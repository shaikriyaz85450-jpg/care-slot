'use server'

import { createClient } from '@/lib/supabase/server'
import { resolveUserAuthorization } from '@/lib/role-utils'
import { revalidatePath } from 'next/cache'

/**
 * Helper to authenticate and authorize that the current session belongs to an active Hospital Administrator.
 */
async function verifyAdminSession() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      supabase,
      user: null,
      isAdmin: false,
      error: 'Authentication required. Please sign in to access admin operations.',
    }
  }

  const authResult = await resolveUserAuthorization(supabase, user.id)
  if (!authResult.isAdmin) {
    return {
      supabase,
      user,
      isAdmin: false,
      error: 'Access denied. You do not possess hospital administrator credentials.',
    }
  }

  return {
    supabase,
    user,
    isAdmin: true,
    error: null,
  }
}

/**
 * Helper to dispatch notification with graceful error handling
 */
async function dispatchNotification(
  supabase: any,
  payload: {
    userId: string
    title: string
    body: string
    type?: string
    appointmentId?: string
    doctorId?: string
  }
) {
  try {
    await supabase.from('notifications').insert({
      user_id: payload.userId,
      title: payload.title,
      body: payload.body,
      type: payload.type || 'system',
      appointment_id: payload.appointmentId || null,
      doctor_id: payload.doctorId || null,
      read_at: null,
    })
  } catch (err) {
    console.warn('Failed to dispatch notification to patient:', err)
  }
}

// ----------------------------------------------------------------------------
// 1. OVERVIEW DATA ACTION
// ----------------------------------------------------------------------------

export interface AdminOverviewStats {
  totalDoctors: number
  activeDoctorsCount: number
  totalDepartments: number
  departmentNames: string[]
  todayAppointmentsCount: number
  todayCompletedCount: number
  todayUpcomingCount: number
  todayCancelledCount: number
  liveAvailableCount: number
  liveDelayedCount: number
  liveOnLeaveCount: number
}

export interface AdminAppointmentSummary {
  id: string
  patientId: string
  patientName: string
  doctorId: string
  doctorName: string
  departmentName: string
  appointmentDate: string
  startTime: string
  endTime: string
  status: 'booked' | 'completed' | 'cancelled' | 'no_show'
  reason: string | null
}

export interface AdminDoctorRosterItem {
  id: string
  profileId: string
  fullName: string
  specialization: string
  departmentName: string
  departmentId: string
  clinicRoom: string | null
  isActive: boolean
  liveStatus: 'available' | 'delayed' | 'on_leave' | 'not_checked_in'
  delayMinutes: number
  statusNote?: string | null
}

export async function getAdminOverviewDataAction() {
  const { supabase, isAdmin, error } = await verifyAdminSession()
  if (!isAdmin) {
    return { success: false, error, data: null }
  }

  try {
    const todayStr = new Date().toISOString().split('T')[0]

    // Concurrently fetch doctors, departments, today's appointments, and live daily status
    const [docsRes, deptsRes, apptsRes, dailyStatusRes, profilesRes] = await Promise.all([
      supabase
        .from('doctors')
        .select('id, profile_id, department_id, full_name, specialization, clinic_room, is_active')
        .order('created_at', { ascending: false }),
      supabase
        .from('departments')
        .select('id, name, description')
        .order('name', { ascending: true }),
      supabase
        .from('appointments')
        .select('id, patient_id, doctor_id, appointment_date, start_time, end_time, status, reason')
        .eq('appointment_date', todayStr)
        .order('start_time', { ascending: true }),
      supabase
        .from('doctor_daily_status')
        .select('doctor_id, status, delay_minutes, note')
        .eq('date', todayStr),
      supabase
        .from('profiles')
        .select('id, full_name, role'),
    ])

    const doctors = docsRes.data || []
    const departments = deptsRes.data || []
    const todayAppointments = apptsRes.data || []
    const dailyStatuses = dailyStatusRes.data || []
    const profiles = profilesRes.data || []

    const deptMap = new Map(departments.map((d: any) => [d.id, d.name]))
    const profileMap = new Map(profiles.map((p: any) => [p.id, p.full_name]))
    const statusMap = new Map(
      dailyStatuses.map((s: any) => [
        s.doctor_id,
        { status: s.status, delayMinutes: s.delay_minutes || 0, note: s.note },
      ])
    )

    // Doctor Map for appointment lookups
    const docMap = new Map(
      doctors.map((d: any) => [
        d.id,
        {
          name: d.full_name || profileMap.get(d.profile_id) || 'Physician',
          deptName: deptMap.get(d.department_id) || 'General',
        },
      ])
    )

    // Compute Stats
    const activeDoctorsCount = doctors.filter((d: any) => d.is_active).length
    const todayCompletedCount = todayAppointments.filter((a: any) => a.status === 'completed').length
    const todayUpcomingCount = todayAppointments.filter((a: any) => a.status === 'booked').length
    const todayCancelledCount = todayAppointments.filter((a: any) => a.status === 'cancelled').length

    let liveAvailableCount = 0
    let liveDelayedCount = 0
    let liveOnLeaveCount = 0

    doctors.forEach((d: any) => {
      const st = statusMap.get(d.id)?.status || 'available'
      if (st === 'available' || st === 'not_checked_in') liveAvailableCount++
      else if (st === 'delayed') liveDelayedCount++
      else if (st === 'on_leave') liveOnLeaveCount++
    })

    const stats: AdminOverviewStats = {
      totalDoctors: doctors.length,
      activeDoctorsCount,
      totalDepartments: departments.length,
      departmentNames: departments.map((d: any) => d.name),
      todayAppointmentsCount: todayAppointments.length,
      todayCompletedCount,
      todayUpcomingCount,
      todayCancelledCount,
      liveAvailableCount,
      liveDelayedCount,
      liveOnLeaveCount,
    }

    // Format Appointments for Overview Table
    const formattedAppointments: AdminAppointmentSummary[] = todayAppointments.map((a: any) => {
      const doc = docMap.get(a.doctor_id)
      const patientName = profileMap.get(a.patient_id) || 'Patient'
      return {
        id: a.id,
        patientId: a.patient_id,
        patientName,
        doctorId: a.doctor_id,
        doctorName: doc?.name || 'Dr. Assigned',
        departmentName: doc?.deptName || 'OPD',
        appointmentDate: a.appointment_date,
        startTime: a.start_time,
        endTime: a.end_time,
        status: a.status,
        reason: a.reason,
      }
    })

    // Format Doctor Roster for Preview Table
    const rosterItems: AdminDoctorRosterItem[] = doctors.map((d: any) => {
      const liveInfo = statusMap.get(d.id)
      return {
        id: d.id,
        profileId: d.profile_id,
        fullName: d.full_name || profileMap.get(d.profile_id) || 'Physician',
        specialization: d.specialization,
        departmentId: d.department_id,
        departmentName: deptMap.get(d.department_id) || 'General',
        clinicRoom: d.clinic_room,
        isActive: d.is_active ?? true,
        liveStatus: (liveInfo?.status as any) || 'available',
        delayMinutes: liveInfo?.delayMinutes || 0,
        statusNote: liveInfo?.note,
      }
    })

    return {
      success: true,
      error: null,
      data: {
        stats,
        recentAppointments: formattedAppointments,
        doctorRoster: rosterItems,
      },
    }
  } catch (err: any) {
    console.error('Error in getAdminOverviewDataAction:', err)
    return { success: false, error: err?.message || 'Failed to fetch overview data.', data: null }
  }
}

// ----------------------------------------------------------------------------
// 2. DOCTOR ACTIONS
// ----------------------------------------------------------------------------

export async function getAdminDoctorsAction() {
  const { supabase, isAdmin, error } = await verifyAdminSession()
  if (!isAdmin) {
    return { success: false, error, data: [] }
  }

  try {
    const todayStr = new Date().toISOString().split('T')[0]
    const [docsRes, deptsRes, statusRes, profilesRes] = await Promise.all([
      supabase
        .from('doctors')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase.from('departments').select('id, name'),
      supabase.from('doctor_daily_status').select('doctor_id, status, delay_minutes, note').eq('date', todayStr),
      supabase.from('profiles').select('id, full_name, phone'),
    ])

    const doctors = docsRes.data || []
    const departments = deptsRes.data || []
    const statuses = statusRes.data || []
    const profiles = profilesRes.data || []

    const deptMap = new Map(departments.map((d: any) => [d.id, d.name]))
    const statusMap = new Map(statuses.map((s: any) => [s.doctor_id, s]))
    const profileMap = new Map(profiles.map((p: any) => [p.id, p]))

    const roster: AdminDoctorRosterItem[] = doctors.map((d: any) => {
      const prof = profileMap.get(d.profile_id)
      const st = statusMap.get(d.id)
      return {
        id: d.id,
        profileId: d.profile_id,
        fullName: d.full_name || prof?.full_name || 'Physician',
        specialization: d.specialization,
        departmentId: d.department_id,
        departmentName: deptMap.get(d.department_id) || 'General',
        clinicRoom: d.clinic_room,
        isActive: d.is_active ?? true,
        liveStatus: (st?.status as any) || 'available',
        delayMinutes: st?.delay_minutes || 0,
        statusNote: st?.note,
      }
    })

    return { success: true, error: null, data: roster }
  } catch (err: any) {
    return { success: false, error: err.message, data: [] }
  }
}

export interface CreateDoctorInput {
  fullName: string
  specialization: string
  departmentId: string
  clinicRoom?: string
  qualification?: string
  experienceYears?: number
  consultationMinutes?: number
  isActive?: boolean
  email?: string
}

export async function createDoctorAction(input: CreateDoctorInput) {
  const { supabase, isAdmin, error } = await verifyAdminSession()
  if (!isAdmin) {
    return { success: false, error }
  }

  if (!input.fullName.trim()) {
    return { success: false, error: 'Doctor name is required.' }
  }
  if (!input.specialization.trim()) {
    return { success: false, error: 'Specialization is required.' }
  }
  if (!input.departmentId) {
    return { success: false, error: 'Department selection is required.' }
  }

  try {
    const profileId = crypto.randomUUID()

    // 1. Create Profile record (allowed by admin RLS policy)
    const { error: profileErr } = await supabase.from('profiles').insert({
      id: profileId,
      full_name: input.fullName.trim(),
      role: 'doctor',
    })

    if (profileErr) {
      console.warn('Profile creation returned notice:', profileErr.message)
    }

    // 2. Insert into public.doctors
    const { data: newDoc, error: docErr } = await supabase
      .from('doctors')
      .insert({
        profile_id: profileId,
        department_id: input.departmentId,
        full_name: input.fullName.trim(),
        specialization: input.specialization.trim(),
        qualification: input.qualification?.trim() || 'MBBS, MD',
        experience_years: Number(input.experienceYears) || 5,
        consultation_minutes: Number(input.consultationMinutes) || 15,
        clinic_room: input.clinicRoom?.trim() || 'Room 101',
        is_active: input.isActive ?? true,
      })
      .select()
      .single()

    if (docErr || !newDoc) {
      return { success: false, error: docErr?.message || 'Failed to insert doctor record.' }
    }

    // 3. Populate default weekday recurring schedule (Mon-Fri 09:00 - 17:00)
    const scheduleRows = [1, 2, 3, 4, 5].map((weekday) => ({
      doctor_id: newDoc.id,
      weekday,
      start_time: '09:00:00',
      end_time: '17:00:00',
    }))

    await supabase.from('doctor_schedules').insert(scheduleRows)

    // 4. Initialize today's status
    const todayStr = new Date().toISOString().split('T')[0]
    await supabase.from('doctor_daily_status').insert({
      doctor_id: newDoc.id,
      date: todayStr,
      status: 'available',
      delay_minutes: 0,
      note: 'OPD Active',
    })

    revalidatePath('/admin')
    revalidatePath('/admin/doctors')
    revalidatePath('/doctors')
    return { success: true, error: null, doctorId: newDoc.id }
  } catch (err: any) {
    console.error('Error creating doctor:', err)
    return { success: false, error: err.message || 'Failed to create doctor.' }
  }
}

export interface UpdateDoctorInput {
  doctorId: string
  fullName: string
  specialization: string
  departmentId: string
  clinicRoom?: string
  qualification?: string
  experienceYears?: number
  consultationMinutes?: number
  isActive?: boolean
}

export async function updateDoctorAction(input: UpdateDoctorInput) {
  const { supabase, isAdmin, error } = await verifyAdminSession()
  if (!isAdmin) {
    return { success: false, error }
  }

  if (!input.doctorId) {
    return { success: false, error: 'Doctor ID is required.' }
  }

  try {
    const { data: updatedDoc, error: updateErr } = await supabase
      .from('doctors')
      .update({
        full_name: input.fullName.trim(),
        specialization: input.specialization.trim(),
        department_id: input.departmentId,
        clinic_room: input.clinicRoom?.trim() || null,
        qualification: input.qualification?.trim() || 'MBBS, MD',
        experience_years: Number(input.experienceYears) || 0,
        consultation_minutes: Number(input.consultationMinutes) || 15,
        is_active: input.isActive ?? true,
      })
      .eq('id', input.doctorId)
      .select('profile_id')
      .single()

    if (updateErr) {
      return { success: false, error: updateErr.message }
    }

    // Also update associated profile full_name if available
    if (updatedDoc?.profile_id) {
      await supabase
        .from('profiles')
        .update({ full_name: input.fullName.trim() })
        .eq('id', updatedDoc.profile_id)
    }

    revalidatePath('/admin')
    revalidatePath('/admin/doctors')
    revalidatePath('/doctors')
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update doctor.' }
  }
}

export async function toggleDoctorActiveAction(doctorId: string, isActive: boolean) {
  const { supabase, isAdmin, error } = await verifyAdminSession()
  if (!isAdmin) {
    return { success: false, error }
  }

  if (!doctorId) {
    return { success: false, error: 'Doctor ID is required.' }
  }

  try {
    const { error: updateErr } = await supabase
      .from('doctors')
      .update({ is_active: isActive })
      .eq('id', doctorId)

    if (updateErr) {
      return { success: false, error: updateErr.message }
    }

    revalidatePath('/admin')
    revalidatePath('/admin/doctors')
    revalidatePath('/doctors')
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to toggle status.' }
  }
}

// ----------------------------------------------------------------------------
// 3. DEPARTMENT ACTIONS
// ----------------------------------------------------------------------------

export interface AdminDepartmentItem {
  id: string
  name: string
  description: string | null
  doctorsCount: number
  createdAt: string
}

export async function getAdminDepartmentsAction() {
  const { supabase, isAdmin, error } = await verifyAdminSession()
  if (!isAdmin) {
    return { success: false, error, data: [] }
  }

  try {
    const [deptsRes, docsRes] = await Promise.all([
      supabase.from('departments').select('*').order('name', { ascending: true }),
      supabase.from('doctors').select('department_id'),
    ])

    const depts = deptsRes.data || []
    const docs = docsRes.data || []

    const countMap: Record<string, number> = {}
    docs.forEach((d: any) => {
      countMap[d.department_id] = (countMap[d.department_id] || 0) + 1
    })

    const data: AdminDepartmentItem[] = depts.map((dept: any) => ({
      id: dept.id,
      name: dept.name,
      description: dept.description,
      doctorsCount: countMap[dept.id] || 0,
      createdAt: dept.created_at,
    }))

    return { success: true, error: null, data }
  } catch (err: any) {
    return { success: false, error: err.message, data: [] }
  }
}

export async function createDepartmentAction(name: string, description?: string) {
  const { supabase, isAdmin, error } = await verifyAdminSession()
  if (!isAdmin) {
    return { success: false, error }
  }

  const cleanName = name.trim()
  if (!cleanName) {
    return { success: false, error: 'Department name is required.' }
  }

  try {
    // Check if name already exists (case-insensitive)
    const { data: existing } = await supabase
      .from('departments')
      .select('id, name')
      .ilike('name', cleanName)
      .maybeSingle()

    if (existing) {
      return { success: false, error: `A department named "${cleanName}" already exists.` }
    }

    const { data, error: insertErr } = await supabase
      .from('departments')
      .insert({
        name: cleanName,
        description: description?.trim() || null,
      })
      .select()
      .single()

    if (insertErr) {
      return { success: false, error: insertErr.message }
    }

    revalidatePath('/admin')
    revalidatePath('/admin/departments')
    revalidatePath('/doctors')
    return { success: true, error: null, department: data }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create department.' }
  }
}

export async function updateDepartmentAction(id: string, name: string, description?: string) {
  const { supabase, isAdmin, error } = await verifyAdminSession()
  if (!isAdmin) {
    return { success: false, error }
  }

  const cleanName = name.trim()
  if (!cleanName) {
    return { success: false, error: 'Department name is required.' }
  }

  try {
    // Check if name collides with another department
    const { data: existing } = await supabase
      .from('departments')
      .select('id, name')
      .ilike('name', cleanName)
      .neq('id', id)
      .maybeSingle()

    if (existing) {
      return { success: false, error: `Another department named "${cleanName}" already exists.` }
    }

    const { error: updateErr } = await supabase
      .from('departments')
      .update({
        name: cleanName,
        description: description?.trim() || null,
      })
      .eq('id', id)

    if (updateErr) {
      return { success: false, error: updateErr.message }
    }

    revalidatePath('/admin')
    revalidatePath('/admin/departments')
    revalidatePath('/doctors')
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update department.' }
  }
}

// ----------------------------------------------------------------------------
// 4. APPOINTMENT ACTIONS
// ----------------------------------------------------------------------------

export interface AdminAppointmentFilters {
  doctorId?: string
  status?: string
  date?: string
  search?: string
}

export async function getAdminAppointmentsAction(filters?: AdminAppointmentFilters) {
  const { supabase, isAdmin, error } = await verifyAdminSession()
  if (!isAdmin) {
    return { success: false, error, data: [] }
  }

  try {
    let query = supabase
      .from('appointments')
      .select('id, patient_id, doctor_id, appointment_date, start_time, end_time, status, reason')
      .order('appointment_date', { ascending: false })
      .order('start_time', { ascending: true })

    if (filters?.doctorId) {
      query = query.eq('doctor_id', filters.doctorId)
    }
    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status as 'booked' | 'cancelled' | 'completed' | 'no_show')
    }
    if (filters?.date && filters.date !== 'all') {
      query = query.eq('appointment_date', filters.date)
    }

    const [apptsRes, docsRes, deptsRes, profilesRes] = await Promise.all([
      query,
      supabase.from('doctors').select('id, full_name, profile_id, department_id'),
      supabase.from('departments').select('id, name'),
      supabase.from('profiles').select('id, full_name'),
    ])

    const appts = apptsRes.data || []
    const doctors = docsRes.data || []
    const depts = deptsRes.data || []
    const profiles = profilesRes.data || []

    const deptMap = new Map(depts.map((d: any) => [d.id, d.name]))
    const profileMap = new Map(profiles.map((p: any) => [p.id, p.full_name]))
    const docMap = new Map(
      doctors.map((d: any) => [
        d.id,
        {
          name: d.full_name || profileMap.get(d.profile_id) || 'Doctor',
          deptName: deptMap.get(d.department_id) || 'General',
        },
      ])
    )

    let results: AdminAppointmentSummary[] = appts.map((a: any) => {
      const doc = docMap.get(a.doctor_id)
      const patientName = profileMap.get(a.patient_id) || 'Patient'
      return {
        id: a.id,
        patientId: a.patient_id,
        patientName,
        doctorId: a.doctor_id,
        doctorName: doc?.name || 'Dr. Physician',
        departmentName: doc?.deptName || 'OPD',
        appointmentDate: a.appointment_date,
        startTime: a.start_time,
        endTime: a.end_time,
        status: a.status,
        reason: a.reason,
      }
    })

    if (filters?.search && filters.search.trim()) {
      const term = filters.search.toLowerCase()
      results = results.filter(
        (r) =>
          r.patientName.toLowerCase().includes(term) ||
          r.doctorName.toLowerCase().includes(term) ||
          (r.reason && r.reason.toLowerCase().includes(term))
      )
    }

    return { success: true, error: null, data: results }
  } catch (err: any) {
    return { success: false, error: err.message, data: [] }
  }
}

export async function cancelAdminAppointmentAction(appointmentId: string, reason?: string) {
  const { supabase, isAdmin, error } = await verifyAdminSession()
  if (!isAdmin) {
    return { success: false, error }
  }

  if (!appointmentId) {
    return { success: false, error: 'Appointment ID is required.' }
  }

  try {
    const cancelReason = reason?.trim() || 'Cancelled by Hospital Administration'

    const { data: appt, error: updateErr } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        reason: cancelReason,
      })
      .eq('id', appointmentId)
      .select('id, patient_id, doctor_id, appointment_date, start_time')
      .single()

    if (updateErr || !appt) {
      return { success: false, error: updateErr?.message || 'Failed to cancel appointment.' }
    }

    // Dispatch notification to the affected patient
    if (appt.patient_id) {
      await dispatchNotification(supabase, {
        userId: appt.patient_id,
        title: 'Appointment Notice: Cancelled by Administration',
        body: `Your appointment scheduled on ${appt.appointment_date} at ${appt.start_time} was cancelled by hospital administration (${cancelReason}). Please visit the portal to reschedule.`,
        type: 'cancelled',
        appointmentId: appt.id,
        doctorId: appt.doctor_id,
      })
    }

    revalidatePath('/admin')
    revalidatePath('/admin/appointments')
    revalidatePath('/appointments')
    revalidatePath('/doctor/dashboard')
    return { success: true, error: null }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to cancel appointment.' }
  }
}
