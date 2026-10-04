import assert from 'assert'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

console.log('=== Verifying Doctor Dashboard Appointments End-to-End ===')

// Read environment
const env = fs.readFileSync('.env.local', 'utf-8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim()
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim()
const supabase = createClient(url, key)

async function runVerification() {
  // 1. Doctor Authentication
  console.log('\n[Step 1] Authenticating as doctor@gmail.com...')
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'doctor@gmail.com',
    password: '123456',
  })

  assert(!authError, `Failed to sign in as doctor@gmail.com: ${authError?.message}`)
  const doctorUserId = authData.user.id
  console.log('Doctor Auth UID:', doctorUserId)

  // 2. Resolve Doctor Record
  console.log('\n[Step 2] Resolving doctor record from public.doctors...')
  const { data: doctorRecord, error: docError } = await supabase
    .from('doctors')
    .select('id, profile_id, full_name, is_active')
    .eq('profile_id', doctorUserId)
    .maybeSingle()

  assert(!docError, `Error fetching doctor record: ${docError?.message}`)
  assert(doctorRecord, 'Doctor record not found for doctorUserId')
  assert.strictEqual(doctorRecord.is_active, true, 'Doctor record must be active')
  const doctorId = doctorRecord.id
  console.log(`Doctor ID: ${doctorId} (${doctorRecord.full_name})`)

  // 3. Query Appointments for Doctor
  console.log('\n[Step 3] Querying appointments for doctor_id =', doctorId)
  const { data: appointments, error: apptError } = await supabase
    .from('appointments')
    .select('id, patient_id, doctor_id, appointment_date, start_time, end_time, status, reason, created_at')
    .eq('doctor_id', doctorId)
    .order('appointment_date', { ascending: true })
    .order('start_time', { ascending: true })

  assert(!apptError, `Failed to query appointments: ${apptError?.message}`)
  assert(appointments && appointments.length > 0, 'No appointments returned for doctor!')
  console.log(`Found ${appointments.length} appointments for this doctor in database.`)

  appointments.forEach((a, i) => {
    console.log(`  Appt #${i + 1}: ID=${a.id.slice(0, 8)} | Date=${a.appointment_date} | Time=${a.start_time} | Status=${a.status} | Patient=${a.patient_id.slice(0, 8)}`)
  })

  // 4. Resolve Patient Profiles safely
  console.log('\n[Step 4] Resolving patient profiles...')
  const patientIds = Array.from(new Set(appointments.map((a) => a.patient_id).filter(Boolean)))
  const patientProfileMap = new Map()

  const { data: docProfs } = await supabase
    .from('doctors')
    .select('profile_id, full_name')
    .in('profile_id', patientIds)

  if (docProfs) {
    docProfs.forEach((dp) => {
      if (dp.full_name) {
        patientProfileMap.set(dp.profile_id, { full_name: dp.full_name.trim() })
      }
    })
  }

  const bookedAppointments = appointments.filter((a) => a.status === 'booked')
  assert(bookedAppointments.length > 0, 'Must have active booked appointments')
  console.log(`Found ${bookedAppointments.length} active booked appointments.`)

  // 5. Test Doctor Dashboard HTTP Page with authenticated session
  console.log('\n[Step 5] Testing Doctor Dashboard HTTP page render...')
  const session = authData.session
  // Next.js Supabase SSR cookie format
  // Construct standard Supabase session cookie headers
  const cookieHeader = `sb-${new URL(url).hostname.split('.')[0]}-auth-token=${encodeURIComponent(JSON.stringify(session))}`

  const pageRes = await fetch('http://localhost:3000/doctor/dashboard', {
    headers: {
      cookie: cookieHeader,
    },
  })

  console.log('Doctor Dashboard HTTP Status:', pageRes.status)
  assert.strictEqual(pageRes.status, 200, 'Doctor dashboard must return HTTP 200')

  const html = await pageRes.text()
  
  // Verify real appointment data is in HTML and NOT demo-1 / Thomas Reed
  const hasRealPatient = html.includes('riyaz') || html.includes('PT-') || html.includes('Patient #')
  const hasDemoFallback = html.includes('Thomas Reed')
  
  console.log('HTML contains real appointment / patient marker:', hasRealPatient)
  console.log('HTML contains hardcoded demo fallback (Thomas Reed):', hasDemoFallback)

  assert(hasRealPatient, 'Doctor dashboard HTML must contain real patient appointment data!')
  assert(!hasDemoFallback, 'Doctor dashboard must NOT fall back to demo appointments when real appointments exist!')

  console.log('\n=== All Doctor Dashboard Verification Tests Passed Successfully! ===')
}

runVerification().catch((err) => {
  console.error('\nVerification FAILED:', err)
  process.exit(1)
})
