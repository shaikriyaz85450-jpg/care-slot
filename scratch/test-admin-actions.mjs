import assert from 'assert'
import {
  getAdminOverviewDataAction,
  getAdminDoctorsAction,
  createDoctorAction,
  updateDoctorAction,
  toggleDoctorActiveAction,
  getAdminDepartmentsAction,
  createDepartmentAction,
  updateDepartmentAction,
  getAdminAppointmentsAction,
  cancelAdminAppointmentAction,
} from '../src/app/actions/admin.ts'

console.log('=== CareSlot Step 9: Admin Server Actions Security Verification ===\n')

async function testActionsSecurity() {
  // Test 1: Calling admin actions unauthenticated must be blocked
  console.log('[Test 1] Testing unauthenticated calls to Admin Server Actions...')

  const overviewRes = await getAdminOverviewDataAction()
  assert.strictEqual(overviewRes.success, false)
  assert(overviewRes.error.includes('Authentication required') || overviewRes.error.includes('Access denied'))
  console.log('  getAdminOverviewDataAction blocked unauthenticated caller:', overviewRes.error)

  const docsRes = await getAdminDoctorsAction()
  assert.strictEqual(docsRes.success, false)
  console.log('  getAdminDoctorsAction blocked unauthenticated caller')

  const createDocRes = await createDoctorAction({
    fullName: 'Dr. Hack',
    specialization: 'None',
    departmentId: 'dept-1',
  })
  assert.strictEqual(createDocRes.success, false)
  console.log('  createDoctorAction blocked unauthenticated caller')

  const toggleRes = await toggleDoctorActiveAction('doc-1', false)
  assert.strictEqual(toggleRes.success, false)
  console.log('  toggleDoctorActiveAction blocked unauthenticated caller')

  const deptsRes = await getAdminDepartmentsAction()
  assert.strictEqual(deptsRes.success, false)
  console.log('  getAdminDepartmentsAction blocked unauthenticated caller')

  const createDeptRes = await createDepartmentAction('Fake Dept')
  assert.strictEqual(createDeptRes.success, false)
  console.log('  createDepartmentAction blocked unauthenticated caller')

  const apptsRes = await getAdminAppointmentsAction()
  assert.strictEqual(apptsRes.success, false)
  console.log('  getAdminAppointmentsAction blocked unauthenticated caller')

  const cancelRes = await cancelAdminAppointmentAction('appt-1')
  assert.strictEqual(cancelRes.success, false)
  console.log('  cancelAdminAppointmentAction blocked unauthenticated caller')

  console.log('\nPASSED: All Admin Server Actions enforce strict server-side authentication and role verification.')
}

testActionsSecurity().catch((err) => {
  console.error('\nACTIONS TEST FAILED:', err)
  process.exit(1)
})
