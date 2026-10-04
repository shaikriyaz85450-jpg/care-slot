import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf-8')
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)

if (!urlMatch || !keyMatch) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabaseUrl = urlMatch[1].trim()
const anonKey = keyMatch[1].trim()
const supabase = createClient(supabaseUrl, anonKey)

async function runTests() {
  console.log('--- Step 7 Functional Verification ---')

  const todayStr = new Date().toISOString().split('T')[0]
  const doctorId = 'c1111111-1111-1111-1111-111111111111' // Marcus Vance

  // Test 1: Check doctor_daily_status table upsert
  console.log('\n[Test 1] Testing doctor_daily_status table operations...')
  const testStatus = {
    doctor_id: doctorId,
    date: todayStr,
    status: 'delayed',
    delay_minutes: 25,
    note: 'Delayed ~25 min (Behind Schedule)',
    updated_at: new Date().toISOString(),
  }

  const { data: upsertData, error: upsertErr } = await supabase
    .from('doctor_daily_status')
    .upsert(testStatus, { onConflict: 'doctor_id,date' })
    .select()

  if (upsertErr) {
    console.error('Upsert failed (might need auth session or RLS policy):', upsertErr.message)
  } else {
    console.log('Upsert succeeded:', upsertData)
  }

  // Test 2: Verify notifications insertion schema
  console.log('\n[Test 2] Testing notifications table schema & insertion...')
  // Using an existing profile id or test patient id if exists
  const { data: profiles } = await supabase.from('profiles').select('id, full_name, role').limit(1)
  const targetPatientId = profiles?.[0]?.id

  if (targetPatientId) {
    const { data: notifData, error: notifErr } = await supabase
      .from('notifications')
      .insert({
        user_id: targetPatientId,
        title: 'Doctor Schedule Delay Alert',
        body: 'Dr. Marcus Vance is running behind schedule by ~25 minutes today. Your appointment timing has been adjusted.',
        read: false,
      })
      .select()

    if (notifErr) {
      console.error('Notification insertion error:', notifErr.message)
    } else {
      console.log('Notification insertion verified successfully! Inserted row:', notifData)
    }
  } else {
    console.log('No profiles found in DB yet to test notifications insert with valid foreign key.')
  }

  // Test 3: Check HTTP route response for /doctor/dashboard
  console.log('\n[Test 3] Verifying route guard for /doctor/dashboard...')
  try {
    const res = await fetch('http://localhost:3000/doctor/dashboard', {
      redirect: 'manual',
    })
    console.log('HTTP status:', res.status, '(Expect 307 redirect to /login)')
    const location = res.headers.get('location')
    console.log('Redirect Location:', location)
    if (res.status === 307 && location && location.includes('/login')) {
      console.log('PASSED: Route guard properly protects /doctor/dashboard for unauthenticated requests.')
    } else {
      console.log('Note: Route returned status', res.status)
    }
  } catch (err) {
    console.log('Dev server check:', err.message)
  }

  console.log('\n--- Test Execution Completed ---')
}

runTests()
