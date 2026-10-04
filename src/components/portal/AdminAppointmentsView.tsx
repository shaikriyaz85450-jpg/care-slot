'use client'

import React, { useState, useTransition } from 'react'
import {
  AdminAppointmentSummary,
  cancelAdminAppointmentAction,
} from '@/app/actions/admin'

interface AdminAppointmentsViewProps {
  initialAppointments: AdminAppointmentSummary[]
  doctors: { id: string; name: string }[]
}

export function AdminAppointmentsView({
  initialAppointments,
  doctors,
}: AdminAppointmentsViewProps) {
  const [appointments, setAppointments] = useState<AdminAppointmentSummary[]>(initialAppointments)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDoctor, setSelectedDoctor] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedDateFilter, setSelectedDateFilter] = useState('all')
  const [customDate, setCustomDate] = useState('')

  // Modals
  const [selectedApptDetails, setSelectedApptDetails] = useState<AdminAppointmentSummary | null>(null)
  const [cancelModalAppt, setCancelModalAppt] = useState<AdminAppointmentSummary | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [isPending, startTransition] = useTransition()

  const todayStr = new Date().toISOString().split('T')[0]

  // Filtered Appointments
  const filteredAppointments = appointments.filter((a) => {
    if (selectedDoctor !== 'all' && a.doctorId !== selectedDoctor) return false
    if (selectedStatus !== 'all' && a.status !== selectedStatus) return false

    if (selectedDateFilter === 'today' && a.appointmentDate !== todayStr) return false
    if (selectedDateFilter === 'custom' && customDate && a.appointmentDate !== customDate) return false

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      const match =
        a.patientName.toLowerCase().includes(term) ||
        a.doctorName.toLowerCase().includes(term) ||
        a.departmentName.toLowerCase().includes(term) ||
        (a.reason && a.reason.toLowerCase().includes(term))
      if (!match) return false
    }

    return true
  })

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

  return (
    <div className="flex flex-col w-full gap-space-lg max-w-7xl mx-auto">
      {/* 1. Header Bar */}
      <div className="flex flex-col">
        <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold">
          Hospital Appointments
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
          Hospital-wide schedule monitoring, patient consultations, and appointment administration.
        </p>
      </div>

      {/* 2. Filter Bar */}
      <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-surface-container-low flex flex-col md:flex-row gap-space-sm items-center justify-between flex-wrap">
        <div className="relative w-full md:w-72">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[18px]">
            search
          </span>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-container-low pl-9 pr-3 py-2 rounded-lg font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container"
            placeholder="Search patient, doctor, reason..."
            type="text"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Doctor Filter */}
          <select
            value={selectedDoctor}
            onChange={(e) => setSelectedDoctor(e.target.value)}
            className="bg-surface-container-low px-3 py-2 rounded-lg text-sm text-on-surface border-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All Doctors</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-surface-container-low px-3 py-2 rounded-lg text-sm text-on-surface border-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All Statuses</option>
            <option value="booked">Booked / Upcoming</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Date Filter */}
          <select
            value={selectedDateFilter}
            onChange={(e) => setSelectedDateFilter(e.target.value)}
            className="bg-surface-container-low px-3 py-2 rounded-lg text-sm text-on-surface border-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="all">All Dates</option>
            <option value="today">Today Only</option>
            <option value="custom">Specific Date</option>
          </select>

          {selectedDateFilter === 'custom' && (
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="bg-surface-container-low px-3 py-1.5 rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          )}
        </div>
      </div>

      {/* 3. Appointments Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col border border-surface-container-low">
        <div className="p-space-lg border-b border-surface-container-low flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
              Appointments Log
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm font-medium">
              {filteredAppointments.length} matching
            </span>
          </div>
          <span className="text-xs text-on-surface-variant font-medium">
            Chronological OPD Schedule
          </span>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                <th className="py-3 px-space-lg font-label-sm">Patient</th>
                <th className="py-3 px-space-md font-label-sm">Doctor</th>
                <th className="py-3 px-space-md font-label-sm">Department</th>
                <th className="py-3 px-space-md font-label-sm">Date</th>
                <th className="py-3 px-space-md font-label-sm">Time</th>
                <th className="py-3 px-space-md font-label-sm">Status</th>
                <th className="py-3 px-space-lg font-label-sm text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high font-body-md text-body-md text-on-surface">
              {filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-on-surface-variant text-sm">
                    No appointments found matching the current filters.
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
                      <td className="py-3.5 px-space-md text-on-surface-variant font-medium">
                        {appt.doctorName}
                      </td>
                      <td className="py-3.5 px-space-md text-on-surface-variant text-sm">
                        <span className="px-2 py-0.5 rounded-full bg-surface-container text-xs">
                          {appt.departmentName}
                        </span>
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
                          <button
                            onClick={() => setSelectedApptDetails(appt)}
                            className="text-on-surface-variant hover:text-on-surface font-label-md text-label-md px-2 py-1 rounded hover:bg-surface-container transition-colors"
                            type="button"
                          >
                            Details
                          </button>
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

      {/* --- APPOINTMENT DETAILS MODAL --- */}
      {selectedApptDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-surface-container-low">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-low">
              <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                Appointment Details
              </h3>
              <button
                onClick={() => setSelectedApptDetails(null)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between py-1.5 border-b border-surface-container-low">
                <span className="text-on-surface-variant font-medium">Appointment ID:</span>
                <span className="font-mono text-xs text-on-surface">{selectedApptDetails.id}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-surface-container-low">
                <span className="text-on-surface-variant font-medium">Patient:</span>
                <span className="font-semibold text-on-surface">{selectedApptDetails.patientName}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-surface-container-low">
                <span className="text-on-surface-variant font-medium">Assigned Physician:</span>
                <span className="font-semibold text-on-surface">{selectedApptDetails.doctorName}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-surface-container-low">
                <span className="text-on-surface-variant font-medium">Department:</span>
                <span className="text-on-surface">{selectedApptDetails.departmentName}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-surface-container-low">
                <span className="text-on-surface-variant font-medium">Date &amp; Time:</span>
                <span className="text-on-surface font-semibold">
                  {selectedApptDetails.appointmentDate} at {selectedApptDetails.startTime.slice(0, 5)} -{' '}
                  {selectedApptDetails.endTime.slice(0, 5)}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-surface-container-low">
                <span className="text-on-surface-variant font-medium">Status:</span>
                <span className="uppercase text-xs font-bold tracking-wider text-primary">
                  {selectedApptDetails.status}
                </span>
              </div>
              {selectedApptDetails.reason && (
                <div className="py-1.5">
                  <span className="text-on-surface-variant font-medium block mb-1">
                    Reason / Clinical Notes:
                  </span>
                  <p className="bg-surface-container-low p-2.5 rounded-lg text-xs text-on-surface">
                    {selectedApptDetails.reason}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedApptDetails(null)}
                className="px-5 py-2 rounded-lg bg-surface-container text-on-surface font-semibold text-sm hover:bg-surface-container-high transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CANCEL CONFIRMATION MODAL --- */}
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
                placeholder="e.g. Schedule realignment or administrative reschedule"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-surface-container-low rounded-lg px-3.5 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <p className="text-xs text-on-surface-variant mt-1">
                The patient will be immediately notified in their Notification Center.
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
