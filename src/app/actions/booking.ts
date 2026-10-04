'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDate, formatTime } from '@/lib/utils'
import { calculateEndTime } from '@/lib/slot-utils'
import { SEED_DOCTORS } from '@/lib/seed-data'

export interface BookAppointmentInput {
  doctorId: string
  date: string
  startTime: string
  endTime?: string
  reason?: string
}

export interface BookAppointmentResult {
  success: boolean
  error?: string
  unauthenticated?: boolean
  appointment?: {
    id: string
    doctorId: string
    doctorName: string
    departmentName: string
    date: string
    formattedDate: string
    startTime: string
    formattedTime: string
    location: string
    avatarUrl?: string
  }
}

/**
 * Server action to securely book an appointment for the authenticated patient.
 * Derives patient_id strictly from the session token and handles double-booking gracefully.
 */
export async function bookAppointmentAction(
  input: BookAppointmentInput
): Promise<BookAppointmentResult> {
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
        unauthenticated: true,
        error: 'Please sign in to your patient account to book an appointment.',
      }
    }

    // 2. Authorize role: only 'patient' role is allowed
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', user.id)
      .maybeSingle()

    const role = profile?.role || user.user_metadata?.role || 'patient'
    if (role !== 'patient') {
      return {
        success: false,
        error: 'Only patient accounts are authorized to book appointments.',
      }
    }

    const { doctorId, date, startTime, reason } = input

    if (!doctorId || !date || !startTime) {
      return {
        success: false,
        error: 'Doctor, appointment date, and time slot are required.',
      }
    }

    // 3. Prevent past dates
    const todayStr = new Date().toISOString().split('T')[0]
    if (date < todayStr) {
      return {
        success: false,
        error: 'Cannot schedule appointments for past dates.',
      }
    }

    // 4. Fetch Doctor information for duration, verification and confirmation display
    let doctorName = 'Specialist'
    let departmentName = 'General OPD'
    let location = 'Consultation Desk'
    let avatarUrl: string | undefined
    let consultationMins = 20

    // Try fetching from database first
    const { data: dbDoctor } = await supabase
      .from('doctors')
      .select(`
        id,
        consultation_minutes,
        departments (
          name
        ),
        profiles (
          full_name
        )
      `)
      .eq('id', doctorId)
      .maybeSingle()

    if (dbDoctor) {
      doctorName = (dbDoctor.profiles as any)?.full_name || 'Specialist'
      departmentName = (dbDoctor.departments as any)?.name || 'General OPD'
      consultationMins = dbDoctor.consultation_minutes || 20
    }

    // Check seed fallback for room and photo
    const seedDoc = SEED_DOCTORS.find((s) => s.id === doctorId)
    if (seedDoc) {
      if (doctorName === 'Specialist') {
        doctorName = seedDoc.profiles?.full_name || 'Specialist'
      }
      if (departmentName === 'General OPD') {
        departmentName = seedDoc.departments?.name || 'General OPD'
      }
      location = seedDoc.desk_location || 'Room 402, 4th Floor'
      avatarUrl = seedDoc.avatar_url
    }

    // Calculate end time if not provided
    const endTime = input.endTime || calculateEndTime(startTime, consultationMins)

    // 5. Check if doctor is on leave on selected date
    const { data: leaveStatus } = await supabase
      .from('doctor_daily_status')
      .select('status, note')
      .eq('doctor_id', doctorId)
      .eq('date', date)
      .maybeSingle()

    if (leaveStatus?.status === 'on_leave') {
      return {
        success: false,
        error: 'The doctor is on leave on this date. Please select another available date.',
      }
    }

    // 6. Insert appointment into public.appointments
    // The verified column in public.appointments is appointment_date
    let appointmentId: string = ''

    const payloadApptDate: any = {
      patient_id: user.id,
      doctor_id: doctorId,
      appointment_date: date,
      start_time: startTime,
      end_time: endTime,
      status: 'booked',
      reason: reason?.trim() || null,
    }

    const { data: apptData, error: insertError } = await supabase
      .from('appointments')
      .insert(payloadApptDate)
      .select('id')
      .maybeSingle()

    if (insertError) {
      // Check for double-booking unique constraint violation
      if (
        insertError.code === '23505' ||
        insertError.message?.toLowerCase().includes('unique') ||
        insertError.message?.toLowerCase().includes('duplicate') ||
        insertError.message?.toLowerCase().includes('idx_appointments_double_booking') ||
        insertError.message?.toLowerCase().includes('appointments_one_booked_per_slot')
      ) {
        return {
          success: false,
          error: 'This slot was just booked. Please choose another time.',
        }
      }

      // Resilient fallback: In case appointment_date is missing and database uses date
      if (
        insertError.message?.includes('appointment_date') ||
        insertError.message?.includes('schema cache')
      ) {
        const payloadDate: any = {
          patient_id: user.id,
          doctor_id: doctorId,
          date: date,
          start_time: startTime,
          end_time: endTime,
          status: 'booked',
          reason: reason?.trim() || null,
        }

        const { data: retryAppt, error: retryError } = await supabase
          .from('appointments')
          .insert(payloadDate)
          .select('id')
          .maybeSingle()

        if (!retryError && retryAppt) {
          appointmentId = retryAppt.id
        } else if (retryError) {
          if (
            retryError.code === '23505' ||
            retryError.message?.toLowerCase().includes('unique') ||
            retryError.message?.toLowerCase().includes('duplicate')
          ) {
            return {
              success: false,
              error: 'This slot was just booked. Please choose another time.',
            }
          }
          return {
            success: false,
            error: retryError.message || 'Unable to confirm appointment booking. Please try again.',
          }
        }
      } else {
        return {
          success: false,
          error: insertError.message || 'Unable to confirm appointment booking. Please try again.',
        }
      }
    } else if (apptData) {
      appointmentId = apptData.id
    }

    if (!appointmentId) {
      return {
        success: false,
        error: 'Failed to record appointment booking.',
      }
    }

    // 7. Dispatch in-app notification for patient
    try {
      const formattedDate = formatDate(date)
      const formattedTime = formatTime(startTime)
      const notifPayload = {
        user_id: user.id,
        title: 'Appointment Confirmed',
        body: `Your appointment with Dr. ${doctorName} on ${formattedDate} at ${formattedTime} has been confirmed.`,
        type: 'confirmed',
        appointment_id: appointmentId,
        doctor_id: doctorId,
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

    const formattedDate = formatDate(date)
    const formattedTime = formatTime(startTime)

    return {
      success: true,
      appointment: {
        id: appointmentId,
        doctorId,
        doctorName,
        departmentName,
        date,
        formattedDate,
        startTime,
        formattedTime,
        location,
        avatarUrl,
      },
    }
  } catch (err: any) {
    console.error('Booking server action error:', err)
    return {
      success: false,
      error: err?.message || 'A server error occurred during booking. Please try again.',
    }
  }
}
