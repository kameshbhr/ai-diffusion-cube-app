import { createClient } from '@supabase/supabase-js';

// SERVER-ONLY. This client uses the service-role key, which bypasses Row
// Level Security entirely. Never import this file in a 'use client'
// component, and never expose SUPABASE_SERVICE_ROLE_KEY via a NEXT_PUBLIC_
// prefix. Only used from Route Handlers for the signup-approval flow, which
// must touch pending_signups/user_roles and the Auth Admin API before the
// user has any session of their own.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
