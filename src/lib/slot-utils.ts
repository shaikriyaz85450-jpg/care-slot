import { formatTime } from './utils'
import type { DoctorSchedule } from '@/types'

export interface DateOption {
  dateStr: string // 'YYYY-MM-DD'
  fullLabel: string // 'Thursday, Oct 24, 2026'
  dayNumber: number // 24
  dayName: string // 'Thu'
  topLabel: string // 'Today', 'Tomorrow', 'Weekend', etc.
  weekday: number // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
}

export interface GeneratedSlot {
  startTime: string // '09:00:00'
  endTime: string // '09:20:00'
  formattedTime: string // '09:00 AM'
  period: 'morning' | 'afternoon'
  isBooked: boolean
  isPast: boolean
  isAvailable: boolean
}

/**
 * Generates 5 consecutive dates starting from today.
 */
export function generateDateOptions(startDate: Date = new Date(), numDays: number = 5): DateOption[] {
  const options: DateOption[] = []
  
  for (let i = 0; i < numDays; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    
    const weekday = d.getDay()
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' })
    const fullLabel = d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    
    let topLabel = d.toLocaleDateString('en-US', { month: 'short' })
    if (i === 0) {
      topLabel = 'Today'
    } else if (i === 1) {
      topLabel = 'Tomorrow'
    } else if (weekday === 0 || weekday === 6) {
      topLabel = 'Weekend'
    }
    
    options.push({
      dateStr,
      fullLabel,
      dayNumber: d.getDate(),
      dayName,
      topLabel,
      weekday,
    })
  }
  
  return options
}

/**
 * Calculates slot end time given start time ('HH:MM:SS' or 'HH:MM') and consultation minutes.
 */
export function calculateEndTime(startTime: string, minutes: number): string {
  const [hStr, mStr] = startTime.split(':')
  const totalMins = parseInt(hStr, 10) * 60 + parseInt(mStr, 10) + minutes
  const endH = Math.floor(totalMins / 60) % 24
  const endM = totalMins % 60
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`
}

/**
 * Normalizes time string to 'HH:MM:SS'
 */
export function normalizeTime(time: string): string {
  if (!time) return '00:00:00'
  const parts = time.split(':')
  const h = parts[0].padStart(2, '0')
  const m = (parts[1] || '00').padStart(2, '0')
  const s = (parts[2] || '00').padStart(2, '0')
  return `${h}:${m}:${s}`
}

/**
 * Converts HH:MM:SS or HH:MM to total minutes from midnight
 */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

/**
 * Generates morning (< 12:00 PM) and afternoon (>= 12:00 PM) slots from doctor schedule
 */
export function generateSlotsForDoctor(params: {
  dateStr: string
  weekday: number
  schedules: Array<Pick<DoctorSchedule, 'weekday' | 'start_time' | 'end_time'>>
  consultationMinutes: number
  bookedTimes: string[]
  isToday: boolean
  isOnLeave: boolean
  leadTimeMinutes?: number
}): {
  morningSlots: GeneratedSlot[]
  afternoonSlots: GeneratedSlot[]
  totalAvailable: number
} {
  const {
    dateStr,
    weekday,
    schedules,
    consultationMinutes = 20,
    bookedTimes,
    isToday,
    isOnLeave,
    leadTimeMinutes = 15,
  } = params

  if (isOnLeave) {
    return { morningSlots: [], afternoonSlots: [], totalAvailable: 0 }
  }

  // Find schedule matching weekday
  const matchingSchedules = schedules.filter((s) => s.weekday === weekday)
  if (matchingSchedules.length === 0) {
    return { morningSlots: [], afternoonSlots: [], totalAvailable: 0 }
  }

  // Normalized booked times set for O(1) lookup
  const bookedSet = new Set(bookedTimes.map((t) => normalizeTime(t).substring(0, 5)))

  // Calculate cutoff minutes if today
  const now = new Date()
  const currentTotalMins = now.getHours() * 60 + now.getMinutes()
  const cutoffMinutes = isToday ? currentTotalMins + leadTimeMinutes : -1

  const morningSlots: GeneratedSlot[] = []
  const afternoonSlots: GeneratedSlot[] = []
  let totalAvailable = 0

  for (const sched of matchingSchedules) {
    const startMins = timeToMinutes(sched.start_time)
    const endMins = timeToMinutes(sched.end_time)
    const step = Math.max(10, consultationMinutes)

    for (let current = startMins; current + step <= endMins; current += step) {
      // Hospital OPD lunch/break: skip 12:00 PM to 01:00 PM (720 to 780 mins)
      if (current >= 720 && current < 780) {
        continue
      }

      const h = Math.floor(current / 60)
      const m = current % 60
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
      const shortTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

      const slotEndTime = calculateEndTime(timeStr, step)
      const formattedTime = formatTime(timeStr)

      const isBooked = bookedSet.has(shortTime)
      const isPast = isToday && current <= cutoffMinutes
      const isAvailable = !isBooked && !isPast

      if (isAvailable) {
        totalAvailable++
      }

      const slotObj: GeneratedSlot = {
        startTime: timeStr,
        endTime: slotEndTime,
        formattedTime,
        period: current < 720 ? 'morning' : 'afternoon',
        isBooked,
        isPast,
        isAvailable,
      }

      if (current < 720) {
        morningSlots.push(slotObj)
      } else {
        afternoonSlots.push(slotObj)
      }
    }
  }

  return { morningSlots, afternoonSlots, totalAvailable }
}
