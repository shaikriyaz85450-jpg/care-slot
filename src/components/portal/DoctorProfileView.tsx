'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  generateDateOptions,
  generateSlotsForDoctor,
  type DateOption,
  type GeneratedSlot,
} from '@/lib/slot-utils'
import { bookAppointmentAction } from '@/app/actions/booking'

export interface DoctorProfileViewProps {
  user: {
    id: string
    email: string
  } | null
  profile: {
    id: string
    full_name: string
    phone?: string | null
    role: string
  } | null
  doctor: {
    id: string
    specialization: string
    qualification: string
    experience_years: number
    consultation_minutes: number
    clinic_name?: string
    desk_location?: string
    avatar_url?: string
    bio?: string
    departments: {
      id: string
      name: string
      description?: string | null
    }
    profiles: {
      id: string
      full_name: string
    }
    doctor_daily_status?: {
      id?: string
      date?: string
      status: 'available' | 'delayed' | 'on_leave' | 'not_checked_in'
      delay_minutes: number
      note?: string | null
    }[]
  }
  schedules: Array<{
    weekday: number
    start_time: string
    end_time: string
  }>
  initialBookedSlots?: Record<string, string[]>
  upcomingCount?: number
  unreadCount?: number
}

export function DoctorProfileView({
  user,
  profile,
  doctor,
  schedules,
  initialBookedSlots = {},
  upcomingCount = 0,
  unreadCount = 0,
}: DoctorProfileViewProps) {
  const router = useRouter()

  // 1. Generate 5-day Date Rail
  const dateOptions = useMemo<DateOption[]>(() => generateDateOptions(new Date(), 5), [])
  const [selectedDateObj, setSelectedDateObj] = useState<DateOption>(dateOptions[0])

  // Track booked slots per date
  const [bookedSlotsMap, setBookedSlotsMap] = useState<Record<string, string[]>>(initialBookedSlots)

  // Selected time slot
  const [selectedSlot, setSelectedSlot] = useState<GeneratedSlot | null>(null)
  const [consultReason, setConsultReason] = useState(
    'Routine checkup and consultation'
  )

  // Booking states
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [confirmedAppointment, setConfirmedAppointment] = useState<{
    id: string
    doctorName: string
    departmentName: string
    formattedDate: string
    formattedTime: string
    location: string
    avatarUrl?: string
  } | null>(null)

  // Doctor status resolution with Realtime state
  const [dailyStatuses, setDailyStatuses] = useState(doctor.doctor_daily_status || [])

  // Supabase Realtime Subscription for Live Doctor Daily Status and Booked Slots
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`doctor-live-${doctor.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'doctor_daily_status',
          filter: `doctor_id=eq.${doctor.id}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldRecord = payload.old as any
            if (oldRecord?.date) {
              setDailyStatuses((prev) => prev.filter((s) => s.date !== oldRecord.date))
            }
          } else {
            const newRecord = payload.new as any
            if (newRecord?.date) {
              setDailyStatuses((prev) => {
                const idx = prev.findIndex((s) => s.date === newRecord.date)
                if (idx >= 0) {
                  const updated = [...prev]
                  updated[idx] = newRecord
                  return updated
                }
                return [newRecord, ...prev]
              })
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `doctor_id=eq.${doctor.id}`,
        },
        (payload) => {
          const record = (payload.new || payload.old) as any
          const apptDate = record?.appointment_date || record?.date
          const startTime = record?.start_time
          const status = record?.status

          if (!apptDate || !startTime) return

          setBookedSlotsMap((prev) => {
            const currentSlots = prev[apptDate] || []
            if (payload.eventType === 'INSERT' || (payload.eventType === 'UPDATE' && status === 'booked')) {
              if (!currentSlots.includes(startTime)) {
                return { ...prev, [apptDate]: [...currentSlots, startTime] }
              }
            } else if (payload.eventType === 'DELETE' || (payload.eventType === 'UPDATE' && status !== 'booked')) {
              return { ...prev, [apptDate]: currentSlots.filter((t) => t !== startTime) }
            }
            return prev
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [doctor.id])

  const todayStatusRecord = dailyStatuses.find(
    (s) => s.date === dateOptions[0].dateStr
  ) || dailyStatuses[0]
  const todayStatus = todayStatusRecord?.status || 'available'
  const todayDelay = todayStatusRecord?.delay_minutes || 0
  const todayNote = todayStatusRecord?.note || null

  // Is doctor on leave on currently selected date?
  const selectedDateStatusRecord = dailyStatuses.find(
    (s) => s.date === selectedDateObj.dateStr
  )
  const isSelectedDateOnLeave =
    selectedDateStatusRecord?.status === 'on_leave' ||
    (selectedDateObj.dateStr === dateOptions[0].dateStr && todayStatus === 'on_leave')

  // Generate slots for each day in rail to show open counts
  const daySlotCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const d of dateOptions) {
      const isDayOnLeave =
        dailyStatuses.find((s) => s.date === d.dateStr)?.status === 'on_leave' ||
        (d.dateStr === dateOptions[0].dateStr && todayStatus === 'on_leave')

      const { totalAvailable } = generateSlotsForDoctor({
        dateStr: d.dateStr,
        weekday: d.weekday,
        schedules,
        consultationMinutes: doctor.consultation_minutes || 20,
        bookedTimes: bookedSlotsMap[d.dateStr] || [],
        isToday: d.dateStr === dateOptions[0].dateStr,
        isOnLeave: isDayOnLeave,
        leadTimeMinutes: 15,
      })
      counts[d.dateStr] = totalAvailable
    }
    return counts
  }, [dateOptions, schedules, doctor, bookedSlotsMap, todayStatus, dailyStatuses])

  // Active slots for selected date
  const { morningSlots, afternoonSlots } = useMemo(() => {
    return generateSlotsForDoctor({
      dateStr: selectedDateObj.dateStr,
      weekday: selectedDateObj.weekday,
      schedules,
      consultationMinutes: doctor.consultation_minutes || 20,
      bookedTimes: bookedSlotsMap[selectedDateObj.dateStr] || [],
      isToday: selectedDateObj.dateStr === dateOptions[0].dateStr,
      isOnLeave: isSelectedDateOnLeave,
      leadTimeMinutes: 15,
    })
  }, [selectedDateObj, schedules, doctor, bookedSlotsMap, isSelectedDateOnLeave, dateOptions])

  // Doctor Details
  const doctorName = doctor.profiles?.full_name || 'Specialist'
  const deptName = doctor.departments?.name || 'General Medicine'
  const deskLocation = doctor.desk_location || 'Room 402, Heart & Vascular Wing'
  const doctorBio =
    doctor.bio ||
    `Dr. ${doctorName} specializes in ${doctor.specialization.toLowerCase()} care, hypertension management, and preventive clinical wellness. Dedicated to clear patient communication and evidence-based medicine.`

  // Date selection handler
  const handleSelectDate = (opt: DateOption) => {
    setSelectedDateObj(opt)
    setSelectedSlot(null)
    setErrorMessage(null)
  }

  // Slot selection handler
  const handleSelectSlot = (slot: GeneratedSlot) => {
    if (!slot.isAvailable) return
    setSelectedSlot(slot)
    setErrorMessage(null)
  }

  // Booking confirmation handler
  const handleConfirmBooking = async () => {
    if (!user) {
      router.push(`/login?redirectTo=/doctors/${doctor.id}`)
      return
    }

    if (!selectedSlot) {
      setErrorMessage('Please select an available consultation time slot.')
      return
    }

    if (isSelectedDateOnLeave) {
      setErrorMessage('The doctor is on leave on this date. Please select another date.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const result = await bookAppointmentAction({
        doctorId: doctor.id,
        date: selectedDateObj.dateStr,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        reason: consultReason,
      })

      if (result.success && result.appointment) {
        // Mark slot as booked locally
        setBookedSlotsMap((prev) => {
          const existing = prev[selectedDateObj.dateStr] || []
          return {
            ...prev,
            [selectedDateObj.dateStr]: [...existing, selectedSlot.startTime],
          }
        })

        setConfirmedAppointment({
          id: result.appointment.id,
          doctorName: result.appointment.doctorName,
          departmentName: result.appointment.departmentName,
          formattedDate: result.appointment.formattedDate,
          formattedTime: result.appointment.formattedTime,
          location: result.appointment.location,
          avatarUrl: result.appointment.avatarUrl || doctor.avatar_url,
        })
      } else if (result.unauthenticated) {
        router.push(`/login?redirectTo=/doctors/${doctor.id}`)
      } else {
        setErrorMessage(
          result.error ||
            'This slot was just booked or is unavailable. Please choose another time.'
        )
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'A network error occurred. Please try again.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased min-h-screen flex">
      {/* Desktop Sidebar Navigation */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-[260px] bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-50 flex-col justify-between">
        <div className="flex flex-col">
          {/* Logo & Portal Identity */}
          <div className="h-16 px-space-md flex items-center gap-space-sm">
            <img
              alt="CareSlot Hospital Logo"
              className="h-8 w-auto object-contain"
              src="https://lh3.googleusercontent.com/aida/AEtjO1UOgZ_3KeLnkUk1iMA4lUKzfGeORs6HpDoBBDqCVCPYba9FOlRSoW3EyLO2a1zOczQIfWPJDWcKJHAKHQGpEN0WWC5hJZyxjifmVli76zjxIW9t65129bMZJ4N-RdsLmDajM3MwJdg5w4K1nqLKSLC1-uKfJEAqA2-OJlS3047bQe-GBd1MSUFgCTkmsUzKYLww86vqZ5nGOOeB8ePw3IcX3e4TiLyojYXSIPZh77C1oYIpkFPcRdWL562Y"
            />
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm text-primary tracking-tight font-bold">
                CareSlot
              </span>
              <span className="font-label-sm text-label-sm text-secondary">
                Patient Portal
              </span>
            </div>
          </div>

          {/* Hospital Branch */}
          <div className="px-space-md py-space-xs">
            <div className="bg-surface-container-low rounded-lg p-space-xs flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                Branch
              </span>
              <span className="font-label-sm text-label-sm text-on-surface font-semibold">
                Central Hospital
              </span>
            </div>
          </div>

          {/* Sidebar Nav Links */}
          <nav
            className="flex flex-col gap-1 px-space-md mt-space-sm"
            data-active-classes="bg-primary-container text-on-primary-container font-semibold rounded-lg"
          >
            <Link
              className="flex items-center justify-between px-space-sm py-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
              data-path="home"
              href="/"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px]">home</span>
                <span className="font-label-lg text-label-lg">Home</span>
              </div>
            </Link>

            <Link
              className="flex items-center justify-between px-space-sm py-2 rounded-lg bg-primary-container text-on-primary-container font-semibold"
              data-path="find-doctors"
              href="/doctors"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px]">stethoscope</span>
                <span className="font-label-lg text-label-lg">Find Doctors</span>
              </div>
            </Link>

            <Link
              className="flex items-center justify-between px-space-sm py-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
              data-path="my-appointments"
              href="/appointments"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                <span className="font-label-lg text-label-lg">My Appointments</span>
              </div>
              {upcomingCount > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold">
                  {upcomingCount}
                </span>
              )}
            </Link>

            <Link
              className="flex items-center justify-between px-space-sm py-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
              data-path="notifications"
              href="/notifications"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px]">notifications</span>
                <span className="font-label-lg text-label-lg">Notifications</span>
              </div>
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold">
                  {unreadCount}
                </span>
              )}
            </Link>

            <Link
              className="flex items-center justify-between px-space-sm py-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
              data-path="profile"
              href="/profile"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px]">person</span>
                <span className="font-label-lg text-label-lg">Profile</span>
              </div>
            </Link>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-space-md flex flex-col gap-space-sm">
          <div className="flex flex-col gap-1">
            <a
              className="flex items-center gap-3 px-space-sm py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md text-label-md transition-colors"
              data-path="help-support"
              href="#"
            >
              <span className="material-symbols-outlined text-[18px]">help</span>
              <span>Help &amp; Support</span>
            </a>
            {user ? (
              <button
                className="flex items-center gap-3 px-space-sm py-1.5 rounded-lg text-error hover:bg-error-container/30 font-label-md text-label-md transition-colors text-left w-full"
                onClick={async () => {
                  const supabase = createClient()
                  await supabase.auth.signOut()
                  router.push('/login')
                }}
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                <span>Log out</span>
              </button>
            ) : (
              <Link
                className="flex items-center gap-3 px-space-sm py-1.5 rounded-lg text-primary hover:bg-primary-container/20 font-label-md text-label-md transition-colors"
                href="/login"
              >
                <span className="material-symbols-outlined text-[18px]">login</span>
                <span>Sign in</span>
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* Main Page Area */}
      <div className="lg:pl-[260px] flex flex-col min-h-screen flex-1 w-full">
        {/* Top Header */}
        <header className="fixed top-0 left-0 lg:left-[260px] right-0 h-16 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 px-space-md lg:px-space-xl flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <Link
              aria-label="Back to doctors"
              className="lg:hidden p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container focus:outline-none"
              href="/doctors"
            >
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
            </Link>
            <div className="flex items-center gap-space-xs lg:hidden">
              <img
                alt="CareSlot Hospital Logo"
                className="h-7 w-auto object-contain"
                src="https://lh3.googleusercontent.com/aida/AEtjO1UOgZ_3KeLnkUk1iMA4lUKzfGeORs6HpDoBBDqCVCPYba9FOlRSoW3EyLO2a1zOczQIfWPJDWcKJHAKHQGpEN0WWC5hJZyxjifmVli76zjxIW9t65129bMZJ4N-RdsLmDajM3MwJdg5w4K1nqLKSLC1-uKfJEAqA2-OJlS3047bQe-GBd1MSUFgCTkmsUzKYLww86vqZ5nGOOeB8ePw3IcX3e4TiLyojYXSIPZh77C1oYIpkFPcRdWL562Y"
              />
              <span className="font-headline-sm text-headline-sm text-primary font-bold">
                CareSlot
              </span>
            </div>
            <div className="hidden md:flex items-center bg-surface-container-low rounded-lg px-space-sm py-1.5 w-64 lg:w-80 gap-space-xs">
              <span className="material-symbols-outlined text-secondary text-[18px]">
                search
              </span>
              <span className="font-body-sm text-body-sm text-secondary truncate">
                Search doctors, specialties, clinics...
              </span>
            </div>
          </div>

          <div className="flex items-center gap-space-md">
            <Link
              aria-label="Notifications"
              className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors relative"
              href="/notifications"
            >
              <span className="material-symbols-outlined text-[22px]">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error ring-2 ring-surface-container-lowest" />
              )}
            </Link>

            {user ? (
              <div className="flex items-center gap-space-sm pl-space-xs">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="font-label-lg text-label-lg text-on-surface font-semibold leading-tight">
                    {profile?.full_name || 'Patient'}
                  </span>
                  <span className="font-label-sm text-label-sm text-secondary">
                    MRN #CS-{user.id.substring(0, 5).toUpperCase()}
                  </span>
                </div>
                <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs shadow-sm">
                  {profile?.full_name?.substring(0, 2).toUpperCase() || 'PT'}
                </div>
              </div>
            ) : (
              <Link
                className="h-9 px-4 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md transition-colors shadow-sm flex items-center justify-center font-semibold"
                href={`/login?redirectTo=/doctors/${doctor.id}`}
              >
                Sign In
              </Link>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="w-full pt-16 pb-20 lg:pb-0 bg-surface flex-1">
          <div className="flex flex-col w-full">
            {/* Navigation / Context Bar */}
            <div className="px-space-md lg:px-space-xl py-space-sm bg-surface-container-lowest shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2 overflow-x-auto py-1">
                <Link
                  className="font-label-md text-label-md text-secondary hover:text-primary transition-colors flex items-center gap-1"
                  href="/"
                >
                  <span className="material-symbols-outlined text-[16px]">home</span>
                  <span>Home</span>
                </Link>
                <span className="font-label-sm text-label-sm text-outline-variant">/</span>
                <Link
                  className="font-label-md text-label-md text-secondary hover:text-primary transition-colors"
                  href="/doctors"
                >
                  Find Doctors
                </Link>
                <span className="font-label-sm text-label-sm text-outline-variant">/</span>
                <span className="font-label-md text-label-md text-primary font-semibold">
                  Dr. {doctorName}, MD
                </span>
              </div>
              <Link
                className="inline-flex items-center gap-1.5 px-space-sm py-1 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container text-label-md font-label-md transition-colors font-medium"
                href="/doctors"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                <span>Back to Doctors</span>
              </Link>
            </div>

            {/* Main Canvas Container */}
            <div className="max-w-[1240px] w-full mx-auto px-space-md lg:px-space-xl py-space-lg flex flex-col gap-space-lg">
              {/* Doctor Profile Header Card */}
              <div className="bg-surface-container-lowest rounded-xl p-space-md lg:p-space-lg shadow-sm flex flex-col md:flex-row gap-space-md lg:gap-space-lg items-start">
                {/* Portrait Column */}
                <div className="relative shrink-0 mx-auto md:mx-0">
                  <div className="w-32 h-32 lg:w-36 lg:h-36 rounded-xl overflow-hidden shadow-sm bg-surface-container">
                    {doctor.avatar_url ? (
                      <img
                        alt={`Dr. ${doctorName}`}
                        className="w-full h-full object-cover"
                        src={doctor.avatar_url}
                      />
                    ) : (
                      <div className="w-full h-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center font-bold text-3xl">
                        {doctorName.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-surface-container-lowest p-1 rounded-full shadow-sm">
                    <span
                      className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-on-primary"
                      title="Board Certified Specialist"
                    >
                      <span
                        className="material-symbols-outlined text-[18px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        verified
                      </span>
                    </span>
                  </div>
                </div>

                {/* Detail Column */}
                <div className="flex-1 flex flex-col gap-space-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
                          Dr. {doctorName}, MD, {doctor.qualification}
                        </h1>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-container/10 text-primary font-label-sm text-label-sm font-semibold">
                          <span
                            className="material-symbols-outlined text-[14px]"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            check
                          </span>{' '}
                          Verified Specialist
                        </span>
                      </div>
                      <p className="font-label-lg text-label-lg text-primary mt-0.5 font-semibold">
                        {doctor.specialization} • {deptName}
                      </p>
                    </div>
                  </div>

                  <p className="font-body-md text-body-md text-on-surface-variant max-w-3xl mt-1">
                    {doctorBio}
                  </p>

                  {/* Quick Meta Info Pills */}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface-container font-label-md text-label-md text-on-surface font-medium">
                      <span className="material-symbols-outlined text-[16px] text-secondary">
                        workspace_premium
                      </span>
                      <span>{doctor.experience_years}+ Yrs Exp</span>
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface-container font-label-md text-label-md text-on-surface font-medium">
                      <span className="material-symbols-outlined text-[16px] text-secondary">
                        meeting_room
                      </span>
                      <span>{deskLocation}</span>
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface-container font-label-md text-label-md text-on-surface font-medium">
                      <span className="material-symbols-outlined text-[16px] text-secondary">
                        domain
                      </span>
                      <span>In-Person Clinic</span>
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface-container font-label-md text-label-md text-secondary font-medium">
                      <span className="material-symbols-outlined text-[16px]">school</span>
                      <span>{doctor.qualification}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* PROMINENT TODAY'S LIVE CLINIC STATUS BANNER */}
              <div
                className={`rounded-xl p-space-md shadow-sm transition-all duration-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md ${
                  todayStatus === 'available'
                    ? 'bg-tertiary/10'
                    : todayStatus === 'delayed'
                    ? 'bg-secondary-container/40'
                    : todayStatus === 'on_leave'
                    ? 'bg-error-container/40'
                    : 'bg-surface-container-low'
                }`}
                id="live-status-banner"
              >
                <div className="flex items-center gap-space-md">
                  <div className="w-10 h-10 rounded-full bg-surface-container-lowest flex items-center justify-center shrink-0 shadow-sm">
                    {todayStatus === 'available' && (
                      <span
                        className="material-symbols-outlined text-[20px] text-tertiary"
                        id="status-icon"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        fiber_manual_record
                      </span>
                    )}
                    {todayStatus === 'delayed' && (
                      <span
                        className="material-symbols-outlined text-[20px] text-secondary"
                        id="status-icon"
                      >
                        warning
                      </span>
                    )}
                    {todayStatus === 'on_leave' && (
                      <span
                        className="material-symbols-outlined text-[20px] text-error"
                        id="status-icon"
                      >
                        event_busy
                      </span>
                    )}
                    {todayStatus === 'not_checked_in' && (
                      <span
                        className="material-symbols-outlined text-[20px] text-secondary"
                        id="status-icon"
                      >
                        schedule
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="font-headline-sm text-headline-sm text-on-surface font-bold"
                        id="status-primary-text"
                      >
                        {todayStatus === 'available' && 'Live • Available Today'}
                        {todayStatus === 'delayed' &&
                          `Delayed by ~${todayDelay} Mins (${todayNote || 'Behind Schedule'})`}
                        {todayStatus === 'on_leave' && 'Doctor On Leave Today'}
                        {todayStatus === 'not_checked_in' && 'Not Checked In Yet'}
                      </span>
                    </div>
                    <p
                      className="font-body-md text-body-md text-on-surface-variant mt-0.5"
                      id="status-secondary-text"
                    >
                      {todayStatus === 'available' &&
                        'Seeing patients on schedule. Next walk-in consult slots are synchronized below.'}
                      {todayStatus === 'delayed' &&
                        'All remaining afternoon slots adjusted automatically. Push alerts sent to checked-in patients.'}
                      {todayStatus === 'on_leave' &&
                        "Today's queue is locked. Booking forwards directly to upcoming available dates."}
                      {todayStatus === 'not_checked_in' &&
                        'Doctor has not checked in for today’s session yet. Pre-booking slots is active.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* TWO-COLUMN BOOKING INTERFACE */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
                {/* LEFT COLUMN: Date Picker & Time Slot Selector (8 Columns) */}
                <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-space-lg">
                  {/* Date Selection Section */}
                  <div className="bg-surface-container-lowest rounded-xl p-space-md lg:p-space-lg shadow-sm flex flex-col gap-space-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[22px]">
                          calendar_month
                        </span>
                        <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                          1. Choose Date
                        </h2>
                      </div>
                      <span className="font-label-sm text-label-sm text-secondary font-medium">
                        5-Day Availability Rail
                      </span>
                    </div>

                    {/* Horizontal Date Picker Rail */}
                    <div className="grid grid-cols-5 gap-2">
                      {dateOptions.map((opt) => {
                        const isSelected = opt.dateStr === selectedDateObj.dateStr
                        const openCount = daySlotCounts[opt.dateStr] || 0
                        const isDayLeave =
                          doctor.doctor_daily_status?.find((s) => s.date === opt.dateStr)?.status ===
                            'on_leave' ||
                          (opt.dateStr === dateOptions[0].dateStr && todayStatus === 'on_leave')

                        return (
                          <button
                            key={opt.dateStr}
                            className={`date-pill flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-150 ${
                              isSelected
                                ? 'bg-primary text-on-primary shadow-md'
                                : 'bg-surface-container-lowest text-on-surface shadow-sm hover:bg-surface-container'
                            }`}
                            onClick={() => handleSelectDate(opt)}
                            type="button"
                          >
                            <span
                              className={`font-label-sm text-label-sm uppercase tracking-wider ${
                                isSelected ? 'opacity-90' : 'text-secondary'
                              }`}
                            >
                              {opt.topLabel}
                            </span>
                            <span className="font-headline-md text-headline-md my-0.5 font-bold">
                              {opt.dayNumber}
                            </span>
                            <span
                              className={`font-label-sm text-label-sm ${
                                isSelected ? '' : 'text-secondary'
                              }`}
                            >
                              {opt.dayName}
                            </span>
                            <span
                              className={`mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                isSelected
                                  ? 'bg-primary-container text-on-primary-container'
                                  : isDayLeave
                                  ? 'bg-error-container text-on-error-container'
                                  : openCount > 0
                                  ? 'bg-surface-container text-secondary'
                                  : 'bg-surface-container-high text-outline'
                              }`}
                            >
                              {isDayLeave
                                ? 'On Leave'
                                : openCount > 0
                                ? `${openCount} open`
                                : 'Off Duty'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Slot Selection Section */}
                  <div className="bg-surface-container-lowest rounded-xl p-space-md lg:p-space-lg shadow-sm flex flex-col gap-space-md">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[22px]">
                          access_time
                        </span>
                        <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                          2. Select Consultation Time
                        </h2>
                      </div>
                      <span className="font-label-sm text-label-sm text-secondary font-medium">
                        {doctor.consultation_minutes || 20} min slots
                      </span>
                    </div>

                    {/* Notice if doctor is on leave on selected date */}
                    {isSelectedDateOnLeave ? (
                      <div className="p-6 bg-error-container/20 rounded-xl text-center flex flex-col items-center justify-center">
                        <span className="material-symbols-outlined text-error text-[36px] mb-2">
                          event_busy
                        </span>
                        <h4 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                          Doctor is On Leave on this date
                        </h4>
                        <p className="font-body-sm text-body-sm text-secondary mt-1 max-w-md">
                          Consultations are not scheduled on {selectedDateObj.fullLabel}.
                          Please choose another date from the calendar rail above.
                        </p>
                      </div>
                    ) : morningSlots.length === 0 && afternoonSlots.length === 0 ? (
                      <div className="p-6 bg-surface-container-low rounded-xl text-center flex flex-col items-center justify-center">
                        <span className="material-symbols-outlined text-secondary text-[36px] mb-2">
                          calendar_today
                        </span>
                        <h4 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                          No OPD Schedule on this Day
                        </h4>
                        <p className="font-body-sm text-body-sm text-secondary mt-1 max-w-md">
                          The specialist does not have regular OPD hours scheduled for{' '}
                          {selectedDateObj.dayName}s.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Morning Slots Block */}
                        {morningSlots.length > 0 && (
                          <div className="flex flex-col gap-2.5">
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-secondary text-[18px]">
                                wb_sunny
                              </span>
                              <h3 className="font-label-lg text-label-lg text-secondary uppercase tracking-wider font-semibold">
                                Morning (09:00 AM - 12:00 PM)
                              </h3>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                              {morningSlots.map((slot) => {
                                const isSelected =
                                  selectedSlot?.startTime === slot.startTime

                                if (!slot.isAvailable) {
                                  return (
                                    <button
                                      key={slot.startTime}
                                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg font-label-md text-label-md bg-surface-container text-outline line-through cursor-not-allowed opacity-75"
                                      data-booked="true"
                                      disabled
                                      type="button"
                                    >
                                      <span className="material-symbols-outlined text-[14px]">
                                        block
                                      </span>
                                      <span>{slot.formattedTime}</span>
                                    </button>
                                  )
                                }

                                return (
                                  <button
                                    key={slot.startTime}
                                    className={`slot-btn flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-lg font-label-md text-label-md transition-all duration-150 ${
                                      isSelected
                                        ? 'bg-primary text-on-primary shadow-md font-semibold'
                                        : 'bg-surface-container-lowest text-on-surface shadow-sm hover:bg-surface-container-high'
                                    }`}
                                    onClick={() => handleSelectSlot(slot)}
                                    type="button"
                                  >
                                    <span
                                      className={`material-symbols-outlined text-[16px] ${
                                        isSelected ? 'text-on-primary' : 'text-primary'
                                      }`}
                                      style={
                                        isSelected
                                          ? { fontVariationSettings: "'FILL' 1" }
                                          : undefined
                                      }
                                    >
                                      {isSelected ? 'check_circle' : 'schedule'}
                                    </span>
                                    <span>{slot.formattedTime}</span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Afternoon Slots Block */}
                        {afternoonSlots.length > 0 && (
                          <div className="flex flex-col gap-2.5 mt-2">
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-secondary text-[18px]">
                                routine
                              </span>
                              <h3 className="font-label-lg text-label-lg text-secondary uppercase tracking-wider font-semibold">
                                Afternoon (01:00 PM - 05:00 PM)
                              </h3>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                              {afternoonSlots.map((slot) => {
                                const isSelected =
                                  selectedSlot?.startTime === slot.startTime

                                if (!slot.isAvailable) {
                                  return (
                                    <button
                                      key={slot.startTime}
                                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg font-label-md text-label-md bg-surface-container text-outline line-through cursor-not-allowed opacity-75"
                                      data-booked="true"
                                      disabled
                                      type="button"
                                    >
                                      <span className="material-symbols-outlined text-[14px]">
                                        block
                                      </span>
                                      <span>{slot.formattedTime}</span>
                                    </button>
                                  )
                                }

                                return (
                                  <button
                                    key={slot.startTime}
                                    className={`slot-btn flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-lg font-label-md text-label-md transition-all duration-150 ${
                                      isSelected
                                        ? 'bg-primary text-on-primary shadow-md font-semibold'
                                        : 'bg-surface-container-lowest text-on-surface shadow-sm hover:bg-surface-container-high'
                                    }`}
                                    onClick={() => handleSelectSlot(slot)}
                                    type="button"
                                  >
                                    <span
                                      className={`material-symbols-outlined text-[16px] ${
                                        isSelected ? 'text-on-primary' : 'text-primary'
                                      }`}
                                      style={
                                        isSelected
                                          ? { fontVariationSettings: "'FILL' 1" }
                                          : undefined
                                      }
                                    >
                                      {isSelected ? 'check_circle' : 'schedule'}
                                    </span>
                                    <span>{slot.formattedTime}</span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Color & State Legend */}
                        <div className="mt-4 pt-3 flex flex-wrap items-center gap-space-md text-label-sm font-label-sm text-secondary bg-surface-container-low p-3 rounded-lg">
                          <span className="font-semibold text-on-surface">Legend:</span>
                          <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 rounded bg-surface-container-lowest shadow-sm border border-outline-variant" />
                            <span>Available</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 rounded bg-primary" />
                            <span>Selected</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 rounded bg-surface-container opacity-75" />
                            <span>Booked / Past</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* RIGHT COLUMN: Booking Summary & Direct Confirmation (Sticky on Desktop) */}
                <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-space-md sticky top-20">
                  <div className="bg-surface-container-lowest rounded-xl p-space-md lg:p-space-lg shadow-sm flex flex-col gap-space-md">
                    <div className="flex items-center justify-between pb-1">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[22px]">
                          assignment_turned_in
                        </span>
                        <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                          Booking Summary
                        </h2>
                      </div>
                    </div>

                    {/* Summary Line Items */}
                    <div className="flex flex-col gap-space-xs text-body-md font-body-md">
                      {/* Doctor Detail */}
                      <div className="flex items-start justify-between py-2 bg-surface-container-low px-3 rounded-lg">
                        <div className="flex flex-col">
                          <span className="font-label-sm text-label-sm text-secondary uppercase font-semibold">
                            Doctor
                          </span>
                          <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                            Dr. {doctorName}, MD
                          </span>
                          <span className="font-body-sm text-body-sm text-primary font-medium">
                            {deptName}
                          </span>
                        </div>
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-container shrink-0">
                          {doctor.avatar_url ? (
                            <img
                              alt={`Dr. ${doctorName}`}
                              className="w-full h-full object-cover"
                              src={doctor.avatar_url}
                            />
                          ) : (
                            <div className="w-full h-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center font-bold text-xs">
                              {doctorName.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Clinic Desk */}
                      <div className="flex items-center justify-between py-2 px-1">
                        <div className="flex items-center gap-2 text-secondary">
                          <span className="material-symbols-outlined text-[18px]">
                            meeting_room
                          </span>
                          <span>Location</span>
                        </div>
                        <span className="font-label-md text-label-md text-on-surface font-medium">
                          {deskLocation}
                        </span>
                      </div>

                      {/* Date */}
                      <div className="flex items-center justify-between py-2 px-1">
                        <div className="flex items-center gap-2 text-secondary">
                          <span className="material-symbols-outlined text-[18px]">
                            event
                          </span>
                          <span>Date</span>
                        </div>
                        <span
                          className="font-label-md text-label-md text-on-surface font-semibold"
                          id="summary-date"
                        >
                          {selectedDateObj.fullLabel}
                        </span>
                      </div>

                      {/* Time */}
                      <div className="flex items-center justify-between py-2 px-1">
                        <div className="flex items-center gap-2 text-secondary">
                          <span className="material-symbols-outlined text-[18px]">
                            schedule
                          </span>
                          <span>Time Slot</span>
                        </div>
                        <span
                          className={`font-label-md text-label-md font-bold ${
                            selectedSlot ? 'text-primary' : 'text-secondary'
                          }`}
                          id="summary-time"
                        >
                          {selectedSlot
                            ? `${selectedSlot.formattedTime} (Estimated: ${
                                doctor.consultation_minutes || 20
                              }m)`
                            : 'Select a time slot'}
                        </span>
                      </div>

                      {/* Real-time Live Status */}
                      <div className="flex items-center justify-between py-2 px-1">
                        <div className="flex items-center gap-2 text-secondary">
                          <span className="material-symbols-outlined text-[18px]">
                            stream
                          </span>
                          <span>Live State</span>
                        </div>
                        <div
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm font-semibold ${
                            todayStatus === 'available'
                              ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                              : todayStatus === 'delayed'
                              ? 'bg-secondary-container text-on-secondary-container'
                              : todayStatus === 'on_leave'
                              ? 'bg-error-container text-on-error-container'
                              : 'bg-surface-container text-secondary'
                          }`}
                          id="summary-status-pill"
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              todayStatus === 'available'
                                ? 'bg-tertiary'
                                : todayStatus === 'delayed'
                                ? 'bg-secondary'
                                : todayStatus === 'on_leave'
                                ? 'bg-error'
                                : 'bg-outline'
                            }`}
                          />
                          <span>
                            {todayStatus === 'available' && 'On Schedule (No delay)'}
                            {todayStatus === 'delayed' &&
                              `Delayed (+${todayDelay}m offset)`}
                            {todayStatus === 'on_leave' && 'On Leave Today'}
                            {todayStatus === 'not_checked_in' && 'Not Checked In'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Reason Input Form */}
                    <div className="flex flex-col gap-1.5 pt-2">
                      <label
                        className="font-label-md text-label-md text-on-surface flex items-center justify-between font-semibold"
                        htmlFor="consult-reason"
                      >
                        <span>Reason for Consultation</span>
                        <span className="text-secondary font-normal">(Optional)</span>
                      </label>
                      <textarea
                        className="w-full bg-surface-container-low rounded-lg p-2.5 font-body-sm text-body-sm text-on-surface focus:outline-none focus:bg-surface-container transition-colors resize-none placeholder:text-outline"
                        id="consult-reason"
                        onChange={(e) => setConsultReason(e.target.value)}
                        placeholder="e.g. Routine blood pressure checkup, chest discomfort evaluation, medication review..."
                        rows={3}
                        value={consultReason}
                      />
                    </div>

                    {/* Error Alert Display */}
                    {errorMessage && (
                      <div className="p-3 rounded-lg bg-error-container/40 text-on-error-container text-body-sm font-medium flex items-center gap-2">
                        <span className="material-symbols-outlined text-error text-[18px]">
                          error
                        </span>
                        <span>{errorMessage}</span>
                      </div>
                    )}

                    {/* Primary CTA Action */}
                    <button
                      className="w-full py-3.5 px-4 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg hover:bg-primary-container active:scale-[0.99] transition-all duration-150 flex items-center justify-center gap-2 shadow-md font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!selectedSlot || isSelectedDateOnLeave || isSubmitting}
                      onClick={handleConfirmBooking}
                      type="button"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="material-symbols-outlined animate-spin text-[20px]">
                            progress_activity
                          </span>
                          <span>Confirming Slot...</span>
                        </>
                      ) : (
                        <>
                          <span>Confirm Booking</span>
                          <span className="material-symbols-outlined text-[20px]">
                            arrow_forward
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* APPOINTMENT CONFIRMATION SUCCESS MODAL / OVERLAY */}
            {confirmedAppointment && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-inverse-surface/60 backdrop-blur-sm"
                id="confirm-modal"
              >
                <div className="bg-surface-container-lowest rounded-xl max-w-md w-full p-space-lg shadow-xl flex flex-col items-center text-center gap-space-md animate-in fade-in zoom-in duration-200">
                  {/* Green Success Icon */}
                  <div className="w-16 h-16 rounded-full bg-tertiary-fixed flex items-center justify-center text-on-tertiary-fixed shadow-sm">
                    <span
                      className="material-symbols-outlined text-[36px]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      check_circle
                    </span>
                  </div>

                  {/* Headline */}
                  <div className="flex flex-col gap-1">
                    <h3 className="font-headline-lg text-headline-lg text-on-surface font-bold">
                      Appointment Confirmed!
                    </h3>
                    <p className="font-body-sm text-body-sm text-secondary">
                      Your slot has been synchronized with Dr. {confirmedAppointment.doctorName}
                      &apos;s live clinic queue.
                    </p>
                  </div>

                  {/* Confirmation Ticket Card */}
                  <div className="w-full bg-surface-container-low rounded-xl p-space-md flex flex-col gap-2.5 text-left">
                    <div className="flex items-center justify-between pb-2">
                      <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">
                        Appointment ID
                      </span>
                      <span className="font-label-md text-label-md text-primary font-bold">
                        #CS-{confirmedAppointment.id.slice(0, 8).toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center gap-space-sm pt-1">
                      <div className="w-10 h-10 rounded-full bg-surface-container overflow-hidden shrink-0">
                        {confirmedAppointment.avatarUrl ? (
                          <img
                            alt={`Dr. ${confirmedAppointment.doctorName}`}
                            className="w-full h-full object-cover"
                            src={confirmedAppointment.avatarUrl}
                          />
                        ) : (
                          <div className="w-full h-full bg-primary text-on-primary flex items-center justify-center font-bold text-xs">
                            {confirmedAppointment.doctorName.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-label-lg text-label-lg text-on-surface font-semibold">
                          Dr. {confirmedAppointment.doctorName}, MD
                        </div>
                        <div className="font-label-sm text-label-sm text-secondary">
                          {confirmedAppointment.departmentName}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div className="bg-surface-container-lowest p-2 rounded-lg">
                        <span className="font-label-sm text-label-sm text-secondary block font-medium">
                          Date &amp; Time
                        </span>
                        <span
                          className="font-label-md text-label-md text-on-surface font-bold"
                          id="modal-confirmed-time"
                        >
                          {confirmedAppointment.formattedDate} • {confirmedAppointment.formattedTime}
                        </span>
                      </div>
                      <div className="bg-surface-container-lowest p-2 rounded-lg">
                        <span className="font-label-sm text-label-sm text-secondary block font-medium">
                          Location
                        </span>
                        <span className="font-label-md text-label-md text-on-surface font-bold">
                          {confirmedAppointment.location}
                        </span>
                      </div>
                    </div>

                    <div className="bg-surface-container-lowest p-2.5 rounded-lg flex items-center gap-2 mt-1">
                      <span className="w-2 h-2 rounded-full bg-tertiary shrink-0 animate-pulse" />
                      <span className="font-label-sm text-label-sm text-on-surface">
                        Queue Live Tracking will become active 1 hr prior to your slot.
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="w-full flex flex-col gap-2 pt-1">
                    <Link
                      className="w-full py-3 px-4 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg text-center hover:bg-primary-container transition-colors shadow-sm font-semibold"
                      href="/appointments"
                    >
                      View My Appointments
                    </Link>
                    <Link
                      className="w-full py-2.5 px-4 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md text-center hover:bg-surface-container-high transition-colors font-medium"
                      href="/doctors"
                    >
                      Back to Doctors
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <nav
          className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-container-lowest shadow-[0_-1px_8px_rgba(0,0,0,0.04)] z-40 flex items-center justify-around px-2"
          data-active-classes="text-primary font-semibold"
        >
          <Link
            className="flex flex-col items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors py-1 flex-1"
            data-path="home"
            href="/"
          >
            <span className="material-symbols-outlined text-[22px]">home</span>
            <span className="font-label-sm text-label-sm mt-0.5">Home</span>
          </Link>

          <Link
            aria-current="page"
            className="flex flex-col items-center justify-center hover:text-on-surface transition-colors py-1 flex-1 bg-primary-container text-on-primary-container font-semibold rounded-lg"
            data-path="find-doctors"
            href="/doctors"
          >
            <span className="material-symbols-outlined text-[22px]">stethoscope</span>
            <span className="font-label-sm text-label-sm mt-0.5">Doctors</span>
          </Link>

          <Link
            className="flex flex-col items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors py-1 flex-1 relative"
            data-path="my-appointments"
            href="/appointments"
          >
            <span className="material-symbols-outlined text-[22px]">calendar_today</span>
            <span className="font-label-sm text-label-sm mt-0.5">Bookings</span>
            {upcomingCount > 0 && (
              <span className="absolute top-1 right-5 w-4 h-4 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] flex items-center justify-center font-bold">
                {upcomingCount}
              </span>
            )}
          </Link>

          <Link
            className="flex flex-col items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors py-1 flex-1 relative"
            data-path="notifications"
            href="/notifications"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            <span className="font-label-sm text-label-sm mt-0.5">Alerts</span>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-5 w-4 h-4 rounded-full bg-error-container text-on-error-container font-label-sm text-[10px] flex items-center justify-center font-bold">
                {unreadCount}
              </span>
            )}
          </Link>

          <Link
            className="flex flex-col items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors py-1 flex-1"
            data-path="profile"
            href="/profile"
          >
            <span className="material-symbols-outlined text-[22px]">person</span>
            <span className="font-label-sm text-label-sm mt-0.5">Profile</span>
          </Link>
        </nav>
      </div>
    </div>
  )
}
