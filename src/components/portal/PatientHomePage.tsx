'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatTime, formatRelativeTime } from '@/lib/utils'

export interface PatientHomeAppointment {
  id: string
  appointment_date: string
  start_time: string
  end_time: string
  status: string
  reason?: string | null
  doctors?: {
    id: string
    specialization: string
    qualification: string
    experience_years?: number
    consultation_minutes?: number
    departments?: {
      id: string
      name: string
    } | null
    profiles?: {
      id: string
      full_name: string
    } | null
  } | null
}

export interface PatientHomeNotification {
  id: string
  user_id: string
  title: string
  body: string
  read: boolean
  created_at: string
}

export interface PatientHomeDoctor {
  id: string
  specialization: string
  qualification: string
  experience_years?: number
  consultation_minutes?: number
  departments?: {
    id: string
    name: string
  } | null
  profiles?: {
    id: string
    full_name: string
  } | null
  doctor_daily_status?: {
    id: string
    date: string
    status: 'available' | 'delayed' | 'on_leave' | 'not_checked_in'
    delay_minutes?: number
    note?: string | null
  }[] | null
}

export interface PatientHomePageProps {
  user: {
    id: string
    email: string
  }
  profile: {
    id: string
    full_name: string
    phone?: string | null
    role: string
  }
  upcomingAppointments: PatientHomeAppointment[]
  unreadNotificationsCount: number
  notifications: PatientHomeNotification[]
  doctors?: PatientHomeDoctor[]
}

export function PatientHomePage({
  user,
  profile,
  upcomingAppointments,
  unreadNotificationsCount,
  notifications,
  doctors = [],
}: PatientHomePageProps) {
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
      router.refresh()
    } catch {
      window.location.href = '/login'
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/doctors?q=${encodeURIComponent(searchQuery.trim())}`)
    } else {
      router.push('/doctors')
    }
  }

  // Derive dynamic patient data
  const patientFullName = profile.full_name || 'Patient'
  const firstName = patientFullName.split(' ')[0]
  const mrnCode = `MRN #CS-${profile.id.replace(/-/g, '').substring(0, 5).toUpperCase()}`

  // Format today's date for banner
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  // Next upcoming appointment
  const nextAppt = upcomingAppointments.length > 0 ? upcomingAppointments[0] : null
  const nextDoctorName =
    nextAppt?.doctors?.profiles?.full_name ||
    nextAppt?.doctors?.specialization ||
    'Clinician'
  const nextDeptName = nextAppt?.doctors?.departments?.name || 'General Medicine'

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased min-h-screen">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-[260px] bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-50 flex-col justify-between">
        <div className="flex flex-col">
          {/* Logo / Brand */}
          <div className="h-16 px-space-md flex items-center gap-space-sm">
            <img
              alt="CareSlot Hospital Logo"
              className="h-8 w-auto object-contain"
              src="https://lh3.googleusercontent.com/aida/AEtjO1UOgZ_3KeLnkUk1iMA4lUKzfGeORs6HpDoBBDqCVCPYba9FOlRSoW3EyLO2a1zOczQIfWPJDWcKJHAKHQGpEN0WWC5hJZyxjifmVli76zjxIW9t65129bMZJ4N-RdsLmDajM3MwJdg5w4K1nqLKSLC1-uKfJEAqA2-OJlS3047bQe-GBd1MSUFgCTkmsUzKYLww86vqZ5nGOOeB8ePw3IcX3e4TiLyojYXSIPZh77C1oYIpkFPcRdWL562Y"
            />
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm text-primary tracking-tight font-bold">CareSlot</span>
              <span className="font-label-sm text-label-sm text-secondary">Patient Portal</span>
            </div>
          </div>

          {/* Branch Pill */}
          <div className="px-space-md py-space-xs">
            <div className="bg-surface-container-low rounded-lg p-space-xs flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">Branch</span>
              <span className="font-label-sm text-label-sm text-on-surface font-semibold">Central Hospital</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1 px-space-md mt-space-sm" data-active-classes="bg-primary-container text-on-primary-container font-semibold rounded-lg">
            <Link
              aria-current="page"
              className="flex items-center justify-between px-space-sm py-2 transition-colors bg-primary-container text-on-primary-container font-semibold rounded-lg"
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
              className="flex items-center justify-between px-space-sm py-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
              data-path="my-appointments"
              href="/appointments"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                <span className="font-label-lg text-label-lg">My Appointments</span>
              </div>
              {upcomingAppointments.length > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold">
                  {upcomingAppointments.length}
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
              {unreadNotificationsCount > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold">
                  {unreadNotificationsCount}
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

        {/* Sidebar Footer Links */}
        <div className="p-space-md flex flex-col gap-space-sm">
          <div className="flex flex-col gap-1">
            <Link
              className="flex items-center gap-3 px-space-sm py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md text-label-md transition-colors"
              data-path="help-support"
              href="/profile"
            >
              <span className="material-symbols-outlined text-[18px]">help</span>
              <span>Help &amp; Support</span>
            </Link>

            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full flex items-center gap-3 px-space-sm py-1.5 rounded-lg text-error hover:bg-error-container/30 font-label-md text-label-md transition-colors text-left"
              data-path="login"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              <span>{isLoggingOut ? 'Logging out...' : 'Log out'}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="fixed inset-y-0 left-0 w-[270px] bg-surface-container-lowest shadow-xl flex flex-col justify-between p-space-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col">
              <div className="h-16 flex items-center justify-between border-b border-surface-container pb-2 mb-2">
                <div className="flex items-center gap-space-xs">
                  <img
                    alt="CareSlot Hospital Logo"
                    className="h-7 w-auto object-contain"
                    src="https://lh3.googleusercontent.com/aida/AEtjO1UOgZ_3KeLnkUk1iMA4lUKzfGeORs6HpDoBBDqCVCPYba9FOlRSoW3EyLO2a1zOczQIfWPJDWcKJHAKHQGpEN0WWC5hJZyxjifmVli76zjxIW9t65129bMZJ4N-RdsLmDajM3MwJdg5w4K1nqLKSLC1-uKfJEAqA2-OJlS3047bQe-GBd1MSUFgCTkmsUzKYLww86vqZ5nGOOeB8ePw3IcX3e4TiLyojYXSIPZh77C1oYIpkFPcRdWL562Y"
                  />
                  <span className="font-headline-sm text-headline-sm text-primary font-bold">CareSlot</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-secondary hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <nav className="flex flex-col gap-1 mt-2">
                <Link
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between px-space-sm py-2 bg-primary-container text-on-primary-container font-semibold rounded-lg"
                  href="/"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px]">home</span>
                    <span className="font-label-lg text-label-lg">Home</span>
                  </div>
                </Link>
                <Link
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between px-space-sm py-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  href="/doctors"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px]">stethoscope</span>
                    <span className="font-label-lg text-label-lg">Find Doctors</span>
                  </div>
                </Link>
                <Link
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between px-space-sm py-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  href="/appointments"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                    <span className="font-label-lg text-label-lg">My Appointments</span>
                  </div>
                  {upcomingAppointments.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold">
                      {upcomingAppointments.length}
                    </span>
                  )}
                </Link>
                <Link
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between px-space-sm py-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  href="/notifications"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px]">notifications</span>
                    <span className="font-label-lg text-label-lg">Notifications</span>
                  </div>
                  {unreadNotificationsCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold">
                      {unreadNotificationsCount}
                    </span>
                  )}
                </Link>
                <Link
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between px-space-sm py-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  href="/profile"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px]">person</span>
                    <span className="font-label-lg text-label-lg">Profile</span>
                  </div>
                </Link>
              </nav>
            </div>

            <div className="pt-4 border-t border-surface-container">
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full flex items-center gap-3 px-space-sm py-2 rounded-lg text-error hover:bg-error-container/30 font-label-md text-label-md"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                <span>{isLoggingOut ? 'Logging out...' : 'Log out'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="lg:pl-[260px] flex flex-col min-h-screen">
        {/* Fixed Header */}
        <header className="fixed top-0 left-0 lg:left-[260px] right-0 h-16 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 px-space-md lg:px-space-xl flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <button
              onClick={() => setMobileMenuOpen(true)}
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
              <span className="font-headline-sm text-headline-sm text-primary font-bold">CareSlot</span>
            </div>

            {/* Desktop Search input */}
            <form onSubmit={handleSearchSubmit} className="hidden md:flex items-center bg-surface-container-low rounded-lg px-space-sm py-1.5 w-64 lg:w-80 gap-space-xs">
              <span className="material-symbols-outlined text-secondary text-[18px]">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search doctors, specialties, clinics..."
                className="bg-transparent border-0 outline-none w-full font-body-sm text-body-sm text-on-surface placeholder:text-secondary"
              />
            </form>
          </div>

          <div className="flex items-center gap-space-md">
            <div className="relative flex items-center">
              <Link
                href="/notifications"
                aria-label="Notifications"
                className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors relative"
              >
                <span className="material-symbols-outlined text-[22px]">notifications</span>
                {unreadNotificationsCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error ring-2 ring-surface-container-lowest" />
                )}
              </Link>
            </div>

            <div className="flex items-center gap-space-sm pl-space-xs">
              <div className="hidden sm:flex flex-col text-right">
                <span className="font-label-lg text-label-lg text-on-surface font-semibold leading-tight">
                  {patientFullName}
                </span>
                <span className="font-label-sm text-label-sm text-secondary">
                  {mrnCode}
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
                {firstName.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Main Body */}
        <main className="w-full pt-16 pb-20 lg:pb-0 bg-surface flex-1">
          <div className="w-full px-space-md lg:px-space-xl py-space-lg mx-auto">
            <div className="flex flex-col w-full">
              <div className="w-full flex flex-col gap-space-lg">
                {/* Welcome Card & Clinical Status Banner */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md pb-space-md bg-surface-container-lowest p-space-lg rounded-xl shadow-sm">
                  <div className="flex flex-col gap-space-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">Home</span>
                      <span className="font-label-sm text-label-sm text-secondary">/</span>
                      <span className="font-label-sm text-label-sm text-primary font-semibold">Patient Portal</span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-surface-container-low text-secondary font-label-sm text-label-sm ml-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                        All systems normal • Central Hospital Campus
                      </span>
                    </div>
                    <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
                      {`Welcome back, ${firstName}`}
                    </h1>
                    <p className="font-body-md text-body-md text-secondary">
                      {todayFormatted}
                    </p>
                  </div>

                  <div className="flex items-center gap-space-sm flex-wrap">
                    <Link
                      className="inline-flex items-center gap-2 bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg px-space-md py-2.5 rounded-lg transition-colors shadow-sm"
                      data-path="find-doctors"
                      href="/doctors"
                    >
                      <span className="material-symbols-outlined text-[18px]">search</span>
                      <span>Find a Doctor</span>
                    </Link>
                    <Link
                      className="inline-flex items-center gap-2 bg-surface-container-low hover:bg-surface-container text-on-surface font-label-lg text-label-lg px-space-md py-2.5 rounded-lg transition-colors"
                      data-path="my-appointments"
                      href="/appointments"
                    >
                      <span className="material-symbols-outlined text-[18px]">add_circle</span>
                      <span>Book Appointment</span>
                    </Link>
                  </div>
                </div>

                {/* Top Summary Metrics Card */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
                  <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-space-sm">
                      <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                        Upcoming Schedule
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-low text-primary font-label-sm text-label-sm font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        {upcomingAppointments.length > 0 ? 'Confirmed' : '0 Scheduled'}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-metric-val text-metric-val text-on-surface font-bold">
                        {upcomingAppointments.length}
                      </span>
                      <span className="font-label-md text-label-md text-secondary">
                        Scheduled Slot{upcomingAppointments.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <Link
                      href="/appointments"
                      className="mt-space-sm pt-space-xs flex items-center justify-between text-secondary hover:text-primary font-body-sm text-body-sm transition-colors"
                    >
                      <span className="truncate">
                        {nextAppt
                          ? `Next: Dr. ${nextDoctorName} • ${formatDate(nextAppt.appointment_date)} ${formatTime(nextAppt.start_time)}`
                          : 'No upcoming appointments scheduled'}
                      </span>
                      <span className="material-symbols-outlined text-primary text-[18px] ml-1">
                        arrow_forward
                      </span>
                    </Link>
                  </div>
                </div>

                {/* Main 2-Column Section */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
                  {/* Left Column (8 cols) */}
                  <div className="lg:col-span-8 flex flex-col gap-space-lg">
                    {/* Upcoming Care & Schedule Card */}
                    <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col gap-space-md">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary text-[24px]">calendar_clock</span>
                          <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                            Upcoming Care &amp; Schedule
                          </h2>
                        </div>
                        <Link
                          className="font-label-md text-label-md text-primary hover:underline flex items-center gap-1 font-semibold"
                          data-path="my-appointments"
                          href="/appointments"
                        >
                          <span>View All ({upcomingAppointments.length})</span>
                          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                        </Link>
                      </div>

                      {/* Display Next Upcoming Appointment if one exists */}
                      {nextAppt ? (
                        <div className="bg-surface-container-low p-space-md rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-space-md">
                          <div className="flex items-start gap-space-md min-w-0">
                            <img
                              className="w-14 h-14 rounded-full object-cover shadow-sm shrink-0"
                              alt={`Portrait of Dr. ${nextDoctorName}`}
                              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDxtDwtft52su85yj_03QuNv56lZUXQl1fWrddOa2CNl2kSVo18XjshcEodPpKfXjsypXK_l6T_Dc2Aw3wZ_vytlqM-CefQ3ycHCoJPmDudBvsJrPAX8G-LKuKrP99tnCwP5gMwfJ7Y-fs5_g0eTVFDppS6g--fY-cYbKUjbq0qeb9PrzJ4MA3zpIWJSE2Ljg-FPdMbVF5xM5D90sLMG0LLDPRXsMargxQYePAsilIm4Plt-y1KitDr4Q"
                            />
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-headline-sm text-headline-sm text-on-surface font-semibold truncate">
                                  Dr. {nextDoctorName}
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container-lowest text-primary font-label-sm text-label-sm font-semibold">
                                  In-Person Visit
                                </span>
                              </div>
                              <span className="font-body-sm text-body-sm text-secondary truncate">
                                {`${nextAppt.doctors?.specialization || 'Clinical Specialist'} • Department of ${nextDeptName}`}
                              </span>
                              <div className="flex items-center gap-space-md mt-1 text-on-surface-variant font-label-sm text-label-sm flex-wrap">
                                <span className="flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[16px] text-secondary">location_on</span>
                                  Consultation Suite • West Wing
                                </span>
                                <span className="flex items-center gap-1 text-primary font-semibold">
                                  <span className="material-symbols-outlined text-[16px]">schedule</span>
                                  {`${formatDate(nextAppt.appointment_date)}, ${formatTime(nextAppt.start_time)} – ${formatTime(nextAppt.end_time)}`}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex md:flex-col items-center md:items-end justify-between gap-2 shrink-0 pt-2 md:pt-0">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-lowest text-tertiary font-label-sm text-label-sm font-semibold">
                              <span className="w-2 h-2 rounded-full bg-tertiary" />
                              Confirmed
                            </span>
                            <div className="flex items-center gap-2">
                              <Link
                                href="/appointments"
                                className="bg-surface-container-lowest hover:bg-surface-container text-on-surface text-label-sm font-label-sm px-3 py-1.5 rounded-lg transition-colors font-semibold"
                              >
                                Details
                              </Link>
                              <Link
                                href="/appointments"
                                className="bg-primary hover:bg-primary-container text-on-primary text-label-sm font-label-sm px-3 py-1.5 rounded-lg transition-colors font-semibold"
                              >
                                Check-in
                              </Link>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Empty State when patient has NO booked appointments */
                        <div className="bg-surface-container-low p-space-lg rounded-xl flex flex-col items-center justify-center text-center gap-space-sm py-8">
                          <div className="w-12 h-12 rounded-full bg-primary-container/10 flex items-center justify-center text-primary mb-1">
                            <span className="material-symbols-outlined text-[28px]">calendar_today</span>
                          </div>
                          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                            No Upcoming Appointments
                          </h3>
                          <p className="font-body-sm text-body-sm text-secondary max-w-md">
                            You do not have any consultations booked at this time. Search our specialist directory to reserve a care slot.
                          </p>
                          <Link
                            href="/doctors"
                            className="mt-2 inline-flex items-center gap-2 bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg px-space-md py-2 rounded-lg transition-colors shadow-sm"
                          >
                            <span className="material-symbols-outlined text-[18px]">search</span>
                            <span>Find a Doctor</span>
                          </Link>
                        </div>
                      )}
                    </div>

                    {/* Find Doctors & Schedule Care Card */}
                    <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col gap-space-md">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                            Find Doctors &amp; Schedule Care
                          </h2>
                          <span className="font-label-sm text-label-sm text-secondary">
                            Primary Patient Navigation Area
                          </span>
                        </div>
                        <p className="font-body-sm text-body-sm text-secondary">
                          Quick access into medical departments, specialist availability, and immediate consultation slots.
                        </p>
                      </div>

                      {/* Search Bar */}
                      <form onSubmit={handleSearchSubmit} className="flex items-center bg-surface-container-low rounded-lg px-space-md py-2 gap-space-sm">
                        <span className="material-symbols-outlined text-secondary text-[20px]">search</span>
                        <input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="bg-transparent border-0 outline-none w-full font-body-sm text-body-sm text-on-surface placeholder:text-secondary"
                          placeholder="Search by physician name, clinical specialty, or symptom..."
                          type="text"
                        />
                        <button
                          type="submit"
                          className="bg-primary hover:bg-primary-container text-on-primary font-label-sm text-label-sm px-space-md py-1.5 rounded-md transition-colors shrink-0 font-semibold"
                        >
                          Search
                        </button>
                      </form>

                      {/* Top Medical Departments */}
                      <div className="flex flex-col gap-space-xs">
                        <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                          Top Medical Departments
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { name: 'Cardiology', icon: 'cardiology' },
                            { name: 'General Medicine', icon: 'stethoscope' },
                            { name: 'Pediatrics', icon: 'child_care' },
                            { name: 'Orthopedics', icon: 'orthopedics' },
                            { name: 'Dermatology', icon: 'dermatology' },
                            { name: 'Neurology', icon: 'neurology' },
                          ].map((dept) => (
                            <Link
                              key={dept.name}
                              href={`/doctors?department=${encodeURIComponent(dept.name)}`}
                              className="px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-label-sm text-label-sm transition-colors flex items-center gap-1.5 font-semibold"
                            >
                              <span className="material-symbols-outlined text-[16px] text-primary">{dept.icon}</span>
                              {dept.name}
                            </Link>
                          ))}
                        </div>
                      </div>

                      {/* Available Doctors Today */}
                      <div className="flex flex-col gap-space-sm pt-space-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                            Available Doctors Today
                          </span>
                          <Link
                            className="font-label-sm text-label-sm text-primary hover:underline flex items-center gap-1 font-semibold"
                            data-path="find-doctors"
                            href="/doctors"
                          >
                            <span>View All</span>
                            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                          </Link>
                        </div>

                        <div className="flex flex-col gap-2">
                          {doctors.length > 0 ? (
                            doctors.map((doc) => {
                              const docStatus = doc.doctor_daily_status?.[0]?.status || 'not_checked_in'
                              const delayMins = doc.doctor_daily_status?.[0]?.delay_minutes || 0

                              let statusBadge = (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-secondary font-label-sm text-label-sm">
                                  <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                                  Not Checked In
                                </span>
                              )

                              if (docStatus === 'available') {
                                statusBadge = (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-lowest text-tertiary font-label-sm text-label-sm font-semibold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                                    Available
                                  </span>
                                )
                              } else if (docStatus === 'delayed') {
                                statusBadge = (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-label-sm text-label-sm font-semibold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    {delayMins > 0 ? `Delayed (${delayMins}m)` : 'Delayed'}
                                  </span>
                                )
                              } else if (docStatus === 'on_leave') {
                                statusBadge = (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-error-container/30 text-error font-label-sm text-label-sm font-semibold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-error" />
                                    On Leave
                                  </span>
                                )
                              }

                              return (
                                <div
                                  key={doc.id}
                                  className="bg-surface-container-low hover:bg-surface-container transition-colors p-space-sm rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm"
                                >
                                  <div className="flex items-center gap-space-sm min-w-0">
                                    <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                                      {doc.profiles?.full_name?.charAt(0) || 'D'}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-label-lg text-label-lg text-on-surface font-semibold truncate">
                                          Dr. {doc.profiles?.full_name || 'Clinician'}
                                        </span>
                                        {statusBadge}
                                      </div>
                                      <span className="font-body-sm text-body-sm text-secondary truncate">
                                        {doc.specialization} • Department of {doc.departments?.name || 'General Medicine'}
                                      </span>
                                      <div className="flex items-center gap-1 text-primary font-label-sm text-label-sm mt-0.5">
                                        <span className="material-symbols-outlined text-[16px]">schedule</span>
                                        <span>Today • {doc.consultation_minutes || 15}m consultation slots</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                    <Link
                                      className="inline-flex items-center gap-1 bg-primary hover:bg-primary-container text-on-primary font-label-sm text-label-sm px-space-md py-1.5 rounded-lg transition-colors font-semibold"
                                      data-path="book-slot"
                                      href={`/doctors/${doc.id}`}
                                    >
                                      <span>View Slots</span>
                                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                                    </Link>
                                  </div>
                                </div>
                              )
                            })
                          ) : (
                            /* When doctors haven't been seeded yet (Step 4), show default preview matching Stitch */
                            <div className="bg-surface-container-low hover:bg-surface-container transition-colors p-space-sm rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
                              <div className="flex items-center gap-space-sm min-w-0">
                                <img
                                  alt="Dr. Alana Chen, MD"
                                  className="w-12 h-12 rounded-full object-cover shadow-sm shrink-0"
                                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDxtDwtft52su85yj_03QuNv56lZUXQl1fWrddOa2CNl2kSVo18XjshcEodPpKfXjsypXK_l6T_Dc2Aw3wZ_vytlqM-CefQ3ycHCoJPmDudBvsJrPAX8G-LKuKrP99tnCwP5gMwfJ7Y-fs5_g0eTVFDppS6g--fY-cYbKUjbq0qeb9PrzJ4MA3zpIWJSE2Ljg-FPdMbVF5xM5D90sLMG0LLDPRXsMargxQYePAsilIm4Plt-y1KitDr4Q"
                                />
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-label-lg text-label-lg text-on-surface font-semibold truncate">
                                      Dr. Alana Chen, MD
                                    </span>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-lowest text-tertiary font-label-sm text-label-sm font-semibold">
                                      <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                                      Available
                                    </span>
                                  </div>
                                  <span className="font-body-sm text-body-sm text-secondary truncate">
                                    Cardiologist • Heart &amp; Vascular Institute
                                  </span>
                                  <div className="flex items-center gap-1 text-primary font-label-sm text-label-sm mt-0.5">
                                    <span className="material-symbols-outlined text-[16px]">schedule</span>
                                    <span>Today • 4 slots open (Next: 2:15 PM)</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                <Link
                                  className="inline-flex items-center gap-1 bg-primary hover:bg-primary-container text-on-primary font-label-sm text-label-sm px-space-md py-1.5 rounded-lg transition-colors font-semibold"
                                  data-path="book-slot"
                                  href="/doctors"
                                >
                                  <span>View Slots</span>
                                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                                </Link>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column (4 cols) - Care Alerts */}
                  <div className="lg:col-span-4 flex flex-col gap-space-lg">
                    <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col gap-space-md">
                      <div className="flex items-center justify-between">
                        <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">Care Alerts</span>
                        <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold">
                          {unreadNotificationsCount} New
                        </span>
                      </div>

                      <div className="flex flex-col gap-space-sm">
                        {notifications.length > 0 ? (
                          notifications.map((notif) => (
                            <div
                              key={notif.id}
                              className="p-space-sm rounded-lg bg-surface-container-low flex items-start gap-space-xs"
                            >
                              <div className="flex flex-col min-w-0 w-full">
                                <div className="flex items-center gap-1.5 font-semibold text-on-surface text-sm">
                                  <span className="material-symbols-outlined text-[16px] text-primary">
                                    {notif.title.toLowerCase().includes('delay') ? 'schedule' : 'notifications'}
                                  </span>
                                  <span>{notif.title}</span>
                                </div>
                                <span className="font-body-sm text-body-sm text-secondary mt-1">
                                  {notif.body}
                                </span>
                                <span className="font-label-sm text-label-sm text-secondary mt-1">
                                  {formatRelativeTime(notif.created_at)}
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          /* Empty State when patient has 0 care alerts */
                          <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col items-center justify-center text-center py-6">
                            <span className="material-symbols-outlined text-secondary text-[28px] mb-1">
                              notifications_none
                            </span>
                            <span className="font-label-lg text-label-lg text-on-surface font-semibold">
                              No Care Alerts
                            </span>
                            <span className="font-body-sm text-body-sm text-secondary mt-1">
                              You are all caught up with your clinical notifications and appointment reminders.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <nav
          className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-container-lowest shadow-[0_-1px_8px_rgba(0,0,0,0.04)] z-40 flex items-center justify-around px-2"
          data-active-classes="text-primary font-semibold"
        >
          <Link
            aria-current="page"
            className="flex flex-col items-center justify-center transition-colors py-1 flex-1 text-primary font-semibold"
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
            className="flex flex-col items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors py-1 flex-1 relative"
            data-path="my-appointments"
            href="/appointments"
          >
            <span className="material-symbols-outlined text-[22px]">calendar_today</span>
            <span className="font-label-sm text-label-sm mt-0.5">Bookings</span>
            {upcomingAppointments.length > 0 && (
              <span className="absolute top-1 right-5 w-4 h-4 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] flex items-center justify-center font-bold">
                {upcomingAppointments.length}
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
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1 right-5 w-4 h-4 rounded-full bg-error-container text-on-error-container font-label-sm text-[10px] flex items-center justify-center font-bold">
                {unreadNotificationsCount}
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
