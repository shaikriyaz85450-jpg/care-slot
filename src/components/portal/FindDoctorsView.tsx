'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { SeedDepartment, SeedDoctor } from '@/lib/seed-data'

export interface FindDoctorsViewProps {
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
  departments: SeedDepartment[]
  doctors: SeedDoctor[]
  upcomingCount?: number
  unreadCount?: number
}

export function FindDoctorsView({
  user,
  profile,
  departments,
  doctors,
  upcomingCount = 0,
  unreadCount = 0,
}: FindDoctorsViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // Query parameter initialization
  const initialQuery = searchParams.get('q') || ''
  const initialDeptParam = searchParams.get('department') || 'all'

  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [selectedDept, setSelectedDept] = useState(initialDeptParam)
  const [sortBy, setSortBy] = useState<'earliest' | 'experience' | 'alpha'>('earliest')

  // Synchronize state when query parameters change
  useEffect(() => {
    const q = searchParams.get('q')
    if (q !== null && q !== searchQuery) {
      setSearchQuery(q)
    }
    const d = searchParams.get('department')
    if (d !== null && d !== selectedDept) {
      setSelectedDept(d)
    }
  }, [searchParams])

  // Update browser URL query params without page reload
  const updateUrlParams = (newQuery: string, newDept: string) => {
    const params = new URLSearchParams()
    if (newQuery.trim()) {
      params.set('q', newQuery.trim())
    }
    if (newDept && newDept !== 'all') {
      params.set('department', newDept)
    }
    const queryString = params.toString()
    const targetUrl = queryString ? `/doctors?${queryString}` : '/doctors'
    window.history.replaceState(null, '', targetUrl)
  }

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    updateUrlParams(value, selectedDept)
  }

  const handleDeptSelect = (deptSlug: string) => {
    setSelectedDept(deptSlug)
    updateUrlParams(searchQuery, deptSlug)
  }

  const handleResetFilters = () => {
    setSearchQuery('')
    setSelectedDept('all')
    setSortBy('earliest')
    updateUrlParams('', 'all')
  }

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

  // Helper to normalize department names for comparison
  const normalizeDept = (str: string) =>
    str.toLowerCase().replace(/[\s&/]+/g, '-').trim()

  // Calculate doctor counts per department
  const departmentCounts = useMemo(() => {
    const counts: Record<string, number> = { all: doctors.length }
    doctors.forEach((doc) => {
      const deptName = doc.departments?.name || ''
      const slug = normalizeDept(deptName)
      counts[slug] = (counts[slug] || 0) + 1
      counts[deptName.toLowerCase()] = (counts[deptName.toLowerCase()] || 0) + 1
    })
    return counts
  }, [doctors])

  // Filter and sort doctors
  const filteredDoctors = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    const deptFilter = selectedDept.toLowerCase()

    return doctors
      .filter((doc) => {
        // Department match
        let matchesDept = deptFilter === 'all'
        if (!matchesDept) {
          const docDept = (doc.departments?.name || '').toLowerCase()
          const docSlug = normalizeDept(docDept)
          matchesDept =
            docSlug === deptFilter ||
            docDept === deptFilter ||
            docDept.includes(deptFilter) ||
            deptFilter.includes(docSlug)
        }

        // Search query match
        let matchesQuery = true
        if (q) {
          const name = (doc.profiles?.full_name || '').toLowerCase()
          const spec = (doc.specialization || '').toLowerCase()
          const dept = (doc.departments?.name || '').toLowerCase()
          const qual = (doc.qualification || '').toLowerCase()
          const clinic = (doc.clinic_name || '').toLowerCase()
          matchesQuery =
            name.includes(q) ||
            spec.includes(q) ||
            dept.includes(q) ||
            qual.includes(q) ||
            clinic.includes(q)
        }

        return matchesDept && matchesQuery
      })
      .sort((a, b) => {
        if (sortBy === 'experience') {
          return (b.experience_years || 0) - (a.experience_years || 0)
        }
        if (sortBy === 'alpha') {
          const nameA = a.profiles?.full_name || ''
          const nameB = b.profiles?.full_name || ''
          return nameA.localeCompare(nameB)
        }
        // 'earliest': available first, then delayed, then on_leave, then not_checked_in
        const rank: Record<string, number> = {
          available: 1,
          delayed: 2,
          on_leave: 3,
          not_checked_in: 4,
        }
        const statusA = a.doctor_daily_status?.[0]?.status || 'not_checked_in'
        const statusB = b.doctor_daily_status?.[0]?.status || 'not_checked_in'
        return (rank[statusA] || 99) - (rank[statusB] || 99)
      })
  }, [doctors, searchQuery, selectedDept, sortBy])

  // Dynamic user data
  const patientFullName = profile?.full_name || 'Patient'
  const mrnCode = profile?.id
    ? `MRN #CS-${profile.id.replace(/-/g, '').substring(0, 5).toUpperCase()}`
    : 'Guest Access'
  const userInitial = patientFullName.charAt(0).toUpperCase()

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
              <span className="font-headline-sm text-headline-sm text-primary tracking-tight font-bold">
                CareSlot
              </span>
              <span className="font-label-sm text-label-sm text-secondary">
                Patient Portal
              </span>
            </div>
          </div>

          {/* Branch Pill */}
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

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1 px-space-md mt-space-sm">
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
              aria-current="page"
              className="flex items-center justify-between px-space-sm py-2 rounded-lg hover:bg-surface-container hover:text-on-surface transition-colors bg-primary-container text-on-primary-container font-semibold"
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
            <Link
              className="flex items-center gap-3 px-space-sm py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md text-label-md transition-colors"
              data-path="help-support"
              href="/profile"
            >
              <span className="material-symbols-outlined text-[18px]">help</span>
              <span>Help &amp; Support</span>
            </Link>

            {user ? (
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full flex items-center gap-3 px-space-sm py-1.5 rounded-lg text-error hover:bg-error-container/30 font-label-md text-label-md transition-colors text-left"
                data-path="login"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                <span>{isLoggingOut ? 'Logging out...' : 'Log out'}</span>
              </button>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-3 px-space-sm py-1.5 rounded-lg text-primary hover:bg-primary-container/10 font-label-md text-label-md transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">login</span>
                <span>Sign In</span>
              </Link>
            )}
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
                  <span className="font-headline-sm text-headline-sm text-primary font-bold">
                    CareSlot
                  </span>
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
                  className="flex items-center justify-between px-space-sm py-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  href="/"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[20px]">home</span>
                    <span className="font-label-lg text-label-lg">Home</span>
                  </div>
                </Link>
                <Link
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between px-space-sm py-2 rounded-lg bg-primary-container text-on-primary-container font-semibold"
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
                  {upcomingCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold">
                      {upcomingCount}
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
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold">
                      {unreadCount}
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
              {user ? (
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full flex items-center gap-3 px-space-sm py-2 rounded-lg text-error hover:bg-error-container/30 font-label-md text-label-md"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  <span>{isLoggingOut ? 'Logging out...' : 'Log out'}</span>
                </button>
              ) : (
                <Link
                  href="/login"
                  className="w-full flex items-center gap-3 px-space-sm py-2 rounded-lg text-primary hover:bg-primary-container/10 font-label-md text-label-md"
                >
                  <span className="material-symbols-outlined text-[18px]">login</span>
                  <span>Sign In</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
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
              <span className="font-headline-sm text-headline-sm text-primary font-bold">
                CareSlot
              </span>
            </div>

            {/* Desktop Quick Search */}
            <div className="hidden md:flex items-center bg-surface-container-low rounded-lg px-space-sm py-1.5 w-64 lg:w-80 gap-space-xs">
              <span className="material-symbols-outlined text-secondary text-[18px]">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search doctors, specialties, clinics..."
                className="bg-transparent border-0 outline-none w-full font-body-sm text-body-sm text-on-surface placeholder:text-secondary"
              />
            </div>
          </div>

          <div className="flex items-center gap-space-md">
            <div className="relative flex items-center">
              <Link
                href="/notifications"
                aria-label="Notifications"
                className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors relative"
              >
                <span className="material-symbols-outlined text-[22px]">notifications</span>
                {unreadCount > 0 && (
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
                {userInitial}
              </div>
            </div>
          </div>
        </header>

        {/* Main Body */}
        <main className="w-full pt-16 pb-20 lg:pb-0 bg-surface flex-1">
          <div className="flex flex-col w-full">
            <div className="max-w-[1280px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
              {/* Page Header & Breadcrumb */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
                <div className="flex flex-col gap-1.5">
                  <nav
                    aria-label="Breadcrumb"
                    className="flex items-center gap-1.5 text-secondary font-label-sm text-label-sm"
                  >
                    <Link
                      className="hover:text-primary transition-colors flex items-center gap-1"
                      href="/"
                    >
                      <span className="material-symbols-outlined text-[16px]">home</span>
                      Home
                    </Link>
                    <span className="material-symbols-outlined text-[14px] text-secondary">
                      chevron_right
                    </span>
                    <span className="text-primary font-semibold">Find Doctors</span>
                  </nav>
                  <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
                    Find a Doctor
                  </h1>
                  <p className="font-body-md text-body-md text-secondary">
                    Check real-time clinical availability and secure your consultation slot before arrival.
                  </p>
                </div>
              </div>

              {/* Search & Filter Controls Surface */}
              <div className="bg-surface-container-lowest rounded-xl shadow-sm p-4 sm:p-5 flex flex-col gap-4">
                {/* Search Input Toolbar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <div className="relative flex-1 flex items-center">
                    <span className="material-symbols-outlined absolute left-3.5 text-secondary text-[20px] pointer-events-none">
                      search
                    </span>
                    <input
                      className="w-full h-11 pl-10 pr-9 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface placeholder:text-secondary focus:outline-none focus:bg-surface-container-lowest transition-all"
                      id="doctorSearchInput"
                      placeholder="Search doctors by name, specialty, or clinic..."
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                    />
                    {searchQuery && (
                      <button
                        className="absolute right-2.5 text-secondary hover:text-on-surface p-1 rounded-md transition-colors"
                        id="clearSearchBtn"
                        onClick={() => handleSearchChange('')}
                        title="Clear search"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    )}
                  </div>
                  <button
                    className="h-11 px-6 bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 font-semibold"
                    type="button"
                    onClick={() => updateUrlParams(searchQuery, selectedDept)}
                  >
                    <span className="material-symbols-outlined text-[18px]">manage_search</span>
                    Search
                  </button>
                </div>

                {/* Department Filter Pills */}
                <div
                  className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-none"
                  id="deptPillContainer"
                >
                  <button
                    className={`dept-pill whitespace-nowrap px-3.5 py-1.5 rounded-full font-label-md text-label-md flex items-center gap-1.5 transition-all font-semibold ${
                      selectedDept === 'all'
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                    }`}
                    data-dept="all"
                    onClick={() => handleDeptSelect('all')}
                    type="button"
                  >
                    All
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                        selectedDept === 'all'
                          ? 'bg-on-primary/20 text-on-primary'
                          : 'bg-surface-container-highest text-secondary'
                      }`}
                    >
                      {departmentCounts['all'] || doctors.length}
                    </span>
                  </button>

                  {departments.map((dept) => {
                    const slug = normalizeDept(dept.name)
                    const isSelected =
                      selectedDept === slug ||
                      selectedDept.toLowerCase() === dept.name.toLowerCase()
                    const count = departmentCounts[slug] || departmentCounts[dept.name.toLowerCase()] || 0

                    return (
                      <button
                        key={dept.id}
                        className={`dept-pill whitespace-nowrap px-3.5 py-1.5 rounded-full font-label-md text-label-md flex items-center gap-1.5 transition-all font-semibold ${
                          isSelected
                            ? 'bg-primary text-on-primary shadow-sm'
                            : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                        }`}
                        data-dept={slug}
                        onClick={() => handleDeptSelect(slug)}
                        type="button"
                      >
                        {dept.name}
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                            isSelected
                              ? 'bg-on-primary/20 text-on-primary'
                              : 'bg-surface-container-highest text-secondary'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Live Filter Status & Sorter Info Bar */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-secondary">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-primary">
                      clinical_notes
                    </span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant" id="resultsCountNotice">
                      {filteredDoctors.length > 0 ? (
                        <>
                          Showing{' '}
                          <strong className="text-on-surface font-semibold" id="displayedCount">
                            {filteredDoctors.length}
                          </strong>{' '}
                          specialist{filteredDoctors.length === 1 ? '' : 's'} across{' '}
                          {selectedDept === 'all'
                            ? 'all departments'
                            : selectedDept.replace(/-/g, ' ')}
                        </>
                      ) : (
                        'No specialists found matching criteria'
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <label className="font-label-sm text-label-sm text-secondary" htmlFor="sortBySelect">
                      Sort by:
                    </label>
                    <div className="relative">
                      <select
                        className="appearance-none bg-surface-container-low text-on-surface font-label-md text-label-md py-1.5 pl-3 pr-8 rounded-lg focus:outline-none cursor-pointer"
                        id="sortBySelect"
                        value={sortBy}
                        onChange={(e) =>
                          setSortBy(e.target.value as 'earliest' | 'experience' | 'alpha')
                        }
                      >
                        <option value="earliest">Earliest Available</option>
                        <option value="experience">Experience (Highest)</option>
                        <option value="alpha">Alphabetical (A-Z)</option>
                      </select>
                      <span className="material-symbols-outlined text-[16px] text-secondary absolute right-2 top-2 pointer-events-none">
                        expand_more
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Doctor Cards Master Grid */}
              {filteredDoctors.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" id="doctorGrid">
                  {filteredDoctors.map((doc) => {
                    const docStatus = doc.doctor_daily_status?.[0]?.status || 'not_checked_in'
                    const delayMins = doc.doctor_daily_status?.[0]?.delay_minutes || 0
                    const doctorName = doc.profiles?.full_name || 'Clinician'
                    const deptName = doc.departments?.name || 'General Medicine'

                    return (
                      <div
                        key={doc.id}
                        className={`doctor-card bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between overflow-hidden ${
                          docStatus === 'on_leave' ? 'opacity-90' : ''
                        }`}
                        data-dept={normalizeDept(deptName)}
                        data-exp={doc.experience_years}
                        data-name={doctorName}
                        data-status={docStatus}
                      >
                        <div className="p-5 flex flex-col gap-4">
                          {/* Top Section */}
                          <div className="flex items-start gap-3.5">
                            {doc.avatar_url ? (
                              <img
                                alt={`Dr. ${doctorName}, MD`}
                                className="w-14 h-14 rounded-full object-cover shadow-sm shrink-0"
                                src={doc.avatar_url}
                              />
                            ) : (
                              <div
                                className={`w-14 h-14 rounded-full font-headline-sm text-headline-sm flex items-center justify-center font-bold shadow-sm shrink-0 ${
                                  docStatus === 'on_leave'
                                    ? 'bg-secondary-container text-on-secondary-container'
                                    : 'bg-primary-fixed text-on-primary-fixed'
                                }`}
                              >
                                {doc.initials || doctorName.substring(0, 2).toUpperCase()}
                              </div>
                            )}

                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h3 className="font-headline-sm text-headline-sm text-on-surface truncate font-semibold">
                                  Dr. {doctorName}, MD
                                </h3>
                                <span
                                  className="material-symbols-outlined text-primary text-[18px] shrink-0"
                                  title="Hospital Verified Specialist"
                                >
                                  verified
                                </span>
                              </div>
                              <span className="font-label-sm text-label-sm text-secondary truncate">
                                {doc.specialization} • {doc.clinic_name || `${deptName} Clinic`}
                              </span>
                              <span className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 truncate">
                                {doc.qualification}
                              </span>
                              <div className="mt-1 flex items-center gap-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container-high font-label-sm text-label-sm text-on-surface-variant font-medium">
                                  {doc.experience_years} Years Exp.
                                </span>
                                <span className="text-secondary text-[11px]">
                                  • {doc.desk_location || 'Consultation Desk'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* CORE DIFFERENTIATOR: Prominent Live Availability Status */}
                          {docStatus === 'available' && (
                            <div className="bg-tertiary-container/10 p-3 rounded-lg flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="relative flex h-2.5 w-2.5 shrink-0">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-tertiary opacity-75" />
                                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-tertiary" />
                                </span>
                                <span className="font-label-md text-label-md text-tertiary font-semibold">
                                  Live • Available Today
                                </span>
                              </div>
                              <span className="font-label-sm text-label-sm text-tertiary-container bg-surface-container-lowest px-2 py-0.5 rounded shadow-sm font-semibold">
                                On Schedule
                              </span>
                            </div>
                          )}

                          {docStatus === 'delayed' && (
                            <div className="bg-secondary-container/50 p-3 rounded-lg flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full bg-secondary shrink-0" />
                                <span className="font-label-md text-label-md text-on-secondary-container font-semibold">
                                  Delayed ~{delayMins || 20} min
                                </span>
                              </div>
                              <span className="font-label-sm text-label-sm text-secondary bg-surface-container-lowest px-2 py-0.5 rounded shadow-sm font-semibold">
                                Behind Schedule
                              </span>
                            </div>
                          )}

                          {docStatus === 'on_leave' && (
                            <div className="bg-surface-container-high p-3 rounded-lg flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full bg-secondary shrink-0" />
                                <span className="font-label-md text-label-md text-secondary font-semibold">
                                  On Leave Today
                                </span>
                              </div>
                              <span className="font-label-sm text-label-sm text-secondary bg-surface-container-lowest px-2 py-0.5 rounded shadow-sm font-semibold">
                                No Intake
                              </span>
                            </div>
                          )}

                          {docStatus === 'not_checked_in' && (
                            <div className="bg-surface-container-low p-3 rounded-lg flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full bg-secondary shrink-0" />
                                <span className="font-label-md text-label-md text-secondary font-semibold">
                                  Not Checked In
                                </span>
                              </div>
                              <span className="font-label-sm text-label-sm text-secondary bg-surface-container-lowest px-2 py-0.5 rounded shadow-sm font-semibold">
                                Pending
                              </span>
                            </div>
                          )}

                          {/* Key Information Row & Slots */}
                          <div className="flex flex-col gap-2.5 pt-1">
                            <div className="flex items-center justify-between text-secondary">
                              <div className="flex items-center gap-1 font-body-sm text-body-sm">
                                <span className="material-symbols-outlined text-[16px] text-secondary">
                                  schedule
                                </span>
                                {doc.consultation_minutes || 20} min consult
                              </div>
                              <span
                                className={`font-label-sm text-label-sm font-semibold ${
                                  docStatus === 'available'
                                    ? 'text-tertiary'
                                    : docStatus === 'delayed'
                                      ? 'text-on-surface-variant'
                                      : 'text-secondary'
                                }`}
                              >
                                {docStatus === 'available'
                                  ? `${doc.slots_today?.length || 4} slots open today`
                                  : docStatus === 'delayed'
                                    ? `${doc.slots_today?.length || 2} slots open today`
                                    : '0 slots open'}
                              </span>
                            </div>

                            {/* Slot Preview Chips / On Leave Banner */}
                            {docStatus === 'on_leave' ? (
                              <div className="bg-surface-container-low rounded-lg p-2.5 flex items-center gap-2 text-on-surface-variant">
                                <span className="material-symbols-outlined text-secondary text-[18px]">
                                  calendar_month
                                </span>
                                <span className="font-label-sm text-label-sm">
                                  Next available:{' '}
                                  <strong className="text-on-surface">Tomorrow</strong>
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between">
                                  <span
                                    className={`font-label-sm text-label-sm ${
                                      docStatus === 'delayed' ? 'text-error font-semibold' : 'text-secondary'
                                    }`}
                                  >
                                    {docStatus === 'delayed'
                                      ? `Next pushed to: ${doc.slots_today?.[0] || '03:30 PM'}`
                                      : `Next slot: ${doc.slots_today?.[0] || '02:15 PM'}`}
                                  </span>
                                  <span
                                    className={`font-label-sm text-label-sm ${
                                      docStatus === 'delayed' ? 'text-secondary' : 'text-primary font-semibold'
                                    }`}
                                  >
                                    {docStatus === 'delayed' ? 'Adjusted' : 'In-Person'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {doc.slots_today && doc.slots_today.length > 0 ? (
                                    doc.slots_today.map((slotTime, idx) => (
                                      <Link
                                        key={slotTime}
                                        href={`/doctors/${doc.id}`}
                                        className={`flex-1 py-1.5 px-2 font-label-sm text-label-sm rounded-lg text-center transition-all ${
                                          idx === 0
                                            ? 'bg-primary text-on-primary shadow-sm hover:bg-primary-container font-semibold'
                                            : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container font-medium'
                                        }`}
                                      >
                                        {slotTime}
                                      </Link>
                                    ))
                                  ) : (
                                    <>
                                      <Link
                                        href={`/doctors/${doc.id}`}
                                        className="flex-1 py-1.5 px-2 bg-primary text-on-primary font-label-sm text-label-sm rounded-lg text-center shadow-sm hover:bg-primary-container transition-all font-semibold"
                                      >
                                        02:15 PM
                                      </Link>
                                      <Link
                                        href={`/doctors/${doc.id}`}
                                        className="flex-1 py-1.5 px-2 bg-surface-container-low text-on-surface-variant hover:bg-surface-container font-label-sm text-label-sm rounded-lg text-center transition-all font-medium"
                                      >
                                        03:00 PM
                                      </Link>
                                      <Link
                                        href={`/doctors/${doc.id}`}
                                        className="flex-1 py-1.5 px-2 bg-surface-container-low text-on-surface-variant hover:bg-surface-container font-label-sm text-label-sm rounded-lg text-center transition-all font-medium"
                                      >
                                        04:15 PM
                                      </Link>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons Footer */}
                        <div className="px-5 py-3.5 bg-surface-container-low flex items-center gap-2">
                          <Link
                            className="flex-1 h-9 rounded-lg bg-surface-container-lowest hover:bg-surface text-on-surface font-label-md text-label-md transition-colors shadow-sm flex items-center justify-center font-semibold"
                            href={`/doctors/${doc.id}`}
                          >
                            View Profile
                          </Link>

                          {docStatus === 'on_leave' ? (
                            <button
                              className="flex-1 h-9 rounded-lg bg-surface-container-highest text-secondary font-label-md text-label-md cursor-not-allowed flex items-center justify-center gap-1 font-semibold"
                              disabled
                              type="button"
                            >
                              Slot Unavailable
                            </button>
                          ) : (
                            <Link
                              className="flex-1 h-9 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md transition-colors shadow-sm flex items-center justify-center gap-1 font-semibold"
                              href={`/doctors/${doc.id}`}
                            >
                              Book Slot
                              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                            </Link>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                /* Empty State (triggered on unmatched search/filter) */
                <div
                  className="flex flex-col items-center justify-center text-center p-12 bg-surface-container-lowest rounded-xl shadow-sm"
                  id="noResultsState"
                >
                  <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center text-secondary mb-4">
                    <span className="material-symbols-outlined text-[32px]">person_search</span>
                  </div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                    No doctors found
                  </h3>
                  <p className="font-body-md text-body-md text-secondary mt-1 max-w-md">
                    No doctors found matching your criteria. Try loosening your search terms or view all departments.
                  </p>
                  <button
                    className="mt-5 h-10 px-5 bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md rounded-lg shadow-sm transition-colors flex items-center gap-1.5 font-semibold"
                    onClick={handleResetFilters}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                    Reset all filters
                  </button>
                </div>
              )}
            </div>
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
