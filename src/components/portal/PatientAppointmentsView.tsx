'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatTime } from '@/lib/utils'
import {
  generateDateOptions,
  generateSlotsForDoctor,
  type DateOption,
  type GeneratedSlot,
} from '@/lib/slot-utils'
import {
  cancelAppointmentAction,
  rescheduleAppointmentAction,
} from '@/app/actions/appointments'

export interface PatientAppointment {
  id: string
  patient_id: string
  doctor_id: string
  appointment_date: string
  start_time: string
  end_time: string
  status: 'booked' | 'cancelled' | 'completed' | 'no_show'
  reason: string | null
  doctor: {
    id: string
    specialization: string
    qualification: string
    experience_years: number
    consultation_minutes: number
    clinic_name?: string
    desk_location?: string
    avatar_url?: string
    initials?: string
    profiles: {
      id: string
      full_name: string
    }
    departments: {
      id: string
      name: string
    }
    doctor_daily_status?: {
      status: 'available' | 'delayed' | 'on_leave' | 'not_checked_in'
      delay_minutes: number
      note?: string | null
    }[]
    doctor_schedules?: {
      weekday: number
      start_time: string
      end_time: string
    }[]
  }
}

export interface PatientAppointmentsViewProps {
  user: {
    id: string
    email: string
  }
  profile: {
    id: string
    full_name: string
    phone?: string | null
    role: string
  } | null
  initialAppointments: PatientAppointment[]
  unreadCount?: number
}

export function PatientAppointmentsView({
  user,
  profile,
  initialAppointments,
  unreadCount = 0,
}: PatientAppointmentsViewProps) {
  const router = useRouter()

  // Tab State: 'upcoming' | 'history'
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming')

  // Appointments state
  const [appointments, setAppointments] = useState<PatientAppointment[]>(initialAppointments)

  // Details Modal State
  const [selectedDetailsAppt, setSelectedDetailsAppt] = useState<PatientAppointment | null>(null)

  // Cancel Modal State
  const [apptToCancel, setApptToCancel] = useState<PatientAppointment | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  // Reschedule Modal State
  const [apptToReschedule, setApptToReschedule] = useState<PatientAppointment | null>(null)
  const rescheduleDateOptions = useMemo<DateOption[]>(() => generateDateOptions(new Date(), 5), [])
  const [selectedRescheduleDate, setSelectedRescheduleDate] = useState<DateOption>(rescheduleDateOptions[0])
  const [selectedRescheduleSlot, setSelectedRescheduleSlot] = useState<GeneratedSlot | null>(null)
  const [isRescheduling, setIsRescheduling] = useState(false)
  const [rescheduleError, setRescheduleError] = useState<string | null>(null)
  const [rescheduleSuccessAlert, setRescheduleSuccessAlert] = useState<string | null>(null)

  // Segregate upcoming vs past appointments
  const todayStr = new Date().toISOString().split('T')[0]

  const { upcomingList, pastList } = useMemo(() => {
    const upcoming: PatientAppointment[] = []
    const past: PatientAppointment[] = []

    for (const appt of appointments) {
      const isFutureOrToday = appt.appointment_date >= todayStr
      if (appt.status === 'booked' && isFutureOrToday) {
        upcoming.push(appt)
      } else {
        past.push(appt)
      }
    }

    // Sort upcoming ascending (nearest first)
    upcoming.sort((a, b) => {
      const diff = a.appointment_date.localeCompare(b.appointment_date)
      if (diff !== 0) return diff
      return a.start_time.localeCompare(b.start_time)
    })

    // Sort past descending (newest first)
    past.sort((a, b) => {
      const diff = b.appointment_date.localeCompare(a.appointment_date)
      if (diff !== 0) return diff
      return b.start_time.localeCompare(a.start_time)
    })

    return { upcomingList: upcoming, pastList: past }
  }, [appointments, todayStr])

  // Generated slots for the doctor in reschedule modal
  const rescheduleSlots = useMemo(() => {
    if (!apptToReschedule) return { morningSlots: [], afternoonSlots: [] }

    const doctor = apptToReschedule.doctor
    const schedules = doctor.doctor_schedules && doctor.doctor_schedules.length > 0
      ? doctor.doctor_schedules
      : [1, 2, 3, 4, 5].map((w) => ({ weekday: w, start_time: '09:00:00', end_time: '17:00:00' }))

    const isDayOnLeave = doctor.doctor_daily_status?.some(
      (s) => s.status === 'on_leave'
    ) || false

    return generateSlotsForDoctor({
      dateStr: selectedRescheduleDate.dateStr,
      weekday: selectedRescheduleDate.weekday,
      schedules,
      consultationMinutes: doctor.consultation_minutes || 20,
      bookedTimes: [], // Will be verified during atomic update
      isToday: selectedRescheduleDate.dateStr === todayStr,
      isOnLeave: isDayOnLeave,
      leadTimeMinutes: 15,
    })
  }, [apptToReschedule, selectedRescheduleDate, todayStr])

  // Cancellation Execution Handler
  const handleExecuteCancel = async () => {
    if (!apptToCancel) return

    setIsCancelling(true)
    setCancelError(null)

    try {
      const result = await cancelAppointmentAction({
        appointmentId: apptToCancel.id,
        reason: 'Cancelled by patient',
      })

      if (result.success) {
        setAppointments((prev) =>
          prev.map((a) =>
            a.id === apptToCancel.id ? { ...a, status: 'cancelled' } : a
          )
        )
        setApptToCancel(null)
      } else {
        setCancelError(result.error || 'Failed to cancel appointment. Please try again.')
      }
    } catch (err: any) {
      setCancelError(err?.message || 'A network error occurred.')
    } finally {
      setIsCancelling(false)
    }
  }

  // Reschedule Execution Handler
  const handleExecuteReschedule = async () => {
    if (!apptToReschedule || !selectedRescheduleSlot) {
      setRescheduleError('Please choose an available consultation time slot.')
      return
    }

    setIsRescheduling(true)
    setRescheduleError(null)

    try {
      const result = await rescheduleAppointmentAction({
        appointmentId: apptToReschedule.id,
        newDate: selectedRescheduleDate.dateStr,
        newStartTime: selectedRescheduleSlot.startTime,
        newEndTime: selectedRescheduleSlot.endTime,
      })

      if (result.success && result.appointment) {
        setAppointments((prev) =>
          prev.map((a) =>
            a.id === apptToReschedule.id
              ? {
                  ...a,
                  appointment_date: result.appointment!.newDate,
                  start_time: result.appointment!.newStartTime,
                }
              : a
          )
        )
        setRescheduleSuccessAlert(
          `Appointment rescheduled to ${result.appointment.formattedDate} at ${result.appointment.formattedTime}.`
        )
        setApptToReschedule(null)
      } else {
        setRescheduleError(result.error || 'Failed to reschedule. Slot might have been booked.')
      }
    } catch (err: any) {
      setRescheduleError(err?.message || 'A network error occurred.')
    } finally {
      setIsRescheduling(false)
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
              className="flex items-center justify-between px-space-sm py-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
              data-path="find-doctors"
              href="/doctors"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px]">stethoscope</span>
                <span className="font-label-lg text-label-lg">Find Doctors</span>
              </div>
            </Link>

            <Link
              className="flex items-center justify-between px-space-sm py-2 rounded-lg bg-primary-container text-on-primary-container font-semibold"
              data-path="my-appointments"
              href="/appointments"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                <span className="font-label-lg text-label-lg">My Appointments</span>
              </div>
              {upcomingList.length > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold">
                  {upcomingList.length}
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
          </div>
        </div>
      </aside>

      {/* Main Page Area */}
      <div className="lg:pl-[260px] flex flex-col min-h-screen flex-1 w-full">
        {/* Top Header */}
        <header className="fixed top-0 left-0 lg:left-[260px] right-0 h-16 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 px-space-md lg:px-space-xl flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <button
              aria-label="Toggle Mobile Menu"
              className="lg:hidden p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container focus:outline-none"
            >
              <span className="material-symbols-outlined text-[24px]">menu</span>
            </button>
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
          </div>
        </header>

        {/* Main Content Area */}
        <main className="w-full pt-16 pb-20 lg:pb-0 bg-surface flex-1">
          <div className="flex flex-col w-full">
            <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
              {/* Top Breadcrumb & Page Title Header */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <nav
                    aria-label="Breadcrumb"
                    className="flex items-center gap-1.5 text-secondary font-label-sm text-label-sm"
                  >
                    <Link
                      className="hover:text-primary transition-colors flex items-center gap-1"
                      href="/"
                    >
                      <span className="material-symbols-outlined text-[16px]">home</span>
                      <span>Home</span>
                    </Link>
                    <span className="material-symbols-outlined text-[14px] text-outline">
                      chevron_right
                    </span>
                    <span className="text-on-surface font-semibold">My Appointments</span>
                  </nav>
                  <h1 className="font-headline-lg text-headline-lg text-on-surface mt-1 font-bold">
                    My Appointments
                  </h1>
                  <p className="font-body-md text-body-md text-secondary mt-0.5">
                    View and manage your upcoming and previous consultations with Central Hospital specialists.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg transition-colors shadow-sm font-semibold"
                    href="/doctors"
                  >
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    <span>Book New Appointment</span>
                  </Link>
                </div>
              </div>

              {/* Success Alert Banner (e.g. after reschedule) */}
              {rescheduleSuccessAlert && (
                <div className="p-4 rounded-xl bg-tertiary-fixed text-on-tertiary-fixed font-body-sm flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-tertiary text-[20px]">
                      check_circle
                    </span>
                    <span className="font-semibold">{rescheduleSuccessAlert}</span>
                  </div>
                  <button
                    className="text-on-tertiary-fixed hover:opacity-75"
                    onClick={() => setRescheduleSuccessAlert(null)}
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              )}

              {/* Tabs Filter Bar */}
              <div className="flex items-center justify-between border-b-0 pb-1">
                <div className="flex items-center gap-2 p-1 bg-surface-container-low rounded-xl">
                  <button
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-label-lg text-label-lg transition-all ${
                      activeTab === 'upcoming'
                        ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                        : 'text-secondary hover:text-on-surface hover:bg-surface-container font-medium'
                    }`}
                    id="tab-btn-upcoming"
                    onClick={() => setActiveTab('upcoming')}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                    <span>Upcoming</span>
                    <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold">
                      {upcomingList.length}
                    </span>
                  </button>

                  <button
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-label-lg text-label-lg transition-all ${
                      activeTab === 'history'
                        ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                        : 'text-secondary hover:text-on-surface hover:bg-surface-container font-medium'
                    }`}
                    id="tab-btn-history"
                    onClick={() => setActiveTab('history')}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">history</span>
                    <span>Past &amp; History</span>
                    <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-secondary font-label-sm text-label-sm font-semibold">
                      {pastList.length}
                    </span>
                  </button>
                </div>
              </div>

              {/* TAB 1: UPCOMING APPOINTMENTS */}
              {activeTab === 'upcoming' && (
                <div className="space-y-4" id="section-upcoming">
                  {upcomingList.length === 0 ? (
                    /* Empty State View */
                    <div
                      className="bg-surface-container-lowest rounded-xl p-10 md:p-14 text-center shadow-sm"
                      id="section-empty"
                    >
                      <div className="max-w-md mx-auto flex flex-col items-center">
                        <div className="w-20 h-20 rounded-full bg-surface-container-low flex items-center justify-center mb-5 text-primary">
                          <span className="material-symbols-outlined text-[40px]">
                            calendar_today
                          </span>
                        </div>
                        <h2 className="font-headline-md text-headline-md text-on-surface font-semibold">
                          No Upcoming Appointments
                        </h2>
                        <p className="font-body-md text-body-md text-secondary mt-2 mb-6">
                          You don&apos;t have any appointments scheduled right now. Browse available specialists to book your next consultation.
                        </p>
                        <Link
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg transition-colors shadow-sm font-semibold"
                          href="/doctors"
                        >
                          <span className="material-symbols-outlined text-[20px]">stethoscope</span>
                          <span>Find a Doctor →</span>
                        </Link>
                      </div>
                    </div>
                  ) : (
                    upcomingList.map((appt) => {
                      const doc = appt.doctor
                      const doctorName = doc.profiles?.full_name || 'Specialist'
                      const deptName = doc.departments?.name || 'General Medicine'
                      const deskLoc = doc.desk_location || 'Consultation Desk'
                      const formattedDate = formatDate(appt.appointment_date)
                      const formattedTime = formatTime(appt.start_time)
                      const docDailyStatus = doc.doctor_daily_status?.[0]?.status || 'available'
                      const delayMinutes = doc.doctor_daily_status?.[0]?.delay_minutes || 0

                      return (
                        <div
                          key={appt.id}
                          className="bg-surface-container-lowest rounded-xl p-5 md:p-6 shadow-sm transition-shadow hover:shadow-md"
                          id={`card-upcoming-${appt.id}`}
                        >
                          {/* Top Status Row */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-sm text-label-sm font-semibold">
                                <span className="w-2 h-2 rounded-full bg-tertiary" />
                                Confirmed
                              </span>

                              {/* CareSlot Live Doctor Tracker Badge */}
                              {docDailyStatus === 'available' && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm font-semibold">
                                  <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                                  Doctor is Live • On Schedule
                                </span>
                              )}
                              {docDailyStatus === 'delayed' && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold">
                                  <span className="w-2 h-2 rounded-full bg-secondary" />
                                  Doctor Delayed (~{delayMinutes}m)
                                </span>
                              )}
                              {docDailyStatus === 'on_leave' && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold">
                                  <span className="w-2 h-2 rounded-full bg-error" />
                                  Doctor on Leave
                                </span>
                              )}
                              {docDailyStatus === 'not_checked_in' && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-secondary font-label-sm text-label-sm font-semibold">
                                  <span className="material-symbols-outlined text-[14px]">
                                    event_available
                                  </span>
                                  Regular Clinic Hours
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Main Card Body */}
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start pt-1">
                            {/* Doctor Profile & Clinical Details */}
                            <div className="lg:col-span-8 flex flex-col sm:flex-row items-start gap-4">
                              {doc.avatar_url ? (
                                <img
                                  alt={`Dr. ${doctorName}`}
                                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover shrink-0 bg-surface-container shadow-sm"
                                  src={doc.avatar_url}
                                />
                              ) : (
                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-primary-fixed text-on-primary-fixed flex items-center justify-center font-bold text-xl shrink-0 shadow-sm">
                                  {doc.initials || doctorName.substring(0, 2).toUpperCase()}
                                </div>
                              )}

                              <div className="flex-1 space-y-2">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                                      Dr. {doctorName}, MD, {doc.qualification}
                                    </h2>
                                    <span
                                      className="material-symbols-outlined text-primary text-[20px]"
                                      style={{ fontVariationSettings: "'FILL' 1" }}
                                      title="Central Hospital Board Certified"
                                    >
                                      verified
                                    </span>
                                  </div>
                                  <p className="font-body-sm text-body-sm text-secondary font-medium">
                                    {doc.specialization} • {deptName}
                                  </p>
                                </div>

                                {/* Time & Room Details Block */}
                                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-on-surface">
                                  <div className="flex items-center gap-1.5 font-label-md text-label-md">
                                    <span className="material-symbols-outlined text-[18px] text-primary">
                                      event
                                    </span>
                                    <span className="font-bold text-on-surface">
                                      {formattedDate}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 font-label-md text-label-md">
                                    <span className="material-symbols-outlined text-[18px] text-primary">
                                      schedule
                                    </span>
                                    <span>
                                      {formattedTime} ({doc.consultation_minutes || 20} min)
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 font-label-md text-label-md text-secondary">
                                    <span className="material-symbols-outlined text-[18px] text-secondary">
                                      room
                                    </span>
                                    <span>{deskLoc}</span>
                                  </div>
                                </div>

                                {/* Purpose / Notes */}
                                {appt.reason && (
                                  <div className="bg-surface-container-low rounded-lg p-3">
                                    <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider block font-semibold">
                                      Reason for Visit
                                    </span>
                                    <p className="font-body-sm text-body-sm text-on-surface mt-0.5">
                                      {appt.reason}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Actions Column */}
                            <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col justify-end gap-2.5 w-full lg:h-full lg:justify-center">
                              <button
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high font-label-lg text-label-lg transition-colors font-medium"
                                onClick={() => setSelectedDetailsAppt(appt)}
                                type="button"
                              >
                                <span className="material-symbols-outlined text-[18px]">info</span>
                                <span>View Details</span>
                              </button>
                              <button
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg transition-colors shadow-sm font-semibold"
                                onClick={() => {
                                  setApptToReschedule(appt)
                                  setSelectedRescheduleSlot(null)
                                  setRescheduleError(null)
                                }}
                                type="button"
                              >
                                <span className="material-symbols-outlined text-[18px]">update</span>
                                <span>Reschedule</span>
                              </button>
                              <button
                                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-error hover:bg-error-container/30 font-label-md text-label-md transition-colors font-medium"
                                onClick={() => {
                                  setApptToCancel(appt)
                                  setCancelError(null)
                                }}
                                type="button"
                              >
                                <span className="material-symbols-outlined text-[16px]">cancel</span>
                                <span>Cancel Appointment</span>
                              </button>
                            </div>
                          </div>

                          {/* Live Status Sub-Bar */}
                          <div className="mt-4 pt-3 flex items-center gap-2 text-on-surface-variant font-body-sm text-body-sm bg-surface-container-low px-3 py-2 rounded-lg">
                            <span
                              className="material-symbols-outlined text-[18px] text-tertiary"
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              check_circle
                            </span>
                            <span>
                              {docDailyStatus === 'available'
                                ? 'Doctor is on duty. Central Hospital check-in desk suggests arriving 10 minutes early.'
                                : docDailyStatus === 'delayed'
                                ? `Clinic is running ~${delayMinutes} min behind. Please check live alerts before departure.`
                                : 'Central Hospital clinic front desk is available for assistance.'}
                            </span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {/* TAB 2: PAST & CANCELLED HISTORY */}
              {activeTab === 'history' && (
                <div className="space-y-4" id="section-history">
                  {pastList.length === 0 ? (
                    /* Empty State View for History */
                    <div className="bg-surface-container-lowest rounded-xl p-10 md:p-14 text-center shadow-sm">
                      <div className="max-w-md mx-auto flex flex-col items-center">
                        <div className="w-20 h-20 rounded-full bg-surface-container-low flex items-center justify-center mb-5 text-secondary">
                          <span className="material-symbols-outlined text-[40px]">history</span>
                        </div>
                        <h2 className="font-headline-md text-headline-md text-on-surface font-semibold">
                          No Past Appointments
                        </h2>
                        <p className="font-body-md text-body-md text-secondary mt-2 mb-6">
                          You do not have any past or cancelled consultations in your medical visit record.
                        </p>
                      </div>
                    </div>
                  ) : (
                    pastList.map((appt) => {
                      const doc = appt.doctor
                      const doctorName = doc.profiles?.full_name || 'Specialist'
                      const deptName = doc.departments?.name || 'General Medicine'
                      const deskLoc = doc.desk_location || 'Consultation Desk'
                      const formattedDate = formatDate(appt.appointment_date)
                      const formattedTime = formatTime(appt.start_time)
                      const isCancelled = appt.status === 'cancelled'

                      return (
                        <div
                          key={appt.id}
                          className="bg-surface-container-lowest rounded-xl p-5 md:p-6 shadow-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
                            <div className="flex items-center gap-2">
                              {isCancelled ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold">
                                  <span className="w-2 h-2 rounded-full bg-error" />
                                  Cancelled
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high text-secondary font-label-sm text-label-sm font-semibold">
                                  <span className="w-2 h-2 rounded-full bg-secondary" />
                                  Completed
                                </span>
                              )}
                              <span className="font-body-sm text-body-sm text-secondary">
                                {isCancelled
                                  ? `Cancelled (${appt.reason || 'Schedule conflict'})`
                                  : 'Consultation concluded'}
                              </span>
                            </div>
                            <span className="text-secondary font-label-sm text-label-sm">
                              {formattedDate}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                            <div className="lg:col-span-8 flex flex-col sm:flex-row items-start gap-4">
                              {doc.avatar_url ? (
                                <img
                                  alt={`Dr. ${doctorName}`}
                                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover shrink-0 bg-surface-container shadow-sm"
                                  src={doc.avatar_url}
                                />
                              ) : (
                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-surface-container-high text-primary flex items-center justify-center font-headline-md text-headline-md font-bold shrink-0 shadow-sm">
                                  {doc.initials || doctorName.substring(0, 2).toUpperCase()}
                                </div>
                              )}

                              <div className="flex-1 space-y-2">
                                <div>
                                  <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                                    Dr. {doctorName}, MD
                                  </h2>
                                  <p className="font-body-sm text-body-sm text-secondary font-medium">
                                    {doc.specialization} • {deptName}
                                  </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-secondary">
                                  <div className="flex items-center gap-1.5 font-label-md text-label-md">
                                    <span className="material-symbols-outlined text-[18px]">
                                      event
                                    </span>
                                    <span>{formattedDate}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 font-label-md text-label-md">
                                    <span className="material-symbols-outlined text-[18px]">
                                      schedule
                                    </span>
                                    <span>
                                      {formattedTime} ({doc.consultation_minutes || 20} min)
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 font-label-md text-label-md">
                                    <span className="material-symbols-outlined text-[18px]">
                                      room
                                    </span>
                                    <span>{deskLoc}</span>
                                  </div>
                                </div>

                                {appt.reason && (
                                  <div className="bg-surface-container-low rounded-lg p-3">
                                    <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider block font-semibold">
                                      {isCancelled ? 'Cancellation Note' : 'Consultation Reason'}
                                    </span>
                                    <p className="font-body-sm text-body-sm text-on-surface mt-0.5">
                                      {appt.reason}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col justify-end gap-2.5 w-full lg:h-full lg:justify-center">
                              <button
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high font-label-lg text-label-lg transition-colors font-medium"
                                onClick={() => setSelectedDetailsAppt(appt)}
                                type="button"
                              >
                                <span className="material-symbols-outlined text-[18px]">info</span>
                                <span>View Details</span>
                              </button>
                              <Link
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg transition-colors shadow-sm font-semibold"
                                href={isCancelled ? '/doctors' : `/doctors/${doc.id}`}
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  {isCancelled ? 'search' : 'repeat'}
                                </span>
                                <span>{isCancelled ? 'Find Another Doctor' : 'Book Again'}</span>
                              </Link>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>

            {/* MODAL: APPOINTMENT DETAILS */}
            {selectedDetailsAppt && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-none"
                id="modal-details"
              >
                <div className="bg-surface-container-lowest rounded-xl max-w-lg w-full p-6 shadow-xl space-y-5 animate-in fade-in zoom-in duration-150">
                  <div className="flex items-center justify-between pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                      </div>
                      <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                        Appointment Details
                      </h2>
                    </div>
                    <button
                      className="p-1 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
                      onClick={() => setSelectedDetailsAppt(null)}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                  </div>

                  <div className="space-y-3.5 text-body-sm">
                    <div className="bg-surface-container-low p-3.5 rounded-lg space-y-1">
                      <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">
                        Doctor &amp; Department
                      </span>
                      <p className="font-label-lg text-label-lg text-on-surface font-semibold" id="modal-doctor-name">
                        Dr. {selectedDetailsAppt.doctor.profiles?.full_name}, MD
                      </p>
                      <p className="text-secondary" id="modal-specialty">
                        {selectedDetailsAppt.doctor.specialization} • {selectedDetailsAppt.doctor.departments?.name}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-surface-container-low p-3.5 rounded-lg space-y-1">
                        <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">
                          Date &amp; Time
                        </span>
                        <p className="font-label-md text-label-md text-on-surface font-semibold" id="modal-datetime">
                          {formatDate(selectedDetailsAppt.appointment_date)} • {formatTime(selectedDetailsAppt.start_time)}
                        </p>
                      </div>
                      <div className="bg-surface-container-low p-3.5 rounded-lg space-y-1">
                        <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">
                          Location / Clinic
                        </span>
                        <p className="font-label-md text-label-md text-on-surface font-semibold" id="modal-location">
                          {selectedDetailsAppt.doctor.desk_location || 'Consultation Desk'}
                        </p>
                      </div>
                    </div>

                    <div className="bg-surface-container-low p-3.5 rounded-lg space-y-1">
                      <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">
                        Reason for Consultation
                      </span>
                      <p className="font-body-sm text-body-sm text-on-surface" id="modal-reason">
                        {selectedDetailsAppt.reason || 'General medical consultation'}
                      </p>
                    </div>

                    <div className="bg-surface-container-low p-3.5 rounded-lg flex items-center justify-between">
                      <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">
                        Booking Status
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${
                          selectedDetailsAppt.status === 'booked'
                            ? 'bg-secondary-container text-on-secondary-container'
                            : selectedDetailsAppt.status === 'cancelled'
                            ? 'bg-error-container text-on-error-container'
                            : 'bg-surface-container text-secondary'
                        }`}
                        id="modal-status"
                      >
                        {selectedDetailsAppt.status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      className="px-4 py-2 rounded-lg bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors font-medium"
                      onClick={() => setSelectedDetailsAppt(null)}
                      type="button"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL: CANCEL CONFIRMATION */}
            {apptToCancel && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-none"
                id="modal-cancel"
              >
                <div className="bg-surface-container-lowest rounded-xl max-w-md w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in duration-150">
                  <div className="flex items-center gap-3 text-error">
                    <div className="w-10 h-10 rounded-full bg-error-container text-on-error-container flex items-center justify-center">
                      <span className="material-symbols-outlined text-[24px]">warning</span>
                    </div>
                    <div>
                      <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                        Cancel Appointment?
                      </h2>
                      <p className="font-body-sm text-body-sm text-secondary">
                        This action cannot be undone.
                      </p>
                    </div>
                  </div>

                  <p className="font-body-sm text-body-sm text-on-surface">
                    Are you sure you want to cancel your consultation with{' '}
                    <strong id="cancel-doctor-name">
                      Dr. {apptToCancel.doctor.profiles?.full_name}
                    </strong>{' '}
                    scheduled for{' '}
                    <span className="font-semibold" id="cancel-datetime">
                      {formatDate(apptToCancel.appointment_date)} at{' '}
                      {formatTime(apptToCancel.start_time)}
                    </span>
                    ?
                  </p>

                  <div className="bg-surface-container-low p-3 rounded-lg text-body-sm text-secondary">
                    Notice: Cancelling releases this slot to other hospital patients waiting on the Central Hospital waitlist.
                  </div>

                  {cancelError && (
                    <div className="p-3 bg-error-container/40 text-on-error-container rounded-lg text-body-sm font-medium">
                      {cancelError}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      className="px-4 py-2 rounded-lg bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors font-medium disabled:opacity-50"
                      disabled={isCancelling}
                      onClick={() => setApptToCancel(null)}
                      type="button"
                    >
                      Keep Appointment
                    </button>
                    <button
                      className="px-4 py-2 rounded-lg bg-error text-on-error font-label-md text-label-md font-semibold hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
                      disabled={isCancelling}
                      onClick={handleExecuteCancel}
                      type="button"
                    >
                      {isCancelling ? 'Cancelling...' : 'Yes, Cancel Slot'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL: RESCHEDULE APPOINTMENT */}
            {apptToReschedule && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-none"
                id="modal-reschedule"
              >
                <div className="bg-surface-container-lowest rounded-xl max-w-lg w-full p-6 shadow-xl space-y-5 animate-in fade-in zoom-in duration-150">
                  <div className="flex items-center justify-between pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-secondary-container flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-[20px]">update</span>
                      </div>
                      <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                        Reschedule Appointment
                      </h2>
                    </div>
                    <button
                      className="p-1 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
                      onClick={() => setApptToReschedule(null)}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                  </div>

                  <p className="font-body-sm text-body-sm text-secondary">
                    Select a new date and time slot for your appointment with{' '}
                    <strong className="text-on-surface" id="reschedule-doctor-name">
                      Dr. {apptToReschedule.doctor.profiles?.full_name}
                    </strong>
                    .
                  </p>

                  <div className="space-y-3">
                    <label className="block font-label-sm text-label-sm text-secondary uppercase tracking-wider font-semibold">
                      Select Available Day
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {rescheduleDateOptions.map((opt) => {
                        const isSelected = opt.dateStr === selectedRescheduleDate.dateStr
                        return (
                          <button
                            key={opt.dateStr}
                            className={`p-2 rounded-lg text-center transition-all ${
                              isSelected
                                ? 'bg-primary text-on-primary shadow-sm font-semibold'
                                : 'bg-surface-container-low hover:bg-surface-container text-on-surface'
                            }`}
                            onClick={() => {
                              setSelectedRescheduleDate(opt)
                              setSelectedRescheduleSlot(null)
                              setRescheduleError(null)
                            }}
                            type="button"
                          >
                            <span className="font-label-xs text-[10px] block opacity-80">
                              {opt.topLabel}
                            </span>
                            <span className="font-label-md text-label-md font-bold">
                              {opt.dayNumber} {opt.dayName}
                            </span>
                          </button>
                        )
                      })}
                    </div>

                    <label className="block font-label-sm text-label-sm text-secondary uppercase tracking-wider pt-2 font-semibold">
                      Available Slots
                    </label>

                    {rescheduleSlots.morningSlots.length === 0 &&
                    rescheduleSlots.afternoonSlots.length === 0 ? (
                      <p className="text-body-sm text-secondary p-3 bg-surface-container-low rounded-lg text-center">
                        No slots available on this day. Please choose another date.
                      </p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                        {rescheduleSlots.morningSlots.length > 0 && (
                          <div>
                            <span className="text-[11px] font-semibold text-secondary uppercase">
                              Morning
                            </span>
                            <div className="grid grid-cols-3 gap-2 mt-1">
                              {rescheduleSlots.morningSlots.map((slot) => {
                                const isSelected =
                                  selectedRescheduleSlot?.startTime === slot.startTime
                                return (
                                  <button
                                    key={slot.startTime}
                                    className={`py-2 px-3 rounded-lg font-label-md text-label-md transition-colors ${
                                      isSelected
                                        ? 'bg-primary text-on-primary font-semibold shadow-sm'
                                        : 'bg-surface-container-low hover:bg-surface-container text-on-surface'
                                    }`}
                                    disabled={!slot.isAvailable}
                                    onClick={() => setSelectedRescheduleSlot(slot)}
                                    type="button"
                                  >
                                    {slot.formattedTime}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {rescheduleSlots.afternoonSlots.length > 0 && (
                          <div className="pt-2">
                            <span className="text-[11px] font-semibold text-secondary uppercase">
                              Afternoon
                            </span>
                            <div className="grid grid-cols-3 gap-2 mt-1">
                              {rescheduleSlots.afternoonSlots.map((slot) => {
                                const isSelected =
                                  selectedRescheduleSlot?.startTime === slot.startTime
                                return (
                                  <button
                                    key={slot.startTime}
                                    className={`py-2 px-3 rounded-lg font-label-md text-label-md transition-colors ${
                                      isSelected
                                        ? 'bg-primary text-on-primary font-semibold shadow-sm'
                                        : 'bg-surface-container-low hover:bg-surface-container text-on-surface'
                                    }`}
                                    disabled={!slot.isAvailable}
                                    onClick={() => setSelectedRescheduleSlot(slot)}
                                    type="button"
                                  >
                                    {slot.formattedTime}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {rescheduleError && (
                    <div className="p-3 bg-error-container/40 text-on-error-container rounded-lg text-body-sm font-medium">
                      {rescheduleError}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-3">
                    <button
                      className="px-4 py-2 rounded-lg bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors font-medium disabled:opacity-50"
                      disabled={isRescheduling}
                      onClick={() => setApptToReschedule(null)}
                      type="button"
                    >
                      Dismiss
                    </button>
                    <button
                      className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-semibold transition-colors disabled:opacity-50"
                      disabled={!selectedRescheduleSlot || isRescheduling}
                      onClick={handleExecuteReschedule}
                      type="button"
                    >
                      {isRescheduling ? 'Rescheduling...' : 'Confirm New Time'}
                    </button>
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
            className="flex flex-col items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors py-1 flex-1"
            data-path="find-doctors"
            href="/doctors"
          >
            <span className="material-symbols-outlined text-[22px]">stethoscope</span>
            <span className="font-label-sm text-label-sm mt-0.5">Doctors</span>
          </Link>

          <Link
            aria-current="page"
            className="flex flex-col items-center justify-center hover:text-on-surface transition-colors py-1 flex-1 bg-primary-container text-on-primary-container font-semibold rounded-lg relative"
            data-path="my-appointments"
            href="/appointments"
          >
            <span className="material-symbols-outlined text-[22px]">calendar_today</span>
            <span className="font-label-sm text-label-sm mt-0.5">Bookings</span>
            {upcomingList.length > 0 && (
              <span className="absolute top-1 right-5 w-4 h-4 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] flex items-center justify-center font-bold">
                {upcomingList.length}
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
