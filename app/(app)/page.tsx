import { redirect } from 'next/navigation';
import DesignDetailView from '@/components/DesignDetailView';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/roles';

export default async function HomePage() {
  // The home page's "quick-start" welcome screen is Design functionality
  // (see DesignDetailView) — General Users without the Adopter role land on
  // Explore instead, matching the same gate as /design.
  const supabase = await createClient();
  const isAdopter = await hasRole(supabase, 'adopter');
  if (!isAdopter) redirect('/explore');

  return <DesignDetailView initial={null} />;
}
