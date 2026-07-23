import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdminEmail, type Role } from '@/lib/roles';

const VALID_ROLES: Role[] = ['general_user', 'adopter', 'pathway_contributor'];

export async function POST(req: Request) {
  // Never trust the client on this — re-check against the caller's own
  // session, same as the real enforcement boundary in app/api/chat/route.ts.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminEmail(user?.email)) {
    return Response.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const { user_id, role, action } = await req.json();

  if (typeof user_id !== 'string' || !VALID_ROLES.includes(role) || (action !== 'add' && action !== 'remove')) {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const admin = createAdminClient();

  if (action === 'add') {
    const { error } = await admin.from('user_roles').insert({ user_id, role });
    if (error) return Response.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await admin.from('user_roles').delete().eq('user_id', user_id).eq('role', role);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
