export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'patient' | 'doctor' | 'admin'
export type DoctorDailyStatusType = 'available' | 'delayed' | 'on_leave' | 'not_checked_in'
export type AppointmentStatusType = 'booked' | 'cancelled' | 'completed' | 'no_show'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          phone: string | null
          role: UserRole
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          phone?: string | null
          role?: UserRole
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          phone?: string | null
          role?: UserRole
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          id: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          created_at?: string
        }
        Relationships: []
      }
      doctors: {
        Row: {
          id: string
          profile_id: string
          department_id: string
          full_name?: string | null
          photo_url?: string | null
          specialization: string
          qualification: string
          experience_years: number
          consultation_minutes: number
          clinic_room?: string | null
          is_active: boolean
          created_at: string
          updated_at?: string
        }
        Insert: {
          id?: string
          profile_id: string
          department_id: string
          full_name?: string | null
          photo_url?: string | null
          specialization: string
          qualification: string
          experience_years?: number
          consultation_minutes?: number
          clinic_room?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          department_id?: string
          full_name?: string | null
          photo_url?: string | null
          specialization?: string
          qualification?: string
          experience_years?: number
          consultation_minutes?: number
          clinic_room?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'doctors_department_id_fkey'
            columns: ['department_id']
            isOneToOne: false
            referencedRelation: 'departments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'doctors_profile_id_fkey'
            columns: ['profile_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      doctor_schedules: {
        Row: {
          id: string
          doctor_id: string
          weekday: number
          start_time: string
          end_time: string
          created_at: string
        }
        Insert: {
          id?: string
          doctor_id: string
          weekday: number
          start_time: string
          end_time: string
          created_at?: string
        }
        Update: {
          id?: string
          doctor_id?: string
          weekday?: number
          start_time?: string
          end_time?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'doctor_schedules_doctor_id_fkey'
            columns: ['doctor_id']
            isOneToOne: false
            referencedRelation: 'doctors'
            referencedColumns: ['id']
          }
        ]
      }
      doctor_daily_status: {
        Row: {
          id: string
          doctor_id: string
          date: string
          status: DoctorDailyStatusType
          delay_minutes: number
          note: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          doctor_id: string
          date?: string
          status?: DoctorDailyStatusType
          delay_minutes?: number
          note?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          doctor_id?: string
          date?: string
          status?: DoctorDailyStatusType
          delay_minutes?: number
          note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'doctor_daily_status_doctor_id_fkey'
            columns: ['doctor_id']
            isOneToOne: false
            referencedRelation: 'doctors'
            referencedColumns: ['id']
          }
        ]
      }
      appointments: {
        Row: {
          id: string
          patient_id: string
          doctor_id: string
          date: string
          appointment_date?: string
          start_time: string
          end_time: string
          status: AppointmentStatusType
          reason: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          doctor_id: string
          date?: string
          appointment_date?: string
          start_time: string
          end_time: string
          status?: AppointmentStatusType
          reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          doctor_id?: string
          date?: string
          appointment_date?: string
          start_time?: string
          end_time?: string
          status?: AppointmentStatusType
          reason?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'appointments_doctor_id_fkey'
            columns: ['doctor_id']
            isOneToOne: false
            referencedRelation: 'doctors'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'appointments_patient_id_fkey'
            columns: ['patient_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          body: string
          type?: string | null
          read_at?: string | null
          read?: boolean
          appointment_id?: string | null
          doctor_id?: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          body: string
          type?: string | null
          read_at?: string | null
          appointment_id?: string | null
          doctor_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          body?: string
          type?: string | null
          read_at?: string | null
          appointment_id?: string | null
          doctor_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notifications_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_doctor: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      get_doctor_id_for_auth_user: {
        Args: Record<PropertyKey, never>
        Returns: string | null
      }
      get_user_role: {
        Args: {
          user_uuid: string
        }
        Returns: string | null
      }
    }
    Enums: {
      user_role: UserRole
      doctor_daily_status_type: DoctorDailyStatusType
      appointment_status_type: AppointmentStatusType
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
