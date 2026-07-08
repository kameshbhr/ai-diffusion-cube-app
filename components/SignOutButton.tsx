'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-xs text-[#7A5C44] hover:text-[#2C1A0E] border border-[#7A5C44]/30 rounded-lg px-2.5 py-1 transition-colors flex-shrink-0"
    >
      Sign out
    </button>
  );
}
