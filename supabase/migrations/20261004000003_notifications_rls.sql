-- ==============================================================================
-- CareSlot: Notifications RLS Policy and Realtime Fix
-- Allows authenticated doctors and system Server Actions to dispatch in-app notifications
-- to affected patients while preserving strict patient-only SELECT/UPDATE isolation.
-- ==============================================================================

-- 1. Ensure RLS is enabled
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "notifications_select_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_policy" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete_policy" ON public.notifications;

-- 3. SELECT: Patients and doctors can ONLY view their own notifications
CREATE POLICY "notifications_select_policy" ON public.notifications
    FOR SELECT USING (
        user_id = auth.uid()
        OR public.is_admin()
    );

-- 4. INSERT: Authenticated users (doctors and patients) can insert notification records
CREATE POLICY "notifications_insert_policy" ON public.notifications
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated'
        OR user_id = auth.uid()
        OR public.is_admin()
    );

-- 5. UPDATE: Patients can update (mark read) only their own notifications
CREATE POLICY "notifications_update_policy" ON public.notifications
    FOR UPDATE USING (
        user_id = auth.uid()
        OR public.is_admin()
    ) WITH CHECK (
        user_id = auth.uid()
        OR public.is_admin()
    );

-- 6. DELETE: Patients can delete only their own notifications
CREATE POLICY "notifications_delete_policy" ON public.notifications
    FOR DELETE USING (
        user_id = auth.uid()
        OR public.is_admin()
    );

-- 7. Ensure table is replicated to Supabase Realtime
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
END $$;
