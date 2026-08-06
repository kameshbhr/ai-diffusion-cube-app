'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SignOutButton from '@/components/SignOutButton';
import { createClient } from '@/lib/supabase/client';

interface AdoptionSummary {
  id: string;
  meta: { name?: string; flow?: string } | null;
  updated_at: string;
}

interface Props {
  email: string | null;
  adoptions: AdoptionSummary[];
  isAdmin?: boolean;
  canExplore?: boolean;
  canContribute?: boolean;
}

export default function Sidebar({ email, adoptions, isAdmin, canExplore, canContribute }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);
  // Optimistic client-side removal — `adoptions` itself is a server-fetched
  // prop (re-populated on navigation), so a deleted row is masked out here
  // rather than mutated in place; it's simply absent again on the next
  // real fetch anyway.
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  async function handleDeleteExploration(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Delete this exploration? This cannot be undone.')) return;

    const supabase = createClient();
    const { error } = await supabase.from('designs').delete().eq('id', id);
    if (error) return;
    setDeletedIds((prev) => new Set(prev).add(id));
  }

  // Auto-close the mobile drawer whenever the route changes (link clicked).
  // Adjusted during render (React's documented pattern) rather than in an
  // effect, since it's a pure derivation with no external side effect.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    if (mobileOpen) setMobileOpen(false);
  }

  // Explore/Contribute are separate entry points (each starts a new
  // adoption in that flow) rather than a choice made inline on a shared
  // welcome screen — mirrors the pre-revamp Explore/Design split. The wiki
  // itself is corpus material for the companion's prompts now, not a
  // user-facing nav destination (the pages still exist at /wiki, just
  // unlinked here).
  const navItems = [
    ...(canExplore ? [{ href: '/explore', label: 'Explore' }] : []),
    ...(canContribute ? [{ href: '/contribute', label: 'Contribute' }] : []),
    ...(isAdmin ? [{ href: '/admin', label: 'Admin' }] : []),
  ];

  // Contributions now live in their own grid at /contribute — this list is
  // Explorer-only, so it's a real "recent explorations" shortcut rather than
  // a mixed-flow dump.
  const recentExplorations = adoptions.filter((a) => a.meta?.flow === 'explorer' && !deletedIds.has(a.id));

  const body = (
    <>
      <Link href="/" className="flex flex-col items-center gap-0.5 border-b border-navy/10 px-4 py-4 text-center transition hover:bg-paper-dim">
        <span className="font-display text-base font-medium tracking-tight text-navy">100 Pathways</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Diffusion Cube</span>
      </Link>

      <nav className="space-y-0.5 p-3">
        {navItems.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm transition ${
                active ? 'bg-navy font-medium text-white' : 'text-ink-soft hover:bg-paper-dim hover:text-navy'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {recentExplorations.length > 0 && (
          <>
            <p className="mt-2 mb-1 px-3 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">
              Recent Explorations
            </p>
            <div className="space-y-0.5">
              {recentExplorations.map((a) => (
                <div key={a.id} className="group/item flex items-center rounded-lg hover:bg-paper-dim">
                  <Link
                    href={`/adoptions?open=${a.id}`}
                    className="block flex-1 truncate px-3 py-1.5 text-xs text-ink-soft transition group-hover/item:text-navy"
                    title={a.meta?.name || 'New exploration'}
                  >
                    {a.meta?.name || 'New exploration'}
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteExploration(e, a.id)}
                    aria-label="Delete exploration"
                    className="flex-shrink-0 px-2 text-ink-soft/50 opacity-0 transition hover:text-coral group-hover/item:opacity-100"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-navy/10 p-3">
        <span className="truncate text-xs text-ink-soft" title={email ?? undefined}>
          {email ?? ''}
        </span>
        <SignOutButton />
      </div>
    </>
  );

  return (
    <>
      {/* Mobile trigger bar — the sidebar (opened via this) owns branding now that there's no separate top header */}
      <div className="flex h-12 items-center gap-3 border-b border-navy/10 bg-paper px-4 md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="text-lg leading-none text-navy"
        >
          ☰
        </button>
        <Link href="/" className="flex items-baseline gap-1.5">
          <span className="font-display text-sm font-medium tracking-tight text-navy">100 Pathways</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">/ Diffusion Cube</span>
        </Link>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-navy/40 md:hidden" onClick={() => setMobileOpen(false)} aria-hidden />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 flex h-screen w-[230px] flex-shrink-0 flex-col border-r border-navy/10 bg-paper transition-transform duration-200 ease-in-out md:static md:h-auto md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {body}
      </aside>
    </>
  );
}
