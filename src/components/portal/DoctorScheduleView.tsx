'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { updateDoctorScheduleAction, type ScheduleDayInput } from '@/app/actions/doctor'
import { signOutAction } from '@/app/actions/auth'
import type { DoctorPortalInfo } from './DoctorDashboardView'

const WEEKDAYS = [
  { id: 1, name: 'Monday', short: 'Mon' },
  { id: 2, name: 'Tuesday', short: 'Tue' },
  { id: 3, name: 'Wednesday', short: 'Wed' },
  { id: 4, name: 'Thursday', short: 'Thu' },
  { id: 5, name: 'Friday', short: 'Fri' },
  { id: 6, name: 'Saturday', short: 'Sat' },
  { id: 0, name: 'Sunday', short: 'Sun' },
]

export interface WeeklyScheduleState {
  weekday: number
  enabled: boolean
  startTime: string
  endTime: string
}

interface DoctorScheduleViewProps {
  doctor: DoctorPortalInfo
  initialSchedules: WeeklyScheduleState[]
  consultationMinutes?: number
}

export function DoctorScheduleView({
  doctor,
  initialSchedules,
  consultationMinutes = 20,
}: DoctorScheduleViewProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Initialize 7 days
  const [scheduleMap, setScheduleMap] = useState<Record<number, WeeklyScheduleState>>(() => {
    const map: Record<number, WeeklyScheduleState> = {}
    WEEKDAYS.forEach((w) => {
      const existing = initialSchedules.find((s) => s.weekday === w.id)
      if (existing) {
        map[w.id] = {
          weekday: w.id,
          enabled: existing.enabled,
          startTime: existing.startTime.substring(0, 5),
          endTime: existing.endTime.substring(0, 5),
        }
      } else {
        // Default Mon-Fri on, Sat-Sun off
        const isDefaultWorkday = w.id >= 1 && w.id <= 5
        map[w.id] = {
          weekday: w.id,
          enabled: isDefaultWorkday,
          startTime: '09:00',
          endTime: '17:00',
        }
      }
    })
    return map
  })

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const handleToggleDay = (weekday: number) => {
    setScheduleMap((prev) => ({
      ...prev,
      [weekday]: {
        ...prev[weekday],
        enabled: !prev[weekday].enabled,
      },
    }))
  }

  const handleTimeChange = (
    weekday: number,
    field: 'startTime' | 'endTime',
    value: string
  ) => {
    setScheduleMap((prev) => ({
      ...prev,
      [weekday]: {
        ...prev[weekday],
        [field]: value,
      },
    }))
  }

  const handleSave = () => {
    setFeedback(null)
    const schedulesList: ScheduleDayInput[] = Object.values(scheduleMap)

    startTransition(async () => {
      const res = await updateDoctorScheduleAction({
        doctorId: doctor.id,
        schedules: schedulesList,
      })

      if (res.success) {
        setFeedback({
          type: 'success',
          message: 'Weekly schedule saved successfully! Patient booking slots have been updated.',
        })
        router.refresh()
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Failed to update schedule. Please check start and end times.',
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
              aria-current="page"
              className="flex items-center justify-between px-space-md py-space-sm transition-colors bg-primary-container text-on-primary-container font-label-lg rounded-lg shadow-sm"
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
              <span className="material-symbols-outlined text-[18px]">calendar_month</span>
              <span className="font-body-sm text-body-sm">Weekly Operating Hours</span>
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

        {/* Main Schedule Content */}
        <main className="w-full pt-16 bg-surface px-space-md lg:px-space-lg py-space-lg flex-1">
          <div className="flex flex-col w-full gap-space-lg max-w-5xl">
            {/* Header section */}
            <section className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
              <div>
                <h1 className="font-headline-lg text-headline-lg text-on-surface">
                  Weekly Operating Schedule
                </h1>
                <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                  Configure your weekly consultation shifts. Patient booking slots are automatically generated based on your {consultationMinutes}-minute consultation window.
                </p>
              </div>
              <button
                type="button"
                disabled={isPending}
                onClick={handleSave}
                className="px-space-lg py-2.5 rounded-lg bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-colors shadow-sm inline-flex items-center gap-2 self-start sm:self-auto"
              >
                {isPending ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">
                      progress_activity
                    </span>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">save</span>
                    <span>Save Schedule</span>
                  </>
                )}
              </button>
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

            {/* Days Schedule Card List */}
            <div className="flex flex-col gap-space-sm">
              {WEEKDAYS.map((day) => {
                const dayState = scheduleMap[day.id] || {
                  weekday: day.id,
                  enabled: false,
                  startTime: '09:00',
                  endTime: '17:00',
                }

                // Calculate slot capacity estimate
                const [startH, startM] = dayState.startTime.split(':').map(Number)
                const [endH, endM] = dayState.endTime.split(':').map(Number)
                const totalMinutes = Math.max(0, (endH * 60 + endM) - (startH * 60 + startM))
                const estimatedSlots = Math.floor(totalMinutes / consultationMinutes)

                return (
                  <div
                    key={day.id}
                    className={`bg-surface-container-lowest rounded-xl p-space-md shadow-sm transition-all border ${
                      dayState.enabled
                        ? 'border-primary/20 bg-surface-container-lowest'
                        : 'border-outline-variant/40 bg-surface-container-low opacity-75'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
                      {/* Day Name and Toggle */}
                      <div className="flex items-center gap-space-md min-w-[200px]">
                        <button
                          type="button"
                          onClick={() => handleToggleDay(day.id)}
                          className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                            dayState.enabled ? 'bg-primary' : 'bg-outline-variant'
                          }`}
                          aria-label={`Toggle ${day.name}`}
                        >
                          <span
                            className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                              dayState.enabled ? 'translate-x-6' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <div>
                          <span className="font-headline-sm text-headline-sm text-on-surface block">
                            {day.name}
                          </span>
                          <span className="font-label-sm text-label-sm text-on-surface-variant">
                            {dayState.enabled ? 'Seeing Patients (Active)' : 'Off-Duty / Closed'}
                          </span>
                        </div>
                      </div>

                      {/* Shift Hours Selectors */}
                      {dayState.enabled ? (
                        <div className="flex items-center gap-space-md flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="font-label-sm text-label-sm text-on-surface-variant">
                              Start:
                            </span>
                            <input
                              type="time"
                              value={dayState.startTime}
                              onChange={(e) =>
                                handleTimeChange(day.id, 'startTime', e.target.value)
                              }
                              className="px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-low font-label-md text-label-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>

                          <span className="text-outline-variant hidden sm:inline">—</span>

                          <div className="flex items-center gap-2">
                            <span className="font-label-sm text-label-sm text-on-surface-variant">
                              End:
                            </span>
                            <input
                              type="time"
                              value={dayState.endTime}
                              onChange={(e) =>
                                handleTimeChange(day.id, 'endTime', e.target.value)
                              }
                              className="px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-low font-label-md text-label-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>

                          {/* Capacity chip */}
                          <div className="px-space-sm py-1 rounded-full bg-surface-container-high text-primary font-label-sm text-label-sm font-semibold">
                            ~{estimatedSlots} slots capacity
                          </div>
                        </div>
                      ) : (
                        <span className="font-body-sm text-body-sm text-on-surface-variant italic">
                          No appointments open for scheduling on this day
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
