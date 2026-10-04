import { requireRole } from '@/lib/auth'
import { getAdminDepartmentsAction } from '@/app/actions/admin'
import { AdminLayout } from '@/components/portal/AdminLayout'
import { AdminDepartmentsView } from '@/components/portal/AdminDepartmentsView'

export const dynamic = 'force-dynamic'

export default async function AdminDepartmentsPage() {
  await requireRole('admin')

  const departmentsRes = await getAdminDepartmentsAction()

  return (
    <AdminLayout activePath="departments">
      <AdminDepartmentsView initialDepartments={departmentsRes.data || []} />
    </AdminLayout>
  )
}
