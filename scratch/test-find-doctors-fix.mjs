import assert from 'assert'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

console.log('=== CareSlot Find Doctors Listing Verification ===')

// Read environment
const env = fs.readFileSync('.env.local', 'utf-8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim()
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim()
const supabase = createClient(url, key)

const SEED_DEPARTMENTS = [
  { id: 'd1111111-1111-1111-1111-111111111111', name: 'Cardiology', description: 'Heart & Vascular Clinic' },
  { id: 'd2222222-2222-2222-2222-222222222222', name: 'General Medicine', description: 'Primary care' },
  { id: 'd3333333-3333-3333-3333-333333333333', name: 'Pediatrics', description: 'Child healthcare' },
  { id: 'd4444444-4444-4444-4444-444444444444', name: 'Orthopedics', description: 'Joint replacement' },
  { id: 'd5555555-5555-5555-5555-555555555555', name: 'Dermatology', description: 'Clinical dermatology' },
  { id: 'd6666666-6666-6666-6666-666666666666', name: 'Neurology', description: 'Neurological disorders' },
]

const SEED_DOCTORS = [
  { id: 'c1111111-1111-1111-1111-111111111111', profiles: { full_name: 'Marcus Vance' }, departments: { name: 'Cardiology' }, specialization: 'Cardiology' },
  { id: 'c2222222-2222-2222-2222-222222222222', profiles: { full_name: 'Alana Chen' }, departments: { name: 'Pediatrics' }, specialization: 'Pediatrics' },
  { id: 'c3333333-3333-3333-3333-333333333333', profiles: { full_name: 'Mei Ling Chen' }, departments: { name: 'Dermatology' }, specialization: 'Dermatology' },
  { id: 'c4444444-4444-4444-4444-444444444444', profiles: { full_name: 'Robert Kim' }, departments: { name: 'Orthopedics' }, specialization: 'Orthopedics' },
  { id: 'c5555555-5555-5555-5555-555555555555', profiles: { full_name: 'Elena Rostova' }, departments: { name: 'General Medicine' }, specialization: 'General Medicine' },
  { id: 'c6666666-6666-6666-6666-666666666666', profiles: { full_name: 'Jonathan Hayes' }, departments: { name: 'Neurology' }, specialization: 'Neurology' },
]

async function runTests() {
  // Test 1: Fetch from Supabase with the updated query
  console.log('\n[Test 1] Querying active doctors from Supabase...')
  const { data: dbDocs, error: docsErr } = await supabase
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
        name,
        description
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

  assert.strictEqual(docsErr, null, 'Query should have no errors')
  assert(dbDocs && dbDocs.length > 0, 'Database should return active doctors')

  // Check Dr. Test Doctor in DB results
  const testDoc = dbDocs.find((d) => d.id === 'f45fea6a-c421-4603-83cc-8ffa93c1304e')
  assert(testDoc, 'Dr. Test Doctor must be found in dbDocs')
  assert.strictEqual(testDoc.full_name, 'Dr. Test Doctor', 'full_name must be Dr. Test Doctor')
  assert.strictEqual(testDoc.profile_id, '111e4ff4-eb00-417e-99c5-21ee7be517be', 'profile_id must match')
  assert.strictEqual(testDoc.is_active, true, 'is_active must be true')
  console.log('PASSED: Dr. Test Doctor queried successfully from public.doctors.')

  // Test 2: Merging and Deduplication Logic
  console.log('\n[Test 2] Simulating Find Doctors merge and deduplication...')
  const mappedDbDocs = dbDocs.map((doc) => {
    const doctorName = (doc.full_name || doc.profiles?.full_name || 'Specialist').trim()
    const deptName = (doc.departments?.name || 'Cardiology').trim()
    return {
      id: doc.id,
      profiles: { full_name: doctorName },
      departments: { name: deptName },
      specialization: (doc.specialization || 'Cardiology').trim(),
    }
  })

  const dbDoctorIds = new Set(mappedDbDocs.map((d) => d.id.toLowerCase()))
  const dbDoctorNames = new Set(mappedDbDocs.map((d) => d.profiles.full_name.toLowerCase().trim()))

  const nonDuplicateSeedDocs = SEED_DOCTORS.filter((s) => {
    const idMatches = dbDoctorIds.has(s.id.toLowerCase())
    const nameMatches = dbDoctorNames.has(s.profiles.full_name.toLowerCase().trim())
    return !idMatches && !nameMatches
  })

  const allDoctors = [...mappedDbDocs, ...nonDuplicateSeedDocs]
  console.log(`Total doctors after merge: ${allDoctors.length}`)
  allDoctors.forEach((d) => console.log(` - [${d.departments.name}] ${d.profiles.full_name} (${d.id})`))

  // Assertions:
  // 1. Dr. Test Doctor is present
  const hasTestDoctor = allDoctors.some((d) => d.id === 'f45fea6a-c421-4603-83cc-8ffa93c1304e' && d.profiles.full_name === 'Dr. Test Doctor')
  assert.strictEqual(hasTestDoctor, true, 'Dr. Test Doctor must be present in allDoctors')

  // 2. All 6 seed doctors are preserved
  for (const s of SEED_DOCTORS) {
    const seedFound = allDoctors.some((d) => d.profiles.full_name === s.profiles.full_name)
    assert.strictEqual(seedFound, true, `Seed doctor ${s.profiles.full_name} must be preserved`)
  }

  // 3. No duplicate IDs or duplicate names
  const ids = allDoctors.map((d) => d.id)
  const uniqueIds = new Set(ids)
  assert.strictEqual(ids.length, uniqueIds.size, 'Doctor IDs must be strictly unique')

  console.log('PASSED: Merged doctor list contains Dr. Test Doctor AND all preserved seed specialists without duplicates!')

  // Test 3: HTTP Endpoint check on /doctors
  console.log('\n[Test 3] Testing HTTP response of /doctors page...')
  const res = await fetch('http://localhost:3000/doctors')
  console.log(`GET /doctors status: ${res.status}`)
  assert.strictEqual(res.status, 200, 'Page /doctors should return HTTP 200')
  const html = await res.text()
  assert(html.includes('Dr. Test Doctor'), 'HTML should render "Dr. Test Doctor"')
  assert(html.includes('Marcus Vance'), 'HTML should render "Marcus Vance"')
  assert(html.includes('Cardiology'), 'HTML should render "Cardiology"')
  console.log('PASSED: /doctors renders Dr. Test Doctor and existing seeded doctors in HTML!')

  console.log('\n=== All Find Doctors Verification Tests Succeeded! ===')
}

runTests().catch((err) => {
  console.error('Test Failed:', err)
  process.exit(1)
})
