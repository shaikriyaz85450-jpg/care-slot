'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface MarkNotificationResult {
  success: boolean
  error?: string
}

/**
 * Marks a single notification as read for the authenticated user.
 */
export async function markNotificationAsReadAction(
  notificationId: string
): Promise<MarkNotificationResult> {
  try {
    const supabase = await createClient()

    // 1. Authenticate user from session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        error: 'Please sign in to update notifications.',
      }
    }

    if (!notificationId) {
      return {
        success: false,
        error: 'Notification ID is required.',
      }
    }

    // 2. Update notification ensuring patient ownership (sets read_at timestamp)
    const nowIso = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read_at: nowIso } as any)
      .eq('id', notificationId)
      .eq('user_id', user.id)

    if (updateError) {
      // Fallback try with read: true if read boolean exists
      await supabase
        .from('notifications')
        .update({ read: true } as any)
        .eq('id', notificationId)
        .eq('user_id', user.id)
    }

    revalidatePath('/notifications')
    revalidatePath('/')

    return { success: true }
  } catch (err: any) {
    console.error('markNotificationAsReadAction error:', err)
    return {
      success: false,
      error: err?.message || 'Failed to update notification.',
    }
  }
}

/**
 * Marks all unread notifications as read for the authenticated user.
 */
export async function markAllNotificationsAsReadAction(): Promise<MarkNotificationResult> {
  try {
    const supabase = await createClient()

    // 1. Authenticate user from session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        error: 'Please sign in to update notifications.',
      }
    }

    // 2. Update all unread notifications for this user (read_at is null)
    const nowIso = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read_at: nowIso } as any)
      .eq('user_id', user.id)
      .is('read_at', null)

    if (updateError) {
      await supabase
        .from('notifications')
        .update({ read: true } as any)
        .eq('user_id', user.id)
        .eq('read', false)
    }

    revalidatePath('/notifications')
    revalidatePath('/')

    return { success: true }
  } catch (err: any) {
    console.error('markAllNotificationsAsReadAction error:', err)
    return {
      success: false,
      error: err?.message || 'Failed to update notifications.',
    }
  }
}
