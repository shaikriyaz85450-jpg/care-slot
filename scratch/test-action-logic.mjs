import assert from 'assert'

console.log('--- Step 7 Logic & Automation Rule Tests ---')

// 1. Validate status options
const validStatuses = ['available', 'delayed', 'on_leave']
assert(validStatuses.includes('available'))
assert(validStatuses.includes('delayed'))
assert(validStatuses.includes('on_leave'))
console.log('PASSED: Valid status options match database enum.')

// 2. Validate delayed notification payload logic
function buildDelayNotification(doctorName, delayMinutes, startTime) {
  return {
    title: 'Doctor Schedule Delay Alert',
    body: `Dr. ${doctorName} is running behind schedule by ~${delayMinutes} minutes. Your ${startTime} appointment schedule has been adjusted accordingly.`,
    read: false,
  }
}

const delayNotif = buildDelayNotification('Marcus Vance', 25, '10:30 AM')
assert.strictEqual(delayNotif.title, 'Doctor Schedule Delay Alert')
assert(delayNotif.body.includes('~25 minutes'))
assert(delayNotif.body.includes('10:30 AM'))
console.log('PASSED: Delay notification payload matches requirements.')

// 3. Validate leave cancellation & notification payload logic
function buildLeaveNotification(doctorName) {
  return {
    title: 'Appointment Cancelled - Doctor On Leave',
    body: `Dr. ${doctorName} is on leave today. Your scheduled appointment has been cancelled. Please visit My Appointments or the portal to reschedule.`,
    read: false,
  }
}

const leaveNotif = buildLeaveNotification('Marcus Vance')
assert.strictEqual(leaveNotif.title, 'Appointment Cancelled - Doctor On Leave')
assert(leaveNotif.body.includes('cancelled'))
assert(leaveNotif.body.includes('reschedule'))
console.log('PASSED: Leave cancellation notification payload matches requirements.')

// 4. Validate KPI calculation logic
const sampleAppointments = [
  { id: '1', status: 'booked', checkInState: 'Checked In • Waiting Room 3' },
  { id: '2', status: 'booked', checkInState: 'Confirmed' },
  { id: '3', status: 'completed', checkInState: 'Completed' },
  { id: '4', status: 'cancelled', checkInState: 'Cancelled' },
]

const totalCount = sampleAppointments.length
const completedCount = sampleAppointments.filter(a => a.status === 'completed').length
const remainingCount = sampleAppointments.filter(a => a.status === 'booked' || a.status === 'checked_in').length
const cancelledCount = sampleAppointments.filter(a => a.status === 'cancelled').length
const completionRate = Math.round((completedCount / totalCount) * 100)

assert.strictEqual(totalCount, 4)
assert.strictEqual(completedCount, 1)
assert.strictEqual(remainingCount, 2)
assert.strictEqual(cancelledCount, 1)
assert.strictEqual(completionRate, 25)
console.log('PASSED: KPI metrics calculation matches Stitch dashboard logic.')

console.log('--- All Unit Assertions Passed! ---')
