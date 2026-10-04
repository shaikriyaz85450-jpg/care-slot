import assert from 'assert'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

console.log('=== End-to-End Notification Flow Test ===')

// Read environment
const env = fs.readFileSync('.env.local', 'utf-8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim()
const anonKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim()

const doctorClient = createClient(url, anonKey)
const patientClient = createClient(url, anonKey)

async function testNotificationFlow() {
  // 1. Authenticate Doctor (doctor@gmail.com)
  console.log('\n[Step 1] Authenticating doctor doctor@gmail.com...')
  const { data: docAuth, error: docAuthErr } = await doctorClient.auth.signInWithPassword({
    email: 'doctor@gmail.com',
    password: '123456',
  })
  assert(!docAuthErr, `Doctor auth failed: ${docAuthErr?.message}`)
  const doctorUserId = docAuth.user.id
  console.log('Doctor Auth User ID:', doctorUserId)

  const { data: docRecord } = await doctorClient
    .from('doctors')
    .select('id, full_name, profile_id')
    .eq('profile_id', doctorUserId)
    .single()
  assert(docRecord, 'Doctor record must exist')
  const doctorId = docRecord.id
  console.log(`Doctor ID: ${doctorId} (${docRecord.full_name})`)

  // 2. Authenticate Patient (riyaz@gmail.com)
  console.log('\n[Step 2] Authenticating patient riyaz@gmail.com...')
  const { data: patAuth, error: patAuthErr } = await patientClient.auth.signInWithPassword({
    email: 'riyaz@gmail.com',
    password: '123456',
  })
  assert(!patAuthErr, `Patient auth failed: ${patAuthErr?.message}`)
  const patientUserId = patAuth.user.id
  console.log('Patient Auth User ID:', patientUserId)

  // 3. Flow Step A: Patient books an appointment with Dr. Test Doctor for today
  console.log('\n[Flow A] Patient books an appointment for today...')
  const todayStr = new Date().toISOString().split('T')[0]
  
  // First clean up any existing booked appointment for today to avoid double-booking conflict
  await patientClient
    .from('appointments')
    .update({ status: 'cancelled', reason: 'Reset for test' })
    .eq('patient_id', patientUserId)
    .eq('doctor_id', doctorId)
    .eq('appointment_date', todayStr)
    .eq('status', 'booked')

  const { data: bookedAppt, error: bookErr } = await patientClient
    .from('appointments')
    .insert({
      patient_id: patientUserId,
      doctor_id: doctorId,
      appointment_date: todayStr,
      start_time: '11:00:00',
      end_time: '11:20:00',
      status: 'booked',
      reason: 'Routine consultation checkup',
    })
    .select()
    .single()

  assert(!bookErr, `Booking failed: ${bookErr?.message}`)
  console.log(`Appointment booked successfully: ID = ${bookedAppt.id} on ${todayStr} at 11:00 AM`)

  // 4. Flow Step E: Patient establishes Realtime subscription on public.notifications
  console.log('\n[Flow E] Patient establishes Realtime subscription on public.notifications...')
  let realtimeNotificationReceived = false
  let receivedNotification = null

  const notifChannel = patientClient
    .channel(`flow-notif-channel-${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${patientUserId}`,
      },
      (payload) => {
        console.log('REALTIME EVENT ARRIVED on public.notifications:', payload.new)
        realtimeNotificationReceived = true
        receivedNotification = payload.new
      }
    )

  await new Promise((resolve) => {
    notifChannel.subscribe((status) => {
      console.log('Realtime notification channel state:', status)
      if (status === 'SUBSCRIBED') {
        resolve(true)
      }
    })
  })

  // 5. Flow Step B & C: Doctor updates status to ON_LEAVE
  console.log('\n[Flow B & C] Doctor changes status to ON_LEAVE...')
  // Update doctor daily status in database
  const { error: leaveStatusErr } = await doctorClient
    .from('doctor_daily_status')
    .upsert({
      doctor_id: doctorId,
      date: todayStr,
      status: 'on_leave',
      delay_minutes: 0,
      note: 'On emergency clinical leave today',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'doctor_id,date' })
  assert(!leaveStatusErr, `Status update failed: ${leaveStatusErr?.message}`)
  console.log('Doctor daily status updated to on_leave in public.doctor_daily_status.')

  // Cancel the affected booked appointments
  const { error: cancelApptErr } = await doctorClient
    .from('appointments')
    .update({
      status: 'cancelled',
      reason: 'Doctor on emergency leave',
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookedAppt.id)
  assert(!cancelApptErr, `Appointment cancellation failed: ${cancelApptErr?.message}`)
  console.log(`Affected appointment ${bookedAppt.id} cancelled.`)

  // 6. Test direct notification insertion via doctorClient to inspect RLS policy
  console.log('\n[Flow D] Testing notification insertion into public.notifications...')
  const notifPayload = {
    user_id: patientUserId,
    doctor_id: doctorId,
    appointment_id: bookedAppt.id,
    title: 'Doctor Unavailable — Reschedule Required',
    body: `Dr. ${docRecord.full_name} is unavailable today. Your appointment needs to be rescheduled at your earliest convenience.`,
    type: 'doctor_on_leave',
    created_at: new Date().toISOString(),
  }

  const { data: insertedNotif, error: notifInsertErr } = await doctorClient
    .from('notifications')
    .insert(notifPayload)
    .select()

  console.log('Notification insertion result:', {
    inserted: Boolean(insertedNotif && insertedNotif.length > 0),
    error: notifInsertErr ? { code: notifInsertErr.code, message: notifInsertErr.message } : null,
  })

  // 7. Verify RLS SELECT isolation (Flow H: Patient cannot see another patient's notification)
  console.log('\n[Flow H] Verifying patient RLS isolation...')
  const { data: patientVisibleNotifs, error: pSelectErr } = await patientClient
    .from('notifications')
    .select('*')
  assert(!pSelectErr, `Patient select failed: ${pSelectErr?.message}`)
  console.log(`Patient sees ${patientVisibleNotifs.length} notifications in public.notifications.`)

  // Verify none of the visible notifications belong to another user
  const foreignNotifs = patientVisibleNotifs.filter((n) => n.user_id !== patientUserId)
  assert.strictEqual(foreignNotifs.length, 0, 'RLS VIOLATION: Patient saw notification belonging to another user!')
  console.log('PASSED: Patient cannot see any notification belonging to other patients.')

  // 8. Test Delay calculation and status handling
  console.log('\n[Flow DELAYED] Testing DELAYED doctor notification behavior...')
  const { error: delayStatusErr } = await doctorClient
    .from('doctor_daily_status')
    .upsert({
      doctor_id: doctorId,
      date: todayStr,
      status: 'delayed',
      delay_minutes: 30,
      note: 'Delayed by 30 min due to complex cardiac case',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'doctor_id,date' })
  assert(!delayStatusErr, `Delay status update failed: ${delayStatusErr?.message}`)
  console.log('Doctor daily status updated to delayed (+30m).')

  // Reset status back to available
  await doctorClient
    .from('doctor_daily_status')
    .upsert({
      doctor_id: doctorId,
      date: todayStr,
      status: 'available',
      delay_minutes: 0,
      note: 'Seeing Patients — On Time. Instant scheduling enabled.',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'doctor_id,date' })
  console.log('Doctor status reset back to available.')

  patientClient.removeChannel(notifChannel)
  console.log('\n=== Notification Flow Test Completed ===')
}

testNotificationFlow().catch((err) => {
  console.error('\nTest failed:', err)
  process.exit(1)
})
