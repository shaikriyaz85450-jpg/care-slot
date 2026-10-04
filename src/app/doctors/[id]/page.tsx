import React, { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DoctorProfileView } from '@/components/portal/DoctorProfileView'
import { SEED_DOCTORS } from '@/lib/seed-data'
import { generateDateOptions } from '@/lib/slot-utils'

interface DoctorProfilePageProps {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export default async function DoctorProfilePage({ params }: DoctorProfilePageProps) {
  const { id } = await params
  const supabase = await createClient()

  // 1. Current authenticated user & profile
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

    upcomingCount = apptCount || 0

    const { count: notifCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null)

    unreadCount = notifCount || 0
  }

  // 2. Fetch Doctor Data from Supabase
  let doctorData: any = null
  let doctorSchedules: Array<{
    weekday: number
    start_time: string
    end_time: string
  }> = []

  try {
    const { data: dbDoc, error: docError } = await supabase
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
        ),
        doctor_schedules (
          id,
          weekday,
          start_time,
          end_time
        )
      `)
      .eq('id', id)
      .maybeSingle()

    if (!docError && dbDoc) {
      const doctorName = (dbDoc.full_name || dbDoc.profiles?.full_name || 'Specialist').trim()
      const deptName = (dbDoc.departments?.name || 'Cardiology').trim()
      const clinicRoom = dbDoc.clinic_room
        ? (dbDoc.clinic_room.includes('Room') || dbDoc.clinic_room.includes('Wing')
            ? dbDoc.clinic_room
            : `Room ${dbDoc.clinic_room}`)
        : 'Wing B • Room 304'

      const seedMatch = SEED_DOCTORS.find(
        (s) =>
          s.id === dbDoc.id ||
          s.profiles?.full_name?.toLowerCase().trim() === doctorName.toLowerCase().trim()
      )

      doctorData = {
        ...dbDoc,
        specialization: (dbDoc.specialization || 'Cardiology').trim(),
        qualification: (dbDoc.qualification || 'MBBS, MD').trim(),
        clinic_name: seedMatch?.clinic_name || `${deptName} Clinic`,
        desk_location: clinicRoom,
        avatar_url: dbDoc.photo_url || seedMatch?.avatar_url,
        departments: {
          id: dbDoc.departments?.id || dbDoc.department_id || '',
          name: deptName,
          description: dbDoc.departments?.description || null,
        },
        profiles: {
          id: dbDoc.profile_id || dbDoc.profiles?.id || dbDoc.id,
          full_name: doctorName,
        },
      }
      if (dbDoc.doctor_schedules && dbDoc.doctor_schedules.length > 0) {
        doctorSchedules = dbDoc.doctor_schedules
      }
    }
  } catch (err) {
    console.error('Error fetching doctor from Supabase:', err)
  }

  // 3. Fallback to SEED_DOCTORS if not found in database
  const seedMatch = SEED_DOCTORS.find((s) => s.id === id)
  if (!doctorData && seedMatch) {
    doctorData = {
      id: seedMatch.id,
      specialization: seedMatch.specialization,
      qualification: seedMatch.qualification,
      experience_years: seedMatch.experience_years,
      consultation_minutes: seedMatch.consultation_minutes,
      clinic_name: seedMatch.clinic_name,
      desk_location: seedMatch.desk_location,
      avatar_url: seedMatch.avatar_url,
      departments: {
        id: seedMatch.departments?.id || '',
        name: seedMatch.departments?.name || 'General Medicine',
      },
      profiles: {
        id: seedMatch.profiles?.id || '',
        full_name: seedMatch.profiles?.full_name || 'Specialist',
      },
      doctor_daily_status: seedMatch.doctor_daily_status || [],
    }
  }

  // If doctor still not found: return Stitch-styled 404 page
  if (!doctorData) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center text-secondary mb-4 shadow-sm">
          <span className="material-symbols-outlined text-[36px]">person_off</span>
        </div>
        <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">
          Doctor Not Found
        </h2>
        <p className="font-body-md text-body-md text-secondary mt-2 max-w-md">
          The specialist profile you are looking for does not exist or has been moved from the clinic directory.
        </p>
        <Link
          className="mt-6 h-10 px-6 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md transition-colors shadow-sm flex items-center gap-2 font-semibold"
          href="/doctors"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Back to Specialist Directory</span>
        </Link>
      </div>
    )
  }

  // 4. Default schedules if none in DB (Mon-Fri 09:00 - 17:00)
  if (doctorSchedules.length === 0) {
    doctorSchedules = [1, 2, 3, 4, 5].map((weekday) => ({
      weekday,
      start_time: '09:00:00',
      end_time: '17:00:00',
    }))
  }

  // 5. Fetch Booked Slots for the 5-day Rail
  const dateOptions = generateDateOptions(new Date(), 5)
  const dateStrings = dateOptions.map((d) => d.dateStr)
  const initialBookedSlots: Record<string, string[]> = {}

  for (const d of dateStrings) {
    initialBookedSlots[d] = []
  }

  try {
    let clientToQuery: any = supabase
    try {
      clientToQuery = createAdminClient()
    } catch {
      clientToQuery = supabase
    }

    // Query booked appointments
    const { data: bookedList } = await clientToQuery
      .from('appointments')
      .select('appointment_date, start_time, status')
      .eq('doctor_id', id)
      .eq('status', 'booked')

    if (bookedList && bookedList.length > 0) {
      for (const b of bookedList) {
        const slotDate = b.appointment_date
        if (slotDate && initialBookedSlots[slotDate]) {
          initialBookedSlots[slotDate].push(b.start_time)
        }
      }
    }
  } catch (err) {
    console.error('Error fetching booked appointments for doctor:', err)
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface flex items-center justify-center text-secondary">
          Loading Specialist Profile...
        </div>
      }
    >
      <DoctorProfileView
        doctor={doctorData}
        initialBookedSlots={initialBookedSlots}
        profile={profile}
        schedules={doctorSchedules}
        upcomingCount={upcomingCount}
        unreadCount={unreadCount}
        user={
          user
            ? {
                id: user.id,
                email: user.email || '',
              }
            : null
        }
      />
    </Suspense>
  )
}
