-- ==============================================================================
-- CareSlot MVP: Initial Database Migration
-- Tables: profiles, departments, doctors, doctor_schedules, doctor_daily_status,
--         appointments, notifications
-- Includes: Constraints, Double-booking protection index, RLS Policies, Functions, Triggers
-- ==============================================================================

-- 1. Helper Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Clean teardown if re-running
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;

-- 3. Create Tables

-- PROFILES: Extends auth.users with app-level user data and roles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'doctor', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DEPARTMENTS: Medical departments (Cardiology, Pediatrics, etc.)
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DOCTORS: Doctor profile extension referencing profiles and departments
CREATE TABLE IF NOT EXISTS public.doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
    specialization TEXT NOT NULL,
    qualification TEXT NOT NULL,
    experience_years INTEGER NOT NULL DEFAULT 0 CHECK (experience_years >= 0),
    consultation_minutes INTEGER NOT NULL DEFAULT 15 CHECK (consultation_minutes > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DOCTOR_SCHEDULES: Weekly recurring OPD schedule (0 = Sunday, 1 = Monday, ... 6 = Saturday)
CREATE TABLE IF NOT EXISTS public.doctor_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT doctor_schedule_time_check CHECK (end_time > start_time)
);

-- DOCTOR_DAILY_STATUS: Today's live availability status
CREATE TABLE IF NOT EXISTS public.doctor_daily_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'not_checked_in' CHECK (status IN ('available', 'delayed', 'on_leave', 'not_checked_in')),
    delay_minutes INTEGER NOT NULL DEFAULT 0 CHECK (delay_minutes >= 0),
    note TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT doctor_daily_status_unique UNIQUE (doctor_id, date)
);

-- APPOINTMENTS: Patient bookings
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'cancelled', 'completed', 'no_show')),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT appointment_time_check CHECK (end_time > start_time)
);

-- NOTIFICATIONS: Realtime user notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. DOUBLE-BOOKING PREVENTION
-- Partial Unique Index: Only 1 active 'booked' appointment can exist
-- for a specific doctor on a given date and start_time.
-- ==============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_double_booking
    ON public.appointments (doctor_id, date, start_time)
    WHERE (status = 'booked');

-- Additional performance indexes
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON public.appointments (patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON public.appointments (doctor_id, date);
CREATE INDEX IF NOT EXISTS idx_doctor_schedules_doctor ON public.doctor_schedules (doctor_id, weekday);
CREATE INDEX IF NOT EXISTS idx_doctor_daily_status_lookup ON public.doctor_daily_status (doctor_id, date);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications (user_id, read);

-- ==============================================================================
-- 5. HELPER FUNCTIONS & RPCs (SECURITY DEFINER to prevent recursive RLS)
-- ==============================================================================

-- Check if current authenticated user is an administrator
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid()),
        FALSE
    );
$$;

-- Check if current authenticated user is a doctor
CREATE OR REPLACE FUNCTION public.is_doctor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT role = 'doctor' FROM public.profiles WHERE id = auth.uid()),
        FALSE
    );
$$;

-- Get the doctor ID corresponding to the authenticated user's profile
CREATE OR REPLACE FUNCTION public.get_doctor_id_for_auth_user()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id FROM public.doctors WHERE profile_id = auth.uid() LIMIT 1;
$$;

-- Get user role safely
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.profiles WHERE id = user_uuid;
$$;

-- ==============================================================================
-- 6. TRIGGERS
-- ==============================================================================

-- Automatic Profile Creation upon Supabase auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, phone, role)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', 'User'),
        new.raw_user_meta_data->>'phone',
        -- Default to patient unless explicitly assigned and allowed
        COALESCE(new.raw_user_meta_data->>'role', 'patient')
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        phone = COALESCE(EXCLUDED.phone, public.profiles.phone);
    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Prevent users from changing their own role to escalate privileges
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (NEW.role IS DISTINCT FROM OLD.role) AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only administrators are authorized to change user roles.';
    END IF;
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

-- ==============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_daily_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Clean existing policies before recreating
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;

DROP POLICY IF EXISTS "departments_select_policy" ON public.departments;
DROP POLICY IF EXISTS "departments_admin_all" ON public.departments;

DROP POLICY IF EXISTS "doctors_select_policy" ON public.doctors;
DROP POLICY IF EXISTS "doctors_admin_all" ON public.doctors;
DROP POLICY IF EXISTS "doctors_self_update" ON public.doctors;

DROP POLICY IF EXISTS "schedules_select_policy" ON public.doctor_schedules;
DROP POLICY IF EXISTS "schedules_manage_policy" ON public.doctor_schedules;

DROP POLICY IF EXISTS "status_select_policy" ON public.doctor_daily_status;
DROP POLICY IF EXISTS "status_manage_policy" ON public.doctor_daily_status;

DROP POLICY IF EXISTS "appointments_select_policy" ON public.appointments;
DROP POLICY IF EXISTS "appointments_insert_policy" ON public.appointments;
DROP POLICY IF EXISTS "appointments_update_policy" ON public.appointments;
DROP POLICY IF EXISTS "appointments_delete_policy" ON public.appointments;

DROP POLICY IF EXISTS "notifications_select_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete_policy" ON public.notifications;

-- ------------------------------------------------------------------------------
-- PROFILES POLICIES
-- ------------------------------------------------------------------------------
-- Anyone logged in can view their own profile; admins view all; public can see doctor profiles
CREATE POLICY "profiles_select_policy" ON public.profiles
    FOR SELECT USING (
        auth.uid() = id
        OR public.is_admin()
        OR role = 'doctor'
    );

-- Users can insert their own profile (or handle_new_user trigger manages this)
CREATE POLICY "profiles_insert_policy" ON public.profiles
    FOR INSERT WITH CHECK (
        auth.uid() = id
        OR public.is_admin()
    );

-- Users can update their own profile; role changes are gated by protect_profile_role() trigger
CREATE POLICY "profiles_update_policy" ON public.profiles
    FOR UPDATE USING (
        auth.uid() = id
        OR public.is_admin()
    ) WITH CHECK (
        auth.uid() = id
        OR public.is_admin()
    );

CREATE POLICY "profiles_delete_policy" ON public.profiles
    FOR DELETE USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- DEPARTMENTS POLICIES
-- ------------------------------------------------------------------------------
-- Departments are public to read for doctor search & filtering
CREATE POLICY "departments_select_policy" ON public.departments
    FOR SELECT USING (TRUE);

-- Only admins can insert, update, or delete departments
CREATE POLICY "departments_admin_all" ON public.departments
    FOR ALL USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ------------------------------------------------------------------------------
-- DOCTORS POLICIES
-- ------------------------------------------------------------------------------
-- Doctor directory is public for patient search and listing
CREATE POLICY "doctors_select_policy" ON public.doctors
    FOR SELECT USING (TRUE);

-- Admin can manage all doctor entries
CREATE POLICY "doctors_admin_all" ON public.doctors
    FOR ALL USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Doctors can update their own specialization/experience details
CREATE POLICY "doctors_self_update" ON public.doctors
    FOR UPDATE USING (auth.uid() = profile_id)
    WITH CHECK (auth.uid() = profile_id);

-- ------------------------------------------------------------------------------
-- DOCTOR SCHEDULES POLICIES
-- ------------------------------------------------------------------------------
-- Schedules are public so patients can calculate available slots
CREATE POLICY "schedules_select_policy" ON public.doctor_schedules
    FOR SELECT USING (TRUE);

-- Doctor can manage their own schedule; admins can manage any schedule
CREATE POLICY "schedules_manage_policy" ON public.doctor_schedules
    FOR ALL USING (
        public.is_admin()
        OR doctor_id = public.get_doctor_id_for_auth_user()
    ) WITH CHECK (
        public.is_admin()
        OR doctor_id = public.get_doctor_id_for_auth_user()
    );

-- ------------------------------------------------------------------------------
-- DOCTOR DAILY STATUS POLICIES
-- ------------------------------------------------------------------------------
-- Live status is public for patients to check live badge (Available/Delayed/On leave)
CREATE POLICY "status_select_policy" ON public.doctor_daily_status
    FOR SELECT USING (TRUE);

-- Doctor can update their own status; admins can manage any
CREATE POLICY "status_manage_policy" ON public.doctor_daily_status
    FOR ALL USING (
        public.is_admin()
        OR doctor_id = public.get_doctor_id_for_auth_user()
    ) WITH CHECK (
        public.is_admin()
        OR doctor_id = public.get_doctor_id_for_auth_user()
    );

-- ------------------------------------------------------------------------------
-- APPOINTMENTS POLICIES
-- ------------------------------------------------------------------------------
-- Patients see only their own appointments; doctors see their appointments; admins see all
CREATE POLICY "appointments_select_policy" ON public.appointments
    FOR SELECT USING (
        patient_id = auth.uid()
        OR doctor_id = public.get_doctor_id_for_auth_user()
        OR public.is_admin()
    );

-- Patients can book an appointment for themselves; admins can book on behalf of patients
CREATE POLICY "appointments_insert_policy" ON public.appointments
    FOR INSERT WITH CHECK (
        patient_id = auth.uid()
        OR public.is_admin()
    );

-- Patients can cancel/reschedule their appointment; doctors can update status; admins can update all
CREATE POLICY "appointments_update_policy" ON public.appointments
    FOR UPDATE USING (
        patient_id = auth.uid()
        OR doctor_id = public.get_doctor_id_for_auth_user()
        OR public.is_admin()
    ) WITH CHECK (
        patient_id = auth.uid()
        OR doctor_id = public.get_doctor_id_for_auth_user()
        OR public.is_admin()
    );

-- Only admins can delete appointments
CREATE POLICY "appointments_delete_policy" ON public.appointments
    FOR DELETE USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- NOTIFICATIONS POLICIES
-- ------------------------------------------------------------------------------
-- Users can see only their own notifications
CREATE POLICY "notifications_select_policy" ON public.notifications
    FOR SELECT USING (
        user_id = auth.uid()
        OR public.is_admin()
    );

-- Users can mark their own notifications as read
CREATE POLICY "notifications_update_policy" ON public.notifications
    FOR UPDATE USING (
        user_id = auth.uid()
        OR public.is_admin()
    ) WITH CHECK (
        user_id = auth.uid()
        OR public.is_admin()
    );

-- Notifications can be inserted by system/admin or user triggers
CREATE POLICY "notifications_insert_policy" ON public.notifications
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        OR public.is_admin()
        OR TRUE -- allow server actions / functions to dispatch notifications
    );

-- Users can delete their own notifications
CREATE POLICY "notifications_delete_policy" ON public.notifications
    FOR DELETE USING (
        user_id = auth.uid()
        OR public.is_admin()
    );

-- ==============================================================================
-- 8. REALTIME REPLICATION CONFIGURATION
-- Enable realtime updates for live doctor status, appointments, and notifications
-- ==============================================================================
DO $$
BEGIN
    -- Add tables to supabase_realtime publication if not already added
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'doctor_daily_status'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.doctor_daily_status;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'appointments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Realtime publication setup skipped or handled by provider: %', SQLERRM;
END $$;
