import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { hasAnyRole, hasRole, isAdmin } from '@/lib/roles';
import SiteHeader from '@/components/SiteHeader';
import Sidebar from '@/components/Sidebar';
import SignOutButton from '@/components/SignOutButton';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // proxy.ts already verified the session and forwards the email via this
  // header — avoids a second getUser() round trip to Supabase on every
  // single navigation.
  const headersList = await headers();
  const email = headersList.get('x-user-email');

  const supabase = await createClient();

  // A brand-new signup has zero rows in user_roles — that's "pending," no
  // separate status column needed. An admin approving is granting a role
  // via /admin, which is exactly what flips this.
  const approved = await hasAnyRole(supabase);
  if (!approved) {
    return (
      <div className="flex min-h-screen flex-col bg-paper">
        <SiteHeader />
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="flex max-w-sm flex-col items-center gap-4 text-center">
            <div>
              <h1 className="mb-2 font-display text-lg font-medium text-navy">Awaiting approval</h1>
              <p className="text-sm text-ink-soft">
                Your account has been created but hasn&apos;t been approved yet. An admin will let you know
                once you&apos;re in.
              </p>
            </div>
            <SignOutButton />
          </div>
        </div>
      </div>
    );
  }

  const [{ data: adoptions }, canExplore, canContribute, adminAccess] = await Promise.all([
    supabase.from('designs').select('id, meta, updated_at').order('updated_at', { ascending: false }),
    hasRole(supabase, 'adopter'),
    hasRole(supabase, 'pathway_contributor'),
    isAdmin(supabase, email),
  ]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-paper md:flex-row">
      <Sidebar
        email={email}
        adoptions={adoptions ?? []}
        isAdmin={adminAccess}
        canExplore={canExplore}
        canContribute={canContribute}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
