export interface SeedDepartment {
  id: string
  name: string
  description: string
}

export interface SeedDoctor {
  id: string
  specialization: string
  qualification: string
  experience_years: number
  consultation_minutes: number
  clinic_name: string
  desk_location: string
  avatar_url?: string
  initials: string
  departments: {
    id: string
    name: string
  }
  profiles: {
    id: string
    full_name: string
  }
  doctor_daily_status: {
    id: string
    date: string
    status: 'available' | 'delayed' | 'on_leave' | 'not_checked_in'
    delay_minutes: number
    note?: string | null
  }[]
  slots_today?: string[]
}

export const SEED_DEPARTMENTS: SeedDepartment[] = [
  {
    id: 'd1111111-1111-1111-1111-111111111111',
    name: 'Cardiology',
    description: 'Heart & Vascular Clinic, diagnostic and interventional cardiovascular care',
  },
  {
    id: 'd2222222-2222-2222-2222-222222222222',
    name: 'General Medicine',
    description: 'Primary care, preventive medicine, and comprehensive adult internal medicine',
  },
  {
    id: 'd3333333-3333-3333-3333-333333333333',
    name: 'Pediatrics',
    description: 'Comprehensive child healthcare, developmental screenings, and immunizations',
  },
  {
    id: 'd4444444-4444-4444-4444-444444444444',
    name: 'Orthopedics',
    description: 'Joint replacement, spine care, sports injuries, and musculoskeletal treatment',
  },
  {
    id: 'd5555555-5555-5555-5555-555555555555',
    name: 'Dermatology',
    description: 'Clinical dermatology, skin disorders, allergic conditions, and minor procedures',
  },
  {
    id: 'd6666666-6666-6666-6666-666666666666',
    name: 'Neurology',
    description: 'Neurological disorders, headache management, and neuro-diagnostic lab',
  },
]

export const SEED_DOCTORS: SeedDoctor[] = [
  {
    id: 'c1111111-1111-1111-1111-111111111111',
    specialization: 'Cardiology',
    qualification: 'MBBS, MD (Cardiology), FACC',
    experience_years: 14,
    consultation_minutes: 20,
    clinic_name: 'Heart & Vascular Clinic',
    desk_location: 'Desk #402',
    avatar_url:
      'https://lh3.googleusercontent.com/aida/AEtjO1X4-puGOp40yfuPoXW-GG24DA32cFOFlHSN5PtXr4Un-Y6WNWhmyP9SfWpkJUc1--37kCxkxxqv8FfRUQ9N9XTM4YlA48eGX-fxR1MqkBdstRUkoh4ko-OBkEWH6FYHwztfr5FWqzdt8ai2kbLvN9wze6V6e_0YTapPdHQGf9-HMEfMst9nz_yTaXUWrIjrmbXq7FPNTAchkx_wMa902Tg7CJT4JpTQ0i_Mycj80RLvaB_7ShXY_LWCDGIi',
    initials: 'MV',
    departments: {
      id: 'd1111111-1111-1111-1111-111111111111',
      name: 'Cardiology',
    },
    profiles: {
      id: 'p1111111-1111-1111-1111-111111111111',
      full_name: 'Marcus Vance',
    },
    doctor_daily_status: [
      {
        id: 's1',
        date: new Date().toISOString().split('T')[0],
        status: 'available',
        delay_minutes: 0,
        note: 'On Schedule in Heart & Vascular Clinic',
      },
    ],
    slots_today: ['02:15 PM', '03:00 PM', '04:15 PM'],
  },
  {
    id: 'c2222222-2222-2222-2222-222222222222',
    specialization: 'Pediatrics',
    qualification: 'MBBS, MD (Pediatrics), FAAP',
    experience_years: 9,
    consultation_minutes: 15,
    clinic_name: 'Child Care Clinic',
    desk_location: 'Wing B, Rm 112',
    avatar_url:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBKwis4oOK5s55SqmY8fJiUQskvhxuTjOKYtr4pgUhj-Ljxu2GmOqO0qmdAc3HGkRjDKzq8F5HZ5n4ztGIS-V9iVu2qSCxks-puErT7hnNTnWegbRHvupyoyaiZSINk-y4lKB8w4rCE3hMRiKGvaLJ49i4NTozsQoMu6NUUa6dW2CDP1oQ7Gr-hRN5N5kSdwBLskbdDJlhzRE8e3JdDam-PTQpOfpuuPqiM6jKqh8du8KUjx8k_3oyZGg',
    initials: 'AC',
    departments: {
      id: 'd3333333-3333-3333-3333-333333333333',
      name: 'Pediatrics',
    },
    profiles: {
      id: 'p2222222-2222-2222-2222-222222222222',
      full_name: 'Alana Chen',
    },
    doctor_daily_status: [
      {
        id: 's2',
        date: new Date().toISOString().split('T')[0],
        status: 'available',
        delay_minutes: 0,
        note: 'On Schedule in Pediatric Clinic',
      },
    ],
    slots_today: ['01:45 PM', '02:30 PM', '03:15 PM'],
  },
  {
    id: 'c3333333-3333-3333-3333-333333333333',
    specialization: 'Dermatology',
    qualification: 'MBBS, MD (Dermatology), FAAD',
    experience_years: 11,
    consultation_minutes: 20,
    clinic_name: 'Skin & Allergy Clinic',
    desk_location: 'Floor 3, Rm 304',
    avatar_url:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCwEwBdoxtJOB9HGz6_uYa0F1QCDMOsfySZ7GrIruDEbvZqlfYIEzfNN0dxrS9Im4xEMn9Hm6nVqZDOhbVU2__-6GL85U1jZYPeI7WGIrlj2uQjji9xz_4F6Gy_OYwfDyl-6GkFoVPx9XSdjoILN1lOFCz0V6AoTXDDf6iMqI9WxZ_-S8htttKuUEXstitP-K3xFnZmh8cxEnTK3WrdrBZNFbTyJx4JFvLsw02pl186zNAXPg32YamRgw',
    initials: 'MC',
    departments: {
      id: 'd5555555-5555-5555-5555-555555555555',
      name: 'Dermatology',
    },
    profiles: {
      id: 'p3333333-3333-3333-3333-333333333333',
      full_name: 'Mei Ling Chen',
    },
    doctor_daily_status: [
      {
        id: 's3',
        date: new Date().toISOString().split('T')[0],
        status: 'delayed',
        delay_minutes: 25,
        note: 'Delayed ~25 min (Behind Schedule)',
      },
    ],
    slots_today: ['03:30 PM', '04:30 PM'],
  },
  {
    id: 'c4444444-4444-4444-4444-444444444444',
    specialization: 'Orthopedics',
    qualification: 'MBBS, MS (Ortho), FAAOS',
    experience_years: 18,
    consultation_minutes: 20,
    clinic_name: 'Joint & Spine Unit',
    desk_location: 'Clinic 2A',
    initials: 'RK',
    departments: {
      id: 'd4444444-4444-4444-4444-444444444444',
      name: 'Orthopedics',
    },
    profiles: {
      id: 'p4444444-4444-4444-4444-444444444444',
      full_name: 'Robert Kim',
    },
    doctor_daily_status: [
      {
        id: 's4',
        date: new Date().toISOString().split('T')[0],
        status: 'on_leave',
        delay_minutes: 0,
        note: 'On Leave Today • No Intake',
      },
    ],
    slots_today: [],
  },
  {
    id: 'c5555555-5555-5555-5555-555555555555',
    specialization: 'General Medicine',
    qualification: 'MBBS, MD (Internal Medicine)',
    experience_years: 12,
    consultation_minutes: 15,
    clinic_name: 'Primary Care Center',
    desk_location: 'Desk #105',
    initials: 'ER',
    departments: {
      id: 'd2222222-2222-2222-2222-222222222222',
      name: 'General Medicine',
    },
    profiles: {
      id: 'p5555555-5555-5555-5555-555555555555',
      full_name: 'Elena Rostova',
    },
    doctor_daily_status: [
      {
        id: 's5',
        date: new Date().toISOString().split('T')[0],
        status: 'available',
        delay_minutes: 0,
        note: 'Direct intake open',
      },
    ],
    slots_today: ['02:00 PM', '02:30 PM', '03:45 PM'],
  },
  {
    id: 'c6666666-6666-6666-6666-666666666666',
    specialization: 'Neurology',
    qualification: 'MBBS, DM (Neurology), FAAN',
    experience_years: 16,
    consultation_minutes: 30,
    clinic_name: 'Neuro-Diagnostic Lab',
    desk_location: 'Wing C, Rm 215',
    initials: 'JH',
    departments: {
      id: 'd6666666-6666-6666-6666-666666666666',
      name: 'Neurology',
    },
    profiles: {
      id: 'p6666666-6666-6666-6666-666666666666',
      full_name: 'Jonathan Hayes',
    },
    doctor_daily_status: [
      {
        id: 's6',
        date: new Date().toISOString().split('T')[0],
        status: 'delayed',
        delay_minutes: 15,
        note: 'Running behind schedule',
      },
    ],
    slots_today: ['04:15 PM'],
  },
]
