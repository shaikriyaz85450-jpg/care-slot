'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDate, formatTime } from '@/lib/utils'
import { calculateEndTime } from '@/lib/slot-utils'
import { SEED_DOCTORS } from '@/lib/seed-data'

export interface CancelAppointmentInput {
  appointmentId: string
  reason?: string
}

export interface CancelAppointmentResult {
  success: boolean
  error?: string
}

export interface RescheduleAppointmentInput {
  appointmentId: string
  newDate: string
  newStartTime: string
  newEndTime?: string
}

export interface RescheduleAppointmentResult {
  success: boolean
  error?: string
  appointment?: {
    id: string
    newDate: string
    formattedDate: string
    newStartTime: string
    formattedTime: string
  }
}

/**
 * Server action to securely cancel an existing booked appointment.
 * Verifies that the appointment belongs to the authenticated patient before updating.
 */
export async function cancelAppointmentAction(
  input: CancelAppointmentInput
): Promise<CancelAppointmentResult> {
  try {
    const supabase = await createClient()

    // 1. Authenticate user from session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        error: 'Please sign in to cancel your appointment.',
      }
    }

    const { appointmentId, reason } = input
    if (!appointmentId) {
      return {
        success: false,
        error: 'Appointment ID is required.',
      }
    }

    // 2. Fetch appointment to verify ownership and current status
    const { data: existingAppt, error: fetchError } = await supabase
      .from('appointments')
      .select(`
        id,
        patient_id,
        doctor_id,
        appointment_date,
        start_time,
        status,
        doctors (
          id,
          profiles (
            full_name
          )
        )
      `)
      .eq('id', appointmentId)
      .maybeSingle()

    if (fetchError || !existingAppt) {
      return {
        success: false,
        error: 'Appointment not found or you do not have permission to access it.',
      }
    }

    // Security check: Verify patient owns this appointment, or user is assigned doctor, or admin
    const isPatient = existingAppt.patient_id === user.id
    let isDoctor = false
    let isAdmin = false

    if (!isPatient) {
      const { data: docRecord } = await supabase
        .from('doctors')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle()

      if (docRecord && docRecord.id === existingAppt.doctor_id) {
        isDoctor = true
      } else {
        const { data: prof } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle()

        if (prof?.role === 'admin') {
          isAdmin = true
        }
      }
    }

    if (!isPatient && !isDoctor && !isAdmin) {
      return {
        success: false,
        error: 'Unauthorized: You do not have permission to cancel this appointment.',
      }
    }

    if (existingAppt.status !== 'booked') {
      return {
        success: false,
        error: `Cannot cancel an appointment that is already ${existingAppt.status}.`,
      }
    }

    // 3. Update appointment status to 'cancelled'
    const cancelReason =
      reason?.trim() ||
      (isPatient
        ? 'Cancelled by patient'
        : isDoctor
        ? 'Cancelled by attending physician'
        : 'Cancelled by clinic administration')

    const { error: updateError } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        reason: cancelReason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId)

    if (updateError) {
      return {
        success: false,
        error: updateError.message || 'Failed to cancel appointment. Please try again.',
      }
    }

    // 4. Dispatch notification to patient
    try {
      const doctorName =
        (existingAppt.doctors as any)?.profiles?.full_name ||
        SEED_DOCTORS.find((s) => s.id === existingAppt.doctor_id)?.profiles?.full_name ||
        'Specialist'

      const dateStr = (existingAppt as any).appointment_date || (existingAppt as any).date || ''
      const formattedDate = dateStr ? formatDate(dateStr) : 'scheduled date'
      const formattedTime = existingAppt.start_time ? formatTime(existingAppt.start_time) : ''

      const notifPayload = {
        user_id: existingAppt.patient_id,
        title: 'Appointment Cancelled',
        body: `Your appointment with Dr. ${doctorName} on ${formattedDate} at ${formattedTime} has been cancelled.${
          !isPatient ? ` Reason: ${cancelReason}` : ''
        }`,
        type: 'cancellation',
        appointment_id: existingAppt.id,
        doctor_id: existingAppt.doctor_id,
      }

      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (serviceRoleKey && !serviceRoleKey.includes('placeholder')) {
        try {
          const adminClient = createAdminClient()
          await adminClient.from('notifications').insert(notifPayload)
        } catch {}
      } else {
        await supabase.from('notifications').insert(notifPayload)
      }
    } catch {
      // Non-blocking notification dispatch
    }

    return { success: true }
  } catch (err: any) {
    console.error('Cancellation error:', err)
    return {
      success: false,
      error: err?.message || 'An error occurred while cancelling your appointment.',
    }
  }
}

/**
 * Server action to securely reschedule a booked appointment to a new date and time slot.
 * Ensures the new slot is not in the past, doctor is not on leave, and slot is not double-booked.
 */
export async function rescheduleAppointmentAction(
  input: RescheduleAppointmentInput
): Promise<RescheduleAppointmentResult> {
  try {
    const supabase = await createClient()

    // 1. Authenticate user from session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        error: 'Please sign in to reschedule your appointment.',
      }
    }

    const { appointmentId, newDate, newStartTime } = input
    if (!appointmentId || !newDate || !newStartTime) {
      return {
        success: false,
        error: 'Appointment ID, new date, and new start time are required.',
      }
    }

    // 2. Prevent past dates
    const todayStr = new Date().toISOString().split('T')[0]
    if (newDate < todayStr) {
      return {
        success: false,
        error: 'Cannot reschedule appointments to past dates.',
      }
    }

    // 3. Fetch appointment and verify ownership
    const { data: existingAppt, error: fetchError } = await supabase
      .from('appointments')
      .select(`
        id,
        patient_id,
        doctor_id,
        appointment_date,
        start_time,
        end_time,
        status,
        doctors (
          id,
          consultation_minutes,
          profiles (
            full_name
          )
        )
      `)
      .eq('id', appointmentId)
      .maybeSingle()

    if (fetchError || !existingAppt) {
      return {
        success: false,
        error: 'Appointment not found or you do not have permission to access it.',
      }
    }

    // Security check: Must belong to current patient
    if (existingAppt.patient_id !== user.id) {
      return {
        success: false,
        error: 'Unauthorized: You can only reschedule your own appointments.',
      }
    }

    if (existingAppt.status !== 'booked') {
      return {
        success: false,
        error: `Only booked appointments can be rescheduled. Current status: ${existingAppt.status}`,
      }
    }

    // 4. Verify doctor is not on leave on newDate
    const { data: leaveStatus } = await supabase
      .from('doctor_daily_status')
      .select('status, note')
      .eq('doctor_id', existingAppt.doctor_id)
      .eq('date', newDate)
      .maybeSingle()

    if (leaveStatus?.status === 'on_leave') {
      return {
        success: false,
        error: 'The doctor is on leave on the selected date. Please choose another date.',
      }
    }

    // Calculate new end time
    const consultMins = (existingAppt.doctors as any)?.consultation_minutes || 20
    const newEndTime = input.newEndTime || calculateEndTime(newStartTime, consultMins)

    // 5. Update appointment in public.appointments
    // Attempt with appointment_date first
    const updatePayload: any = {
      appointment_date: newDate,
      start_time: newStartTime,
      end_time: newEndTime,
      status: 'booked',
      updated_at: new Date().toISOString(),
    }

    const { error: updateError } = await supabase
      .from('appointments')
      .update(updatePayload)
      .eq('id', appointmentId)
      .eq('patient_id', user.id)

    if (updateError) {
      // Check for double-booking conflict
      if (
        updateError.code === '23505' ||
        updateError.message?.toLowerCase().includes('unique') ||
        updateError.message?.toLowerCase().includes('duplicate') ||
        updateError.message?.toLowerCase().includes('idx_appointments_double_booking')
      ) {
        return {
          success: false,
          error: 'This slot was just booked by another patient. Please choose another time.',
        }
      }

      // If appointment_date column fails, retry with date
      if (updateError.message?.includes('appointment_date') || updateError.message?.includes('schema cache')) {
        const fallbackPayload: any = {
          date: newDate,
          start_time: newStartTime,
          end_time: newEndTime,
          status: 'booked',
          updated_at: new Date().toISOString(),
        }

        const { error: fallbackError } = await supabase
          .from('appointments')
          .update(fallbackPayload)
          .eq('id', appointmentId)
          .eq('patient_id', user.id)

        if (fallbackError) {
          if (
            fallbackError.code === '23505' ||
            fallbackError.message?.toLowerCase().includes('unique') ||
            fallbackError.message?.toLowerCase().includes('duplicate')
          ) {
            return {
              success: false,
              error: 'This slot was just booked by another patient. Please choose another time.',
            }
          }
          return {
            success: false,
            error: fallbackError.message || 'Failed to reschedule appointment.',
          }
        }
      } else {
        return {
          success: false,
          error: updateError.message || 'Failed to reschedule appointment.',
        }
      }
    }

    const doctorName =
      (existingAppt.doctors as any)?.profiles?.full_name ||
      SEED_DOCTORS.find((s) => s.id === existingAppt.doctor_id)?.profiles?.full_name ||
      'Specialist'

    const formattedDate = formatDate(newDate)
    const formattedTime = formatTime(newStartTime)

    // 6. Dispatch notification
    try {
      const notifPayload = {
        user_id: user.id,
        title: 'Appointment Rescheduled',
        body: `Your appointment with Dr. ${doctorName} has been rescheduled to ${formattedDate} at ${formattedTime}.`,
        type: 'rescheduled',
        appointment_id: appointmentId,
        doctor_id: existingAppt.doctor_id,
      }

      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (serviceRoleKey && !serviceRoleKey.includes('placeholder')) {
        try {
          const adminClient = createAdminClient()
          await adminClient.from('notifications').insert(notifPayload)
        } catch {}
      } else {
        await supabase.from('notifications').insert(notifPayload)
      }
    } catch {
      // Non-blocking notification dispatch
    }

    return {
      success: true,
      appointment: {
        id: appointmentId,
        newDate,
        formattedDate,
        newStartTime,
        formattedTime,
      },
    }
  } catch (err: any) {
    console.error('Rescheduling error:', err)
    return {
      success: false,
      error: err?.message || 'An error occurred while rescheduling your appointment.',
    }
  }
}
