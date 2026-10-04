import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database, UserRole } from '@/types/database.types'
import { resolveUserAuthorization } from '@/lib/role-utils'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse
  }

  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid getSession() in middleware/proxy as it only reads cookies without validating.
  // getUser() validates the auth token against Supabase Auth servers.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Protected route prefixes
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/signup')
  const isPatientProtectedRoute =
    pathname.startsWith('/appointments') ||
    pathname.startsWith('/notifications') ||
    pathname.startsWith('/profile') ||
    pathname === '/home'
  const isDoctorRoute = pathname === '/doctor' || pathname.startsWith('/doctor/')
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/')

  // Helper to construct redirects while preserving refreshed auth cookies
  const createRedirectResponse = (targetPath: string) => {
    const url = request.nextUrl.clone()
    url.pathname = targetPath
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return redirectResponse
  }

  // 1. Unauthenticated users trying to access protected sections
  if (!user && (isPatientProtectedRoute || isDoctorRoute || isAdminRoute)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('redirectTo', pathname)
    const redirectResponse = NextResponse.redirect(redirectUrl)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
    })
    return redirectResponse
  }

  // 2. Authenticated users
  if (user) {
    // Resolve user authorization from the database relationship:
    // auth.uid() -> profiles.id -> profiles.role = 'doctor' -> doctors.profile_id = profiles.id -> doctors.is_active = true
    const authResult = await resolveUserAuthorization(supabase, user.id)
    const role = authResult.role

    // Authenticated user accessing /login or /signup -> redirect to their role home
    if (isAuthRoute) {
      if (role === 'admin') return createRedirectResponse('/admin')
      if (role === 'doctor') return createRedirectResponse('/doctor/dashboard')
      return createRedirectResponse('/')
    }

    // Role-based authorization guards:
    // Only authorized doctors or admins can access /doctor/*
    if (isDoctorRoute && !authResult.isAuthorizedDoctor && !authResult.isAdmin) {
      return createRedirectResponse('/')
    }

    // Only admins can access /admin/*
    if (isAdminRoute && !authResult.isAdmin) {
      return createRedirectResponse('/')
    }
  }

  return supabaseResponse
}
