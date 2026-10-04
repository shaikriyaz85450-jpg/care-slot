'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { resolveUserAuthorization } from '@/lib/role-utils'
import type { UserRole } from '@/types'

interface StitchLandingPageProps {
  initialRole?: UserRole | null
  autoOpenLogin?: boolean
}

export function StitchLandingPageContent({ initialRole = null, autoOpenLogin = false }: StitchLandingPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const roleParam = (searchParams.get('role') as UserRole) || initialRole
  const [selectedRole, setSelectedRole] = useState<UserRole>(roleParam || 'patient')
  const [isLoginOpen, setIsLoginOpen] = useState(Boolean(roleParam || autoOpenLogin))

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (roleParam) {
      setSelectedRole(roleParam)
      setIsLoginOpen(true)
    }
  }, [roleParam])

  const handleOpenLogin = (role: UserRole) => {
    setSelectedRole(role)
    setErrorMsg('')
    setIsLoginOpen(true)
  }

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim() || !password) {
      setErrorMsg('Please enter both your email address and password.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg('')

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (error) {
        setErrorMsg(error.message)
        setIsSubmitting(false)
        return
      }

      if (data?.user) {
        // Resolve user authorization from the database relationship:
        // auth.uid() -> profiles.id -> profiles.role = 'doctor' -> doctors.profile_id = profiles.id -> doctors.is_active = true
        const authResult = await resolveUserAuthorization(supabase, data.user.id)
        const userRole = authResult.role

        // Role verification: check if user is logging into the appropriate portal
        if (selectedRole === 'admin' && !authResult.isAdmin) {
          setErrorMsg('Access denied. This account does not possess hospital administrator credentials.')
          await supabase.auth.signOut()
          setIsSubmitting(false)
          return
        }

        if (selectedRole === 'doctor' && !authResult.isAuthorizedDoctor && !authResult.isAdmin) {
          setErrorMsg('Access denied. This account is not registered as an authorized hospital physician.')
          await supabase.auth.signOut()
          setIsSubmitting(false)
          return
        }

        // Route strictly based on the authenticated user's actual database role:
        // The selected tab must NOT override the actual database role.
        if (userRole === 'admin') {
          router.push('/admin')
        } else if (userRole === 'doctor') {
          router.push('/doctor/dashboard')
        } else {
          const redirectTo = searchParams.get('redirectTo') || '/'
          router.push(redirectTo)
        }
        router.refresh()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed. Please verify credentials.'
      setErrorMsg(msg)
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-background font-body-md text-on-surface antialiased min-h-screen flex flex-col justify-between">
      {/* Fixed Header */}
      <header className="fixed top-0 w-full z-50 bg-surface/90 backdrop-blur-md shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-16 max-w-7xl mx-auto px-margin flex items-center justify-between gap-gutter">
          <div className="flex items-center gap-space-md">
            <img
              alt="CareSlot logo"
              className="h-8 w-auto object-contain"
              src="https://lh3.googleusercontent.com/aida/AEtjO1Xuc9Rs6Ae-tAN7zLtOttlwVNu3xgirpZWKdtsMa1C3sEzJ7GBC3kiG_3bRBG3PtB7zQRAO4zmUwFlJVpHxPBps4NmzsMtuY3w9p5VVvq0K64sme4zB5y7Tfi6_XWOsQxVPGanWvZuHqsA-PZPB0wxmuQAPHH2RFOmeZUDYPaCs8JvvNxyOUJFd5u3tLAbHh1314BMy8nWjYb7N1sKvcSq3aQhGyRnM-qAkpigWWLwOeh6XI74TvAXaycs"
            />
            <Link
              className="font-headline-sm text-headline-sm text-primary font-bold tracking-tight"
              data-path="home"
              href="/"
            >
              CareSlot
            </Link>
          </div>

          <nav
            className="hidden lg:flex items-center gap-space-lg"
            data-active-classes="bg-primary-container text-on-primary-container rounded-lg px-space-sm py-space-xs font-label-md text-label-md"
          >
            <Link
              aria-current="page"
              className="transition-colors bg-primary-container text-on-primary-container rounded-lg px-space-sm py-space-xs font-label-md text-label-md"
              data-path="home"
              href="/"
            >
              Home
            </Link>
            <a
              className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors"
              data-path="how-it-works"
              href="#how-it-works"
            >
              How It Works
            </a>
            <a
              className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors"
              data-path="departments"
              href="#portals"
            >
              Departments
            </a>
            <a
              className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors"
              data-path="find-doctors"
              href="#doctors"
            >
              Find Doctors
            </a>
            <a
              className="font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface transition-colors"
              data-path="about"
              href="#how-it-works"
            >
              About
            </a>
          </nav>

          <div className="flex items-center gap-space-sm">
            <button
              onClick={() => handleOpenLogin('patient')}
              className="hidden sm:inline-flex items-center px-space-md py-space-xs rounded-lg font-label-lg text-label-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors"
              data-path="sign-in"
            >
              Sign In
            </button>
            <Link
              className="inline-flex items-center px-space-md py-space-xs rounded-lg bg-primary text-on-primary font-label-lg text-label-lg hover:bg-primary-container hover:text-on-primary-container transition-colors shadow-[0_1px_3px_rgba(15,23,42,0.05)]"
              data-path="create-patient-account"
              href="/signup"
            >
              Create Patient Account
            </Link>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0 ml-space-xs">
              <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full pt-16 bg-background flex-1 max-w-7xl mx-auto px-margin">
        <div className="flex flex-col w-full">
          {/* Hero Section */}
          <section className="relative py-space-xl lg:py-24 overflow-hidden">
            <div className="max-w-5xl mx-auto text-center flex flex-col items-center">
              {/* Badge Tag */}
              <div className="inline-flex items-center gap-space-xs px-space-md py-1 rounded-full bg-surface-container-high text-primary font-label-md text-label-md mb-space-lg shadow-sm">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                Hospital Doctor Availability &amp; Real-Time Scheduling
              </div>

              {/* Main Headline */}
              <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface tracking-tight max-w-4xl font-bold">
                Instant Doctor Availability, <br className="hidden sm:inline" />
                Seamless Hospital Appointments
              </h1>

              {/* Subtitle */}
              <p className="mt-space-md font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
                CareSlot connects patients, healthcare providers, and hospital administration with real-time schedule
                synchronization and reliable appointment booking.
              </p>

              {/* Key Value Propositions */}
              <div className="mt-space-lg flex flex-wrap justify-center gap-space-sm sm:gap-space-md">
                <div className="inline-flex items-center gap-2 px-space-md py-2 rounded-lg bg-surface-container-lowest shadow-sm">
                  <span
                    className="material-symbols-outlined text-primary text-[20px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    sync
                  </span>
                  <span className="font-label-lg text-label-lg text-on-surface">Real-Time Live Status Updates</span>
                </div>
                <div className="inline-flex items-center gap-2 px-space-md py-2 rounded-lg bg-surface-container-lowest shadow-sm">
                  <span
                    className="material-symbols-outlined text-primary text-[20px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    verified_user
                  </span>
                  <span className="font-label-lg text-label-lg text-on-surface">0 Double Bookings</span>
                </div>
                <div className="inline-flex items-center gap-2 px-space-md py-2 rounded-lg bg-surface-container-lowest shadow-sm">
                  <span
                    className="material-symbols-outlined text-primary text-[20px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    mark_email_read
                  </span>
                  <span className="font-label-lg text-label-lg text-on-surface">Instant Digital Confirmations</span>
                </div>
              </div>

              {/* Quick Action Jump */}
              <div className="mt-space-xl flex items-center gap-space-md">
                <a
                  className="inline-flex items-center gap-2 px-space-lg py-3 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg hover:bg-primary-container transition-all shadow-sm"
                  href="#portals"
                >
                  <span>Select Your Portal</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
                </a>
                <a
                  className="inline-flex items-center gap-2 px-space-lg py-3 rounded-lg bg-surface-container text-on-surface font-label-lg text-label-lg hover:bg-surface-container-high transition-all"
                  href="#how-it-works"
                >
                  <span>Explore Workflow</span>
                </a>
              </div>
            </div>
          </section>

          {/* Hospital Live Pulse Visual Strip */}
          <section className="w-full bg-surface-container-lowest shadow-sm rounded-xl p-space-lg mb-space-xl">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-space-lg items-center">
              <div className="flex items-center gap-space-md">
                <div className="w-12 h-12 rounded-lg bg-surface-container-low flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-[28px]">local_hospital</span>
                </div>
                <div>
                  <div className="font-label-sm text-label-sm uppercase tracking-wider text-outline">Central Facility</div>
                  <div className="font-headline-sm text-headline-sm text-on-surface font-semibold">St. Jude Medical</div>
                </div>
              </div>
              <div className="flex items-center gap-space-md">
                <div className="w-12 h-12 rounded-lg bg-secondary-container flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-secondary text-[28px]">stethoscope</span>
                </div>
                <div>
                  <div className="font-label-sm text-label-sm uppercase tracking-wider text-outline">Active Roster</div>
                  <div className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    42 Physicians On-Duty
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-space-md">
                <div className="w-12 h-12 rounded-lg bg-tertiary-fixed flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-tertiary text-[28px]">event_available</span>
                </div>
                <div>
                  <div className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
                    Live Consult Slots
                  </div>
                  <div className="font-headline-sm text-headline-sm text-on-surface font-semibold">189 Open Today</div>
                </div>
              </div>
              <div className="flex items-center justify-end">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container text-primary font-label-md text-label-md">
                  <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                  Direct Synchronization Active
                </div>
              </div>
            </div>
          </section>

          {/* ROLE PORTALS ACCESS (Central Core Section) */}
          <section className="py-space-xl scroll-mt-20" id="portals">
            <div className="text-center max-w-3xl mx-auto mb-space-xl">
              <div className="font-label-md text-label-md uppercase tracking-wider text-primary font-semibold">
                Hospital Access Hub
              </div>
              <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold mt-1">Choose Your Portal</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-2">
                Access CareSlot based on your hospital role to manage appointments, doctor schedules, or clinical
                administrative operations.
              </p>
            </div>

            {/* 3-Column Portal Card Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-lg items-stretch">
              {/* Card 1: PATIENT PORTAL */}
              <div className="bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-shadow p-space-lg flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary"></div>
                <div>
                  <div className="flex items-center justify-between mb-space-md mt-1">
                    <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-[28px]">personal_injury</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-surface-container-high text-primary font-label-sm text-label-sm font-semibold">
                      Self-registration enabled
                    </span>
                  </div>
                  <h3 className="font-headline-md text-headline-md text-on-surface font-bold">Patient Portal</h3>
                  <p className="mt-2 font-body-md text-body-md text-on-surface-variant">
                    Search certified hospital physicians, check real-time availability, and book or manage your
                    appointments in seconds.
                  </p>
                  <div className="mt-space-lg space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <span
                        className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                      <span className="font-body-md text-body-md text-on-surface">
                        Search verified doctors by specialty &amp; hospital wing
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span
                        className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                      <span className="font-body-md text-body-md text-on-surface">
                        View real-time open consultation slots
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span
                        className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                      <span className="font-body-md text-body-md text-on-surface">
                        Track appointment status &amp; digital intake slip
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-space-xl pt-space-md space-y-2.5 bg-surface-container-low -mx-space-lg -mb-space-lg p-space-lg rounded-b-xl">
                  <button
                    onClick={() => handleOpenLogin('patient')}
                    className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg hover:bg-primary-container transition-colors shadow-sm"
                    data-path="login-patient"
                  >
                    <span>Sign In as Patient</span>
                    <span className="material-symbols-outlined text-[18px]">login</span>
                  </button>
                  <Link
                    className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-surface-container-lowest text-on-surface font-label-lg text-label-lg hover:bg-surface-container transition-colors shadow-sm"
                    data-path="signup-patient"
                    href="/signup"
                  >
                    <span>Create Patient Account</span>
                    <span className="material-symbols-outlined text-[18px]">person_add</span>
                  </Link>
                  <p className="font-label-sm text-label-sm text-center text-outline-variant pt-1">
                    Free digital profile with immediate booking privileges.
                  </p>
                </div>
              </div>

              {/* Card 2: DOCTOR PORTAL */}
              <div className="bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-shadow p-space-lg flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-primary-container"></div>
                <div>
                  <div className="flex items-center justify-between mb-space-md mt-1">
                    <div className="w-12 h-12 rounded-lg bg-secondary-container flex items-center justify-center">
                      <span className="material-symbols-outlined text-secondary text-[28px]">stethoscope</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface font-label-sm text-label-sm font-semibold">
                      Authorized Staff Only
                    </span>
                  </div>
                  <h3 className="font-headline-md text-headline-md text-on-surface font-bold">Doctor Portal</h3>
                  <p className="mt-2 font-body-md text-body-md text-on-surface-variant">
                    Manage your daily consultation schedule, toggle live clinic availability status, and review upcoming
                    patient consultations.
                  </p>
                  <div className="mt-space-lg space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <span
                        className="material-symbols-outlined text-primary-container text-[18px] shrink-0 mt-0.5"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                      <span className="font-body-md text-body-md text-on-surface">
                        Live status control (Available / In-Consult / Away)
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span
                        className="material-symbols-outlined text-primary-container text-[18px] shrink-0 mt-0.5"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                      <span className="font-body-md text-body-md text-on-surface">
                        Auto-slot consultation schedule generator
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span
                        className="material-symbols-outlined text-primary-container text-[18px] shrink-0 mt-0.5"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                      <span className="font-body-md text-body-md text-on-surface">
                        Daily patient schedule overview &amp; telehealth bridge
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-space-xl pt-space-md space-y-2.5 bg-surface-container-low -mx-space-lg -mb-space-lg p-space-lg rounded-b-xl">
                  <button
                    onClick={() => handleOpenLogin('doctor')}
                    className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg hover:bg-primary-container transition-colors shadow-sm"
                    data-path="login-doctor"
                  >
                    <span>Sign In as Doctor</span>
                    <span className="material-symbols-outlined text-[18px]">badge</span>
                  </button>
                  <div className="p-2.5 rounded-lg bg-surface-container text-on-surface-variant flex items-start gap-2">
                    <span className="material-symbols-outlined text-outline text-[16px] shrink-0 mt-0.5">info</span>
                    <p className="font-label-sm text-label-sm leading-tight text-on-surface-variant">
                      Doctor accounts are provisioned and activated by Hospital Administration. No public signup.
                    </p>
                  </div>
                </div>
              </div>

              {/* Card 3: ADMIN PORTAL */}
              <div className="bg-surface-container-lowest rounded-xl shadow-sm hover:shadow-md transition-shadow p-space-lg flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-inverse-surface"></div>
                <div>
                  <div className="flex items-center justify-between mb-space-md mt-1">
                    <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center">
                      <span className="material-symbols-outlined text-inverse-surface text-[28px]">
                        admin_panel_settings
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold">
                      Restricted Access
                    </span>
                  </div>
                  <h3 className="font-headline-md text-headline-md text-on-surface font-bold">
                    Hospital Administration
                  </h3>
                  <p className="mt-2 font-body-md text-body-md text-on-surface-variant">
                    Oversee hospital departments, onboard and manage doctor credentials, monitor schedule availability,
                    and administer all hospital appointments.
                  </p>
                  <div className="mt-space-lg space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <span
                        className="material-symbols-outlined text-tertiary text-[18px] shrink-0 mt-0.5"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                      <span className="font-body-md text-body-md text-on-surface">
                        Physician roster &amp; operational status control
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span
                        className="material-symbols-outlined text-tertiary text-[18px] shrink-0 mt-0.5"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                      <span className="font-body-md text-body-md text-on-surface">
                        Medical department catalog &amp; wing management
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span
                        className="material-symbols-outlined text-tertiary text-[18px] shrink-0 mt-0.5"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        check_circle
                      </span>
                      <span className="font-body-md text-body-md text-on-surface">
                        System-wide appointment audits &amp; scheduling queue
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-space-xl pt-space-md space-y-2.5 bg-surface-container-low -mx-space-lg -mb-space-lg p-space-lg rounded-b-xl">
                  <button
                    onClick={() => handleOpenLogin('admin')}
                    className="w-full flex items-center justify-center gap-2 h-10 rounded-lg bg-inverse-surface text-inverse-on-surface font-label-lg text-label-lg hover:bg-on-background transition-colors shadow-sm"
                    data-path="login-admin"
                  >
                    <span>Sign In as Admin</span>
                    <span className="material-symbols-outlined text-[18px]">security</span>
                  </button>
                  <div className="p-2.5 rounded-lg bg-surface-container text-on-surface-variant flex items-start gap-2">
                    <span className="material-symbols-outlined text-outline text-[16px] shrink-0 mt-0.5">lock</span>
                    <p className="font-label-sm text-label-sm leading-tight text-on-surface-variant">
                      Restricted system administrator access. Authorized personnel only.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Visual Hospital Environment Banner */}
          <section className="py-space-md">
            <div className="relative w-full rounded-2xl overflow-hidden bg-surface-container-low">
              <div className="grid grid-cols-1 lg:grid-cols-12 items-center">
                <div className="lg:col-span-7 p-space-xl lg:p-12 z-10">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-lowest text-primary font-label-sm text-label-sm font-semibold mb-4">
                    <span className="material-symbols-outlined text-[16px]">verified</span> Real-Time Synchronized
                    Infrastructure
                  </div>
                  <h3 className="font-headline-lg text-headline-lg lg:text-display-lg text-on-surface font-bold tracking-tight">
                    Designed for Acute Hospital Workflows
                  </h3>
                  <p className="font-body-lg text-body-lg text-on-surface-variant mt-3 max-w-xl">
                    Whether a surgeon transitions to an emergency surgical rotation or an outpatient department reaches
                    full consultation capacity, CareSlot updates patient-facing availability within milliseconds.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-4">
                    <div className="flex items-center gap-3 bg-surface-container-lowest p-3 rounded-lg shadow-sm">
                      <span className="material-symbols-outlined text-primary text-[24px]">speed</span>
                      <div>
                        <div className="font-label-sm text-label-sm text-outline">Sync Latency</div>
                        <div className="font-headline-sm text-headline-sm text-on-surface font-bold">&lt; 150ms</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-surface-container-lowest p-3 rounded-lg shadow-sm">
                      <span className="material-symbols-outlined text-primary text-[24px]">verified</span>
                      <div>
                        <div className="font-label-sm text-label-sm text-outline">Conflict Rate</div>
                        <div className="font-headline-sm text-headline-sm text-on-surface font-bold">
                          0.00% Zero-Overlap
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-5 h-72 lg:h-96 relative">
                  <img
                    className="w-full h-full object-cover"
                    alt="Modern clean hospital clinical corridor"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuB1fuSKRE1mgT0UrsGZtPE4L8G7n3l9gvUYmT4iR_hX6lAbO4LIc_SuSY7wJCokmfsMiqzgzf0h3SFEwjigFCTBQRVJcZgb0bCQemNkv9s2yXFNKI3L8QDH_a-wInEGMAuv1Bz66gueJRm0e0a3n6MTNk7HY49OVl3BEOSex-XJejisWoprMQWlNYjq9-VQPWjdIdA7Rn9OLyZQRNnGBv_cVeEixSe9RyL3uob7dESTuxqMnsogmcc9SQ"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* HOW CARESLOT WORKS (Compact 3-Step Flow) */}
          <section className="py-space-xl scroll-mt-20" id="how-it-works">
            <div className="text-center max-w-2xl mx-auto mb-space-xl">
              <div className="font-label-md text-label-md uppercase tracking-wider text-primary font-semibold">
                Operational Rigor
              </div>
              <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold mt-1">How CareSlot Works</h2>
              <p className="font-body-md text-body-md text-on-surface-variant mt-2">
                A unified scheduling pipeline eliminating miscommunication between clinical staff, administrators, and
                patients.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg relative">
              {/* Step 1 */}
              <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col items-start relative">
                <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center font-headline-sm text-headline-sm font-bold mb-space-md">
                  1
                </div>
                <div className="font-label-sm text-label-sm uppercase tracking-wider text-primary font-semibold mb-1">
                  Physician Action
                </div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Doctor Sets Live Availability &amp; Consultation Slots
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant mt-2 leading-relaxed">
                  Doctors use their portal to configure consultation hours, auto-generate slot durations, or instantly
                  toggle to &quot;In Emergency&quot; with one tap.
                </p>
                <div className="mt-space-md w-full p-space-sm bg-surface-container-low rounded-lg flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Live Slot Status</span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-container-high text-primary font-label-sm text-label-sm font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary"></span> 15m Consults Auto-Set
                  </span>
                </div>
              </div>

              {/* Step 2 */}
              <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col items-start relative">
                <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center font-headline-sm text-headline-sm font-bold mb-space-md">
                  2
                </div>
                <div className="font-label-sm text-label-sm uppercase tracking-wider text-primary font-semibold mb-1">
                  Patient Action
                </div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Patient Finds Physician &amp; Books Instant Available Slot
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant mt-2 leading-relaxed">
                  Patients browse specialists by wing or specialty, filter by next-available openings, and confirm
                  reservation with zero double-booking risk.
                </p>
                <div className="mt-space-md w-full p-space-sm bg-surface-container-low rounded-lg flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Digital Confirmation</span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-container text-on-surface font-label-sm text-label-sm font-semibold">
                    <span className="material-symbols-outlined text-[14px] text-primary">qr_code_2</span> Instant Passcode
                  </span>
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col items-start relative">
                <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center font-headline-sm text-headline-sm font-bold mb-space-md">
                  3
                </div>
                <div className="font-label-sm text-label-sm uppercase tracking-wider text-primary font-semibold mb-1">
                  Administrative Control
                </div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Hospital Admin Manages Appointments &amp; Rosters
                </h3>
                <p className="font-body-md text-body-md text-on-surface-variant mt-2 leading-relaxed">
                  Hospital supervisors monitor queue health, assign shift replacements, manage clinical departments, and
                  view real-time patient traffic.
                </p>
                <div className="mt-space-md w-full p-space-sm bg-surface-container-low rounded-lg flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-on-surface-variant">Clinical Oversight</span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-container text-inverse-surface font-label-sm text-label-sm font-semibold">
                    <span className="material-symbols-outlined text-[14px]">tune</span> Central Command
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Live Doctor Schedule Preview Component */}
          <section className="py-space-lg scroll-mt-20" id="doctors">
            <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-md mb-space-lg">
                <div>
                  <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary font-semibold">
                    Real-Time Schedule Matrix
                  </span>
                  <h3 className="font-headline-md text-headline-md text-on-surface font-bold">
                    Live Doctor Availability Stream
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-surface-container text-on-surface font-label-sm text-label-sm">
                    Cardiology
                  </span>
                  <span className="px-3 py-1 rounded-full bg-surface-container text-on-surface font-label-sm text-label-sm">
                    Neurology
                  </span>
                  <span className="px-3 py-1 rounded-full bg-surface-container text-on-surface font-label-sm text-label-sm">
                    Orthopedics
                  </span>
                </div>
              </div>

              {/* Doctor Preview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
                {/* Doctor 1 */}
                <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center font-bold text-primary font-headline-sm text-headline-sm">
                          EK
                        </div>
                        <div>
                          <div className="font-headline-sm text-headline-sm text-on-surface font-semibold flex items-center gap-1">
                            Dr. Elena Rostova
                            <span className="material-symbols-outlined text-primary text-[16px]">verified</span>
                          </div>
                          <div className="font-body-sm text-body-sm text-on-surface-variant">Cardiology Dept • Wing B</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-2 px-3 rounded bg-surface-container-lowest mb-3">
                      <span className="font-label-sm text-label-sm text-outline">Current Status:</span>
                      <span className="inline-flex items-center gap-1 text-primary font-label-sm text-label-sm font-bold">
                        <span className="w-2 h-2 rounded-full bg-primary"></span> Available Now
                      </span>
                    </div>
                    <div className="font-label-sm text-label-sm text-outline mb-1.5">Immediate Open Slots:</div>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      <span className="px-2 py-1 rounded bg-surface-container-lowest text-on-surface font-label-sm text-label-sm font-medium shadow-sm">
                        10:30 AM
                      </span>
                      <span className="px-2 py-1 rounded bg-surface-container-lowest text-on-surface font-label-sm text-label-sm font-medium shadow-sm">
                        11:15 AM
                      </span>
                      <span className="px-2 py-1 rounded bg-surface-container-lowest text-on-surface font-label-sm text-label-sm font-medium shadow-sm">
                        02:00 PM
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleOpenLogin('patient')}
                    className="w-full text-center py-2 rounded bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors shadow-sm"
                    data-path="book-doc-1"
                  >
                    Book Next Slot
                  </button>
                </div>

                {/* Doctor 2 */}
                <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center font-bold text-primary font-headline-sm text-headline-sm">
                          MA
                        </div>
                        <div>
                          <div className="font-headline-sm text-headline-sm text-on-surface font-semibold flex items-center gap-1">
                            Dr. Marcus Vance
                            <span className="material-symbols-outlined text-primary text-[16px]">verified</span>
                          </div>
                          <div className="font-body-sm text-body-sm text-on-surface-variant">Neurology Dept • Wing A</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-2 px-3 rounded bg-surface-container-lowest mb-3">
                      <span className="font-label-sm text-label-sm text-outline">Current Status:</span>
                      <span className="inline-flex items-center gap-1 text-secondary font-label-sm text-label-sm font-bold">
                        <span className="w-2 h-2 rounded-full bg-secondary"></span> In-Consultation
                      </span>
                    </div>
                    <div className="font-label-sm text-label-sm text-outline mb-1.5">Immediate Open Slots:</div>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      <span className="px-2 py-1 rounded bg-surface-container-lowest text-on-surface font-label-sm text-label-sm font-medium shadow-sm">
                        01:45 PM
                      </span>
                      <span className="px-2 py-1 rounded bg-surface-container-lowest text-on-surface font-label-sm text-label-sm font-medium shadow-sm">
                        03:30 PM
                      </span>
                      <span className="px-2 py-1 rounded bg-surface-container-lowest text-on-surface font-label-sm text-label-sm font-medium shadow-sm">
                        04:15 PM
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleOpenLogin('patient')}
                    className="w-full text-center py-2 rounded bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors shadow-sm"
                    data-path="book-doc-2"
                  >
                    Book Next Slot
                  </button>
                </div>

                {/* Doctor 3 */}
                <div className="p-space-md rounded-lg bg-surface-container-low flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center font-bold text-primary font-headline-sm text-headline-sm">
                          SJ
                        </div>
                        <div>
                          <div className="font-headline-sm text-headline-sm text-on-surface font-semibold flex items-center gap-1">
                            Dr. Sarah Jenkins
                            <span className="material-symbols-outlined text-primary text-[16px]">verified</span>
                          </div>
                          <div className="font-body-sm text-body-sm text-on-surface-variant">Orthopedics Dept • Wing C</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-2 px-3 rounded bg-surface-container-lowest mb-3">
                      <span className="font-label-sm text-label-sm text-outline">Current Status:</span>
                      <span className="inline-flex items-center gap-1 text-primary font-label-sm text-label-sm font-bold">
                        <span className="w-2 h-2 rounded-full bg-primary"></span> Available Now
                      </span>
                    </div>
                    <div className="font-label-sm text-label-sm text-outline mb-1.5">Immediate Open Slots:</div>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      <span className="px-2 py-1 rounded bg-surface-container-lowest text-on-surface font-label-sm text-label-sm font-medium shadow-sm">
                        11:00 AM
                      </span>
                      <span className="px-2 py-1 rounded bg-surface-container-lowest text-on-surface font-label-sm text-label-sm font-medium shadow-sm">
                        11:30 AM
                      </span>
                      <span className="px-2 py-1 rounded bg-surface-container-lowest text-on-surface font-label-sm text-label-sm font-medium shadow-sm">
                        12:00 PM
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleOpenLogin('patient')}
                    className="w-full text-center py-2 rounded bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors shadow-sm"
                    data-path="book-doc-3"
                  >
                    Book Next Slot
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* SYSTEM HIGHLIGHTS / STATS (Clean counters) */}
          <section className="py-space-xl">
            <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-xl">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-space-lg text-center">
                {/* Stat 1 */}
                <div className="flex flex-col items-center">
                  <div className="font-metric-val text-metric-val text-primary font-extrabold tracking-tight">100%</div>
                  <div className="mt-1 font-label-lg text-label-lg text-on-surface font-semibold">
                    Real-Time Availability
                  </div>
                  <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant max-w-[200px]">
                    Synchronized instantly across physician clinics and hospital desks
                  </p>
                </div>
                {/* Stat 2 */}
                <div className="flex flex-col items-center">
                  <div className="font-metric-val text-metric-val text-primary font-extrabold tracking-tight">0</div>
                  <div className="mt-1 font-label-lg text-label-lg text-on-surface font-semibold">
                    Conflicting Double Bookings
                  </div>
                  <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant max-w-[200px]">
                    Atomic reservation locks prevent simultaneous conflicting reservations
                  </p>
                </div>
                {/* Stat 3 */}
                <div className="flex flex-col items-center">
                  <div className="font-metric-val text-metric-val text-primary font-extrabold tracking-tight">8</div>
                  <div className="mt-1 font-label-lg text-label-lg text-on-surface font-semibold">
                    Specialized Departments
                  </div>
                  <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant max-w-[200px]">
                    Cardiology, Pediatrics, Neurology, Surgery, Ortho, Oncology &amp; more
                  </p>
                </div>
                {/* Stat 4 */}
                <div className="flex flex-col items-center">
                  <div className="font-metric-val text-metric-val text-primary font-extrabold tracking-tight">100%</div>
                  <div className="mt-1 font-label-lg text-label-lg text-on-surface font-semibold">
                    Direct Hospital Coordination
                  </div>
                  <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant max-w-[200px]">
                    Directly connected to hospital administration and active clinical wings
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Interactive Department Specialty Filter Strip */}
          <section className="py-space-md mb-space-xl">
            <div className="bg-surface-container rounded-xl p-space-lg flex flex-col md:flex-row items-center justify-between gap-space-lg">
              <div>
                <h4 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  Looking for a specific medical department?
                </h4>
                <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                  Directly view departmental schedules or contact nursing stations.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleOpenLogin('patient')}
                  className="px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md hover:bg-primary hover:text-on-primary transition-colors shadow-sm"
                  data-path="dept-cardio"
                >
                  Cardiology
                </button>
                <button
                  onClick={() => handleOpenLogin('patient')}
                  className="px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md hover:bg-primary hover:text-on-primary transition-colors shadow-sm"
                  data-path="dept-pediatrics"
                >
                  Pediatrics
                </button>
                <button
                  onClick={() => handleOpenLogin('patient')}
                  className="px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md hover:bg-primary hover:text-on-primary transition-colors shadow-sm"
                  data-path="dept-ortho"
                >
                  Orthopedics
                </button>
                <button
                  onClick={() => handleOpenLogin('patient')}
                  className="px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md hover:bg-primary hover:text-on-primary transition-colors shadow-sm"
                  data-path="dept-neurology"
                >
                  Neurology
                </button>
                <button
                  onClick={() => handleOpenLogin('patient')}
                  className="px-3 py-1.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md shadow-sm"
                  data-path="dept-all"
                >
                  View All 8 →
                </button>
              </div>
            </div>
          </section>

          {/* BOTTOM CALL TO ACTION */}
          <section className="py-space-xl mb-space-xl">
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-space-xl lg:p-14 text-center max-w-4xl mx-auto relative overflow-hidden">
              <div className="w-16 h-16 rounded-full bg-surface-container mx-auto flex items-center justify-center mb-space-md">
                <span className="material-symbols-outlined text-primary text-[32px]">domain_verification</span>
              </div>
              <h2 className="font-headline-lg text-headline-lg lg:text-display-lg text-on-surface font-bold tracking-tight">
                Ready to Experience Seamless Hospital Scheduling?
              </h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl mx-auto mt-space-sm mb-space-lg">
                Patients can create an account in 60 seconds. Hospital medical doctors and administrative directors can
                log in to their authenticated stations below.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-space-sm sm:gap-space-md">
                <Link
                  className="w-full sm:w-auto px-space-xl py-3 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg hover:bg-primary-container transition-all shadow-sm"
                  data-path="cta-patient-signup"
                  href="/signup"
                >
                  Register Patient Account
                </Link>
                <button
                  onClick={() => handleOpenLogin('doctor')}
                  className="w-full sm:w-auto px-space-lg py-3 rounded-lg bg-surface-container text-on-surface font-label-lg text-label-lg hover:bg-surface-container-high transition-all"
                  data-path="cta-doctor-login"
                >
                  Doctor Station Login
                </button>
                <button
                  onClick={() => handleOpenLogin('admin')}
                  className="w-full sm:w-auto px-space-lg py-3 rounded-lg bg-inverse-surface text-inverse-on-surface font-label-lg text-label-lg hover:bg-on-background transition-all"
                  data-path="cta-admin-login"
                >
                  Admin Portal Login
                </button>
              </div>
              <div className="mt-space-lg flex items-center justify-center gap-space-lg text-outline-variant font-label-sm text-label-sm">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-primary">lock</span> HIPAA &amp; Medical
                  Privacy Compliant
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-primary">bolt</span> Real-Time WebSocket
                  Sync
                </span>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full bg-surface-container-low shadow-[0_-1px_8px_rgba(0,0,0,0.02)] py-space-xl mt-space-xl">
        <div className="max-w-7xl mx-auto px-margin flex flex-col md:flex-row items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-sm">
            <span className="font-body-md text-body-md text-on-surface-variant">© 2024 CareSlot. All rights reserved.</span>
          </div>
          <div className="flex flex-wrap items-center gap-space-lg">
            <a
              className="font-body-md text-body-md text-on-surface-variant hover:text-on-surface transition-colors"
              data-path="privacy-policy"
              href="#"
            >
              Privacy Policy
            </a>
            <a
              className="font-body-md text-body-md text-on-surface-variant hover:text-on-surface transition-colors"
              data-path="terms-of-service"
              href="#"
            >
              Terms of Service
            </a>
            <a
              className="font-body-md text-body-md text-on-surface-variant hover:text-on-surface transition-colors"
              data-path="security"
              href="#"
            >
              Security
            </a>
            <a
              className="font-body-md text-body-md text-on-surface-variant hover:text-on-surface transition-colors"
              data-path="support"
              href="#"
            >
              Support
            </a>
          </div>
        </div>
      </footer>

      {/* Sign In Modal / Drawer for Role Authentication */}
      {isLoginOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top colored indicator bar matching role */}
            <div
              className={`absolute top-0 left-0 right-0 h-1.5 ${
                selectedRole === 'patient'
                  ? 'bg-primary'
                  : selectedRole === 'doctor'
                  ? 'bg-primary-container'
                  : 'bg-inverse-surface'
              }`}
            />

            {/* Close button */}
            <button
              onClick={() => setIsLoginOpen(false)}
              className="absolute top-4 right-4 text-outline hover:text-on-surface p-1 rounded-lg hover:bg-surface-container transition-colors"
              aria-label="Close dialog"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>

            {/* Modal Header */}
            <div className="text-center space-y-1 mb-6 mt-1">
              <div className="w-12 h-12 rounded-xl bg-surface-container mx-auto flex items-center justify-center mb-3">
                <span
                  className={`material-symbols-outlined text-[28px] ${
                    selectedRole === 'patient'
                      ? 'text-primary'
                      : selectedRole === 'doctor'
                      ? 'text-primary-container'
                      : 'text-inverse-surface'
                  }`}
                >
                  {selectedRole === 'patient'
                    ? 'personal_injury'
                    : selectedRole === 'doctor'
                    ? 'stethoscope'
                    : 'admin_panel_settings'}
                </span>
              </div>
              <h3 className="font-headline-md text-headline-md text-on-surface font-bold">
                {selectedRole === 'patient'
                  ? 'Patient Sign In'
                  : selectedRole === 'doctor'
                  ? 'Physician Station Login'
                  : 'Hospital Admin Sign In'}
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {selectedRole === 'patient'
                  ? 'Access appointments, live slot booking, and OPD status'
                  : selectedRole === 'doctor'
                  ? 'Enter credentials to manage your live OPD consultation roster'
                  : 'Restricted access for clinical administrators'}
              </p>
            </div>

            {/* Role Switcher Tabs */}
            <div className="grid grid-cols-3 gap-1 bg-surface-container p-1 rounded-xl mb-5">
              <button
                type="button"
                onClick={() => {
                  setSelectedRole('patient')
                  setErrorMsg('')
                }}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  selectedRole === 'patient'
                    ? 'bg-surface-container-lowest text-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Patient
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedRole('doctor')
                  setErrorMsg('')
                }}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  selectedRole === 'doctor'
                    ? 'bg-surface-container-lowest text-primary-container shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Doctor
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedRole('admin')
                  setErrorMsg('')
                }}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  selectedRole === 'admin'
                    ? 'bg-surface-container-lowest text-inverse-surface shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Admin
              </button>
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <div
                className="mb-4 rounded-xl bg-error-container text-on-error-container p-3 text-xs flex items-start gap-2"
                role="alert"
              >
                <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Sign In Form */}
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block font-label-sm text-label-sm uppercase tracking-wider text-outline mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder={
                    selectedRole === 'patient'
                      ? 'patient@example.com'
                      : selectedRole === 'doctor'
                      ? 'dr.name@hospital.org'
                      : 'admin@hospital.org'
                  }
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-on-surface bg-surface-container-lowest focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block font-label-sm text-label-sm uppercase tracking-wider text-outline mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 text-sm text-on-surface bg-surface-container-lowest focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-outline hover:text-on-surface"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                    selectedRole === 'admin'
                      ? 'bg-inverse-surface hover:bg-on-background'
                      : selectedRole === 'doctor'
                      ? 'bg-primary-container hover:bg-teal-700'
                      : 'bg-primary hover:bg-primary-container'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>
                        Sign In as{' '}
                        {selectedRole === 'patient'
                          ? 'Patient'
                          : selectedRole === 'doctor'
                          ? 'Doctor'
                          : 'Admin'}
                      </span>
                      <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Footer / Alt link */}
            <div className="mt-5 pt-4 border-t border-slate-100 text-center space-y-2">
              {selectedRole === 'patient' ? (
                <p className="text-xs text-on-surface-variant">
                  Don&apos;t have an account yet?{' '}
                  <Link href="/signup" className="font-semibold text-primary hover:underline">
                    Create patient account
                  </Link>
                </p>
              ) : (
                <p className="text-xs text-outline">
                  Staff credentials are provisioned by Central IT &amp; Hospital Administration.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
