import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getAdminDoctorsAction } from '@/app/actions/admin'
import { AdminLayout } from '@/components/portal/AdminLayout'
import { AdminDoctorsView } from '@/components/portal/AdminDoctorsView'

export const dynamic = 'force-dynamic'

export default async function AdminDoctorsPage() {
  await requireRole('admin')

  const [doctorsRes, supabase] = await Promise.all([
    getAdminDoctorsAction(),
    createClient(),
  ])

  const { data: depts } = await supabase
    .from('departments')
    .select('id, name')
    .order('name', { ascending: true })

  const departmentsList = depts || []

  return (
    <AdminLayout activePath="doctors">
      <AdminDoctorsView
        initialDoctors={doctorsRes.data || []}
        departments={departmentsList}
      />
    </AdminLayout>
  )
}
