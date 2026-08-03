import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/roles';

// The landing just routes to whichever entry point the user actually has —
// Explore and Contribute are now dedicated pages (sidebar links), not a
// choice made inline here.
export default async function HomePage() {
  const supabase = await createClient();
  const [canExplore, canContribute] = await Promise.all([
    hasRole(supabase, 'adopter'),
    hasRole(supabase, 'pathway_contributor'),
  ]);

  if (canExplore) redirect('/explore');
  if (canContribute) redirect('/contribute');

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <p className="max-w-sm text-center text-sm text-ink-soft">
        Ask an admin to grant you Explorer or Contributor access to get started.
      </p>
    </div>
  );
}
