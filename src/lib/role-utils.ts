import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, UserRole } from '@/types/database.types'

export interface UserAuthorizationResult {
  role: UserRole
  isAuthorizedDoctor: boolean
  isAdmin: boolean
  isPatient: boolean
  profile: {
    id: string
    role: UserRole
    full_name: string
    phone: string | null
  } | null
  doctor: {
    id: string
    profile_id: string
    department_id: string
    specialization: string
    qualification: string
    experience_years: number
    consultation_minutes: number
    clinic_room: string | null
    is_active: boolean
    full_name?: string | null
  } | null
}

/**
 * Resolves user authorization and effective role strictly from the database relationship:
 * auth.uid() -> profiles.id -> profiles.role = 'doctor' -> doctors.profile_id = profiles.id -> doctors.is_active = true
 *
 * Never relies on client-provided or unverified user_metadata.
 *
 * @param supabase - Supabase client instance (works in browser, server, or middleware)
 * @param userId - Authenticated user's UUID (auth.uid())
 */
export async function resolveUserAuthorization(
  supabase: SupabaseClient<Database> | any,
  userId: string | null | undefined
): Promise<UserAuthorizationResult> {
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

  try {
    // Concurrently fetch profile and doctor records directly from the database
    const [profileRes, doctorRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, phone, role')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('doctors')
        .select('id, profile_id, department_id, specialization, qualification, experience_years, consultation_minutes, clinic_room, is_active')
        .eq('profile_id', userId)
        .maybeSingle(),
    ])

    const profile = profileRes.data || null
    const doctor = doctorRes.data || null

    const isAdmin = profile?.role === 'admin'

    // Doctor authorization strictly requires an active doctor record in public.doctors
    // associated with the user's profile ID (auth.uid() = profiles.id = doctors.profile_id)
    // where is_active is true, and the profile role reflects 'doctor'.
    const isAuthorizedDoctor = Boolean(
      profile?.role === 'doctor' &&
      doctor &&
      doctor.is_active === true &&
      doctor.profile_id === userId
    )

    let role: UserRole = 'patient'
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
  } catch (error) {
    console.error('Error resolving user authorization:', error)
    return {
      role: 'patient',
      isAuthorizedDoctor: false,
      isAdmin: false,
      isPatient: true,
      profile: null,
      doctor: null,
    }
  }
}
