import React, { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveUserAuthorization } from '@/lib/role-utils'
import { StitchLandingPageContent } from '@/components/portal/StitchLandingPage'
import {
  PatientHomePage,
  type PatientHomeAppointment,
  type PatientHomeNotification,
  type PatientHomeDoctor,
} from '@/components/portal/PatientHomePage'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createClient()

  // 1. Authenticate user from Supabase session token
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If visitor is unauthenticated, render public Hospital Access Hub landing page
  if (!user) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-surface flex items-center justify-center text-secondary">
            Loading CareSlot...
          </div>
        }
      >
        <StitchLandingPageContent />
      </Suspense>
    )
  }

  // 2. Fetch authenticated user profile & resolve database authorization
  const authResult = await resolveUserAuthorization(supabase, user.id)
  const profile = authResult.profile

  // Role redirection guards
  if (authResult.isAdmin) {
    redirect('/admin')
  }
  if (authResult.isAuthorizedDoctor) {
    redirect('/doctor/dashboard')
  }

  // 3. Authenticated Patient: Fetch real Supabase data
  const todayStr = new Date().toISOString().split('T')[0]

  // A. Upcoming booked appointments
  let upcomingAppointments: PatientHomeAppointment[] = []
  try {
    const { data: appts, error: apptsError } = await supabase
      .from('appointments')
      .select(`
        id,
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
          departments (
            id,
            name
          ),
          profiles (
            id,
            full_name
          )
        )
      `)
      .eq('patient_id', user.id)
      .eq('status', 'booked')
      .gte('appointment_date', todayStr)
      .order('appointment_date', { ascending: true })
      .order('start_time', { ascending: true })

    if (apptsError) {
      console.error('Error querying upcoming appointments:', apptsError.message)
    } else if (appts) {
      upcomingAppointments = appts as unknown as PatientHomeAppointment[]
    }
  } catch (err) {
    console.error('Failed to load appointments:', err)
  }

  // B. Notifications and unread count
  let unreadNotificationsCount = 0
  let notifications: PatientHomeNotification[] = []
  try {
    const { count, error: countError } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null)

    if (!countError && typeof count === 'number') {
      unreadNotificationsCount = count
    }

    const { data: notifData, error: notifError } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    if (notifError) {
      console.error('Error querying notifications:', notifError.message)
    } else if (notifData) {
      notifications = notifData as PatientHomeNotification[]
    }
  } catch (err) {
    console.error('Failed to load notifications:', err)
  }

  // C. Doctors with live daily status
  let doctors: PatientHomeDoctor[] = []
  try {
    const { data: docsData, error: docsError } = await supabase
      .from('doctors')
      .select(`
        id,
        profile_id,
        department_id,
        full_name,
        photo_url,
        specialization,
        qualification,
        experience_years,
        consultation_minutes,
        clinic_room,
        is_active,
        departments (
          id,
          name
        ),
        profiles (
          id,
          full_name
        ),
        doctor_daily_status (
          id,
          date,
          status,
          delay_minutes,
          note
        )
      `)
      .eq('is_active', true)
      .limit(6)

    if (docsError) {
      console.error('Error querying doctors:', docsError.message)
    } else if (docsData && docsData.length > 0) {
      doctors = docsData.map((d: any) => ({
        ...d,
        profiles: {
          id: d.profile_id || d.profiles?.id || d.id,
          full_name: (d.full_name || d.profiles?.full_name || 'Specialist').trim(),
        },
      })) as unknown as PatientHomeDoctor[]
    }
  } catch (err) {
    console.error('Failed to load doctors:', err)
  }

  // 4. Render Patient Home Page with real Supabase data
  const patientProfile = profile || {
    id: user.id,
    full_name: user.user_metadata?.full_name || 'Patient',
    phone: user.user_metadata?.phone || null,
    role: 'patient' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface flex items-center justify-center text-secondary">
          Loading Patient Portal...
        </div>
      }
    >
      <PatientHomePage
        user={{
          id: user.id,
          email: user.email || '',
        }}
        profile={patientProfile}
        upcomingAppointments={upcomingAppointments}
        unreadNotificationsCount={unreadNotificationsCount}
        notifications={notifications}
        doctors={doctors}
      />
    </Suspense>
  )
}
