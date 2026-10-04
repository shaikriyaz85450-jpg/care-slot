import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveUserAuthorization } from '@/lib/role-utils'
import {
  DoctorProfileSettingsView,
  type DoctorFullProfile,
} from '@/components/portal/DoctorProfileSettingsView'
import type { DoctorPortalInfo } from '@/components/portal/DoctorDashboardView'
import { SEED_DOCTORS } from '@/lib/seed-data'

export const dynamic = 'force-dynamic'

export default async function DoctorProfilePage() {
  const supabase = await createClient()

  // 1. Authenticate user from session
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login?redirectTo=/doctor/profile')
  }

  // 2. Resolve Doctor Authorization via Database Relationship:
  // auth.uid() -> profiles.id -> profiles.role = 'doctor' -> doctors.profile_id = profiles.id -> doctors.is_active = true
  const authResult = await resolveUserAuthorization(supabase, user.id)
  if (!authResult.isAuthorizedDoctor && !authResult.isAdmin) {
    redirect('/')
  }

  const profile = authResult.profile
  const userRole = authResult.role

  // 3. Resolve Doctor Profile
  let doctorRecord: any = null
  const { data: dbDoctor } = await supabase
    .from('doctors')
    .select(`
      id,
      specialization,
      qualification,
      experience_years,
      consultation_minutes,
      departments (
        id,
        name,
        description
      ),
      profiles (
        id,
        full_name,
        phone,
        role
      )
    `)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (dbDoctor) {
    doctorRecord = dbDoctor
  }

  const defaultSeed = SEED_DOCTORS[0]
  const doctorId = doctorRecord?.id || defaultSeed.id
  const doctorName =
    doctorRecord?.profiles?.full_name || profile?.full_name || defaultSeed.profiles.full_name
  const doctorSpecialization = doctorRecord?.specialization || defaultSeed.specialization
  const departmentName =
    (doctorRecord?.departments as any)?.name || defaultSeed.departments.name || 'Cardiology Clinic'
  const clinicRoom = defaultSeed.desk_location || 'Wing B • Room 304'

  const doctorPortalInfo: DoctorPortalInfo = {
    id: doctorId,
    name: doctorName,
    fullName: `Dr. ${doctorName}, MD`,
    prefix: 'Dr.',
    specialization: doctorSpecialization,
    departmentName: departmentName.includes('Department') || departmentName.includes('Clinic')
      ? departmentName
      : `${departmentName} Department`,
    clinicRoom: clinicRoom.includes('•') ? clinicRoom : `Wing B • ${clinicRoom}`,
    shiftRange: '08:00 AM – 04:30 PM',
    avatarUrl:
      defaultSeed.avatar_url ||
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAzt_NuJcyLUje-lQcFdgxEiAyae1ipRfo81SwJTQvKkWiuxYC_xvY5Sf_hWaiG5F3DUy4AN4_HG6KwuzI3Bqsul-WwNtsgYB8o2HCyd-LoQMx14i3sEl33sELe0d6ceR4kHivI1p3rD405RdzTOCCkYopjkbn8cGi7py88v_xh0YP-X14tbHf3kachYkItyaRspX3Q2Hl9C7GBaai_GzCD_0a2XBayChv2ZNKc-AmmW0saULjvdplNfg',
    docCode: `CS-DOC-${doctorId.substring(0, 4).toUpperCase()}`,
  }

  const fullProfile: DoctorFullProfile = {
    id: doctorId,
    profileId: user.id,
    fullName: doctorName,
    email: user.email || '',
    phone: doctorRecord?.profiles?.phone || profile?.phone || '',
    role: userRole,
    departmentName,
    specialization: doctorSpecialization,
    qualification: doctorRecord?.qualification || defaultSeed.qualification,
    experienceYears: doctorRecord?.experience_years ?? defaultSeed.experience_years,
    consultationMinutes: doctorRecord?.consultation_minutes || defaultSeed.consultation_minutes,
    clinicRoom,
    avatarUrl: doctorPortalInfo.avatarUrl,
    docCode: doctorPortalInfo.docCode,
  }

  return (
    <DoctorProfileSettingsView
      doctor={doctorPortalInfo}
      profileDetails={fullProfile}
    />
  )
}
