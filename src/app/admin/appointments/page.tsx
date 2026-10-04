import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getAdminAppointmentsAction } from '@/app/actions/admin'
import { AdminLayout } from '@/components/portal/AdminLayout'
import { AdminAppointmentsView } from '@/components/portal/AdminAppointmentsView'

export const dynamic = 'force-dynamic'

export default async function AdminAppointmentsPage() {
  await requireRole('admin')

  const [appointmentsRes, supabase] = await Promise.all([
    getAdminAppointmentsAction(),
    createClient(),
  ])

  // Fetch doctors for doctor filter dropdown
  const { data: docs } = await supabase
    .from('doctors')
    .select('id, full_name, profile_id')
    .order('full_name', { ascending: true })

  const doctorsList = (docs || []).map((d: any) => ({
    id: d.id,
    name: d.full_name || 'Dr. Physician',
  }))

  return (
    <AdminLayout activePath="appointments">
      <AdminAppointmentsView
        initialAppointments={appointmentsRes.data || []}
        doctors={doctorsList}
      />
    </AdminLayout>
  )
}
