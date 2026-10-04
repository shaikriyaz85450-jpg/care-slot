'use client'

import React, { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  updateDoctorStatusAction,
  markAppointmentCompletedAction,
} from '@/app/actions/doctor'
import { signOutAction } from '@/app/actions/auth'
import { createClient } from '@/lib/supabase/client'
import { formatTime } from '@/lib/utils'

export interface DoctorPortalInfo {
  id: string
  name: string
  fullName: string
  prefix: string
  specialization: string
  departmentName: string
  clinicRoom: string
  shiftRange: string
  avatarUrl: string
  docCode: string
}

export interface DoctorPortalStatus {
  status: 'available' | 'delayed' | 'on_leave'
  delayMinutes: number
  note: string
  lastSyncedTime: string
}

export interface DoctorPortalAppointment {
  id: string
  patientId?: string
  patientName: string
  patientAge: string | number
  patientPhone?: string
  mrn: string
  status: 'booked' | 'completed' | 'cancelled' | 'checked_in'
  checkInState: string
  startTime: string
  endTime: string
  timeRange: string
  startsIn?: string
  consultType: string
  room: string
  reason: string
  durationMinutes?: number
}

export interface DoctorSlotMatrixItem {
  time: string
  type: 'completed' | 'active' | 'booked' | 'break' | 'open'
  label: string
}

interface DoctorDashboardViewProps {
  doctor: DoctorPortalInfo
  initialStatus: DoctorPortalStatus
  initialAppointments: DoctorPortalAppointment[]
  slotMatrix: DoctorSlotMatrixItem[]
  unreadNotificationsCount?: number
}

export function DoctorDashboardView({
  doctor,
  initialStatus,
  initialAppointments,
  slotMatrix,
  unreadNotificationsCount = 4,
}: DoctorDashboardViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Live status state
  const [currentStatus, setCurrentStatus] = useState<'available' | 'delayed' | 'on_leave'>(
    initialStatus.status || 'available'
  )
  const [delayMinutes, setDelayMinutes] = useState<number>(initialStatus.delayMinutes || 15)
  const [displayNote, setDisplayNote] = useState<string>(
    initialStatus.note || 'Seeing Patients — On Time. Instant scheduling enabled.'
  )
  const [lastSyncedText, setLastSyncedText] = useState<string>(
    initialStatus.lastSyncedTime || 'Synced with Central Reception'
  )
  const [statusCommitSuccess, setStatusCommitSuccess] = useState<boolean>(false)
  const [bannerAlert, setBannerAlert] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
  } | null>(null)

  // Appointment Queue & Tabs
  const [appointments, setAppointments] = useState<DoctorPortalAppointment[]>(initialAppointments)
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'waiting' | 'upcoming' | 'completed'>(
    'all'
  )

  // Keep client appointment state in sync with server revalidations/props
  useEffect(() => {
    setAppointments(initialAppointments)
  }, [initialAppointments])

  // Modals
  const [detailsModalAppt, setDetailsModalAppt] = useState<DoctorPortalAppointment | null>(null)
  const [isNoteModalOpen, setIsNoteModalOpen] = useState<boolean>(false)
  const [tempNoteText, setTempNoteText] = useState<string>(displayNote)

  // Dynamically calculate greeting based on hour
  const currentHour = new Date().getHours()
  const greeting =
    currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening'

  // Format today's date banner
  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date())

  // Calculate live appointment KPI metrics
  const totalCount = appointments.length
  const completedCount = appointments.filter((a) => a.status === 'completed').length
  const remainingList = appointments.filter((a) => a.status === 'booked' || a.status === 'checked_in')
  const remainingCount = remainingList.length
  const cancelledCount = appointments.filter((a) => a.status === 'cancelled').length
  const completedPercentage =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const nextPatient = remainingList[0] || null

  // Tab counts
  const waitingCount = appointments.filter(
    (a) => a.checkInState?.toLowerCase().includes('checked in') || a.checkInState?.toLowerCase().includes('waiting')
  ).length
  const upcomingCount = remainingCount
  const completedTabCount = completedCount

  // Filtered list
  const filteredAppointments = appointments.filter((a) => {
    if (selectedFilter === 'waiting') {
      return (
        a.status !== 'completed' &&
        a.status !== 'cancelled' &&
        (a.checkInState?.toLowerCase().includes('checked in') ||
          a.checkInState?.toLowerCase().includes('waiting'))
      )
    }
    if (selectedFilter === 'upcoming') {
      return a.status === 'booked' || a.status === 'checked_in'
    }
    if (selectedFilter === 'completed') {
      return a.status === 'completed'
    }
    return true
  })

  // Realtime subscription setup
  useEffect(() => {
    const supabase = createClient()
    const todayStr = new Date().toISOString().split('T')[0]

    const channel = supabase
      .channel(`doctor-dashboard-${doctor.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'doctor_daily_status',
          filter: `doctor_id=eq.${doctor.id}`,
        },
        (payload: any) => {
          if (payload.new && payload.new.date === todayStr) {
            setCurrentStatus(payload.new.status)
            if (payload.new.delay_minutes !== undefined) {
              setDelayMinutes(payload.new.delay_minutes)
            }
            if (payload.new.note) {
              setDisplayNote(payload.new.note)
            }
            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            setLastSyncedText(`Last updated: ${timeStr} (Realtime Sync)`)
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
        () => {
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [doctor.id, router])

  // Handle status update commit
  const handlePushStatus = () => {
    startTransition(async () => {
      const res = await updateDoctorStatusAction({
        doctorId: doctor.id,
        status: currentStatus,
        delayMinutes: currentStatus === 'delayed' ? delayMinutes : 0,
        note: displayNote,
      })

      if (res.success) {
        setStatusCommitSuccess(true)
        const timeStr = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
        const statusLabel =
          currentStatus === 'available'
            ? 'Available'
            : currentStatus === 'delayed'
            ? `Delayed (+${delayMinutes}m)`
            : 'On Leave'
        setLastSyncedText(`Last updated: ${timeStr} (Status pushed: ${statusLabel})`)

        let msg = `Live availability published: ${statusLabel}.`
        if (res.notifiedPatientsCount && res.notifiedPatientsCount > 0) {
          msg += ` ${res.notifiedPatientsCount} booked patient(s) notified.`
        }
        if (res.cancelledAppointmentsCount && res.cancelledAppointmentsCount > 0) {
          msg += ` ${res.cancelledAppointmentsCount} appointment(s) cancelled.`
        }

        setBannerAlert({
          type: 'success',
          message: msg,
        })

        // If on leave, reflect cancellations locally immediately
        if (currentStatus === 'on_leave') {
          setAppointments((prev) =>
            prev.map((a) =>
              a.status === 'booked' || a.status === 'checked_in'
                ? {
                    ...a,
                    status: 'cancelled',
                    checkInState: 'Cancelled • Doctor On Leave',
                  }
                : a
            )
          )
        }

        setTimeout(() => {
          setStatusCommitSuccess(false)
        }, 2500)
      } else {
        setBannerAlert({
          type: 'error',
          message: res.error || 'Failed to sync status update with server.',
        })
      }
    })
  }

  // Handle marking appointment completed
  const handleMarkCompleted = (appointmentId: string) => {
    startTransition(async () => {
      // Optimistic update
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === appointmentId
            ? {
                ...a,
                status: 'completed',
                checkInState: 'Completed (20 min)',
              }
            : a
        )
      )

      if (detailsModalAppt && detailsModalAppt.id === appointmentId) {
        setDetailsModalAppt({
          ...detailsModalAppt,
          status: 'completed',
          checkInState: 'Completed (20 min)',
        })
      }

      const res = await markAppointmentCompletedAction({ appointmentId })
      if (!res.success) {
        setBannerAlert({
          type: 'error',
          message: res.error || 'Failed to mark appointment completed.',
        })
        router.refresh()
      } else {
        setBannerAlert({
          type: 'success',
          message: 'Appointment marked as completed and clinical record updated.',
        })
      }
    })
  }

  // Handle saving customized patient note
  const handleSaveNote = () => {
    setDisplayNote(tempNoteText.trim())
    setIsNoteModalOpen(false)
    setBannerAlert({
      type: 'info',
      message: 'Display note updated. Click "Push Status Update" to publish changes.',
    })
  }

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased min-h-screen">
      {/* ------------------------------------------------------------- */}
      {/* DESKTOP SIDEBAR                                               */}
      {/* ------------------------------------------------------------- */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-50 flex flex-col justify-between hidden md:flex">
        <div className="flex flex-col">
          {/* Logo */}
          <div className="h-16 px-space-md flex items-center gap-space-sm border-b border-surface-container-high/40">
            <Link href="/" className="flex items-center gap-space-xs">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-on-primary">
                <span className="material-symbols-outlined text-[20px]">local_hospital</span>
              </div>
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm text-primary leading-tight tracking-tight">
                  CareSlot
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  Doctor Portal
                </span>
              </div>
            </Link>
          </div>

          {/* Clinic Location Badge */}
          <div className="mx-space-md my-space-sm p-space-sm rounded-lg bg-surface-container-low flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-primary text-[18px]">
              local_hospital
            </span>
            <div className="flex flex-col">
              <span className="font-label-md text-label-md text-on-surface">
                {doctor.departmentName}
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                {doctor.clinicRoom}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-space-xs px-space-md mt-space-sm">
            <a
              aria-current="page"
              className="flex items-center justify-between px-space-md py-space-sm transition-colors bg-primary-container text-on-primary-container font-label-lg rounded-lg shadow-sm"
              href="#overview"
            >
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[20px]">grid_view</span>
                <span className="font-label-lg text-label-lg">Overview</span>
              </div>
            </a>

            <a
              className="flex items-center justify-between px-space-md py-space-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
              href="#queue"
            >
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                <span className="font-label-lg text-label-lg">Today&apos;s Appointments</span>
              </div>
              <span className="px-space-xs py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm">
                {totalCount}
              </span>
            </a>

            <Link
              className="flex items-center justify-between px-space-md py-space-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
              href="/doctor/schedule"
            >
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[20px]">schedule</span>
                <span className="font-label-lg text-label-lg">Schedule</span>
              </div>
            </Link>

            <a
              className="flex items-center justify-between px-space-md py-space-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
              href="#status-section"
            >
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[20px]">sensors</span>
                <span className="font-label-lg text-label-lg">Status</span>
              </div>
              <span
                className={`w-2 h-2 rounded-full ${
                  currentStatus === 'available'
                    ? 'bg-tertiary'
                    : currentStatus === 'delayed'
                    ? 'bg-secondary'
                    : 'bg-error'
                }`}
              />
            </a>

            <Link
              className="flex items-center justify-between px-space-md py-space-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
              href="/doctor/profile"
            >
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[20px]">person</span>
                <span className="font-label-lg text-label-lg">Profile</span>
              </div>
            </Link>
          </nav>
        </div>

        {/* Sign Out Action */}
        <div className="p-space-md flex flex-col gap-space-xs bg-surface-container-low border-t border-surface-container-high/40">
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full flex items-center gap-space-sm px-space-md py-space-sm rounded-lg text-error hover:bg-error-container hover:text-on-error-container transition-colors text-left"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
              <span className="font-label-lg text-label-lg">Sign Out</span>
            </button>
          </form>
        </div>
      </aside>

      {/* ------------------------------------------------------------- */}
      {/* MAIN VIEWPORT CONTAINER                                       */}
      {/* ------------------------------------------------------------- */}
      <div className="md:pl-64 flex flex-col min-h-screen">
        {/* Top Sticky Header */}
        <header className="fixed top-0 left-0 md:left-64 right-0 h-16 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 flex items-center justify-between px-space-md lg:px-space-lg">
          <div className="flex items-center gap-space-md">
            {/* Mobile Brand Logo */}
            <div className="flex md:hidden items-center gap-space-xs">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-on-primary">
                <span className="material-symbols-outlined text-[16px]">local_hospital</span>
              </div>
              <span className="font-headline-sm text-headline-sm text-primary">CareSlot</span>
            </div>

            {/* Date Badge */}
            <div className="hidden sm:flex items-center gap-space-xs bg-surface-container-low px-space-md py-space-xs rounded-lg text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">calendar_month</span>
              <span className="font-body-sm text-body-sm">Today, {todayFormatted}</span>
            </div>
          </div>

          <div className="flex items-center gap-space-md">
            {/* Live Status Header Chip */}
            <div className="hidden sm:flex items-center gap-space-xs bg-surface-container-low px-space-sm py-0.5 rounded-full">
              <span
                className={`w-2 h-2 rounded-full ${
                  currentStatus === 'available'
                    ? 'bg-tertiary'
                    : currentStatus === 'delayed'
                    ? 'bg-secondary'
                    : 'bg-error'
                }`}
              />
              <span
                className={`font-label-sm text-label-sm capitalize ${
                  currentStatus === 'available'
                    ? 'text-tertiary'
                    : currentStatus === 'delayed'
                    ? 'text-secondary'
                    : 'text-error font-semibold'
                }`}
              >
                {currentStatus === 'available'
                  ? 'Available'
                  : currentStatus === 'delayed'
                  ? `Delayed (+${delayMinutes}m)`
                  : 'On Leave'}
              </span>
            </div>

            {/* Notifications Bell */}
            <Link
              href="/notifications"
              aria-label="Notifications"
              className="relative p-space-xs rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-[22px]">notifications</span>
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 rounded-full bg-primary text-on-primary font-label-sm text-[10px]">
                  {unreadNotificationsCount}
                </span>
              )}
            </Link>

            {/* Doctor Profile Header Capsule */}
            <div className="flex items-center gap-space-sm pl-space-sm">
              <div className="hidden text-right lg:flex flex-col">
                <span className="font-label-lg text-label-lg text-on-surface leading-tight">
                  {doctor.fullName || `${doctor.prefix} ${doctor.name}`}
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  {doctor.specialization} • {doctor.docCode}
                </span>
              </div>
              <img
                alt={doctor.name}
                className="w-8 h-8 rounded-full object-cover border border-outline-variant"
                src={
                  doctor.avatarUrl ||
                  'https://lh3.googleusercontent.com/aida-public/AB6AXuAzt_NuJcyLUje-lQcFdgxEiAyae1ipRfo81SwJTQvKkWiuxYC_xvY5Sf_hWaiG5F3DUy4AN4_HG6KwuzI3Bqsul-WwNtsgYB8o2HCyd-LoQMx14i3sEl33sELe0d6ceR4kHivI1p3rD405RdzTOCCkYopjkbn8cGi7py88v_xh0YP-X14tbHf3kachYkItyaRspX3Q2Hl9C7GBaai_GzCD_0a2XBayChv2ZNKc-AmmW0saULjvdplNfg'
                }
              />
            </div>
          </div>
        </header>

        {/* Main Content Body */}
        <main className="w-full pt-16 bg-surface px-space-md lg:px-space-lg py-space-lg flex-1">
          <div className="flex flex-col w-full gap-space-lg" id="overview">
            {/* Banner alert notification if present */}
            {bannerAlert && (
              <div
                className={`p-space-md rounded-xl shadow-sm flex items-center justify-between transition-all ${
                  bannerAlert.type === 'success'
                    ? 'bg-tertiary-container/15 text-tertiary border border-tertiary/20'
                    : bannerAlert.type === 'error'
                    ? 'bg-error-container/20 text-error border border-error/20'
                    : 'bg-primary-container/15 text-primary border border-primary/20'
                }`}
              >
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-[20px]">
                    {bannerAlert.type === 'success'
                      ? 'check_circle'
                      : bannerAlert.type === 'error'
                      ? 'warning'
                      : 'info'}
                  </span>
                  <span className="font-body-md text-body-md font-medium">{bannerAlert.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setBannerAlert(null)}
                  className="p-1 rounded hover:bg-black/5"
                  aria-label="Dismiss banner"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            )}

            {/* --------------------------------------------------------- */}
            {/* 1. Header & Greeting Bar                                  */}
            {/* --------------------------------------------------------- */}
            <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md bg-surface-container-lowest p-space-lg rounded-xl shadow-sm">
              <div className="flex flex-col gap-space-xs">
                <div className="flex items-center gap-space-sm flex-wrap">
                  <h1 className="font-headline-lg text-headline-lg text-on-surface">
                    {greeting}, {doctor.prefix} {doctor.name.split(' ').pop()}
                  </h1>
                </div>
                <p className="font-body-md text-body-md text-on-surface-variant flex items-center gap-space-xs flex-wrap">
                  <span>{doctor.departmentName}</span>
                  <span className="text-outline-variant">•</span>
                  <span>{doctor.clinicRoom}</span>
                  <span className="text-outline-variant">•</span>
                  <span className="font-label-md text-on-surface">
                    Current Shift: {doctor.shiftRange}
                  </span>
                </p>
              </div>
            </section>

            {/* --------------------------------------------------------- */}
            {/* 2. Doctor Live Status Control Section (Hero priority card)*/}
            {/* --------------------------------------------------------- */}
            <section
              id="status-section"
              className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col gap-space-md"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-xs">
                <div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface">
                    Today&apos;s Live Availability Status
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Updates patient-facing booking portal and clinic intake immediately in real-time.
                  </p>
                </div>
                <div className="flex items-center gap-space-xs text-on-surface-variant font-label-sm text-label-sm">
                  <span
                    className={`material-symbols-outlined text-[16px] text-tertiary ${
                      isPending ? 'animate-spin' : ''
                    }`}
                  >
                    sync
                  </span>
                  <span>{lastSyncedText}</span>
                </div>
              </div>

              {/* 3 Status Toggle Cards */}
              <div
                aria-label="Physician Schedule State"
                className="grid grid-cols-1 md:grid-cols-3 gap-space-md"
                role="radiogroup"
              >
                {/* Option 1: Available */}
                <div
                  role="radio"
                  aria-checked={currentStatus === 'available'}
                  tabIndex={0}
                  onClick={() => setCurrentStatus('available')}
                  className={`cursor-pointer rounded-xl p-space-md shadow-sm flex flex-col justify-between gap-space-sm transition-all ${
                    currentStatus === 'available'
                      ? 'bg-surface-container-lowest'
                      : 'bg-surface-container-low hover:bg-surface-container'
                  }`}
                  style={{
                    outline: currentStatus === 'available' ? '2px solid #00685f' : 'none',
                    outlineOffset: '-2px',
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-space-xs">
                      <span className="w-3 h-3 rounded-full bg-tertiary inline-block" />
                      <span className="font-headline-sm text-headline-sm text-on-surface">
                        Available
                      </span>
                    </div>
                    {currentStatus === 'available' ? (
                      <span className="px-space-xs py-0.5 rounded-full bg-surface-container-high text-tertiary font-label-sm text-label-sm font-bold">
                        Active Now
                      </span>
                    ) : (
                      <span className="px-space-xs py-0.5 rounded-full bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm">
                        On Time
                      </span>
                    )}
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Seeing Patients — On Time. Instant scheduling enabled.
                  </p>
                  <div className="flex items-center justify-between pt-space-xs">
                    <span className="font-label-sm text-label-sm text-primary flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">check_circle</span>{' '}
                      Portal Open
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      100% Slot Cadence
                    </span>
                  </div>
                </div>

                {/* Option 2: Delayed */}
                <div
                  role="radio"
                  aria-checked={currentStatus === 'delayed'}
                  tabIndex={0}
                  onClick={() => setCurrentStatus('delayed')}
                  className={`cursor-pointer rounded-xl p-space-md shadow-sm flex flex-col justify-between gap-space-sm transition-all ${
                    currentStatus === 'delayed'
                      ? 'bg-surface-container-lowest'
                      : 'bg-surface-container-low hover:bg-surface-container'
                  }`}
                  style={{
                    outline: currentStatus === 'delayed' ? '2px solid #00685f' : 'none',
                    outlineOffset: '-2px',
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-space-xs">
                      <span className="w-3 h-3 rounded-full bg-secondary inline-block" />
                      <span className="font-headline-sm text-headline-sm text-on-surface">
                        Delayed
                      </span>
                    </div>
                    <span className="px-space-xs py-0.5 rounded-full bg-surface-container-highest text-on-secondary-container font-label-sm text-label-sm">
                      Behind Schedule
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Push estimated start times back for incoming waiting room arrivals.
                  </p>
                  <div className="flex items-center gap-space-xs pt-space-xs flex-wrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setCurrentStatus('delayed')
                        setDelayMinutes(15)
                      }}
                      className={`px-space-xs py-1 rounded font-label-sm text-label-sm transition-colors ${
                        currentStatus === 'delayed' && delayMinutes === 15
                          ? 'bg-primary text-on-primary font-bold shadow-sm'
                          : 'bg-surface-container-highest text-on-surface hover:bg-surface-container-high'
                      }`}
                    >
                      +15m
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setCurrentStatus('delayed')
                        setDelayMinutes(30)
                      }}
                      className={`px-space-xs py-1 rounded font-label-sm text-label-sm transition-colors ${
                        currentStatus === 'delayed' && delayMinutes === 30
                          ? 'bg-primary text-on-primary font-bold shadow-sm'
                          : 'bg-surface-container-highest text-on-surface hover:bg-surface-container-high'
                      }`}
                    >
                      +30m
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setCurrentStatus('delayed')
                        setDelayMinutes(45)
                      }}
                      className={`px-space-xs py-1 rounded font-label-sm text-label-sm transition-colors ${
                        currentStatus === 'delayed' && delayMinutes === 45
                          ? 'bg-primary text-on-primary font-bold shadow-sm'
                          : 'bg-surface-container-highest text-on-surface hover:bg-surface-container-high'
                      }`}
                    >
                      +45m
                    </button>
                    <span className="font-body-sm text-body-sm text-on-surface-variant pl-space-xs">
                      Autosends Alert
                    </span>
                  </div>
                </div>

                {/* Option 3: On Leave */}
                <div
                  role="radio"
                  aria-checked={currentStatus === 'on_leave'}
                  tabIndex={0}
                  onClick={() => setCurrentStatus('on_leave')}
                  className={`cursor-pointer rounded-xl p-space-md shadow-sm flex flex-col justify-between gap-space-sm transition-all ${
                    currentStatus === 'on_leave'
                      ? 'bg-surface-container-lowest'
                      : 'bg-surface-container-low hover:bg-surface-container'
                  }`}
                  style={{
                    outline: currentStatus === 'on_leave' ? '2px solid #00685f' : 'none',
                    outlineOffset: '-2px',
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-space-xs">
                      <span className="w-3 h-3 rounded-full bg-error inline-block" />
                      <span className="font-headline-sm text-headline-sm text-on-surface">
                        On Leave
                      </span>
                    </div>
                    <span className="px-space-xs py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm">
                      Off-Duty
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Emergency or sick leave. Pauses automated booking and alerts triage nurse.
                  </p>
                  <div className="flex items-center justify-between pt-space-xs">
                    <span className="font-label-sm text-label-sm text-error flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">pause_circle</span>{' '}
                      Slots Frozen
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      Cancels Today&apos;s Bookings
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Status Action Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-space-sm pt-space-xs bg-surface-container-low p-space-sm rounded-lg">
                <div className="flex items-center gap-space-xs text-on-surface-variant">
                  <span className="material-symbols-outlined text-[18px] text-primary">info</span>
                  <span className="font-body-sm text-body-sm">
                    {currentStatus === 'on_leave'
                      ? 'Switching to On Leave will automatically cancel today\'s appointments and notify affected patients.'
                      : currentStatus === 'delayed'
                      ? `Delayed status will dispatch alert notices (${delayMinutes}m delay) to all today's booked patients.`
                      : 'Automated waiting room board updates when status alters. Check triage notes before updating.'}
                  </span>
                </div>
                <div className="flex items-center gap-space-xs w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setTempNoteText(displayNote)
                      setIsNoteModalOpen(true)
                    }}
                    className="px-space-md py-1.5 rounded-lg bg-surface-container-highest text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-colors"
                  >
                    Edit Patient Display Note
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handlePushStatus}
                    className={`px-space-md py-1.5 rounded-lg font-label-md text-label-md transition-colors shadow-sm inline-flex items-center gap-1.5 ${
                      statusCommitSuccess
                        ? 'bg-tertiary text-on-tertiary'
                        : 'bg-primary text-on-primary hover:bg-primary-container'
                    }`}
                  >
                    {isPending ? (
                      <>
                        <span className="material-symbols-outlined text-[16px] animate-spin">
                          progress_activity
                        </span>
                        <span>Publishing...</span>
                      </>
                    ) : statusCommitSuccess ? (
                      <>
                        <span className="material-symbols-outlined text-[16px]">task_alt</span>
                        <span>Status Synced!</span>
                      </>
                    ) : (
                      <span>Push Status Update</span>
                    )}
                  </button>
                </div>
              </div>
            </section>

            {/* --------------------------------------------------------- */}
            {/* 3. Today's Appointment Summary KPI Cards                  */}
            {/* --------------------------------------------------------- */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
              {/* KPI 1: Total Scheduled */}
              <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between gap-space-xs">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface-variant">
                    Total Scheduled
                  </span>
                  <span className="p-1.5 rounded-lg bg-surface-container-low text-secondary">
                    <span className="material-symbols-outlined text-[20px]">calendar_month</span>
                  </span>
                </div>
                <div className="flex items-baseline gap-space-xs">
                  <span className="font-metric-val text-metric-val text-on-surface">
                    {totalCount}
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">patients</span>
                </div>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  {remainingCount} queued, {completedCount} completed
                </span>
              </div>

              {/* KPI 2: Completed */}
              <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between gap-space-xs">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface-variant">
                    Completed
                  </span>
                  <span className="p-1.5 rounded-lg bg-surface-container-low text-tertiary">
                    <span className="material-symbols-outlined text-[20px]">task_alt</span>
                  </span>
                </div>
                <div className="flex items-baseline gap-space-xs">
                  <span className="font-metric-val text-metric-val text-on-surface">
                    {completedCount}
                  </span>
                  <span className="font-label-sm text-label-sm text-tertiary font-bold">
                    {completedPercentage}%
                  </span>
                </div>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  On schedule • avg 20 min per patient
                </span>
              </div>

              {/* KPI 3: Remaining */}
              <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between gap-space-xs">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface-variant">Remaining</span>
                  <span className="p-1.5 rounded-lg bg-surface-container-low text-primary">
                    <span className="material-symbols-outlined text-[20px]">hourglass_top</span>
                  </span>
                </div>
                <div className="flex items-baseline gap-space-xs">
                  <span className="font-metric-val text-metric-val text-primary">
                    {remainingCount}
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">queued</span>
                </div>
                <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                  {nextPatient
                    ? `Next: ${nextPatient.patientName} at ${nextPatient.startTime ? formatTime(nextPatient.startTime) : '10:30 AM'}`
                    : 'Queue clear for today'}
                </span>
              </div>

              {/* KPI 4: Cancelled / No-show */}
              <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between gap-space-xs">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface-variant">
                    Cancelled / No-show
                  </span>
                  <span className="p-1.5 rounded-lg bg-surface-container-low text-error">
                    <span className="material-symbols-outlined text-[20px]">cancel</span>
                  </span>
                </div>
                <div className="flex items-baseline gap-space-xs">
                  <span className="font-metric-val text-metric-val text-on-surface">
                    {cancelledCount}
                  </span>
                  <span className="font-label-sm text-label-sm text-error font-bold">
                    {cancelledCount > 0 ? 'Slots released' : 'No dropouts'}
                  </span>
                </div>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Slots reopened to urgent intake
                </span>
              </div>
            </section>

            {/* --------------------------------------------------------- */}
            {/* 4. Main 2-Column Layout (Left 8 cols, Right 4 cols)       */}
            {/* --------------------------------------------------------- */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start" id="queue">
              {/* LEFT COLUMN: Patient Queue & Detailed Cards (8 cols) */}
              <div className="lg:col-span-8 flex flex-col gap-space-md">
                {/* Queue Header & Filter Tabs */}
                <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
                  <div>
                    <h2 className="font-headline-sm text-headline-sm text-on-surface">
                      Patient Queue &amp; Timeline
                    </h2>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Live clinical records, check-in status and consult controls
                    </p>
                  </div>

                  {/* Filter tabs */}
                  <div className="flex items-center gap-space-xs bg-surface-container-low p-1 rounded-lg self-start sm:self-auto overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setSelectedFilter('all')}
                      className={`px-space-sm py-1 rounded font-label-sm text-label-sm transition-colors ${
                        selectedFilter === 'all'
                          ? 'bg-surface-container-lowest shadow-sm text-on-surface font-semibold'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      All ({totalCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedFilter('waiting')}
                      className={`px-space-sm py-1 rounded font-label-sm text-label-sm transition-colors ${
                        selectedFilter === 'waiting'
                          ? 'bg-surface-container-lowest shadow-sm text-on-surface font-semibold'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      Waiting ({waitingCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedFilter('upcoming')}
                      className={`px-space-sm py-1 rounded font-label-sm text-label-sm transition-colors ${
                        selectedFilter === 'upcoming'
                          ? 'bg-surface-container-lowest shadow-sm text-on-surface font-semibold'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      Upcoming ({upcomingCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedFilter('completed')}
                      className={`px-space-sm py-1 rounded font-label-sm text-label-sm transition-colors ${
                        selectedFilter === 'completed'
                          ? 'bg-surface-container-lowest shadow-sm text-on-surface font-semibold'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      Completed ({completedTabCount})
                    </button>
                  </div>
                </div>

                {/* Queue Cards List */}
                <div className="flex flex-col gap-space-md">
                  {filteredAppointments.length === 0 ? (
                    <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-xl text-center flex flex-col items-center justify-center">
                      <span className="material-symbols-outlined text-[36px] text-outline-variant mb-2">
                        check_circle
                      </span>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface">
                        No appointments found
                      </h3>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                        There are currently no appointments in the &ldquo;{selectedFilter}&rdquo; view.
                      </p>
                    </div>
                  ) : (
                    filteredAppointments.map((appt, idx) => {
                      const isFirstActive =
                        (appt.status === 'booked' || appt.status === 'checked_in') &&
                        idx === filteredAppointments.findIndex((a) => a.status === 'booked' || a.status === 'checked_in')

                      // Appointment 1: Immediate Next / Featured Card
                      if (isFirstActive) {
                        return (
                          <div
                            key={appt.id}
                            className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg relative flex flex-col gap-space-md"
                            style={{ outline: '2px solid #00685f', outlineOffset: '-2px' }}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs">
                              <div className="flex items-center gap-space-xs flex-wrap">
                                <span className="px-space-xs py-0.5 rounded-full bg-primary text-on-primary font-label-sm text-label-sm">
                                  Immediate Next
                                </span>
                                <span className="font-headline-sm text-headline-sm text-on-surface">
                                  {appt.patientName}
                                </span>
                                <span className="font-body-sm text-body-sm text-on-surface-variant">
                                  Age {appt.patientAge} • MRN #{appt.mrn}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 px-space-sm py-1 rounded-full bg-surface-container-high text-tertiary font-label-sm text-label-sm self-start sm:self-auto">
                                <span className="w-2 h-2 rounded-full bg-tertiary" />
                                <span>{appt.checkInState || 'Checked In • Waiting Room'}</span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm bg-surface-container-low p-space-md rounded-lg">
                              <div className="flex flex-col">
                                <span className="font-label-sm text-label-sm text-on-surface-variant">
                                  Slot Scheduled
                                </span>
                                <span className="font-headline-sm text-headline-sm text-primary">
                                  {appt.timeRange}
                                </span>
                                <span className="font-body-sm text-body-sm text-on-surface-variant">
                                  {appt.startsIn || 'Starts soon'}
                                </span>
                              </div>
                              <div className="flex flex-col">
                                <span className="font-label-sm text-label-sm text-on-surface-variant">
                                  Consultation Type
                                </span>
                                <span className="font-body-md text-body-md text-on-surface font-bold flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[16px] text-primary">
                                    apartment
                                  </span>
                                  {appt.consultType || 'In-Person Specialist'}
                                </span>
                                <span className="font-body-sm text-body-sm text-on-surface-variant">
                                  {appt.room || doctor.clinicRoom}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-col gap-1">
                              <span className="font-label-sm text-label-sm text-on-surface-variant">
                                Reason for Visit
                              </span>
                              <p className="font-body-md text-body-md text-on-surface">
                                {appt.reason || 'General clinical consultation.'}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-space-sm pt-space-xs">
                              <button
                                type="button"
                                onClick={() => setDetailsModalAppt(appt)}
                                className="px-space-md py-2 rounded-lg bg-surface-container-high text-on-surface font-label-md text-label-md hover:bg-surface-container-highest transition-colors shadow-sm"
                              >
                                View Details
                              </button>
                              <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleMarkCompleted(appt.id)}
                                className="inline-flex items-center gap-space-xs px-space-md py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors shadow-sm"
                              >
                                <span className="material-symbols-outlined text-[18px]">done_all</span>
                                <span>Mark Completed</span>
                              </button>
                            </div>
                          </div>
                        )
                      }

                      // Completed appointment card
                      if (appt.status === 'completed') {
                        return (
                          <div
                            key={appt.id}
                            className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md flex flex-col gap-space-sm opacity-80"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs">
                              <div className="flex items-center gap-space-xs">
                                <span className="font-headline-sm text-headline-sm text-on-surface line-through text-on-surface-variant">
                                  {appt.patientName}
                                </span>
                                <span className="font-body-sm text-body-sm text-on-surface-variant">
                                  Age {appt.patientAge} • MRN #{appt.mrn}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 px-space-sm py-0.5 rounded-full bg-surface-container-low text-tertiary font-label-sm text-label-sm self-start sm:self-auto">
                                <span className="material-symbols-outlined text-[14px]">check</span>
                                <span>{appt.checkInState || 'Completed'}</span>
                              </div>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs text-on-surface-variant font-body-sm text-body-sm">
                              <div className="flex items-center gap-space-xs flex-wrap">
                                <span className="material-symbols-outlined text-[16px]">history</span>
                                <span className="font-label-md text-on-surface">{appt.timeRange}</span>
                                <span className="text-outline-variant">•</span>
                                <span>Reason: {appt.reason || 'Routine consultation'}</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between pt-space-xs">
                              <span className="font-body-sm text-body-sm text-on-surface-variant">
                                Summary Filed to Patient Record
                              </span>
                              <div className="flex items-center gap-space-xs">
                                <button
                                  type="button"
                                  onClick={() => setDetailsModalAppt(appt)}
                                  className="px-space-sm py-1 rounded bg-surface-container-high text-on-surface font-label-sm text-label-sm hover:bg-surface-container-highest"
                                >
                                  View Details
                                </button>
                                <span className="font-label-sm text-label-sm text-tertiary font-semibold flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[14px]">task_alt</span>
                                  Completed
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      }

                      // Cancelled appointment card
                      if (appt.status === 'cancelled') {
                        return (
                          <div
                            key={appt.id}
                            className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md flex flex-col gap-space-sm opacity-70"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs">
                              <div className="flex items-center gap-space-xs">
                                <span className="font-headline-sm text-headline-sm line-through text-on-surface-variant">
                                  {appt.patientName}
                                </span>
                                <span className="font-body-sm text-body-sm text-on-surface-variant">
                                  MRN #{appt.mrn}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 px-space-sm py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm">
                                <span className="material-symbols-outlined text-[14px]">cancel</span>
                                <span>Cancelled</span>
                              </div>
                            </div>
                            <div className="text-on-surface-variant font-body-sm text-body-sm">
                              <span>Scheduled: {appt.timeRange} • Slot released back to clinic pool</span>
                            </div>
                          </div>
                        )
                      }

                      // Standard Upcoming appointment card
                      return (
                        <div
                          key={appt.id}
                          className="bg-surface-container-lowest rounded-xl shadow-sm p-space-md flex flex-col gap-space-sm"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs">
                            <div className="flex items-center gap-space-xs flex-wrap">
                              <span className="font-headline-sm text-headline-sm text-on-surface">
                                {appt.patientName}
                              </span>
                              <span className="font-body-sm text-body-sm text-on-surface-variant">
                                Age {appt.patientAge} • MRN #{appt.mrn}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 px-space-sm py-0.5 rounded-full bg-surface-container-high text-on-surface font-label-sm text-label-sm self-start sm:self-auto">
                              <span className="w-2 h-2 rounded-full bg-secondary" />
                              <span>{appt.checkInState || 'Confirmed'}</span>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-xs text-on-surface-variant font-body-sm text-body-sm">
                            <div className="flex items-center gap-space-xs flex-wrap">
                              <span className="material-symbols-outlined text-[16px] text-primary">
                                {appt.consultType?.toLowerCase().includes('telehealth')
                                  ? 'videocam'
                                  : 'schedule'}
                              </span>
                              <span className="font-label-md text-on-surface">{appt.timeRange}</span>
                              <span className="text-outline-variant">•</span>
                              <span>Reason: {appt.reason || 'Follow-up appointment'}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-space-xs pt-space-xs">
                            <button
                              type="button"
                              onClick={() => setDetailsModalAppt(appt)}
                              className="px-space-md py-1.5 rounded-lg bg-surface-container-high text-on-surface font-label-sm text-label-sm hover:bg-surface-container-highest transition-colors"
                            >
                              View Details
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleMarkCompleted(appt.id)}
                              className="px-space-md py-1.5 rounded-lg bg-primary text-on-primary font-label-sm text-label-sm hover:bg-primary-container transition-colors shadow-sm inline-flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[16px]">done_all</span>
                              <span>Mark Completed</span>
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: Working Hours Preview & Slot Matrix (4 cols) */}
              <div className="lg:col-span-4 flex flex-col gap-space-md" id="schedule">
                {/* Card: Schedule & Working Hours Preview */}
                <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-space-md">
                  <div className="flex items-center justify-between">
                    <h3 className="font-headline-sm text-headline-sm text-on-surface">
                      Today&apos;s Working Hours
                    </h3>
                    <span className="p-1 rounded-lg bg-surface-container-low text-primary">
                      <span className="material-symbols-outlined text-[18px]">timer</span>
                    </span>
                  </div>

                  <div className="bg-surface-container-low p-space-sm rounded-lg flex flex-col gap-1">
                    <div className="flex items-center justify-between font-label-md text-label-md text-on-surface">
                      <span>Shift Range</span>
                      <span>{doctor.shiftRange}</span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      8.5 hrs total • 45m lunch break scheduled at 01:00 PM
                    </p>
                  </div>

                  {/* Visual Slot Grid Strip */}
                  <div className="flex flex-col gap-space-xs">
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                      Slot Allocation Matrix
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {slotMatrix.map((item, i) => {
                        if (item.type === 'completed') {
                          return (
                            <div
                              key={i}
                              className="flex items-center justify-between px-space-sm py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant font-body-sm text-body-sm"
                            >
                              <span className="font-label-md">{item.time}</span>
                              <span className="flex items-center gap-1 font-label-sm text-label-sm text-tertiary">
                                <span className="material-symbols-outlined text-[14px]">
                                  check_circle
                                </span>{' '}
                                Completed
                              </span>
                            </div>
                          )
                        }

                        if (item.type === 'active') {
                          return (
                            <div
                              key={i}
                              className="flex items-center justify-between px-space-sm py-1.5 rounded-lg bg-primary-container text-on-primary-container font-body-sm text-body-sm shadow-sm font-semibold"
                            >
                              <span className="font-label-md">{item.time}</span>
                              <span className="flex items-center gap-1 font-label-sm text-label-sm">
                                <span className="w-2 h-2 rounded-full bg-on-primary-container animate-pulse" />{' '}
                                Active / Next
                              </span>
                            </div>
                          )
                        }

                        if (item.type === 'break') {
                          return (
                            <div
                              key={i}
                              className="flex items-center justify-between px-space-sm py-1.5 rounded-lg bg-surface-container text-on-surface-variant font-body-sm text-body-sm"
                            >
                              <span className="font-label-md">{item.time}</span>
                              <span className="flex items-center gap-1 font-label-sm text-label-sm italic">
                                <span className="material-symbols-outlined text-[14px]">
                                  restaurant
                                </span>{' '}
                                Lunch Break (45m)
                              </span>
                            </div>
                          )
                        }

                        if (item.type === 'open') {
                          return (
                            <div
                              key={i}
                              className="flex items-center justify-between px-space-sm py-1.5 rounded-lg bg-surface-container-low text-on-surface font-body-sm text-body-sm hover:bg-surface-container-high cursor-pointer transition-colors"
                            >
                              <span className="font-label-md">{item.time}</span>
                              <span className="font-label-sm text-label-sm text-primary font-bold">
                                Open Slot
                              </span>
                            </div>
                          )
                        }

                        // Booked slot
                        return (
                          <div
                            key={i}
                            className="flex items-center justify-between px-space-sm py-1.5 rounded-lg bg-surface-container-high text-on-surface font-body-sm text-body-sm"
                          >
                            <span className="font-label-md">{item.time}</span>
                            <span className="font-label-sm text-label-sm text-secondary truncate max-w-[160px]">
                              {item.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <Link
                    className="inline-flex items-center justify-center gap-1 py-2 rounded-lg bg-surface-container-low text-primary font-label-md text-label-md hover:bg-surface-container-high transition-colors"
                    href="/doctor/schedule"
                  >
                    <span>Manage Full Week Schedule</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: VIEW APPOINTMENT CLINICAL DETAILS                    */}
      {/* ------------------------------------------------------------- */}
      {detailsModalAppt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-surface-container-lowest max-w-lg w-full rounded-2xl shadow-xl overflow-hidden flex flex-col gap-space-md p-space-lg">
            <div className="flex items-center justify-between border-b border-surface-container-high/60 pb-space-sm">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-primary text-[24px]">
                  medical_information
                </span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">
                  Patient Clinical Record
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailsModalAppt(null)}
                className="p-1 rounded-lg hover:bg-surface-container-high text-on-surface-variant"
                aria-label="Close modal"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-space-sm">
              <div className="bg-surface-container-low p-space-md rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="font-headline-sm text-headline-sm text-on-surface">
                    {detailsModalAppt.patientName}
                  </h4>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Age {detailsModalAppt.patientAge} • MRN #{detailsModalAppt.mrn}
                  </p>
                </div>
                <span
                  className={`px-space-sm py-1 rounded-full font-label-sm text-label-sm ${
                    detailsModalAppt.status === 'completed'
                      ? 'bg-tertiary-container/20 text-tertiary font-bold'
                      : detailsModalAppt.status === 'cancelled'
                      ? 'bg-error-container text-on-error-container'
                      : 'bg-surface-container-high text-primary font-bold'
                  }`}
                >
                  {detailsModalAppt.checkInState || detailsModalAppt.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-space-sm">
                <div className="p-space-sm bg-surface-container-lowest border border-outline-variant/60 rounded-lg">
                  <span className="font-label-sm text-label-sm text-on-surface-variant block">
                    Scheduled Time
                  </span>
                  <span className="font-label-md text-label-md text-on-surface">
                    {detailsModalAppt.timeRange}
                  </span>
                </div>
                <div className="p-space-sm bg-surface-container-lowest border border-outline-variant/60 rounded-lg">
                  <span className="font-label-sm text-label-sm text-on-surface-variant block">
                    Consultation Room
                  </span>
                  <span className="font-label-md text-label-md text-on-surface">
                    {detailsModalAppt.room || doctor.clinicRoom}
                  </span>
                </div>
              </div>

              <div className="p-space-sm bg-surface-container-lowest border border-outline-variant/60 rounded-lg">
                <span className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
                  Reason for Visit / Triage Notes
                </span>
                <p className="font-body-md text-body-md text-on-surface">
                  {detailsModalAppt.reason || 'Standard consultation requested.'}
                </p>
              </div>

              {detailsModalAppt.patientPhone && (
                <div className="flex items-center gap-space-xs text-on-surface-variant font-body-sm text-body-sm">
                  <span className="material-symbols-outlined text-[16px]">call</span>
                  <span>Contact Phone: {detailsModalAppt.patientPhone}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-space-sm pt-space-xs border-t border-surface-container-high/60">
              <button
                type="button"
                onClick={() => setDetailsModalAppt(null)}
                className="px-space-md py-2 rounded-lg bg-surface-container-high text-on-surface font-label-md text-label-md hover:bg-surface-container-highest"
              >
                Close
              </button>
              {detailsModalAppt.status !== 'completed' && detailsModalAppt.status !== 'cancelled' && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    handleMarkCompleted(detailsModalAppt.id)
                  }}
                  className="px-space-md py-2 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container shadow-sm inline-flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">done_all</span>
                  <span>Mark Completed</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: EDIT PATIENT DISPLAY NOTE                            */}
      {/* ------------------------------------------------------------- */}
      {isNoteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-surface-container-lowest max-w-md w-full rounded-2xl shadow-xl overflow-hidden flex flex-col gap-space-md p-space-lg">
            <div className="flex items-center justify-between border-b border-surface-container-high/60 pb-space-sm">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-primary text-[22px]">edit_note</span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">
                  Edit Patient Display Note
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNoteModalOpen(false)}
                className="p-1 rounded-lg hover:bg-surface-container-high text-on-surface-variant"
                aria-label="Close modal"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-space-xs">
              <label htmlFor="patientDisplayNoteInput" className="font-label-md text-label-md text-on-surface">
                Broadcast Note for Portal &amp; Waiting Room
              </label>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                This message appears directly on your public booking profile and patient waitlist screens.
              </p>
              <textarea
                id="patientDisplayNoteInput"
                rows={3}
                value={tempNoteText}
                onChange={(e) => setTempNoteText(e.target.value)}
                placeholder="e.g. Dr. Vance is seeing patients on schedule in Room 304."
                className="w-full mt-2 p-space-sm rounded-lg border border-outline-variant bg-surface-container-low text-on-surface font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-end gap-space-sm pt-space-xs border-t border-surface-container-high/60">
              <button
                type="button"
                onClick={() => setIsNoteModalOpen(false)}
                className="px-space-md py-1.5 rounded-lg bg-surface-container-high text-on-surface font-label-md text-label-md hover:bg-surface-container-highest"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                className="px-space-md py-1.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container shadow-sm"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
