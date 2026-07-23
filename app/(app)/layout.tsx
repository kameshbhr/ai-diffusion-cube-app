import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { hasAnyRole, isAdminEmail } from '@/lib/roles';
import Sidebar from '@/components/Sidebar';
import SignOutButton from '@/components/SignOutButton';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // proxy.ts already verified the session and forwards the email via this
  // header — avoids a second getUser() round trip to Supabase on every
  // single navigation between tabs.
  const headersList = await headers();
  const email = headersList.get('x-user-email');

  const supabase = await createClient();

  // A brand-new signup has zero rows in user_roles — that's "pending," no
  // separate status column needed. An admin approving is granting a role
  // via /admin, which is exactly what flips this.
  const approved = await hasAnyRole(supabase);
  if (!approved) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F5EFE6] text-[#2C1A0E] p-8">
        <div className="text-center max-w-sm flex flex-col items-center gap-4">
          <div>
            <h1 className="text-lg font-bold mb-2">Awaiting approval</h1>
            <p className="text-sm text-[#7A5C44]">
              Your account has been created but hasn&apos;t been approved yet. An admin will let you know once
              you&apos;re in.
            </p>
          </div>
          <SignOutButton />
        </div>
      </div>
    );
  }

  const { data: designs } = await supabase
    .from('designs')
    .select('id, meta, updated_at')
    .order('updated_at', { ascending: false });

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar email={email} designs={designs ?? []} isAdmin={isAdminEmail(email)} />
      <div className="flex-1 flex flex-col overflow-hidden pt-14 md:pt-0">{children}</div>
    </div>
  );
}
