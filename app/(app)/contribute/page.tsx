import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/roles';
import ContributeGrid from './ContributeGrid';

// A dedicated entry point rather than a choice on a shared welcome screen —
// mirrors the pre-revamp Explore/Design split. Shows a grid of the user's
// past contributions (same structure as /adoptions), with a "+ New
// Contribution" button that opens a fresh Contributor-flow workspace —
// unlike /explore, which always starts fresh directly.
export default async function ContributePage() {
  const supabase = await createClient();
  if (!(await hasRole(supabase, 'pathway_contributor'))) {
    redirect('/');
  }

  return <ContributeGrid />;
}
