import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getAdminOverviewDataAction } from '@/app/actions/admin'
import { AdminLayout } from '@/components/portal/AdminLayout'
import { AdminOverviewView } from '@/components/portal/AdminOverviewView'

export const dynamic = 'force-dynamic'

export default async function AdminOverviewPage() {
  // 1. Enforce strict Admin role check (redirects non-admins to / and unauthenticated to /login)
  await requireRole('admin')

  // 2. Fetch overview data
  const overviewRes = await getAdminOverviewDataAction()
  if (!overviewRes.success || !overviewRes.data) {
    return (
      <AdminLayout activePath="overview">
        <div className="p-8 text-center bg-surface-container-lowest rounded-xl border border-surface-container">
          <p className="text-error font-medium">Failed to load hospital administration data.</p>
          <p className="text-sm text-on-surface-variant mt-1">{overviewRes.error}</p>
        </div>
      </AdminLayout>
    )
  }

  // 3. Fetch departments for the Add Doctor dropdown
  const supabase = await createClient()
  const { data: depts } = await supabase
    .from('departments')
    .select('id, name')
    .order('name', { ascending: true })

  const departmentsList = depts || []

  return (
    <AdminLayout activePath="overview">
      <AdminOverviewView
        stats={overviewRes.data.stats}
        initialAppointments={overviewRes.data.recentAppointments}
        initialDoctorRoster={overviewRes.data.doctorRoster}
        departments={departmentsList}
      />
    </AdminLayout>
  )
}
