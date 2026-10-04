import React, { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveUserAuthorization } from '@/lib/role-utils'
import {
  PatientNotificationsView,
  type NotificationItem,
} from '@/components/portal/PatientNotificationsView'

export const dynamic = 'force-dynamic'

export default async function NotificationsPage() {
  const supabase = await createClient()

  // 1. Authenticate user from session
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login?redirectTo=/notifications')
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

  // 3. Fetch notifications for authenticated patient
  let notifications: NotificationItem[] = []
  try {
    const { data: dbNotifs, error: notifError } = await supabase
      .from('notifications')
      .select('id, user_id, title, body, type, read_at, appointment_id, doctor_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!notifError && dbNotifs && dbNotifs.length > 0) {
      notifications = dbNotifs.map((n: any) => ({
        id: n.id,
        user_id: n.user_id,
        title: n.title,
        body: n.body,
        read: Boolean(n.read_at),
        created_at: n.created_at,
      }))
    }
  } catch (err) {
    console.error('Error querying notifications:', err)
  }

  // If no database notifications exist yet, synthesize alerts from patient's real appointments
  if (notifications.length === 0) {
    try {
      const todayStr = new Date().toISOString().split('T')[0]
      const { data: patientAppts } = await supabase
        .from('appointments')
        .select(`
          id,
          doctor_id,
          appointment_date,
          start_time,
          status,
          created_at,
          doctors (
            id,
            profiles (
              full_name
            ),
            departments (
              name
            ),
            doctor_daily_status (
              status,
              delay_minutes,
              note
            )
          )
        `)
        .eq('patient_id', user.id)
        .order('appointment_date', { ascending: false })

      if (patientAppts && patientAppts.length > 0) {
        const synth: NotificationItem[] = []
        for (const appt of patientAppts) {
          const doc = appt.doctors as any
          const docName = doc?.profiles?.full_name || 'Specialist'
          const deptName = doc?.departments?.name || 'General OPD'
          const dailyStatus = doc?.doctor_daily_status?.[0]
          const isToday = appt.appointment_date === todayStr

          // 1. Doctor delayed alert
          if (isToday && dailyStatus?.status === 'delayed' && appt.status === 'booked') {
            synth.push({
              id: `delayed-${appt.id}`,
              user_id: user.id,
              title: 'Doctor Schedule Delayed',
              body: `Dr. ${docName} is delayed by ${dailyStatus.delay_minutes || 20} minutes due to an extended clinical consultation. Your appointment is now estimated for ${appt.start_time}.`,
              read: false,
              created_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
            })
          }

          // 2. Doctor on leave / Action Required
          if (isToday && (dailyStatus?.status === 'on_leave' || appt.status === 'cancelled')) {
            synth.push({
              id: `leave-${appt.id}`,
              user_id: user.id,
              title: 'Doctor Unavailable — Reschedule Required',
              body: `Dr. ${docName} is unavailable today. Your appointment needs to be rescheduled at your earliest convenience.`,
              read: false,
              created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
            })
          }

          // 3. Confirmed appointment
          if (appt.status === 'booked' && !synth.some((s) => s.id === `delayed-${appt.id}`)) {
            synth.push({
              id: `confirmed-${appt.id}`,
              user_id: user.id,
              title: 'Appointment Confirmed',
              body: `Your appointment with Dr. ${docName} is confirmed for ${deptName} consultation on ${appt.appointment_date} at ${appt.start_time}.`,
              read: false,
              created_at: appt.created_at || new Date().toISOString(),
            })
          }

          // 4. Cancelled appointment
          if (appt.status === 'cancelled' && !synth.some((s) => s.id === `leave-${appt.id}`)) {
            synth.push({
              id: `cancelled-${appt.id}`,
              user_id: user.id,
              title: 'Appointment Cancelled',
              body: `Your appointment for ${deptName} consultation with Dr. ${docName} on ${appt.appointment_date} has been cancelled.`,
              read: true,
              created_at: appt.created_at || new Date().toISOString(),
            })
          }
        }
        if (synth.length > 0) {
          notifications = synth
        }
      }
    } catch (err) {
      console.error('Error synthesizing alerts from appointments:', err)
    }
  }

  // 4. Fetch upcoming appointments count for sidebar badge
  let upcomingCount = 0
  try {
    const { count: apptCount } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('patient_id', user.id)
      .eq('status', 'booked')

    upcomingCount = apptCount || 0
  } catch {
    upcomingCount = 0
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface flex items-center justify-center text-secondary font-medium">
          Loading Notifications...
        </div>
      }
    >
      <PatientNotificationsView
        initialNotifications={notifications}
        profile={profile}
        upcomingCount={upcomingCount}
        user={{
          id: user.id,
          email: user.email || '',
        }}
      />
    </Suspense>
  )
}
