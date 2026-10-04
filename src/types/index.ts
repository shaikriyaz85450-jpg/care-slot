export * from './database.types'

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Department = Database['public']['Tables']['departments']['Row']
export type Doctor = Database['public']['Tables']['doctors']['Row']
export type DoctorSchedule = Database['public']['Tables']['doctor_schedules']['Row']
export type DoctorDailyStatus = Database['public']['Tables']['doctor_daily_status']['Row']
export type Appointment = Database['public']['Tables']['appointments']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']

import type { Database } from './database.types'

export interface DoctorWithDetails extends Doctor {
  profile: Profile
  department: Department
  today_status?: DoctorDailyStatus | null
}
