-- ==============================================================================
-- CareSlot Step 4 Seed Data: Realistic Clinical Departments and Specialists
-- Execute this script in the Supabase SQL Editor to populate departments,
-- doctor profiles, doctor entries, weekly schedules, and daily statuses.
-- ==============================================================================

-- 1. CLINICAL DEPARTMENTS
INSERT INTO public.departments (id, name, description)
VALUES
    ('d1111111-1111-1111-1111-111111111111', 'Cardiology', 'Heart & Vascular Clinic, diagnostic and interventional cardiovascular care'),
    ('d2222222-2222-2222-2222-222222222222', 'General Medicine', 'Primary care, preventive medicine, and comprehensive adult internal medicine'),
    ('d3333333-3333-3333-3333-333333333333', 'Pediatrics', 'Comprehensive child healthcare, developmental screenings, and immunizations'),
    ('d4444444-4444-4444-4444-444444444444', 'Orthopedics', 'Joint replacement, spine care, sports injuries, and musculoskeletal treatment'),
    ('d5555555-5555-5555-5555-555555555555', 'Dermatology', 'Clinical dermatology, skin disorders, allergic conditions, and minor procedures'),
    ('d6666666-6666-6666-6666-666666666666', 'Neurology', 'Neurological disorders, headache management, and neuro-diagnostic lab')
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description;

-- 2. DOCTOR PROFILES (Associated with role = 'doctor')
INSERT INTO public.profiles (id, full_name, phone, role)
VALUES
    ('p1111111-1111-1111-1111-111111111111', 'Marcus Vance', '+1555100001', 'doctor'),
    ('p2222222-2222-2222-2222-222222222222', 'Alana Chen', '+1555100002', 'doctor'),
    ('p3333333-3333-3333-3333-333333333333', 'Mei Ling Chen', '+1555100003', 'doctor'),
    ('p4444444-4444-4444-4444-444444444444', 'Robert Kim', '+1555100004', 'doctor'),
    ('p5555555-5555-5555-5555-555555555555', 'Elena Rostova', '+1555100005', 'doctor'),
    ('p6666666-6666-6666-6666-666666666666', 'Jonathan Hayes', '+1555100006', 'doctor')
ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = 'doctor';

-- 3. DOCTORS DIRECTORY
INSERT INTO public.doctors (id, profile_id, department_id, specialization, qualification, experience_years, consultation_minutes)
VALUES
    ('c1111111-1111-1111-1111-111111111111', 'p1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'Cardiology', 'MBBS, MD (Cardiology), FACC', 14, 20),
    ('c2222222-2222-2222-2222-222222222222', 'p2222222-2222-2222-2222-222222222222', 'd3333333-3333-3333-3333-333333333333', 'Pediatrics', 'MBBS, MD (Pediatrics), FAAP', 9, 15),
    ('c3333333-3333-3333-3333-333333333333', 'p3333333-3333-3333-3333-333333333333', 'd5555555-5555-5555-5555-555555555555', 'Dermatology', 'MBBS, MD (Dermatology), FAAD', 11, 20),
    ('c4444444-4444-4444-4444-444444444444', 'p4444444-4444-4444-4444-444444444444', 'd4444444-4444-4444-4444-444444444444', 'Orthopedics', 'MBBS, MS (Ortho), FAAOS', 18, 20),
    ('c5555555-5555-5555-5555-555555555555', 'p5555555-5555-5555-5555-555555555555', 'd2222222-2222-2222-2222-222222222222', 'General Medicine', 'MBBS, MD (Internal Medicine)', 12, 15),
    ('c6666666-6666-6666-6666-666666666666', 'p6666666-6666-6666-6666-666666666666', 'd6666666-6666-6666-6666-666666666666', 'Neurology', 'MBBS, DM (Neurology), FAAN', 16, 30)
ON CONFLICT (id) DO UPDATE SET
    specialization = EXCLUDED.specialization,
    qualification = EXCLUDED.qualification,
    experience_years = EXCLUDED.experience_years,
    consultation_minutes = EXCLUDED.consultation_minutes;

-- 4. WEEKLY SCHEDULES (Weekdays: Mon-Fri from 09:00 to 17:00)
INSERT INTO public.doctor_schedules (doctor_id, weekday, start_time, end_time)
SELECT
    d.id,
    w.weekday,
    '09:00:00'::TIME,
    '17:00:00'::TIME
FROM public.doctors d
CROSS JOIN (VALUES (1), (2), (3), (4), (5)) AS w(weekday)
ON CONFLICT DO NOTHING;

-- 5. TODAY'S LIVE CLINICAL AVAILABILITY STATUS
INSERT INTO public.doctor_daily_status (doctor_id, date, status, delay_minutes, note)
VALUES
    ('c1111111-1111-1111-1111-111111111111', CURRENT_DATE, 'available', 0, 'On schedule in Heart & Vascular Clinic'),
    ('c2222222-2222-2222-2222-222222222222', CURRENT_DATE, 'available', 0, 'Accepting routine pediatric visits'),
    ('c3333333-3333-3333-3333-333333333333', CURRENT_DATE, 'delayed', 25, 'Delayed by 25 min due to procedural case'),
    ('c4444444-4444-4444-4444-444444444444', CURRENT_DATE, 'on_leave', 0, 'On emergency leave, back tomorrow'),
    ('c5555555-5555-5555-5555-555555555555', CURRENT_DATE, 'available', 0, 'Direct intake open in Desk 105'),
    ('c6666666-6666-6666-6666-666666666666', CURRENT_DATE, 'delayed', 15, 'Delayed by 15 min')
ON CONFLICT (doctor_id, date) DO UPDATE SET
    status = EXCLUDED.status,
    delay_minutes = EXCLUDED.delay_minutes,
    note = EXCLUDED.note;
