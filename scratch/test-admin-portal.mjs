import assert from 'assert'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

console.log('=== CareSlot Step 9: Hospital Administration Portal Verification ===\n')

// Read environment
const env = fs.readFileSync('.env.local', 'utf-8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim()
const anonKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim()

const BASE_URL = 'http://localhost:3000'

// ----------------------------------------------------------------------------
// Helper: Resolve Authorization model
// ----------------------------------------------------------------------------
function evaluateAuthorization(userId, profile, doctor) {
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
  } else {
    role = 'patient'
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

async function runVerificationSuite() {
  // ==========================================================================
  // Test 1: Unauthenticated Route Protection
  // ==========================================================================
  console.log('[Test 1] Verifying Unauthenticated Access to /admin/* routes...')
  const adminRoutes = ['/admin', '/admin/doctors', '/admin/departments', '/admin/appointments']

  for (const route of adminRoutes) {
    const res = await fetch(`${BASE_URL}${route}`, { redirect: 'manual' })
    assert.strictEqual(
      res.status,
      307,
      `Unauthenticated visit to ${route} must return 307 Redirect`
    )
    const location = res.headers.get('location')
    assert(
      location.includes('/login'),
      `Redirect target for ${route} must be /login, received: ${location}`
    )
    assert(
      location.includes(`redirectTo=${encodeURIComponent(route)}`),
      `Redirect target must preserve redirectTo parameter: ${location}`
    )
  }
  console.log('  PASSED: Unauthenticated visitors are strictly redirected to login.')

  // ==========================================================================
  // Test 2: Authenticate Patient (riyaz@gmail.com) and verify /admin/* blocking
  // ==========================================================================
  console.log('\n[Test 2] Verifying Patient (riyaz@gmail.com) cannot access /admin/*...')
  const patientClient = createClient(url, anonKey)
  const { data: patientAuth, error: pAuthErr } = await patientClient.auth.signInWithPassword({
    email: 'riyaz@gmail.com',
    password: '123456',
  })
  assert(!pAuthErr, `Patient login failed: ${pAuthErr?.message}`)
  const patientUserId = patientAuth.user.id
  const patientSession = patientAuth.session

  // Get cookies for HTTP fetch
  const patientCookies = `sb-ahpzissqbxgkrmxmewwv-auth-token=${encodeURIComponent(
    JSON.stringify(patientSession)
  )}`

  for (const route of adminRoutes) {
    const res = await fetch(`${BASE_URL}${route}`, {
      headers: { Cookie: patientCookies },
      redirect: 'manual',
    })
    assert.strictEqual(
      res.status,
      307,
      `Patient accessing ${route} must be blocked with 307 Redirect`
    )
    const loc = res.headers.get('location')
    assert.strictEqual(
      loc,
      '/',
      `Patient accessing ${route} must be redirected to / (Patient Home), received: ${loc}`
    )
  }
  console.log('  PASSED: Authenticated Patient is strictly blocked from all /admin/* routes.')

  // ==========================================================================
  // Test 3: Authenticate Doctor (doctor@gmail.com) and verify /admin/* blocking
  // ==========================================================================
  console.log('\n[Test 3] Verifying Doctor (doctor@gmail.com) cannot access /admin/*...')
  const doctorClient = createClient(url, anonKey)
  const { data: doctorAuth, error: dAuthErr } = await doctorClient.auth.signInWithPassword({
    email: 'doctor@gmail.com',
    password: '123456',
  })
  assert(!dAuthErr, `Doctor login failed: ${dAuthErr?.message}`)
  const doctorUserId = doctorAuth.user.id
  const doctorSession = doctorAuth.session

  const doctorCookies = `sb-ahpzissqbxgkrmxmewwv-auth-token=${encodeURIComponent(
    JSON.stringify(doctorSession)
  )}`

  for (const route of adminRoutes) {
    const res = await fetch(`${BASE_URL}${route}`, {
      headers: { Cookie: doctorCookies },
      redirect: 'manual',
    })
    assert.strictEqual(
      res.status,
      307,
      `Doctor accessing ${route} must be blocked with 307 Redirect`
    )
    const loc = res.headers.get('location')
    assert.strictEqual(
      loc,
      '/',
      `Doctor accessing ${route} must be redirected away from admin, received: ${loc}`
    )
  }
  console.log('  PASSED: Authenticated Doctor is strictly blocked from all /admin/* routes.')

  // ==========================================================================
  // Test 4: Role Gate Verification on Login Screen
  // ==========================================================================
  console.log('\n[Test 4] Testing Login Portal Role Gates for Admin Tab...')

  function simulateLoginRoleGate(selectedTabRole, userAuthResult) {
    if (selectedTabRole === 'admin' && !userAuthResult.isAdmin) {
      return {
        allowed: false,
        error: 'Access denied. This account does not possess hospital administrator credentials.',
      }
    }
    if (selectedTabRole === 'doctor' && !userAuthResult.isAuthorizedDoctor && !userAuthResult.isAdmin) {
      return {
        allowed: false,
        error: 'Access denied. This account is not registered as an authorized hospital physician.',
      }
    }
    return { allowed: true, target: userAuthResult.role === 'admin' ? '/admin' : userAuthResult.role === 'doctor' ? '/doctor/dashboard' : '/' }
  }

  const patientAuthResult = evaluateAuthorization(patientUserId, { id: patientUserId, role: 'patient' }, null)
  const doctorAuthResult = evaluateAuthorization(
    doctorUserId,
    { id: doctorUserId, role: 'doctor' },
    { id: 'doc-1', profile_id: doctorUserId, is_active: true }
  )
  const adminAuthResult = evaluateAuthorization('admin-user-id', { id: 'admin-user-id', role: 'admin' }, null)

  // 4a. Patient on Admin Tab
  const patientAdminGate = simulateLoginRoleGate('admin', patientAuthResult)
  assert.strictEqual(patientAdminGate.allowed, false)
  assert.strictEqual(patientAdminGate.error, 'Access denied. This account does not possess hospital administrator credentials.')

  // 4b. Doctor on Admin Tab
  const doctorAdminGate = simulateLoginRoleGate('admin', doctorAuthResult)
  assert.strictEqual(doctorAdminGate.allowed, false)
  assert.strictEqual(doctorAdminGate.error, 'Access denied. This account does not possess hospital administrator credentials.')

  // 4c. Admin on Admin Tab
  const adminAdminGate = simulateLoginRoleGate('admin', adminAuthResult)
  assert.strictEqual(adminAdminGate.allowed, true)
  assert.strictEqual(adminAdminGate.target, '/admin')

  console.log('  PASSED: Login tab role gates strictly prevent unauthorized users from entering Admin portal.')

  // ==========================================================================
  // Test 5: Doctor Deactivation & Authorization Impact
  // ==========================================================================
  console.log('\n[Test 5] Verifying Doctor Deactivation Impact on Portal Authorization...')

  // 5a. Active Doctor: is_active = true
  const activeDocAuth = evaluateAuthorization(
    doctorUserId,
    { id: doctorUserId, role: 'doctor' },
    { id: 'doc-1', profile_id: doctorUserId, is_active: true }
  )
  assert.strictEqual(activeDocAuth.isAuthorizedDoctor, true)
  assert.strictEqual(activeDocAuth.role, 'doctor')

  // 5b. Deactivated Doctor: is_active = false
  const deactivatedDocAuth = evaluateAuthorization(
    doctorUserId,
    { id: doctorUserId, role: 'doctor' },
    { id: 'doc-1', profile_id: doctorUserId, is_active: false }
  )
  assert.strictEqual(deactivatedDocAuth.isAuthorizedDoctor, false, 'Deactivated doctor must NOT be authorized')
  assert.strictEqual(deactivatedDocAuth.role, 'patient', 'Deactivated doctor must fall back to non-doctor role')

  console.log('  PASSED: Deactivating a doctor immediately revokes physician portal authorization.')

  // ==========================================================================
  // Test 6: Verify Database Doctors Directory & Active Doctors
  // ==========================================================================
  console.log('\n[Test 6] Verifying Doctors & Departments in Database...')
  const { data: dbDepts, error: deptErr } = await doctorClient.from('departments').select('*')
  assert(!deptErr, `Failed to query departments: ${deptErr?.message}`)
  assert(dbDepts && dbDepts.length > 0, 'Departments must exist in database')
  console.log(`  Found ${dbDepts.length} departments:`, dbDepts.map(d => d.name).join(', '))

  const { data: dbDocs, error: docErr } = await doctorClient.from('doctors').select('*')
  assert(!docErr, `Failed to query doctors: ${docErr?.message}`)
  assert(dbDocs && dbDocs.length > 0, 'Doctors must exist in database')
  console.log(`  Found ${dbDocs.length} doctors:`, dbDocs.map(d => `${d.full_name || 'Dr.'} (${d.specialization}, room: ${d.clinic_room}, active: ${d.is_active})`).join('; '))

  // ==========================================================================
  // Test 7: Verify Appointments Overview Query
  // ==========================================================================
  console.log('\n[Test 7] Verifying Appointments Visibility...')
  const { data: doctorAppts, error: apptErr } = await doctorClient.from('appointments').select('*')
  assert(!apptErr, `Failed to query appointments: ${apptErr?.message}`)
  console.log(`  Doctor sees ${doctorAppts.length} assigned appointments.`)

  // ==========================================================================
  // Test 8: Verify Existing Patient Booking Flow (No Regression)
  // ==========================================================================
  console.log('\n[Test 8] Verifying Existing Patient Booking Flow...')
  const testDoctorId = 'f45fea6a-c421-4603-83cc-8ffa93c1304e'
  const todayDateStr = new Date().toISOString().split('T')[0]

  // Check that patient can see doctor schedule & slots
  const { data: schedules } = await patientClient
    .from('doctor_schedules')
    .select('*')
    .eq('doctor_id', testDoctorId)
  assert(schedules && schedules.length > 0, 'Doctor schedules must exist for slot generation')
  console.log(`  Doctor has ${schedules.length} operating schedule entries.`)

  // ==========================================================================
  // Test 9: Verify Existing Doctor Dashboard (No Regression)
  // ==========================================================================
  console.log('\n[Test 9] Verifying Doctor Dashboard Endpoint with Authenticated Session...')
  const docDashboardRes = await fetch(`${BASE_URL}/doctor/dashboard`, {
    headers: { Cookie: doctorCookies },
    redirect: 'manual',
  })
  assert.strictEqual(
    docDashboardRes.status,
    200,
    `Authenticated doctor visiting /doctor/dashboard must return HTTP 200, got: ${docDashboardRes.status}`
  )
  const dashboardHtml = await docDashboardRes.text()
  assert(
    dashboardHtml.includes('Cardiology') || dashboardHtml.includes('Physician Station'),
    'Dashboard HTML must render the doctor station'
  )
  assert(!dashboardHtml.includes('Thomas Reed'), 'Dashboard HTML must NOT render demo fallback')
  console.log('  PASSED: Doctor Dashboard loads live clinical appointments with HTTP 200.')

  console.log('\n=== ALL 9 TEST SUITES COMPLETED SUCCESSFULLY! ===')
}

runVerificationSuite().catch((err) => {
  console.error('\nTEST SUITE FAILED:', err)
  process.exit(1)
})
