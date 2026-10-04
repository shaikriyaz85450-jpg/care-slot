import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a YYYY-MM-DD date string into a friendly label like "Today", "Tomorrow", or "Sun, Oct 4".
 */
export function formatDate(dateString: string): string {
  if (!dateString) return ''
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [year, month, day] = dateString.split('-').map(Number)
    const target = new Date(year, month - 1, day)
    target.setHours(0, 0, 0, 0)

    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Tomorrow'
    if (diffDays === -1) return 'Yesterday'

    return target.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateString
  }
}

/**
 * Formats time from "HH:MM:SS" or "HH:MM" to "10:30 AM"
 */
export function formatTime(timeString: string): string {
  if (!timeString) return ''
  try {
    const [hours, minutes] = timeString.split(':')
    const h = parseInt(hours, 10)
    const m = parseInt(minutes, 10)
    const period = h >= 12 ? 'PM' : 'AM'
    const formattedHours = h % 12 === 0 ? 12 : h % 12
    const formattedMinutes = m < 10 ? `0${m}` : m
    return `${formattedHours}:${formattedMinutes} ${period}`
  } catch {
    return timeString
  }
}

/**
 * Formats an ISO date string into relative time e.g. "10 minutes ago", "2 hours ago", "Yesterday"
 */
export function formatRelativeTime(dateString: string): string {
  if (!dateString) return ''
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffSeconds < 60) return 'Just now'
    const diffMinutes = Math.floor(diffSeconds / 60)
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateString
  }
}
