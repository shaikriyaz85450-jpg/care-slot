import React, { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveUserAuthorization } from '@/lib/role-utils'
import { PatientAppointmentsView, type PatientAppointment } from '@/components/portal/PatientAppointmentsView'
import { SEED_DOCTORS } from '@/lib/seed-data'

export const dynamic = 'force-dynamic'

export default async function AppointmentsPage() {
  const supabase = await createClient()

  // 1. Authenticate user from session
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login?redirectTo=/appointments')
  }

  // 2. Fetch user profile & enforce role
  const authResult = await resolveUserAuthorization(supabase, user.id)
  const profile = authResult.profile

  if (authResult.isAuthorizedDoctor) {
    redirect('/doctor/dashboard')
  }
  if (authResult.isAdmin) {
    redirect('/admin')
  }

  // 3. Fetch patient's appointments from Supabase
  let appointments: PatientAppointment[] = []

  try {
    const { data: dbAppts, error: apptError } = await supabase
      .from('appointments')
      .select(`
        id,
        patient_id,
        doctor_id,
        appointment_date,
        start_time,
        end_time,
        status,
        reason,
        doctors (
          id,
          specialization,
          qualification,
          experience_years,
          consultation_minutes,
          profiles (
            id,
            full_name
          ),
          departments (
            id,
            name
          ),
          doctor_daily_status (
            status,
            delay_minutes,
            note
          ),
          doctor_schedules (
            weekday,
            start_time,
            end_time
          )
        )
      `)
      .eq('patient_id', user.id)
      .order('appointment_date', { ascending: false })

    if (!apptError && dbAppts && dbAppts.length > 0) {
      appointments = dbAppts.map((item: any) => {
        const doc = item.doctors
        const doctorName = doc?.profiles?.full_name || 'Specialist'
        const seedMatch = SEED_DOCTORS.find((s) => s.id === item.doctor_id)

        return {
          id: item.id,
          patient_id: item.patient_id,
          doctor_id: item.doctor_id,
          appointment_date: item.appointment_date,
          start_time: item.start_time,
          end_time: item.end_time,
          status: item.status,
          reason: item.reason,
          doctor: {
            id: doc?.id || item.doctor_id,
            specialization: doc?.specialization || seedMatch?.specialization || 'General Medicine',
            qualification: doc?.qualification || seedMatch?.qualification || 'MBBS, MD',
            experience_years: doc?.experience_years ?? seedMatch?.experience_years ?? 10,
            consultation_minutes: doc?.consultation_minutes ?? seedMatch?.consultation_minutes ?? 20,
            clinic_name: seedMatch?.clinic_name || 'Central Hospital Clinic',
            desk_location: seedMatch?.desk_location || 'Room 402, 4th Floor',
            avatar_url: seedMatch?.avatar_url,
            initials:
              seedMatch?.initials ||
              doctorName
                .split(' ')
                .map((n: string) => n[0])
                .join('')
                .toUpperCase() ||
              'MD',
            profiles: {
              id: doc?.profiles?.id || '',
              full_name: doctorName,
            },
            departments: {
              id: doc?.departments?.id || '',
              name: doc?.departments?.name || seedMatch?.departments?.name || 'General Medicine',
            },
            doctor_daily_status: doc?.doctor_daily_status || seedMatch?.doctor_daily_status || [
              {
                status: 'available',
                delay_minutes: 0,
                note: 'On Schedule',
              },
            ],
            doctor_schedules: doc?.doctor_schedules || [
              { weekday: 1, start_time: '09:00:00', end_time: '17:00:00' },
              { weekday: 2, start_time: '09:00:00', end_time: '17:00:00' },
              { weekday: 3, start_time: '09:00:00', end_time: '17:00:00' },
              { weekday: 4, start_time: '09:00:00', end_time: '17:00:00' },
              { weekday: 5, start_time: '09:00:00', end_time: '17:00:00' },
            ],
          },
        }
      })
    }
  } catch (err) {
    console.error('Error querying patient appointments:', err)
  }

  // 4. Fetch unread notifications count
  let unreadCount = 0
  try {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null)

    unreadCount = count || 0
  } catch {
    unreadCount = 0
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface flex items-center justify-center text-secondary font-medium">
          Loading Appointments...
        </div>
      }
    >
      <PatientAppointmentsView
        initialAppointments={appointments}
        profile={profile}
        unreadCount={unreadCount}
        user={{
          id: user.id,
          email: user.email || '',
        }}
      />
    </Suspense>
  )
}
