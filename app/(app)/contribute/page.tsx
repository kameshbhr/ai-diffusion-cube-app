import { redirect } from 'next/navigation';
import AdoptionWorkspace from '@/components/AdoptionWorkspace';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/roles';

// A dedicated entry point rather than a choice on a shared welcome screen —
// mirrors the pre-revamp Explore/Design split. Always starts a fresh
// adoption in the Contributor flow.
export default async function ContributePage() {
  const supabase = await createClient();
  if (!(await hasRole(supabase, 'pathway_contributor'))) {
    redirect('/');
  }

  // key="contribute" forces a fresh mount when navigating here from
  // /explore — see the matching comment in app/(app)/explore/page.tsx.
  return <AdoptionWorkspace key="contribute" initial={null} fixedFlow="contributor" />;
}
