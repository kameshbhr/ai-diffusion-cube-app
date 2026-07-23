import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdminEmail, type Role } from '@/lib/roles';
import AdminDashboard, { AdminUserRow } from '@/components/AdminDashboard';

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminEmail(user?.email)) {
    redirect('/');
  }

  const admin = createAdminClient();
  const [{ data: usersData }, { data: rolesData }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from('user_roles').select('user_id, role'),
  ]);

  const rolesByUser = new Map<string, Role[]>();
  for (const row of rolesData ?? []) {
    const list = rolesByUser.get(row.user_id) ?? [];
    list.push(row.role);
    rolesByUser.set(row.user_id, list);
  }

  const rows: AdminUserRow[] = (usersData?.users ?? [])
    .map((u) => ({
      id: u.id,
      email: u.email ?? '',
      name: (u.user_metadata?.name as string) ?? '',
      organization: (u.user_metadata?.organization as string) ?? '',
      roles: rolesByUser.get(u.id) ?? [],
    }))
    .sort((a, b) => a.roles.length - b.roles.length);

  return (
    <div className="min-h-screen bg-[#F5EFE6] text-[#2C1A0E] p-8">
      <Link href="/" className="text-xs text-[#7A5C44] hover:text-[#2C1A0E] transition-colors">
        ← Back
      </Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">Admin</h1>
      <p className="text-sm text-[#7A5C44] mb-6">Approve signups and manage roles.</p>
      <AdminDashboard initialRows={rows} />
    </div>
  );
}
