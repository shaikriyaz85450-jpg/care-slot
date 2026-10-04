'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { updateDoctorProfileDetailsAction } from '@/app/actions/doctor'
import { signOutAction } from '@/app/actions/auth'
import type { DoctorPortalInfo } from './DoctorDashboardView'

export interface DoctorFullProfile {
  id: string
  profileId: string
  fullName: string
  email: string
  phone: string
  role: string
  departmentName: string
  specialization: string
  qualification: string
  experienceYears: number
  consultationMinutes: number
  clinicRoom: string
  avatarUrl: string
  docCode: string
}

interface DoctorProfileSettingsViewProps {
  doctor: DoctorPortalInfo
  profileDetails: DoctorFullProfile
}

export function DoctorProfileSettingsView({
  doctor,
  profileDetails,
}: DoctorProfileSettingsViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Form states for editable fields
  const [fullName, setFullName] = useState(profileDetails.fullName)
  const [phone, setPhone] = useState(profileDetails.phone)
  const [specialization, setSpecialization] = useState(profileDetails.specialization)
  const [qualification, setQualification] = useState(profileDetails.qualification)
  const [experienceYears, setExperienceYears] = useState(profileDetails.experienceYears)
  const [consultationMinutes, setConsultationMinutes] = useState(
    profileDetails.consultationMinutes
  )

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setFeedback(null)

    startTransition(async () => {
      const res = await updateDoctorProfileDetailsAction({
        doctorId: doctor.id,
        fullName,
        phone,
        specialization,
        qualification,
        experienceYears,
        consultationMinutes,
      })

      if (res.success) {
        setFeedback({
          type: 'success',
          message: 'Doctor profile updated successfully! Changes are live across the portal.',
        })
        router.refresh()
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Failed to update profile. Please try again.',
        })
      }
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
            <Link
              className="flex items-center justify-between px-space-md py-space-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
              href="/doctor/dashboard"
            >
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[20px]">grid_view</span>
                <span className="font-label-lg text-label-lg">Overview</span>
              </div>
            </Link>

            <Link
              className="flex items-center justify-between px-space-md py-space-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
              href="/doctor/dashboard#queue"
            >
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                <span className="font-label-lg text-label-lg">Today&apos;s Appointments</span>
              </div>
            </Link>

            <Link
              className="flex items-center justify-between px-space-md py-space-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
              href="/doctor/schedule"
            >
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[20px]">schedule</span>
                <span className="font-label-lg text-label-lg">Schedule</span>
              </div>
            </Link>

            <Link
              className="flex items-center justify-between px-space-md py-space-sm rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
              href="/doctor/dashboard#status-section"
            >
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[20px]">sensors</span>
                <span className="font-label-lg text-label-lg">Status</span>
              </div>
              <span className="w-2 h-2 rounded-full bg-tertiary" />
            </Link>

            <Link
              aria-current="page"
              className="flex items-center justify-between px-space-md py-space-sm transition-colors bg-primary-container text-on-primary-container font-label-lg rounded-lg shadow-sm"
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
        {/* Top Header */}
        <header className="fixed top-0 left-0 md:left-64 right-0 h-16 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 flex items-center justify-between px-space-md lg:px-space-lg">
          <div className="flex items-center gap-space-md">
            <div className="flex md:hidden items-center gap-space-xs">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-on-primary">
                <span className="material-symbols-outlined text-[16px]">local_hospital</span>
              </div>
              <span className="font-headline-sm text-headline-sm text-primary">CareSlot</span>
            </div>
            <div className="hidden sm:flex items-center gap-space-xs bg-surface-container-low px-space-md py-space-xs rounded-lg text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">person</span>
              <span className="font-body-sm text-body-sm">Physician Profile &amp; Settings</span>
            </div>
          </div>

          <div className="flex items-center gap-space-md">
            <Link
              href="/notifications"
              className="relative p-space-xs rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-[22px]">notifications</span>
            </Link>

            <div className="flex items-center gap-space-sm pl-space-sm">
              <div className="hidden text-right lg:flex flex-col">
                <span className="font-label-lg text-label-lg text-on-surface leading-tight">
                  {doctor.fullName}
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">
                  {doctor.specialization} • {doctor.docCode}
                </span>
              </div>
              <img
                alt={doctor.name}
                className="w-8 h-8 rounded-full object-cover border border-outline-variant"
                src={doctor.avatarUrl}
              />
            </div>
          </div>
        </header>

        {/* Main Content Body */}
        <main className="w-full pt-16 bg-surface px-space-md lg:px-space-lg py-space-lg flex-1">
          <div className="flex flex-col w-full gap-space-lg max-w-4xl">
            {/* Header section */}
            <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
              <div className="flex items-center gap-space-md">
                <img
                  alt={doctor.name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-primary/20 shadow-sm"
                  src={doctor.avatarUrl}
                />
                <div>
                  <h1 className="font-headline-lg text-headline-lg text-on-surface">
                    {profileDetails.fullName}
                  </h1>
                  <p className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1.5 mt-0.5">
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm font-semibold">
                      {profileDetails.specialization}
                    </span>
                    <span>•</span>
                    <span>{profileDetails.departmentName}</span>
                    <span>•</span>
                    <span className="font-mono text-outline">{profileDetails.docCode}</span>
                  </p>
                </div>
              </div>
              <Link
                href={`/doctors/${doctor.id}`}
                className="px-space-md py-2 rounded-lg bg-surface-container-high text-on-surface font-label-md text-label-md hover:bg-surface-container-highest transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto"
              >
                <span className="material-symbols-outlined text-[18px]">visibility</span>
                <span>View Public Profile</span>
              </Link>
            </section>

            {/* Feedback alert */}
            {feedback && (
              <div
                className={`p-space-md rounded-xl shadow-sm flex items-center justify-between ${
                  feedback.type === 'success'
                    ? 'bg-tertiary-container/15 text-tertiary border border-tertiary/20'
                    : 'bg-error-container/20 text-error border border-error/20'
                }`}
              >
                <div className="flex items-center gap-space-xs">
                  <span className="material-symbols-outlined text-[20px]">
                    {feedback.type === 'success' ? 'check_circle' : 'warning'}
                  </span>
                  <span className="font-body-md text-body-md font-medium">{feedback.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFeedback(null)}
                  className="p-1 rounded hover:bg-black/5"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            )}

            {/* Profile Form */}
            <form onSubmit={handleSave} className="flex flex-col gap-space-md">
              {/* Editable Clinical Fields */}
              <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col gap-space-md">
                <div>
                  <h2 className="font-headline-sm text-headline-sm text-on-surface">
                    Clinical &amp; Personal Information
                  </h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    These details are visible to patients on doctor cards and during slot booking.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                  <div>
                    <label className="font-label-md text-label-md text-on-surface block mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-outline-variant bg-surface-container-low font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="font-label-md text-label-md text-on-surface block mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full px-3.5 py-2 rounded-lg border border-outline-variant bg-surface-container-low font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="font-label-md text-label-md text-on-surface block mb-1">
                      Medical Specialization
                    </label>
                    <input
                      type="text"
                      required
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg border border-outline-variant bg-surface-container-low font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="font-label-md text-label-md text-on-surface block mb-1">
                      Qualifications &amp; Degrees
                    </label>
                    <input
                      type="text"
                      required
                      value={qualification}
                      onChange={(e) => setQualification(e.target.value)}
                      placeholder="e.g. MBBS, MD, FACC"
                      className="w-full px-3.5 py-2 rounded-lg border border-outline-variant bg-surface-container-low font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="font-label-md text-label-md text-on-surface block mb-1">
                      Years of Experience
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      required
                      value={experienceYears}
                      onChange={(e) => setExperienceYears(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-lg border border-outline-variant bg-surface-container-low font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="font-label-md text-label-md text-on-surface block mb-1">
                      Consultation Duration (Minutes per Slot)
                    </label>
                    <select
                      value={consultationMinutes}
                      onChange={(e) => setConsultationMinutes(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-lg border border-outline-variant bg-surface-container-low font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value={10}>10 minutes</option>
                      <option value={15}>15 minutes</option>
                      <option value={20}>20 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={45}>45 minutes</option>
                      <option value={60}>60 minutes</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Protected Read-Only Institutional Fields */}
              <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col gap-space-md">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-headline-sm text-headline-sm text-on-surface">
                      Protected Institutional Credentials
                    </h2>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Managed by hospital central administration and protected under database security rules.
                    </p>
                  </div>
                  <span className="p-1 rounded bg-surface-container-low text-outline">
                    <span className="material-symbols-outlined text-[18px]">lock</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                  <div className="p-space-sm bg-surface-container-low rounded-lg">
                    <span className="font-label-sm text-label-sm text-on-surface-variant block">
                      Hospital Department
                    </span>
                    <span className="font-label-md text-label-md text-on-surface font-semibold">
                      {profileDetails.departmentName}
                    </span>
                  </div>

                  <div className="p-space-sm bg-surface-container-low rounded-lg">
                    <span className="font-label-sm text-label-sm text-on-surface-variant block">
                      Assigned Clinic Room
                    </span>
                    <span className="font-label-md text-label-md text-on-surface font-semibold">
                      {profileDetails.clinicRoom}
                    </span>
                  </div>

                  <div className="p-space-sm bg-surface-container-low rounded-lg">
                    <span className="font-label-sm text-label-sm text-on-surface-variant block">
                      System Role
                    </span>
                    <span className="font-label-md text-label-md text-on-surface uppercase font-semibold text-primary">
                      {profileDetails.role}
                    </span>
                  </div>

                  <div className="p-space-sm bg-surface-container-low rounded-lg">
                    <span className="font-label-sm text-label-sm text-on-surface-variant block">
                      Doctor Record ID
                    </span>
                    <span className="font-mono text-[12px] text-outline break-all">
                      {doctor.id}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-space-sm">
                <Link
                  href="/doctor/dashboard"
                  className="px-space-lg py-2.5 rounded-lg bg-surface-container-high text-on-surface font-label-md text-label-md hover:bg-surface-container-highest transition-colors"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-space-lg py-2.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors shadow-sm inline-flex items-center gap-2"
                >
                  {isPending ? (
                    <>
                      <span className="material-symbols-outlined text-[18px] animate-spin">
                        progress_activity
                      </span>
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      <span>Save Profile Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  )
}
