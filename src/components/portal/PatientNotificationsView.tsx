'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  markNotificationAsReadAction,
  markAllNotificationsAsReadAction,
} from '@/app/actions/notifications'

export interface NotificationItem {
  id: string
  user_id: string
  title: string
  body: string
  read: boolean
  created_at: string
}

export interface PatientNotificationsViewProps {
  user: {
    id: string
    email: string
  }
  profile: {
    id: string
    full_name: string
    phone?: string | null
    role: string
  } | null
  initialNotifications: NotificationItem[]
  upcomingCount?: number
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} mins ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return 'Recently'
  }
}

export function PatientNotificationsView({
  user,
  profile,
  initialNotifications,
  upcomingCount = 0,
}: PatientNotificationsViewProps) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications)
  const [currentFilter, setCurrentFilter] = useState<'all' | 'unread' | 'important'>('all')
  const [isMarkingAll, setIsMarkingAll] = useState(false)
  const [updatingIds, setUpdatingIds] = useState<Record<string, boolean>>({})

  // Supabase Realtime Listener on public.notifications for current user
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`patient-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const raw = payload.new as any
            const newNotif: NotificationItem = {
              id: raw.id,
              user_id: raw.user_id,
              title: raw.title,
              body: raw.body,
              read: Boolean(raw.read_at || raw.read),
              created_at: raw.created_at,
            }
            setNotifications((prev) => {
              if (prev.some((n) => n.id === newNotif.id)) return prev
              return [newNotif, ...prev]
            })
          } else if (payload.eventType === 'UPDATE') {
            const raw = payload.new as any
            const updated: NotificationItem = {
              id: raw.id,
              user_id: raw.user_id,
              title: raw.title,
              body: raw.body,
              read: Boolean(raw.read_at || raw.read),
              created_at: raw.created_at,
            }
            setNotifications((prev) =>
              prev.map((n) => (n.id === updated.id ? updated : n))
            )
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as any
            setNotifications((prev) => prev.filter((n) => n.id !== deleted.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user.id])

  // Categorization & Filtering helper
  const getNotificationCategory = (notif: NotificationItem): 'important' | 'updates' => {
    const title = notif.title.toLowerCase()
    const body = notif.body.toLowerCase()
    if (
      title.includes('delay') ||
      title.includes('delayed') ||
      title.includes('unavailable') ||
      title.includes('leave') ||
      title.includes('reschedule') ||
      body.includes('delayed by') ||
      body.includes('on leave')
    ) {
      return 'important'
    }
    return 'updates'
  }

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  )

  const importantCount = useMemo(
    () => notifications.filter((n) => getNotificationCategory(n) === 'important').length,
    [notifications]
  )

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (currentFilter === 'unread') return !n.read
      if (currentFilter === 'important') return getNotificationCategory(n) === 'important'
      return true
    })
  }, [notifications, currentFilter])

  // Single Mark As Read
  const handleMarkSingleRead = async (id: string) => {
    setUpdatingIds((prev) => ({ ...prev, [id]: true }))
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
    try {
      await markNotificationAsReadAction(id)
    } catch (err) {
      console.error('Failed to mark notification as read:', err)
    } finally {
      setUpdatingIds((prev) => ({ ...prev, [id]: false }))
    }
  }

  // Mark All As Read
  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || isMarkingAll) return
    setIsMarkingAll(true)
    // Optimistic UI update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    try {
      await markAllNotificationsAsReadAction()
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err)
    } finally {
      setIsMarkingAll(false)
    }
  }

  const patientName = profile?.full_name || 'Patient'

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased min-h-screen flex">
      {/* Desktop Sidebar Navigation */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-[260px] bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-50 flex-col justify-between">
        <div className="flex flex-col">
          {/* Logo & Identity */}
          <div className="h-16 px-space-md flex items-center gap-space-sm">
            <img
              alt="CareSlot Hospital Logo"
              className="h-8 w-auto object-contain"
              src="https://lh3.googleusercontent.com/aida/AEtjO1UOgZ_3KeLnkUk1iMA4lUKzfGeORs6HpDoBBDqCVCPYba9FOlRSoW3EyLO2a1zOczQIfWPJDWcKJHAKHQGpEN0WWC5hJZyxjifmVli76zjxIW9t65129bMZJ4N-RdsLmDajM3MwJdg5w4K1nqLKSLC1-uKfJEAqA2-OJlS3047bQe-GBd1MSUFgCTkmsUzKYLww86vqZ5nGOOeB8ePw3IcX3e4TiLyojYXSIPZh77C1oYIpkFPcRdWL562Y"
            />
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm text-primary tracking-tight font-bold">
                CareSlot
              </span>
              <span className="font-label-sm text-label-sm text-secondary">
                Patient Portal
              </span>
            </div>
          </div>

          {/* Hospital Branch */}
          <div className="px-space-md py-space-xs">
            <div className="bg-surface-container-low rounded-lg p-space-xs flex items-center justify-between">
              <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                Branch
              </span>
              <span className="font-label-sm text-label-sm text-on-surface font-semibold">
                Central Hospital
              </span>
            </div>
          </div>

          {/* Sidebar Nav Links */}
          <nav
            className="flex flex-col gap-1 px-space-md mt-space-sm"
            data-active-classes="bg-primary-container text-on-primary-container font-semibold rounded-lg"
          >
            <Link
              className="flex items-center justify-between px-space-sm py-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
              data-path="home"
              href="/"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px]">home</span>
                <span className="font-label-lg text-label-lg">Home</span>
              </div>
            </Link>

            <Link
              className="flex items-center justify-between px-space-sm py-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
              data-path="find-doctors"
              href="/doctors"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px]">stethoscope</span>
                <span className="font-label-lg text-label-lg">Find Doctors</span>
              </div>
            </Link>

            <Link
              className="flex items-center justify-between px-space-sm py-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
              data-path="my-appointments"
              href="/appointments"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px]">calendar_today</span>
                <span className="font-label-lg text-label-lg">My Appointments</span>
              </div>
              {upcomingCount > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold">
                  {upcomingCount}
                </span>
              )}
            </Link>

            <Link
              className="flex items-center justify-between px-space-sm py-2 rounded-lg bg-primary-container text-on-primary-container font-semibold"
              data-path="notifications"
              href="/notifications"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px]">notifications</span>
                <span className="font-label-lg text-label-lg">Notifications</span>
              </div>
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm font-semibold">
                  {unreadCount}
                </span>
              )}
            </Link>

            <Link
              className="flex items-center justify-between px-space-sm py-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
              data-path="profile"
              href="/profile"
            >
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[20px]">person</span>
                <span className="font-label-lg text-label-lg">Profile</span>
              </div>
            </Link>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-space-md flex flex-col gap-space-sm">
          <div className="flex flex-col gap-1">
            <a
              className="flex items-center gap-3 px-space-sm py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface font-label-md text-label-md transition-colors"
              data-path="help-support"
              href="#"
            >
              <span className="material-symbols-outlined text-[18px]">help</span>
              <span>Help &amp; Support</span>
            </a>
            <button
              className="flex items-center gap-3 px-space-sm py-1.5 rounded-lg text-error hover:bg-error-container/30 font-label-md text-label-md transition-colors text-left w-full"
              onClick={async () => {
                const supabase = createClient()
                await supabase.auth.signOut()
                router.push('/login')
              }}
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              <span>Log out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Page Content */}
      <div className="lg:pl-[260px] flex flex-col min-h-screen flex-1 w-full">
        {/* Top Header Bar */}
        <header className="fixed top-0 left-0 lg:left-[260px] right-0 h-16 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 px-space-md lg:px-space-xl flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <Link
              className="lg:hidden p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container focus:outline-none"
              href="/"
            >
              <span className="material-symbols-outlined text-[24px]">menu</span>
            </Link>
            <div className="flex items-center gap-space-xs lg:hidden">
              <img
                alt="CareSlot Hospital Logo"
                className="h-7 w-auto object-contain"
                src="https://lh3.googleusercontent.com/aida/AEtjO1UOgZ_3KeLnkUk1iMA4lUKzfGeORs6HpDoBBDqCVCPYba9FOlRSoW3EyLO2a1zOczQIfWPJDWcKJHAKHQGpEN0WWC5hJZyxjifmVli76zjxIW9t65129bMZJ4N-RdsLmDajM3MwJdg5w4K1nqLKSLC1-uKfJEAqA2-OJlS3047bQe-GBd1MSUFgCTkmsUzKYLww86vqZ5nGOOeB8ePw3IcX3e4TiLyojYXSIPZh77C1oYIpkFPcRdWL562Y"
              />
              <span className="font-headline-sm text-headline-sm text-primary font-bold">CareSlot</span>
            </div>
            <div className="hidden md:flex items-center bg-surface-container-low rounded-lg px-space-sm py-1.5 w-64 lg:w-80 gap-space-xs">
              <span className="material-symbols-outlined text-secondary text-[18px]">search</span>
              <span className="font-body-sm text-body-sm text-secondary truncate">
                Search doctors, specialties, clinics...
              </span>
            </div>
          </div>

          <div className="flex items-center gap-space-md">
            <div className="relative flex items-center">
              <Link
                aria-label="Notifications"
                className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors relative"
                href="/notifications"
              >
                <span className="material-symbols-outlined text-[22px]">notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error ring-2 ring-surface-container-lowest" />
                )}
              </Link>
            </div>
            <div className="flex items-center gap-space-sm pl-space-xs">
              <div className="hidden sm:flex flex-col text-right">
                <span className="font-label-lg text-label-lg text-on-surface font-semibold leading-tight">
                  {patientName}
                </span>
                <span className="font-label-sm text-label-sm text-secondary">
                  Patient
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container font-semibold flex items-center justify-center text-xs shadow-sm">
                {patientName.slice(0, 2).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Main Body */}
        <main className="w-full pt-16 pb-20 lg:pb-0 bg-surface flex-1">
          <div className="flex flex-col w-full">
            <div className="px-space-md lg:px-space-xl py-space-lg max-w-[1240px] w-full mx-auto flex flex-col gap-space-lg">
              {/* Breadcrumbs */}
              <nav aria-label="Breadcrumbs" className="flex items-center gap-2">
                <Link
                  className="font-label-md text-label-md text-secondary hover:text-primary transition-colors flex items-center gap-1"
                  href="/"
                >
                  <span className="material-symbols-outlined text-[16px]">home</span>
                  <span>Home</span>
                </Link>
                <span className="text-secondary/60 text-xs">/</span>
                <span className="font-label-md text-label-md text-on-surface font-medium">
                  Notifications
                </span>
              </nav>

              {/* Page Header Section */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md bg-surface-container-lowest p-space-lg rounded-xl shadow-sm">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <h1 className="font-display-lg text-headline-lg lg:text-display-lg text-on-surface tracking-tight font-bold">
                      Notifications
                    </h1>
                    {unreadCount > 0 ? (
                      <span
                        className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-label-sm text-label-sm font-semibold"
                        id="unread-counter-badge"
                      >
                        {unreadCount} Unread
                      </span>
                    ) : (
                      <span
                        className="px-2 py-0.5 rounded-full bg-surface-container text-secondary font-label-sm text-label-sm"
                        id="unread-counter-badge"
                      >
                        All Read
                      </span>
                    )}
                  </div>
                  <p className="font-body-md text-body-md text-secondary max-w-xl">
                    Stay updated about your appointments and doctor availability.
                  </p>
                </div>

                {/* Header Quick Actions */}
                <div className="flex items-center gap-space-sm self-start md:self-auto">
                  <button
                    className="flex items-center gap-2 px-space-md py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={unreadCount === 0 || isMarkingAll}
                    id="mark-all-read-btn"
                    onClick={handleMarkAllRead}
                  >
                    <span className="material-symbols-outlined text-[18px] text-primary">
                      done_all
                    </span>
                    <span>{isMarkingAll ? 'Marking read...' : 'Mark all as read'}</span>
                  </button>
                </div>
              </div>

              {/* Filter Tab Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
                <div
                  className="flex items-center gap-2 p-1 bg-surface-container-low rounded-xl w-fit overflow-x-auto max-w-full"
                  role="tablist"
                >
                  <button
                    aria-selected={currentFilter === 'all'}
                    className={`tab-btn px-4 py-2 rounded-lg font-label-md text-label-md transition-all ${
                      currentFilter === 'all'
                        ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                        : 'text-secondary hover:text-on-surface'
                    }`}
                    id="tab-all"
                    onClick={() => setCurrentFilter('all')}
                    role="tab"
                  >
                    All Notifications{' '}
                    <span className="ml-1 opacity-75 font-normal">
                      ({notifications.length})
                    </span>
                  </button>

                  <button
                    aria-selected={currentFilter === 'unread'}
                    className={`tab-btn px-4 py-2 rounded-lg font-label-md text-label-md transition-all ${
                      currentFilter === 'unread'
                        ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                        : 'text-secondary hover:text-on-surface'
                    }`}
                    id="tab-unread"
                    onClick={() => setCurrentFilter('unread')}
                    role="tab"
                  >
                    Unread{' '}
                    <span className="ml-1 opacity-75 font-normal">
                      ({unreadCount})
                    </span>
                  </button>

                  <button
                    aria-selected={currentFilter === 'important'}
                    className={`tab-btn px-4 py-2 rounded-lg font-label-md text-label-md transition-all ${
                      currentFilter === 'important'
                        ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                        : 'text-secondary hover:text-on-surface'
                    }`}
                    id="tab-important"
                    onClick={() => setCurrentFilter('important')}
                    role="tab"
                  >
                    Important Status Updates{' '}
                    <span className="ml-1 opacity-75 font-normal">
                      ({importantCount})
                    </span>
                  </button>
                </div>
              </div>

              {/* Main Notification Feeds Grid */}
              <div className="gap-space-lg flex flex-col">
                <div className="flex flex-col gap-space-md w-full" id="notification-list-container">
                  {filteredNotifications.length === 0 ? (
                    /* Empty State View */
                    <div
                      className="bg-surface-container-lowest rounded-xl p-12 shadow-sm text-center flex flex-col items-center justify-center gap-4"
                      id="empty-state-view"
                    >
                      <div className="w-16 h-16 rounded-full bg-surface-container-low flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-[36px]">
                          mark_email_read
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 max-w-sm">
                        <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                          You&apos;re all caught up!
                        </h3>
                        <p className="font-body-md text-body-md text-secondary">
                          {currentFilter === 'unread'
                            ? 'There are no unread notifications about your doctor availability or upcoming appointments.'
                            : currentFilter === 'important'
                            ? 'There are no active doctor delay or status alerts at this time.'
                            : 'No notifications found. Bookings and doctor availability updates will appear here.'}
                        </p>
                      </div>
                      {currentFilter !== 'all' ? (
                        <button
                          className="mt-2 px-4 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-primary font-label-md text-label-md transition-colors font-medium"
                          onClick={() => setCurrentFilter('all')}
                        >
                          Show all past notifications
                        </button>
                      ) : (
                        <Link
                          className="mt-2 px-4 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md transition-colors font-medium"
                          href="/doctors"
                        >
                          Explore Specialist Doctors
                        </Link>
                      )}
                    </div>
                  ) : (
                    filteredNotifications.map((notif) => {
                      const titleLower = notif.title.toLowerCase()
                      const bodyLower = notif.body.toLowerCase()

                      const isDelayed =
                        titleLower.includes('delay') || bodyLower.includes('delayed by')
                      const isOnLeave =
                        titleLower.includes('leave') ||
                        titleLower.includes('unavailable') ||
                        bodyLower.includes('on leave')
                      const isConfirmed =
                        titleLower.includes('confirmed') ||
                        bodyLower.includes('confirmed')
                      const isCancelled =
                        titleLower.includes('cancel') ||
                        bodyLower.includes('cancelled')

                      // Contextual extraction for metadata ribbon
                      const docMatch = notif.body.match(/Dr\.?\s+([A-Za-z\s]+?)(?=\s+is|\s+on|\s+has|\.|,|$)/i)
                      const docName = docMatch ? `Dr. ${docMatch[1].trim()}` : null

                      // Extract delay minutes if delayed
                      const delayMatch = notif.body.match(/(\d+)\s*minutes/i)
                      const delayMins = delayMatch ? delayMatch[1] : null

                      // Extract estimated or scheduled time if mentioned
                      const estTimeMatch = notif.body.match(/estimated for\s+([0-9]{1,2}:[0-9]{2}\s*(?:AM|PM)?)/i)
                      const estTime = estTimeMatch ? estTimeMatch[1] : null

                      const schedTimeMatch = notif.body.match(/at\s+([0-9]{1,2}:[0-9]{2}\s*(?:AM|PM)?)/i)
                      const schedTime = schedTimeMatch ? schedTimeMatch[1] : null

                      // 1. Doctor Schedule Delayed Card
                      if (isDelayed) {
                        return (
                          <article
                            key={notif.id}
                            className={`notification-item group relative bg-surface-container-lowest rounded-xl p-space-lg shadow-sm transition-all duration-200 hover:shadow-md flex flex-col gap-space-md ${
                              !notif.read
                                ? 'bg-gradient-to-r from-secondary-container/10 via-surface-container-lowest to-surface-container-lowest'
                                : 'opacity-90'
                            }`}
                            data-category="important"
                            data-status={notif.read ? 'read' : 'unread'}
                          >
                            <div className="flex items-start justify-between gap-space-md">
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                                  <span className="material-symbols-outlined text-[22px]">schedule</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
                                      {notif.title || 'Doctor Schedule Delayed'}
                                    </h2>
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-label-sm text-label-sm font-semibold">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                                      Important Doctor Status
                                    </span>
                                  </div>
                                  <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                                    {notif.body}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2 shrink-0">
                                <span className="font-label-sm text-label-sm text-secondary whitespace-nowrap">
                                  {formatRelativeTime(notif.created_at)}
                                </span>
                                {!notif.read && (
                                  <span
                                    className="unread-dot inline-block w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-primary/10"
                                    title="Unread notification"
                                  />
                                )}
                              </div>
                            </div>

                            {/* Metadata Ribbon */}
                            <div className="bg-surface-container-low rounded-lg p-3 flex flex-wrap items-center justify-between gap-space-sm font-label-md text-label-md">
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-on-surface">
                                <span className="flex items-center gap-1.5 font-semibold text-primary">
                                  <span className="material-symbols-outlined text-[18px]">stethoscope</span>
                                  {docName || 'Attending Physician'}
                                </span>
                                {schedTime && (
                                  <span className="text-secondary flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[16px]">schedule</span>
                                    Today at {schedTime}{' '}
                                    {estTime && (
                                      <strong className="text-amber-800 font-semibold">
                                        (Est. {estTime})
                                      </strong>
                                    )}
                                  </span>
                                )}
                                {delayMins && !estTime && (
                                  <span className="text-amber-800 font-semibold flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[16px]">timer</span>
                                    Delay: ~{delayMins} min
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Card Actions */}
                            <div className="flex items-center justify-between pt-1">
                              <div className="flex items-center gap-2">
                                <Link
                                  className="px-4 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md transition-colors inline-flex items-center gap-1.5 font-medium"
                                  href="/appointments"
                                >
                                  <span>View Related Appointment</span>
                                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                                </Link>
                              </div>
                              {!notif.read && (
                                <button
                                  className="mark-btn text-secondary hover:text-on-surface font-label-md text-label-md transition-colors px-2 py-1 rounded hover:bg-surface-container"
                                  disabled={updatingIds[notif.id]}
                                  onClick={() => handleMarkSingleRead(notif.id)}
                                >
                                  Mark as read
                                </button>
                              )}
                            </div>
                          </article>
                        )
                      }

                      // 2. Doctor Unavailable / Action Required Card
                      if (isOnLeave) {
                        return (
                          <article
                            key={notif.id}
                            className={`notification-item group relative bg-surface-container-lowest rounded-xl p-space-lg shadow-sm transition-all duration-200 hover:shadow-md flex flex-col gap-space-md ${
                              !notif.read
                                ? 'bg-gradient-to-r from-error-container/15 via-surface-container-lowest to-surface-container-lowest'
                                : 'opacity-90'
                            }`}
                            data-category="important"
                            data-status={notif.read ? 'read' : 'unread'}
                          >
                            <div className="flex items-start justify-between gap-space-md">
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-error-container text-error flex items-center justify-center shrink-0 mt-0.5">
                                  <span className="material-symbols-outlined text-[22px]">event_busy</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
                                      {notif.title || 'Doctor Unavailable — Reschedule Required'}
                                    </h2>
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-error-container text-error font-label-sm text-label-sm font-semibold">
                                      <span className="w-1.5 h-1.5 rounded-full bg-error" />
                                      Action Required
                                    </span>
                                  </div>
                                  <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                                    {notif.body}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2 shrink-0">
                                <span className="font-label-sm text-label-sm text-secondary whitespace-nowrap">
                                  {formatRelativeTime(notif.created_at)}
                                </span>
                                {!notif.read && (
                                  <span
                                    className="unread-dot inline-block w-2.5 h-2.5 rounded-full bg-error ring-4 ring-error-container"
                                    title="Unread urgent notification"
                                  />
                                )}
                              </div>
                            </div>

                            {/* Metadata Ribbon */}
                            <div className="bg-surface-container-low rounded-lg p-3 flex flex-wrap items-center justify-between gap-space-sm font-label-md text-label-md">
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-on-surface">
                                <span className="flex items-center gap-1.5 font-semibold text-on-surface">
                                  <span className="material-symbols-outlined text-[18px] text-secondary">
                                    stethoscope
                                  </span>
                                  {docName || 'Hospital Specialist'}
                                </span>
                                <span className="text-error font-medium flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[16px]">cancel</span>
                                  Doctor on Leave • Please Reschedule
                                </span>
                              </div>
                            </div>

                            {/* Card Actions */}
                            <div className="flex items-center justify-between pt-1">
                              <div className="flex items-center gap-2">
                                <Link
                                  className="px-4 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md transition-colors inline-flex items-center gap-1.5 font-medium"
                                  href="/appointments"
                                >
                                  <span className="material-symbols-outlined text-[16px]">update</span>
                                  <span>Reschedule Appointment</span>
                                </Link>
                              </div>
                              {!notif.read && (
                                <button
                                  className="mark-btn text-secondary hover:text-on-surface font-label-md text-label-md transition-colors px-2 py-1 rounded hover:bg-surface-container"
                                  disabled={updatingIds[notif.id]}
                                  onClick={() => handleMarkSingleRead(notif.id)}
                                >
                                  Mark as read
                                </button>
                              )}
                            </div>
                          </article>
                        )
                      }

                      // 3. Appointment Confirmed Card
                      if (isConfirmed) {
                        return (
                          <article
                            key={notif.id}
                            className={`notification-item group relative bg-surface-container-lowest rounded-xl p-space-lg shadow-sm transition-all duration-200 hover:shadow-md flex flex-col gap-space-md ${
                              notif.read ? 'opacity-90' : ''
                            }`}
                            data-category="updates"
                            data-status={notif.read ? 'read' : 'unread'}
                          >
                            <div className="flex items-start justify-between gap-space-md">
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-tertiary-fixed text-tertiary flex items-center justify-center shrink-0 mt-0.5">
                                  <span className="material-symbols-outlined text-[22px]">check_circle</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
                                      {notif.title || 'Appointment Confirmed'}
                                    </h2>
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold">
                                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                      Confirmed
                                    </span>
                                  </div>
                                  <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                                    {notif.body}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2 shrink-0">
                                <span className="font-label-sm text-label-sm text-secondary whitespace-nowrap">
                                  {formatRelativeTime(notif.created_at)}
                                </span>
                                {!notif.read && (
                                  <span
                                    className="unread-dot inline-block w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-primary/10"
                                    title="Unread notification"
                                  />
                                )}
                              </div>
                            </div>

                            {/* Metadata Ribbon */}
                            <div className="bg-surface-container-low rounded-lg p-3 flex flex-wrap items-center justify-between gap-space-sm font-label-md text-label-md">
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-on-surface">
                                <span className="flex items-center gap-1.5 font-medium text-on-surface">
                                  <span className="material-symbols-outlined text-[18px] text-secondary">
                                    stethoscope
                                  </span>
                                  {docName || 'Attending Physician'}
                                </span>
                                {schedTime && (
                                  <span className="text-secondary flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                                    Time: {schedTime}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Card Actions */}
                            <div className="flex items-center justify-between pt-1">
                              <div className="flex items-center gap-2">
                                <Link
                                  className="px-3.5 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md transition-colors inline-flex items-center gap-1.5 font-medium"
                                  href="/appointments"
                                >
                                  <span>View Related Appointment</span>
                                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                                </Link>
                              </div>
                              {!notif.read && (
                                <button
                                  className="mark-btn text-secondary hover:text-on-surface font-label-md text-label-md transition-colors px-2 py-1 rounded hover:bg-surface-container"
                                  disabled={updatingIds[notif.id]}
                                  onClick={() => handleMarkSingleRead(notif.id)}
                                >
                                  Mark as read
                                </button>
                              )}
                            </div>
                          </article>
                        )
                      }

                      // 4. Appointment Cancelled Card
                      if (isCancelled) {
                        return (
                          <article
                            key={notif.id}
                            className={`notification-item group relative bg-surface-container-lowest/80 rounded-xl p-space-lg shadow-sm transition-all duration-200 hover:shadow-md flex flex-col gap-space-md ${
                              notif.read ? 'opacity-90' : ''
                            }`}
                            data-category="updates"
                            data-status={notif.read ? 'read' : 'unread'}
                          >
                            <div className="flex items-start justify-between gap-space-md">
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-surface-container text-secondary flex items-center justify-center shrink-0 mt-0.5">
                                  <span className="material-symbols-outlined text-[22px]">event_busy</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="font-headline-sm text-headline-sm text-secondary font-medium tracking-tight">
                                      {notif.title || 'Appointment Cancelled'}
                                    </h2>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container text-secondary font-label-sm text-label-sm font-semibold">
                                      Cancelled
                                    </span>
                                  </div>
                                  <p className="font-body-md text-body-md text-secondary leading-relaxed">
                                    {notif.body}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2 shrink-0">
                                <span className="font-label-sm text-label-sm text-secondary/80 whitespace-nowrap">
                                  {formatRelativeTime(notif.created_at)}
                                </span>
                                {!notif.read && (
                                  <span
                                    className="unread-dot inline-block w-2.5 h-2.5 rounded-full bg-secondary ring-4 ring-secondary/10"
                                    title="Unread notification"
                                  />
                                )}
                              </div>
                            </div>

                            {/* Metadata Ribbon */}
                            <div className="bg-surface-container-low/70 rounded-lg p-3 flex flex-wrap items-center justify-between gap-space-sm font-label-md text-label-md">
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-secondary">
                                <span className="flex items-center gap-1.5 font-medium text-on-surface/90">
                                  <span className="material-symbols-outlined text-[18px]">stethoscope</span>
                                  {docName || 'Physician'}
                                </span>
                              </div>
                            </div>

                            {/* Card Actions */}
                            <div className="flex items-center justify-between pt-1">
                              <div className="flex items-center gap-3">
                                <Link
                                  className="px-3.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-primary font-label-md text-label-md transition-colors inline-flex items-center gap-1 font-semibold"
                                  href="/doctors"
                                >
                                  <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                                  <span>Book Again</span>
                                </Link>
                                <Link
                                  className="text-secondary hover:text-on-surface font-label-md text-label-md transition-colors px-2 py-1"
                                  href="/appointments"
                                >
                                  View Details
                                </Link>
                              </div>
                              {!notif.read && (
                                <button
                                  className="mark-btn text-secondary hover:text-on-surface font-label-md text-label-md transition-colors px-2 py-1 rounded hover:bg-surface-container"
                                  disabled={updatingIds[notif.id]}
                                  onClick={() => handleMarkSingleRead(notif.id)}
                                >
                                  Mark as read
                                </button>
                              )}
                            </div>
                          </article>
                        )
                      }

                      // 5. Default Notification Card (Reminders / General Alerts)
                      return (
                        <article
                          key={notif.id}
                          className={`notification-item group relative bg-surface-container-lowest/80 rounded-xl p-space-lg shadow-sm transition-all duration-200 hover:shadow-md flex flex-col gap-space-md ${
                            notif.read ? 'opacity-90' : ''
                          }`}
                          data-category="updates"
                          data-status={notif.read ? 'read' : 'unread'}
                        >
                          <div className="flex items-start justify-between gap-space-md">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-xl bg-surface-container text-secondary flex items-center justify-center shrink-0 mt-0.5">
                                <span className="material-symbols-outlined text-[22px]">
                                  notifications_active
                                </span>
                              </div>
                              <div className="flex flex-col gap-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h2 className="font-headline-sm text-headline-sm text-secondary font-medium tracking-tight">
                                    {notif.title}
                                  </h2>
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container-low text-secondary font-label-sm text-label-sm">
                                    Alert
                                  </span>
                                </div>
                                <p className="font-body-md text-body-md text-secondary leading-relaxed">
                                  {notif.body}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 shrink-0">
                              <span className="font-label-sm text-label-sm text-secondary/80 whitespace-nowrap">
                                {formatRelativeTime(notif.created_at)}
                              </span>
                              {!notif.read && (
                                <span
                                  className="unread-dot inline-block w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-primary/10"
                                  title="Unread notification"
                                />
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <Link
                              className="px-3.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-label-md text-label-md transition-colors inline-flex items-center gap-1.5 font-medium"
                              href="/appointments"
                            >
                              <span>View Related Appointment</span>
                            </Link>
                            {!notif.read && (
                              <button
                                className="mark-btn text-secondary hover:text-on-surface font-label-md text-label-md transition-colors px-2 py-1 rounded hover:bg-surface-container"
                                disabled={updatingIds[notif.id]}
                                onClick={() => handleMarkSingleRead(notif.id)}
                              >
                                Mark as read
                              </button>
                            )}
                          </div>
                        </article>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav
          className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-container-lowest shadow-[0_-1px_8px_rgba(0,0,0,0.04)] z-40 flex items-center justify-around px-2"
          data-active-classes="text-primary font-semibold"
        >
          <Link
            className="flex flex-col items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors py-1 flex-1"
            data-path="home"
            href="/"
          >
            <span className="material-symbols-outlined text-[22px]">home</span>
            <span className="font-label-sm text-label-sm mt-0.5">Home</span>
          </Link>
          <Link
            className="flex flex-col items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors py-1 flex-1"
            data-path="find-doctors"
            href="/doctors"
          >
            <span className="material-symbols-outlined text-[22px]">stethoscope</span>
            <span className="font-label-sm text-label-sm mt-0.5">Doctors</span>
          </Link>
          <Link
            className="flex flex-col items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors py-1 flex-1 relative"
            data-path="my-appointments"
            href="/appointments"
          >
            <span className="material-symbols-outlined text-[22px]">calendar_today</span>
            <span className="font-label-sm text-label-sm mt-0.5">Bookings</span>
            {upcomingCount > 0 && (
              <span className="absolute top-1 right-5 w-4 h-4 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-[10px] flex items-center justify-center font-bold">
                {upcomingCount}
              </span>
            )}
          </Link>
          <Link
            className="flex flex-col items-center justify-center text-primary font-semibold py-1 flex-1 relative"
            data-path="notifications"
            href="/notifications"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            <span className="font-label-sm text-label-sm mt-0.5">Alerts</span>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-5 w-4 h-4 rounded-full bg-error-container text-on-error-container font-label-sm text-[10px] flex items-center justify-center font-bold">
                {unreadCount}
              </span>
            )}
          </Link>
          <Link
            className="flex flex-col items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors py-1 flex-1"
            data-path="profile"
            href="/profile"
          >
            <span className="material-symbols-outlined text-[22px]">person</span>
            <span className="font-label-sm text-label-sm mt-0.5">Profile</span>
          </Link>
        </nav>
      </div>
    </div>
  )
}
