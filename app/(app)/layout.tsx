import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/Sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // proxy.ts already verified the session and forwards the email via this
  // header — avoids a second getUser() round trip to Supabase on every
  // single navigation between tabs.
  const headersList = await headers();
  const email = headersList.get('x-user-email');

  const supabase = await createClient();
  const { data: designs } = await supabase
    .from('designs')
    .select('id, meta, updated_at')
    .order('updated_at', { ascending: false });

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar email={email} designs={designs ?? []} />
      <div className="flex-1 flex flex-col overflow-hidden">{children}</div>
    </div>
  );
}
