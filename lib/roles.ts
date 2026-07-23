import type { SupabaseClient } from '@supabase/supabase-js';

export type Role = 'general_user' | 'adopter' | 'pathway_contributor';

// Checks the CURRENT signed-in user's own roles via the normal per-request
// client (not the service-role client) — relies on user_roles' "select own
// rows" RLS policy, so this only ever sees the caller's own grants.
export async function hasRole(supabase: SupabaseClient, role: Role): Promise<boolean> {
  const { data } = await supabase.from('user_roles').select('role').eq('role', role).maybeSingle();
  return !!data;
}

// A signup with zero roles at all is "pending" — no admin has approved them
// yet. Approving is granting at least one role, so this doubles as the
// approval check (see app/(app)/layout.tsx).
export async function hasAnyRole(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.from('user_roles').select('role').limit(1).maybeSingle();
  return !!data;
}

// Who can access /admin and its API routes — reuses ADMIN_EMAILS (the same
// list originally used for the email-based flow) rather than a separate
// 'admin' role, since there's no other use for one yet.
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const adminAddresses = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return adminAddresses.includes(email.toLowerCase());
}
