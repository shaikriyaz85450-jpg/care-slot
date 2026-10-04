import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveUserAuthorization } from '@/lib/role-utils'
import type { Profile, UserRole } from '@/types'

/**
 * Retrieves the currently authenticated user and their profile.
 * Validates the auth session server-side using getUser().
 */
export async function getCurrentUser(): Promise<{
  user: import('@supabase/supabase-js').User | null
  profile: Profile | null
}> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { user: null, profile: null }
  }

  const authResult = await resolveUserAuthorization(supabase, user.id)

  return { user, profile: authResult.profile as Profile | null }
}

/**
 * Server guard: requires the user to be logged in.
 * Redirects unauthenticated requests to /login.
 */
export async function requireUser() {
  const { user, profile } = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  return { user, profile }
}

/**
 * Server guard: requires the user to have a specific role based on the database relationship:
 * auth.uid() -> profiles.id -> profiles.role = 'doctor' -> doctors.profile_id = profiles.id -> doctors.is_active = true
 * Redirects unauthorized requests appropriately.
 */
export async function requireRole(allowedRoles: UserRole | UserRole[]) {
  const { user } = await requireUser()
  const supabase = await createClient()
  const authResult = await resolveUserAuthorization(supabase, user.id)
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]

  if (!roles.includes(authResult.role)) {
    redirect('/')
  }

  return { user, profile: authResult.profile as Profile | null, role: authResult.role }
}

export { resolveUserAuthorization } from '@/lib/role-utils'
export { signOutAction } from '@/app/actions/auth'
