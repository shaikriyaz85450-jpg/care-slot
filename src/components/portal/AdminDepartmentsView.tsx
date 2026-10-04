'use client'

import React, { useState, useTransition } from 'react'
import {
  AdminDepartmentItem,
  createDepartmentAction,
  updateDepartmentAction,
} from '@/app/actions/admin'

interface AdminDepartmentsViewProps {
  initialDepartments: AdminDepartmentItem[]
}

export function AdminDepartmentsView({ initialDepartments }: AdminDepartmentsViewProps) {
  const [departments, setDepartments] = useState<AdminDepartmentItem[]>(initialDepartments)
  const [searchTerm, setSearchTerm] = useState('')

  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingDept, setEditingDept] = useState<AdminDepartmentItem | null>(null)

  // Forms
  const [addForm, setAddForm] = useState({ name: '', description: '' })
  const [editForm, setEditForm] = useState({ name: '', description: '' })
  const [modalError, setModalError] = useState<string | null>(null)
  const [modalSuccess, setModalSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Filtered
  const filteredDepartments = departments.filter((d) => {
    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase()
    return d.name.toLowerCase().includes(term) || (d.description && d.description.toLowerCase().includes(term))
  })

  // Handlers
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    setModalError(null)
    setModalSuccess(null)

    startTransition(async () => {
      const res = await createDepartmentAction(addForm.name, addForm.description)
      if (!res.success) {
        setModalError(res.error || 'Failed to create department.')
      } else {
        const newDept: AdminDepartmentItem = {
          id: res.department?.id || crypto.randomUUID(),
          name: addForm.name.trim(),
          description: addForm.description?.trim() || null,
          doctorsCount: 0,
          createdAt: new Date().toISOString(),
        }
        setDepartments((prev) => [...prev, newDept].sort((a, b) => a.name.localeCompare(b.name)))
        setModalSuccess(`Department "${addForm.name}" created successfully.`)

        setTimeout(() => {
          setIsAddOpen(false)
          setModalSuccess(null)
          setAddForm({ name: '', description: '' })
        }, 1200)
      }
    })
  }

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingDept) return
    setModalError(null)
    setModalSuccess(null)

    startTransition(async () => {
      const res = await updateDepartmentAction(editingDept.id, editForm.name, editForm.description)
      if (!res.success) {
        setModalError(res.error || 'Failed to update department.')
      } else {
        setDepartments((prev) =>
          prev.map((d) =>
            d.id === editingDept.id
              ? { ...d, name: editForm.name.trim(), description: editForm.description?.trim() || null }
              : d
          )
        )
        setModalSuccess('Department details updated successfully.')
        setTimeout(() => {
          setEditingDept(null)
          setModalSuccess(null)
        }, 1200)
      }
    })
  }

  const handleOpenEdit = (dept: AdminDepartmentItem) => {
    setEditingDept(dept)
    setEditForm({ name: dept.name, description: dept.description || '' })
    setModalError(null)
    setModalSuccess(null)
  }

  return (
    <div className="flex flex-col w-full gap-space-lg max-w-7xl mx-auto">
      {/* 1. Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-space-md">
        <div className="flex flex-col">
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold">
            Hospital Departments
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
            Configure clinical wings, specialized outpatient divisions, and assignable medical departments.
          </p>
        </div>
        <button
          onClick={() => {
            setModalError(null)
            setModalSuccess(null)
            setIsAddOpen(true)
          }}
          className="inline-flex items-center gap-space-xs px-space-md py-2.5 rounded-lg bg-primary-container text-on-primary font-label-lg text-label-lg shadow-sm hover:bg-primary transition-colors self-start md:self-auto"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>+ Add Department</span>
        </button>
      </div>

      {/* 2. Search Toolbar */}
      <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm border border-surface-container-low flex flex-col sm:flex-row gap-space-sm items-center justify-between">
        <div className="relative w-full sm:w-80">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[18px]">
            search
          </span>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-surface-container-low pl-9 pr-3 py-2 rounded-lg font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container"
            placeholder="Search departments..."
            type="text"
          />
        </div>
        <span className="text-xs text-on-surface-variant font-medium">
          Total: {departments.length} Operational Departments
        </span>
      </div>

      {/* 3. Departments Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col border border-surface-container-low">
        <div className="p-space-lg border-b border-surface-container-low flex items-center justify-between">
          <h2 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
            Department Directory
          </h2>
          <span className="text-xs text-on-surface-variant font-medium">
            Names are enforced unique in database schema
          </span>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
                <th className="py-3 px-space-lg font-label-sm">Department Name</th>
                <th className="py-3 px-space-md font-label-sm">Description</th>
                <th className="py-3 px-space-md font-label-sm">Active Doctors</th>
                <th className="py-3 px-space-lg font-label-sm text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high font-body-md text-body-md text-on-surface">
              {filteredDepartments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-on-surface-variant text-sm">
                    No departments found.
                  </td>
                </tr>
              ) : (
                filteredDepartments.map((dept) => (
                  <tr key={dept.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="py-4 px-space-lg">
                      <div className="flex items-center gap-space-sm">
                        <div className="w-9 h-9 rounded-full bg-surface-container-high text-primary flex items-center justify-center font-bold">
                          <span className="material-symbols-outlined text-[20px]">domain</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-semibold text-on-surface leading-tight text-sm">
                            {dept.name}
                          </span>
                          <span className="text-xs text-on-surface-variant">ID: {dept.id.slice(0, 8)}...</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-space-md text-on-surface-variant text-sm max-w-md">
                      {dept.description || '—'}
                    </td>
                    <td className="py-4 px-space-md">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm bg-surface-container text-primary font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary-container" />
                        {dept.doctorsCount} {dept.doctorsCount === 1 ? 'Doctor' : 'Doctors'}
                      </span>
                    </td>
                    <td className="py-4 px-space-lg text-right">
                      <button
                        onClick={() => handleOpenEdit(dept)}
                        className="text-on-surface-variant hover:text-on-surface font-label-md text-label-md px-3 py-1.5 rounded hover:bg-surface-container transition-colors"
                        type="button"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- ADD DEPARTMENT MODAL --- */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-surface-container-low">
            <div className="flex items-center justify-between pb-4 border-b border-surface-container-low">
              <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                Add Hospital Department
              </h3>
              <button
                onClick={() => setIsAddOpen(false)}
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

            <form onSubmit={handleCreate} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface mb-1">
                  Department Name *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Neurology, Dermatology"
                  value={addForm.name}
                  onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full bg-surface-container-low rounded-lg px-3.5 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Clinical procedures, specialized facilities, and treatment scope..."
                  value={addForm.description}
                  onChange={(e) => setAddForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full bg-surface-container-low rounded-lg px-3.5 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
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

      {/* --- EDIT DEPARTMENT MODAL --- */}
      {editingDept && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-surface-container-low">
            <div className="flex items-center justify-between pb-4 border-b border-surface-container-low">
              <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                Edit Department
              </h3>
              <button
                onClick={() => setEditingDept(null)}
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

            <form onSubmit={handleUpdate} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface mb-1">
                  Department Name *
                </label>
                <input
                  required
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full bg-surface-container-low rounded-lg px-3.5 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full bg-surface-container-low rounded-lg px-3.5 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingDept(null)}
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
