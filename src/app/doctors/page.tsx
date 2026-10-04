import React, { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { FindDoctorsView } from '@/components/portal/FindDoctorsView'
import {
  SEED_DEPARTMENTS,
  SEED_DOCTORS,
  type SeedDepartment,
  type SeedDoctor,
} from '@/lib/seed-data'

export const dynamic = 'force-dynamic'

export default async function DoctorsPage() {
  const supabase = await createClient()

  // 1. Authenticate user from session token if available
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let profile = null
  let upcomingCount = 0
  let unreadCount = 0

  if (user) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    profile = prof

    const todayStr = new Date().toISOString().split('T')[0]
    const { count: apptCount } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('patient_id', user.id)
      .eq('status', 'booked')
      .gte('appointment_date', todayStr)

    upcomingCount = apptCount || 0

    const { count: notifCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null)

    unreadCount = notifCount || 0
  }

  // 2. Query Departments from Supabase
  let departments: SeedDepartment[] = [...SEED_DEPARTMENTS]
  try {
    const { data: dbDepts, error: deptsErr } = await supabase
      .from('departments')
      .select('id, name, description')
      .order('name')

    if (!deptsErr && dbDepts && dbDepts.length > 0) {
      const existingNames = new Set(departments.map((d) => d.name.toLowerCase().trim()))
      const newDepts: SeedDepartment[] = []

      for (const d of dbDepts) {
        const cleanName = d.name.trim()
        const lowerName = cleanName.toLowerCase()
        if (!existingNames.has(lowerName)) {
          existingNames.add(lowerName)
          newDepts.push({
            id: d.id,
            name: cleanName,
            description: d.description || `${cleanName} Clinic`,
          })
        } else {
          const existing = departments.find((sd) => sd.name.toLowerCase().trim() === lowerName)
          if (existing) {
            existing.id = d.id
          }
        }
      }
      departments = [...departments, ...newDepts]
    }
  } catch (err) {
    console.error('Error fetching departments from Supabase:', err)
  }

  // 3. Query Active Doctors from Supabase
  let doctors: SeedDoctor[] = [...SEED_DOCTORS]
  try {
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

    if (!docsErr && dbDocs && dbDocs.length > 0) {
      const mappedDbDocs: SeedDoctor[] = dbDocs.map((doc: any) => {
        const doctorName = (doc.full_name || doc.profiles?.full_name || 'Specialist').trim()
        const deptName = (doc.departments?.name || 'Cardiology').trim()
        const clinicRoom = doc.clinic_room
          ? (doc.clinic_room.includes('Room') || doc.clinic_room.includes('Wing')
              ? doc.clinic_room
              : `Room ${doc.clinic_room}`)
          : 'Wing B • Room 304'

        const seedMatch = SEED_DOCTORS.find(
          (s) =>
            s.profiles?.full_name?.toLowerCase().trim() === doctorName.toLowerCase().trim() ||
            s.id === doc.id
        )

        const initials = doctorName
          .replace(/^Dr\.?\s*/i, '')
          .split(/\s+/)
          .map((n: string) => n[0])
          .join('')
          .substring(0, 2)
          .toUpperCase() || 'MD'

        const todayStr = new Date().toISOString().split('T')[0]
        const dailyStatusList = (doc.doctor_daily_status && doc.doctor_daily_status.length > 0)
          ? doc.doctor_daily_status
          : [
              {
                id: `status-${doc.id}`,
                date: todayStr,
                status: 'available' as const,
                delay_minutes: 0,
                note: 'Seeing Patients — On Time. Instant scheduling enabled.',
              },
            ]

        return {
          id: doc.id,
          specialization: (doc.specialization || 'Cardiology').trim(),
          qualification: (doc.qualification || 'MBBS, MD').trim(),
          experience_years: doc.experience_years ?? 10,
          consultation_minutes: doc.consultation_minutes ?? 20,
          clinic_name: seedMatch?.clinic_name || `${deptName} Clinic`,
          desk_location: clinicRoom,
          avatar_url: doc.photo_url || seedMatch?.avatar_url,
          initials,
          departments: {
            id: doc.departments?.id || doc.department_id || '',
            name: deptName,
          },
          profiles: {
            id: doc.profile_id || doc.profiles?.id || doc.id,
            full_name: doctorName,
          },
          doctor_daily_status: dailyStatusList,
          slots_today: seedMatch?.slots_today || ['09:30 AM', '11:00 AM', '02:15 PM', '04:00 PM'],
        }
      })

      // Combine database doctors with seeded doctors without duplicating any doctor
      const dbDoctorIds = new Set(mappedDbDocs.map((d) => d.id.toLowerCase()))
      const dbDoctorNames = new Set(
        mappedDbDocs.map((d) => d.profiles?.full_name?.toLowerCase().trim())
      )

      const nonDuplicateSeedDocs = SEED_DOCTORS.filter((s) => {
        const idMatches = dbDoctorIds.has(s.id.toLowerCase())
        const nameMatches = dbDoctorNames.has(s.profiles?.full_name?.toLowerCase().trim())
        return !idMatches && !nameMatches
      })

      // Place active database doctors first, followed by preserved seeded specialists
      doctors = [...mappedDbDocs, ...nonDuplicateSeedDocs]
    }
  } catch (err) {
    console.error('Error fetching doctors from Supabase:', err)
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface flex items-center justify-center text-secondary">
          Loading Specialist Directory...
        </div>
      }
    >
      <FindDoctorsView
        user={
          user
            ? {
                id: user.id,
                email: user.email || '',
              }
            : null
        }
        profile={profile}
        departments={departments}
        doctors={doctors}
        upcomingCount={upcomingCount}
        unreadCount={unreadCount}
      />
    </Suspense>
  )
}
