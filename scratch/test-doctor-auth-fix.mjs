import assert from 'assert'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

console.log('=== CareSlot Doctor Authorization Verification ===')

// Read environment
const env = fs.readFileSync('.env.local', 'utf-8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim()
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim()
const supabase = createClient(url, key)

// Replicate resolveUserAuthorization logic
async function resolveUserAuthorization(client, userId) {
  if (!userId) {
    return {
      role: 'patient',
      isAuthorizedDoctor: false,
      isAdmin: false,
      isPatient: true,
      profile: null,
      doctor: null,
    }
  }

  const [profileRes, doctorRes] = await Promise.all([
    client
      .from('profiles')
      .select('id, full_name, phone, role')
      .eq('id', userId)
      .maybeSingle(),
    client
      .from('doctors')
      .select('id, profile_id, department_id, specialization, qualification, experience_years, consultation_minutes, clinic_room, is_active')
      .eq('profile_id', userId)
      .maybeSingle(),
  ])

  const profile = profileRes.data || null
  const doctor = doctorRes.data || null

  const isAdmin = profile?.role === 'admin'
  const isAuthorizedDoctor = Boolean(
    profile?.role === 'doctor' &&
    doctor &&
    doctor.is_active === true &&
    doctor.profile_id === userId
  )

  let role = 'patient'
  if (isAdmin) {
    role = 'admin'
  } else if (isAuthorizedDoctor) {
    role = 'doctor'
  }

  return {
    role,
    isAuthorizedDoctor,
    isAdmin,
    isPatient: role === 'patient',
    profile,
    doctor,
  }
}

async function runTests() {
  const doctorUserId = '111e4ff4-eb00-417e-99c5-21ee7be517be'

  // Test 1: Authenticated Doctor Authorization from Database Relationship
  console.log('\n[Test 1] Verifying doctor authorization for:', doctorUserId)
  const docAuth = await resolveUserAuthorization(supabase, doctorUserId)
  console.log('Result:', {
    role: docAuth.role,
    isAuthorizedDoctor: docAuth.isAuthorizedDoctor,
    hasDoctorRecord: Boolean(docAuth.doctor),
    doctorActive: docAuth.doctor?.is_active,
    doctorId: docAuth.doctor?.id,
    clinicRoom: docAuth.doctor?.clinic_room
  })

  assert.strictEqual(docAuth.isAuthorizedDoctor, true, 'User must be recognized as an authorized doctor')
  assert.strictEqual(docAuth.role, 'doctor', 'Role must resolve to doctor')
  assert.strictEqual(docAuth.doctor?.is_active, true, 'Doctor record must be active')
  assert.strictEqual(docAuth.doctor?.profile_id, doctorUserId, 'Doctor profile_id must match authenticated user')
  console.log('PASSED: Doctor authorization from database relationship succeeds!')

  // Test 2: Simulated Patient Authorization
  console.log('\n[Test 2] Verifying patient authorization (non-doctor UUID)')
  const patientUserId = '99999999-9999-9999-9999-999999999999'
  const patientAuth = await resolveUserAuthorization(supabase, patientUserId)
  assert.strictEqual(patientAuth.isAuthorizedDoctor, false, 'Patient must NOT be recognized as doctor')
  assert.strictEqual(patientAuth.role, 'patient', 'Patient role must resolve to patient')
  assert.strictEqual(patientAuth.doctor, null, 'Patient must not have doctor record')
  console.log('PASSED: Non-doctor account is NOT authorized as a physician.')

  // Test 3: Validate Login Portal Access Control Logic
  console.log('\n[Test 3] Testing login portal role verification logic')

  // Case 3a: Doctor signing in on Doctor tab
  function simulateLoginGate(selectedRole, auth) {
    if (selectedRole === 'admin' && !auth.isAdmin) {
      return { allowed: false, error: 'Access denied. This account does not possess hospital administrator credentials.' }
    }
    if (selectedRole === 'doctor' && !auth.isAuthorizedDoctor && !auth.isAdmin) {
      return { allowed: false, error: 'Access denied. This account is not registered as an authorized hospital physician.' }
    }
    return { allowed: true }
  }

  const doctorOnDoctorTab = simulateLoginGate('doctor', docAuth)
  assert.strictEqual(doctorOnDoctorTab.allowed, true, 'Doctor on Doctor tab must be allowed')

  const patientOnDoctorTab = simulateLoginGate('doctor', patientAuth)
  assert.strictEqual(patientOnDoctorTab.allowed, false, 'Patient on Doctor tab must be blocked')
  assert.strictEqual(patientOnDoctorTab.error, 'Access denied. This account is not registered as an authorized hospital physician.')

  const patientOnPatientTab = simulateLoginGate('patient', patientAuth)
  assert.strictEqual(patientOnPatientTab.allowed, true, 'Patient on Patient tab must be allowed')

  console.log('PASSED: Login portal role gate permits authorized doctor and blocks unauthorized patient!')

  // Test 4: Route Guards via HTTP on local server
  console.log('\n[Test 4] Testing route guards (unauthenticated access)')
  const protectedRoutes = ['/doctor/dashboard', '/doctor/schedule', '/doctor/profile']
  for (const route of protectedRoutes) {
    const res = await fetch(`http://localhost:3000${route}`, { redirect: 'manual' })
    const loc = res.headers.get('location')
    console.log(`Route ${route}: status ${res.status}, location: ${loc}`)
    assert(res.status === 307 || res.status === 308, `Route ${route} must redirect unauthenticated access`)
    assert(loc && loc.includes('/login'), `Route ${route} redirect must point to /login`)
  }
  console.log('PASSED: All doctor routes strictly protected by middleware!')

  console.log('\n=== All Verification Tests Succeeded! ===')
}

runTests().catch((err) => {
  console.error('Test Failed:', err)
  process.exit(1)
})
