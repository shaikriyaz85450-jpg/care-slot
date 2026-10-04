'use client'

import React, { useState, useTransition } from 'react'
import {
  AdminDoctorRosterItem,
  createDoctorAction,
  updateDoctorAction,
  toggleDoctorActiveAction,
} from '@/app/actions/admin'

interface AdminDoctorsViewProps {
  initialDoctors: AdminDoctorRosterItem[]
  departments: { id: string; name: string }[]
}

export function AdminDoctorsView({ initialDoctors, departments }: AdminDoctorsViewProps) {
  const [doctors, setDoctors] = useState<AdminDoctorRosterItem[]>(initialDoctors)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDept, setSelectedDept] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingDoctor, setEditingDoctor] = useState<AdminDoctorRosterItem | null>(null)

  // Forms state
  const [addForm, setAddForm] = useState({
    fullName: '',
    specialization: '',
    departmentId: departments[0]?.id || '',
    clinicRoom: '',
    qualification: 'MBBS, MD',
    experienceYears: 5,
    consultationMinutes: 15,
    isActive: true,
  })

  const [editForm, setEditForm] = useState({
    fullName: '',
    specialization: '',
    departmentId: '',
    clinicRoom: '',
    qualification: 'MBBS, MD',
    experienceYears: 5,
    consultationMinutes: 15,
    isActive: true,
  })

  const [modalError, setModalError] = useState<string | null>(null)
  const [modalSuccess, setModalSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Filtered Doctors
  const filteredDoctors = doctors.filter((doc) => {
    if (selectedDept !== 'all' && doc.departmentId !== selectedDept) return false
    if (selectedStatus === 'active' && !doc.isActive) return false
    if (selectedStatus === 'inactive' && doc.isActive) return false
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      const match =
        doc.fullName.toLowerCase().includes(term) ||
        doc.specialization.toLowerCase().includes(term) ||
        doc.departmentName.toLowerCase().includes(term) ||
        (doc.clinicRoom && doc.clinicRoom.toLowerCase().includes(term))
      if (!match) return false
    }
    return true
  })

  // Handlers
  const handleOpenEdit = (doc: AdminDoctorRosterItem) => {
    setEditingDoctor(doc)
    setEditForm({
      fullName: doc.fullName,
      specialization: doc.specialization,
      departmentId: doc.departmentId,
      clinicRoom: doc.clinicRoom || '',
      qualification: 'MBBS, MD',
      experienceYears: 5,
      consultationMinutes: 15,
      isActive: doc.isActive,
    })
    setModalError(null)
    setModalSuccess(null)
  }

  const handleCreateDoctor = (e: React.FormEvent) => {
    e.preventDefault()
    setModalError(null)
    setModalSuccess(null)

    startTransition(async () => {
      const res = await createDoctorAction({
        fullName: addForm.fullName,
        specialization: addForm.specialization,
        departmentId: addForm.departmentId,
        clinicRoom: addForm.clinicRoom,
        qualification: addForm.qualification,
        experienceYears: Number(addForm.experienceYears),
        consultationMinutes: Number(addForm.consultationMinutes),
        isActive: addForm.isActive,
      })

      if (!res.success) {
        setModalError(res.error || 'Failed to add doctor.')
      } else {
        const dept = departments.find((d) => d.id === addForm.departmentId)
        const newDoc: AdminDoctorRosterItem = {
          id: res.doctorId || crypto.randomUUID(),
          profileId: crypto.randomUUID(),
          fullName: addForm.fullName,
          specialization: addForm.specialization,
          departmentId: addForm.departmentId,
          departmentName: dept?.name || 'General',
          clinicRoom: addForm.clinicRoom,
          isActive: addForm.isActive,
          liveStatus: 'available',
          delayMinutes: 0,
        }
        setDoctors((prev) => [newDoc, ...prev])
        setModalSuccess(`Dr. ${addForm.fullName} has been added successfully.`)

        setTimeout(() => {
          setIsAddModalOpen(false)
          setModalSuccess(null)
          setAddForm({
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

  const handleUpdateDoctor = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingDoctor) return
    setModalError(null)
    setModalSuccess(null)

    startTransition(async () => {
      const res = await updateDoctorAction({
        doctorId: editingDoctor.id,
        fullName: editForm.fullName,
        specialization: editForm.specialization,
        departmentId: editForm.departmentId,
        clinicRoom: editForm.clinicRoom,
        qualification: editForm.qualification,
        experienceYears: Number(editForm.experienceYears),
        consultationMinutes: Number(editForm.consultationMinutes),
        isActive: editForm.isActive,
      })

      if (!res.success) {
        setModalError(res.error || 'Failed to update doctor details.')
      } else {
        const dept = departments.find((d) => d.id === editForm.departmentId)
        setDoctors((prev) =>
          prev.map((d) =>
            d.id === editingDoctor.id
              ? {
                  ...d,
                  fullName: editForm.fullName,
                  specialization: editForm.specialization,
                  departmentId: editForm.departmentId,
                  departmentName: dept?.name || d.departmentName,
                  clinicRoom: editForm.clinicRoom,
                  isActive: editForm.isActive,
                }
              : d
          )
        )
        setModalSuccess('Doctor details saved successfully.')
        setTimeout(() => {
          setEditingDoctor(null)
          setModalSuccess(null)
        }, 1200)
      }
    })
  }

  const handleToggleStatus = (doctorId: string, currentStatus: boolean) => {
    startTransition(async () => {
      const nextStatus = !currentStatus
      const res = await toggleDoctorActiveAction(doctorId, nextStatus)
      if (res.success) {
        setDoctors((prev) =>
          prev.map((d) => (d.id === doctorId ? { ...d, isActive: nextStatus } : d))
        )
      } else {
        alert(res.error || 'Failed to update active status.')
      }
    })
  }

  return (
    <div className="flex flex-col w-full gap-space-lg max-w-7xl mx-auto">
      {/* 1. Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-space-md">
        <div className="flex flex-col">
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold">
            Doctors Management
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
            Manage hospital medical staff, departments, room allocations, and portal authentication access.
          </p>
        </div>
        <button
          onClick={() => {
            setModalError(null)
            setModalSuccess(null)
            setIsAddModalOpen(true)
          }}
          className="inline-flex items-center gap-space-xs px-space-md py-2.5 rounded-lg bg-primary-container text-on-primary font-label-lg text-label-lg shadow-sm hover:bg-primary transition-colors self-start md:self-auto"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          <span>+ Add Doctor</span>
        </button>
      </div>

      {/* 2. Filters & Search Bar */}
      <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-surface-container-low flex flex-col md:flex-row gap-space-sm items-center justify-between">
        <div className="relative w-full md:w-80">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[18px]">
            search
          </span>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-container-low pl-9 pr-3 py-2 rounded-lg font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container"
            placeholder="Search by name, specialization, room..."
            type="text"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Department Filter */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="bg-surface-container-low px-3 py-2 rounded-lg text-sm text-on-surface border-none focus:ring-2 focus:ring-primary/20 w-full md:w-auto"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-surface-container-low px-3 py-2 rounded-lg text-sm text-on-surface border-none focus:ring-2 focus:ring-primary/20 w-full md:w-auto"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* 3. Doctors Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col border border-surface-container-low">
        <div className="p-space-lg flex items-center justify-between border-b border-surface-container-low">
          <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
            Physicians Roster ({filteredDoctors.length})
          </h2>
          <span className="text-xs text-on-surface-variant font-medium">
            Deactivating immediately revokes doctor portal access
          </span>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                <th className="py-3 px-space-lg font-label-sm">Doctor</th>
                <th className="py-3 px-space-md font-label-sm">Department</th>
                <th className="py-3 px-space-md font-label-sm">Specialization</th>
                <th className="py-3 px-space-md font-label-sm">Clinic Room</th>
                <th className="py-3 px-space-md font-label-sm">Roster Access</th>
                <th className="py-3 px-space-lg font-label-sm text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high font-body-md text-body-md text-on-surface">
              {filteredDoctors.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-on-surface-variant text-sm">
                    No doctors match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredDoctors.map((doc) => {
                  const initials = doc.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()

                  return (
                    <tr key={doc.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="py-3.5 px-space-lg">
                        <div className="flex items-center gap-space-sm">
                          <div className="w-9 h-9 rounded-full bg-surface-container-high text-primary flex items-center justify-center font-bold text-sm">
                            {initials}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-on-surface leading-tight">
                              {doc.fullName}
                            </span>
                            <span className="text-xs text-on-surface-variant">
                              ID: {doc.id.slice(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-space-md">
                        <span className="px-2.5 py-0.5 rounded-full bg-surface-container font-label-sm text-label-sm text-on-surface">
                          {doc.departmentName}
                        </span>
                      </td>
                      <td className="py-3.5 px-space-md text-on-surface-variant font-medium">
                        {doc.specialization}
                      </td>
                      <td className="py-3.5 px-space-md text-on-surface">
                        {doc.clinicRoom || '—'}
                      </td>
                      <td className="py-3.5 px-space-md">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm font-semibold ${
                            doc.isActive
                              ? 'bg-primary-container text-on-primary-container'
                              : 'bg-surface-variant text-on-surface-variant'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              doc.isActive ? 'bg-primary-fixed-dim' : 'bg-outline'
                            }`}
                          />
                          {doc.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3.5 px-space-lg text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEdit(doc)}
                            className="text-on-surface-variant hover:text-on-surface font-label-md text-label-md px-2.5 py-1 rounded hover:bg-surface-container transition-colors"
                            type="button"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleStatus(doc.id, doc.isActive)}
                            disabled={isPending}
                            className={`font-label-md text-label-md px-2.5 py-1 rounded transition-colors ${
                              doc.isActive
                                ? 'text-error hover:bg-error-container'
                                : 'text-primary hover:bg-surface-container font-semibold'
                            }`}
                            type="button"
                          >
                            {doc.isActive ? 'Deactivate' : 'Activate'}
                          </button>
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

      {/* --- ADD DOCTOR MODAL --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-surface-container-low my-8">
            <div className="flex items-center justify-between pb-4 border-b border-surface-container-low">
              <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                Add Doctor to Hospital Roster
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {modalError && (
              <div className="mt-4 p-3 bg-error-container text-on-error-container rounded-lg text-sm">
                {modalError}
              </div>
            )}
            {modalSuccess && (
              <div className="mt-4 p-3 bg-secondary-container text-on-secondary-fixed rounded-lg text-sm font-medium">
                {modalSuccess}
              </div>
            )}

            <form onSubmit={handleCreateDoctor} className="space-y-3.5 mt-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface mb-1">
                  Doctor Full Name *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Dr. Arthur Pendelton, MD"
                  value={addForm.fullName}
                  onChange={(e) => setAddForm((p) => ({ ...p, fullName: e.target.value }))}
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
                    value={addForm.departmentId}
                    onChange={(e) => setAddForm((p) => ({ ...p, departmentId: e.target.value }))}
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
                    placeholder="e.g. Pediatric Cardiology"
                    value={addForm.specialization}
                    onChange={(e) => setAddForm((p) => ({ ...p, specialization: e.target.value }))}
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
                    placeholder="e.g. Desk 204"
                    value={addForm.clinicRoom}
                    onChange={(e) => setAddForm((p) => ({ ...p, clinicRoom: e.target.value }))}
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
                    value={addForm.qualification}
                    onChange={(e) => setAddForm((p) => ({ ...p, qualification: e.target.value }))}
                    className="w-full bg-surface-container-low rounded-lg px-3.5 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActiveNew"
                  checked={addForm.isActive}
                  onChange={(e) => setAddForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                />
                <label htmlFor="isActiveNew" className="text-sm text-on-surface font-medium">
                  Active in Hospital Roster (Allow patient booking and physician portal access)
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-surface-container-low">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm text-on-surface-variant hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-lg bg-primary-container text-on-primary font-semibold text-sm hover:bg-primary transition-colors disabled:opacity-50"
                >
                  {isPending ? 'Saving...' : 'Create Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT DOCTOR MODAL --- */}
      {editingDoctor && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-surface-container-low my-8">
            <div className="flex items-center justify-between pb-4 border-b border-surface-container-low">
              <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                Edit Doctor Details
              </h3>
              <button
                onClick={() => setEditingDoctor(null)}
                className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {modalError && (
              <div className="mt-4 p-3 bg-error-container text-on-error-container rounded-lg text-sm">
                {modalError}
              </div>
            )}
            {modalSuccess && (
              <div className="mt-4 p-3 bg-secondary-container text-on-secondary-fixed rounded-lg text-sm font-medium">
                {modalSuccess}
              </div>
            )}

            <form onSubmit={handleUpdateDoctor} className="space-y-3.5 mt-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface mb-1">
                  Doctor Full Name *
                </label>
                <input
                  required
                  type="text"
                  value={editForm.fullName}
                  onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))}
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
                    value={editForm.departmentId}
                    onChange={(e) => setEditForm((p) => ({ ...p, departmentId: e.target.value }))}
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
                    value={editForm.specialization}
                    onChange={(e) => setEditForm((p) => ({ ...p, specialization: e.target.value }))}
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
                    value={editForm.clinicRoom}
                    onChange={(e) => setEditForm((p) => ({ ...p, clinicRoom: e.target.value }))}
                    className="w-full bg-surface-container-low rounded-lg px-3.5 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface mb-1">
                    Qualifications
                  </label>
                  <input
                    type="text"
                    value={editForm.qualification}
                    onChange={(e) => setEditForm((p) => ({ ...p, qualification: e.target.value }))}
                    className="w-full bg-surface-container-low rounded-lg px-3.5 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActiveEdit"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
                />
                <label htmlFor="isActiveEdit" className="text-sm text-on-surface font-medium">
                  Active in Hospital Roster (Permit doctor station login &amp; patient booking)
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-surface-container-low">
                <button
                  type="button"
                  onClick={() => setEditingDoctor(null)}
                  className="px-4 py-2 rounded-lg text-sm text-on-surface-variant hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 rounded-lg bg-primary-container text-on-primary font-semibold text-sm hover:bg-primary transition-colors disabled:opacity-50"
                >
                  {isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
