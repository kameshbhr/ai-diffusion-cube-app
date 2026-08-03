import { redirect } from 'next/navigation';
import AdoptionWorkspace from '@/components/AdoptionWorkspace';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/roles';

// A dedicated entry point rather than a choice on a shared welcome screen —
// mirrors the pre-revamp Explore/Design split. Always starts a fresh
// adoption in the Explorer flow.
export default async function ExplorePage() {
  const supabase = await createClient();
  if (!(await hasRole(supabase, 'adopter'))) {
    redirect('/');
  }

  // key="explore" forces a fresh mount when navigating here from /contribute
  // — otherwise React reconciles both routes' AdoptionWorkspace as the same
  // instance (same type, same tree position under the shared layout) and
  // carries over the other flow's conversation state, ignoring fixedFlow.
  return <AdoptionWorkspace key="explore" initial={null} fixedFlow="explorer" />;
}
