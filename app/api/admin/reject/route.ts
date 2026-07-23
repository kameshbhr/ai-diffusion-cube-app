import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdminEmail } from '@/lib/roles';

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdminEmail(user?.email)) {
    return Response.json({ error: 'Not authorized.' }, { status: 403 });
  }

  const { user_id } = await req.json();
  if (typeof user_id !== 'string') {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }

  // Deletes the account entirely rather than leaving a dangling zero-role
  // row — if rejected by mistake, the person can just sign up again with the
  // same email.
  const { error } = await createAdminClient().auth.admin.deleteUser(user_id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
