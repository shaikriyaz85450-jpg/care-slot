'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  AdminOverviewStats,
  AdminAppointmentSummary,
  AdminDoctorRosterItem,
  createDoctorAction,
  createDepartmentAction,
  cancelAdminAppointmentAction,
  toggleDoctorActiveAction,
} from '@/app/actions/admin'

interface AdminOverviewViewProps {
  stats: AdminOverviewStats
  initialAppointments: AdminAppointmentSummary[]
  initialDoctorRoster: AdminDoctorRosterItem[]
  departments: { id: string; name: string }[]
}

export function AdminOverviewView({
  stats,
  initialAppointments,
  initialDoctorRoster,
  departments,
}: AdminOverviewViewProps) {
  const [appointments, setAppointments] = useState<AdminAppointmentSummary[]>(initialAppointments)
  const [doctorRoster, setDoctorRoster] = useState<AdminDoctorRosterItem[]>(initialDoctorRoster)
  const [searchApptTerm, setSearchApptTerm] = useState('')

  // Modals state
  const [isAddDeptOpen, setIsAddDeptOpen] = useState(false)
  const [isAddDocOpen, setIsAddDocOpen] = useState(false)
  const [cancelModalAppt, setCancelModalAppt] = useState<AdminAppointmentSummary | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  // Form states
  const [deptForm, setDeptForm] = useState({ name: '', description: '' })
  const [docForm, setDocForm] = useState({
    fullName: '',
    specialization: '',
    departmentId: departments[0]?.id || '',
    clinicRoom: '',
    qualification: 'MBBS, MD',
    experienceYears: 5,
    consultationMinutes: 15,
    isActive: true,
  })

  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Filtered Appointments
  const filteredAppointments = appointments.filter((a) => {
    if (!searchApptTerm.trim()) return true
    const term = searchApptTerm.toLowerCase()
    return (
      a.patientName.toLowerCase().includes(term) ||
      a.doctorName.toLowerCase().includes(term) ||
      a.departmentName.toLowerCase().includes(term)
    )
  })

  // Handlers
  const handleAddDepartment = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setFormSuccess(null)

    startTransition(async () => {
      const res = await createDepartmentAction(deptForm.name, deptForm.description)
      if (!res.success) {
        setFormError(res.error || 'Failed to create department.')
      } else {
        setFormSuccess(`Department "${deptForm.name}" created successfully.`)
        setDeptForm({ name: '', description: '' })
        setTimeout(() => {
          setIsAddDeptOpen(false)
          setFormSuccess(null)
        }, 1200)
      }
    })
  }

  const handleAddDoctor = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setFormSuccess(null)

    startTransition(async () => {
      const res = await createDoctorAction({
        fullName: docForm.fullName,
        specialization: docForm.specialization,
        departmentId: docForm.departmentId,
        clinicRoom: docForm.clinicRoom,
        qualification: docForm.qualification,
        experienceYears: Number(docForm.experienceYears),
        consultationMinutes: Number(docForm.consultationMinutes),
        isActive: docForm.isActive,
      })

      if (!res.success) {
        setFormError(res.error || 'Failed to add doctor.')
      } else {
        setFormSuccess(`Dr. ${docForm.fullName} has been added successfully.`)
        // Optimistic append
        const selectedDept = departments.find((d) => d.id === docForm.departmentId)
        const newDoctorItem: AdminDoctorRosterItem = {
          id: res.doctorId || crypto.randomUUID(),
          profileId: crypto.randomUUID(),
          fullName: docForm.fullName,
          specialization: docForm.specialization,
          departmentId: docForm.departmentId,
          departmentName: selectedDept?.name || 'General',
          clinicRoom: docForm.clinicRoom,
          isActive: docForm.isActive,
          liveStatus: 'available',
          delayMinutes: 0,
        }
        setDoctorRoster((prev) => [newDoctorItem, ...prev])

        setTimeout(() => {
          setIsAddDocOpen(false)
          setFormSuccess(null)
          setDocForm({
            fullName: '',
            specialization: '',
            departmentId: departments[0]?.id || '',
            clinicRoom: '',
            qualification: 'MBBS, MD',
            experienceYears: 5,
            consultationMinutes: 15,
            isActive: true,
          })
        }, 1200)
      }
    })
  }

  const handleCancelAppointment = () => {
    if (!cancelModalAppt) return
    startTransition(async () => {
      const res = await cancelAdminAppointmentAction(cancelModalAppt.id, cancelReason)
      if (res.success) {
        setAppointments((prev) =>
          prev.map((a) => (a.id === cancelModalAppt.id ? { ...a, status: 'cancelled' } : a))
        )
        setCancelModalAppt(null)
        setCancelReason('')
      } else {
        alert(res.error || 'Failed to cancel appointment.')
      }
    })
  }

  const handleToggleActive = (doctorId: string, currentStatus: boolean) => {
    startTransition(async () => {
      const newStatus = !currentStatus
      const res = await toggleDoctorActiveAction(doctorId, newStatus)
      if (res.success) {
        setDoctorRoster((prev) =>
          prev.map((d) => (d.id === doctorId ? { ...d, isActive: newStatus } : d))
        )
      } else {
        alert(res.error || 'Failed to update doctor status.')
      }
    })
  }

  return (
    <div className="flex flex-col w-full gap-space-lg max-w-7xl mx-auto">
      {/* 1. Header & Quick Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-space-md">
        <div className="flex flex-col">
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold">
            Hospital Administration Overview
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
            Central control for doctor schedules, hospital departments, and live appointment activity.
          </p>
        </div>
        <div className="flex items-center gap-space-sm self-start md:self-auto">
          <button
            onClick={() => {
              setFormError(null)
              setFormSuccess(null)
              setIsAddDeptOpen(true)
            }}
            className="inline-flex items-center gap-space-xs px-space-md py-2.5 rounded-lg bg-surface-container-lowest text-on-surface font-label-lg text-label-lg shadow-sm hover:bg-surface-container-high transition-colors border border-surface-container"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px] text-secondary">add_circle</span>
            <span>+ Add Department</span>
          </button>
          <button
            onClick={() => {
              setFormError(null)
              setFormSuccess(null)
              setIsAddDocOpen(true)
            }}
            className="inline-flex items-center gap-space-xs px-space-md py-2.5 rounded-lg bg-primary-container text-on-primary font-label-lg text-label-lg shadow-sm hover:bg-primary transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            <span>+ Add Doctor</span>
          </button>
        </div>
      </div>

      {/* 2. Simple Overview Statistics (4 responsive cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        {/* Card 1: Total Doctors */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden border border-surface-container-low">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant font-semibold">
              Total Doctors
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full font-label-sm text-label-sm bg-surface-container-high text-on-surface">
              {stats.activeDoctorsCount} Active
            </span>
          </div>
          <div className="my-space-sm flex items-baseline gap-space-xs">
            <span className="font-metric-val text-metric-val text-on-surface text-3xl font-bold">
              {stats.totalDoctors}
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Across {stats.totalDepartments} clinical departments
          </p>
        </div>

        {/* Card 2: Departments */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden border border-surface-container-low">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant font-semibold">
              Departments
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full font-label-sm text-label-sm bg-surface-container-high text-on-surface">
              Operational
            </span>
          </div>
          <div className="my-space-sm flex items-baseline gap-space-xs">
            <span className="font-metric-val text-metric-val text-on-surface text-3xl font-bold">
              {stats.totalDepartments}
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
            {stats.departmentNames.slice(0, 3).join(', ') || 'Cardiology, Pediatrics...'}
          </p>
        </div>

        {/* Card 3: Today's Appointments */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden border border-surface-container-low">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant font-semibold">
              Today's Appointments
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-label-sm text-label-sm bg-secondary-container text-on-secondary-fixed">
              <span className="material-symbols-outlined text-[14px]">event_available</span> Live
            </span>
          </div>
          <div className="my-space-sm flex items-baseline gap-space-xs">
            <span className="font-metric-val text-metric-val text-on-surface text-3xl font-bold">
              {stats.todayAppointmentsCount}
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {stats.todayCompletedCount} completed, {stats.todayUpcomingCount} upcoming, {stats.todayCancelledCount} cancelled
          </p>
        </div>

        {/* Card 4: Today's Available Doctors */}
        <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden border border-surface-container-low">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant font-semibold">
              Available Doctors
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-label-sm text-label-sm bg-surface-container text-primary font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse"></span> Live
            </span>
          </div>
          <div className="my-space-sm flex items-baseline gap-space-xs">
            <span className="font-metric-val text-metric-val text-on-surface text-3xl font-bold">
              {stats.liveAvailableCount}
            </span>
          </div>
          <div className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant flex-wrap">
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary-container"></span>
              {stats.liveAvailableCount} Ready
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              {stats.liveDelayedCount} Delayed
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
              {stats.liveOnLeaveCount} Leave
            </span>
          </div>
        </div>
      </div>

      {/* 3A. Recent / Today's Appointments Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col border border-surface-container-low">
        {/* Header */}
        <div className="p-space-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-space-sm bg-surface-container-lowest border-b border-surface-container-low">
          <div className="flex items-center gap-space-sm">
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Today's Appointments
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">
              {appointments.length} Scheduled
            </span>
          </div>
          <div className="flex items-center gap-space-sm">
            <div className="relative w-full sm:w-64">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[18px]">
                search
              </span>
              <input
                value={searchApptTerm}
                onChange={(e) => setSearchApptTerm(e.target.value)}
                className="w-full bg-surface-container-low pl-9 pr-3 py-2 rounded-lg font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container"
                placeholder="Search patient or doctor..."
                type="text"
              />
            </div>
            <Link
              href="/admin/appointments"
              className="inline-flex items-center gap-1 font-label-lg text-label-lg text-primary hover:text-primary-container px-2 py-1.5 rounded transition-colors whitespace-nowrap font-medium"
            >
              <span>View All</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </Link>
          </div>
        </div>

        {/* Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                <th className="py-3 px-space-lg font-label-sm">Patient</th>
                <th className="py-3 px-space-md font-label-sm">Assigned Doctor</th>
                <th className="py-3 px-space-md font-label-sm">Date</th>
                <th className="py-3 px-space-md font-label-sm">Time</th>
                <th className="py-3 px-space-md font-label-sm">Status</th>
                <th className="py-3 px-space-lg font-label-sm text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high font-body-md text-body-md text-on-surface">
              {filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-on-surface-variant text-sm">
                    No appointments scheduled for today.
                  </td>
                </tr>
              ) : (
                filteredAppointments.map((appt) => {
                  let statusBadge = (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm bg-surface-container-high text-on-surface">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
                      Booked
                    </span>
                  )

                  if (appt.status === 'completed') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm bg-secondary-container text-on-secondary-fixed">
                        <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                        Completed
                      </span>
                    )
                  } else if (appt.status === 'cancelled') {
                    statusBadge = (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm bg-error-container text-on-error-container">
                        <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
                        Cancelled
                      </span>
                    )
                  }

                  return (
                    <tr key={appt.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="py-3.5 px-space-lg font-semibold text-on-surface">
                        {appt.patientName}
                      </td>
                      <td className="py-3.5 px-space-md text-on-surface-variant">
                        {appt.doctorName}
                      </td>
                      <td className="py-3.5 px-space-md text-on-surface-variant">
                        {appt.appointmentDate}
                      </td>
                      <td className="py-3.5 px-space-md font-label-md text-label-md text-on-surface font-medium">
                        {appt.startTime.slice(0, 5)} - {appt.endTime.slice(0, 5)}
                      </td>
                      <td className="py-3.5 px-space-md">{statusBadge}</td>
                      <td className="py-3.5 px-space-lg text-right">
                        <div className="inline-flex items-center gap-2">
                          {appt.status === 'booked' && (
                            <button
                              onClick={() => {
                                setCancelModalAppt(appt)
                                setCancelReason('')
                              }}
                              className="text-error hover:text-on-error-container font-label-md text-label-md px-2 py-1 rounded hover:bg-error-container transition-colors"
                              type="button"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3B. Doctor Management Preview */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col border border-surface-container-low">
        {/* Header */}
        <div className="p-space-lg flex items-center justify-between bg-surface-container-lowest border-b border-surface-container-low">
          <div className="flex items-center gap-space-sm">
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Doctor Availability &amp; Roster
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">
              {doctorRoster.length} Doctors Total
            </span>
          </div>
          <Link
            href="/admin/doctors"
            className="inline-flex items-center gap-1 font-label-lg text-label-lg text-primary hover:text-primary-container transition-colors font-medium"
          >
            <span>View All Doctors</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Link>
        </div>

        {/* Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                <th className="py-3 px-space-lg font-label-sm">Doctor Name</th>
                <th className="py-3 px-space-md font-label-sm">Department</th>
                <th className="py-3 px-space-md font-label-sm">Specialization</th>
                <th className="py-3 px-space-md font-label-sm">Today's Live Status</th>
                <th className="py-3 px-space-md font-label-sm">Roster Status</th>
                <th className="py-3 px-space-lg font-label-sm text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high font-body-md text-body-md text-on-surface">
              {doctorRoster.map((doc) => {
                const initials = doc.fullName
                  .split(' ')
                  .map((n) => n[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()

                let liveStatusBadge = (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm bg-surface-container text-primary font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-container"></span>
                    Available
                  </span>
                )

                if (doc.liveStatus === 'delayed') {
                  liveStatusBadge = (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm bg-surface-container-highest text-on-surface font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary-fixed-dim"></span>
                      Delayed (+{doc.delayMinutes}m)
                    </span>
                  )
                } else if (doc.liveStatus === 'on_leave') {
                  liveStatusBadge = (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm bg-surface-container-low text-on-surface-variant">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                      On Leave
                    </span>
                  )
                }

                return (
                  <tr key={doc.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="py-3.5 px-space-lg">
                      <div className="flex items-center gap-space-sm">
                        <div className="w-8 h-8 rounded-full bg-surface-container-high text-primary flex items-center justify-center font-label-md text-label-md font-bold">
                          {initials}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-label-lg text-label-lg text-on-surface leading-tight font-semibold">
                            {doc.fullName}
                          </span>
                          {doc.clinicRoom && (
                            <span className="text-xs text-on-surface-variant">{doc.clinicRoom}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-space-md">
                      <span className="px-2.5 py-0.5 rounded-full bg-surface-container font-label-sm text-label-sm text-on-surface">
                        {doc.departmentName}
                      </span>
                    </td>
                    <td className="py-3.5 px-space-md text-on-surface-variant">{doc.specialization}</td>
                    <td className="py-3.5 px-space-md">{liveStatusBadge}</td>
                    <td className="py-3.5 px-space-md">
                      <span
                        className={`px-2 py-0.5 rounded-full font-label-sm text-label-sm ${
                          doc.isActive
                            ? 'bg-surface-container-high text-primary font-semibold'
                            : 'bg-surface-variant text-on-surface-variant'
                        }`}
                      >
                        {doc.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3.5 px-space-lg text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => handleToggleActive(doc.id, doc.isActive)}
                          disabled={isPending}
                          className={`font-label-md text-label-md px-2 py-1 rounded transition-colors ${
                            doc.isActive
                              ? 'text-error hover:bg-error-container'
                              : 'text-primary hover:bg-surface-container'
                          }`}
                          type="button"
                        >
                          {doc.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- ADD DEPARTMENT MODAL --- */}
      {isAddDeptOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-surface-container-low">
            <div className="flex items-center justify-between pb-4 border-b border-surface-container-low">
              <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                Add Hospital Department
              </h3>
              <button
                onClick={() => setIsAddDeptOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-error-container text-on-error-container rounded-lg text-sm">
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className="mt-4 p-3 bg-secondary-container text-on-secondary-fixed rounded-lg text-sm font-medium">
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleAddDepartment} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface mb-1">
                  Department Name *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Ophthalmology, Oncology"
                  value={deptForm.name}
                  onChange={(e) => setDeptForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full bg-surface-container-low rounded-lg px-3.5 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Specialized patient care and clinic facilities..."
                  value={deptForm.description}
                  onChange={(e) => setDeptForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full bg-surface-container-low rounded-lg px-3.5 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddDeptOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm text-on-surface-variant hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-lg bg-primary-container text-on-primary font-semibold text-sm hover:bg-primary transition-colors disabled:opacity-50"
                >
                  {isPending ? 'Saving...' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD DOCTOR MODAL --- */}
      {isAddDocOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-surface-container-low my-8">
            <div className="flex items-center justify-between pb-4 border-b border-surface-container-low">
              <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                Add Doctor to Hospital Roster
              </h3>
              <button
                onClick={() => setIsAddDocOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 bg-error-container text-on-error-container rounded-lg text-sm">
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className="mt-4 p-3 bg-secondary-container text-on-secondary-fixed rounded-lg text-sm font-medium">
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleAddDoctor} className="space-y-3.5 mt-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface mb-1">
                  Doctor Full Name *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Dr. Sarah Jenkins, MD"
                  value={docForm.fullName}
                  onChange={(e) => setDocForm((p) => ({ ...p, fullName: e.target.value }))}
                  className="w-full bg-surface-container-low rounded-lg px-3.5 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface mb-1">
                    Department *
                  </label>
                  <select
                    required
                    value={docForm.departmentId}
                    onChange={(e) => setDocForm((p) => ({ ...p, departmentId: e.target.value }))}
                    className="w-full bg-surface-container-low rounded-lg px-3.5 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface mb-1">
                    Specialization *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Interventional Cardiology"
                    value={docForm.specialization}
                    onChange={(e) => setDocForm((p) => ({ ...p, specialization: e.target.value }))}
                    className="w-full bg-surface-container-low rounded-lg px-3.5 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface mb-1">
                    Clinic Room / Desk
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Room 204"
                    value={docForm.clinicRoom}
                    onChange={(e) => setDocForm((p) => ({ ...p, clinicRoom: e.target.value }))}
                    className="w-full bg-surface-container-low rounded-lg px-3.5 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface mb-1">
                    Qualifications
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MBBS, MD, FACC"
                    value={docForm.qualification}
                    onChange={(e) => setDocForm((p) => ({ ...p, qualification: e.target.value }))}
                    className="w-full bg-surface-container-low rounded-lg px-3.5 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface mb-1">
                    Experience (Years)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={docForm.experienceYears}
                    onChange={(e) => setDocForm((p) => ({ ...p, experienceYears: Number(e.target.value) }))}
                    className="w-full bg-surface-container-low rounded-lg px-3.5 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface mb-1">
                    Consultation Duration (Mins)
                  </label>
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={docForm.consultationMinutes}
                    onChange={(e) => setDocForm((p) => ({ ...p, consultationMinutes: Number(e.target.value) }))}
                    className="w-full bg-surface-container-low rounded-lg px-3.5 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActiveDoctor"
                  checked={docForm.isActive}
                  onChange={(e) => setDocForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                />
                <label htmlFor="isActiveDoctor" className="text-sm text-on-surface font-medium">
                  Active in Hospital Roster (Permit doctor station login &amp; patient booking)
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-surface-container-low">
                <button
                  type="button"
                  onClick={() => setIsAddDocOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm text-on-surface-variant hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-lg bg-primary-container text-on-primary font-semibold text-sm hover:bg-primary transition-colors disabled:opacity-50"
                >
                  {isPending ? 'Saving...' : 'Add Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CANCEL APPOINTMENT CONFIRMATION MODAL --- */}
      {cancelModalAppt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-surface-container-low">
            <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface mb-2">
              Cancel Appointment
            </h3>
            <p className="text-sm text-on-surface-variant mb-4">
              Are you sure you want to cancel the appointment for{' '}
              <strong className="text-on-surface">{cancelModalAppt.patientName}</strong> with{' '}
              <strong className="text-on-surface">{cancelModalAppt.doctorName}</strong> on{' '}
              {cancelModalAppt.appointmentDate} at {cancelModalAppt.startTime.slice(0, 5)}?
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface mb-1">
                Reason for cancellation
              </label>
              <input
                type="text"
                placeholder="e.g. Doctor emergency realignment"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-surface-container-low rounded-lg px-3.5 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <p className="text-xs text-on-surface-variant mt-1">
                An automatic notification will be dispatched to the patient.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelModalAppt(null)}
                className="px-4 py-2 rounded-lg text-sm text-on-surface-variant hover:bg-surface-container"
              >
                Keep Appointment
              </button>
              <button
                type="button"
                onClick={handleCancelAppointment}
                disabled={isPending}
                className="px-5 py-2 rounded-lg bg-error text-white font-semibold text-sm hover:bg-rose-700 transition-colors disabled:opacity-50"
              >
                {isPending ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
