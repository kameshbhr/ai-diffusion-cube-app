'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SignOutButton from '@/components/SignOutButton';

interface AdoptionSummary {
  id: string;
  meta: { name?: string } | null;
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
    { href: '/adoptions', label: 'Your adoptions' },
    ...(isAdmin ? [{ href: '/admin', label: 'Admin' }] : []),
  ];

  const body = (
    <>
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
        {adoptions.length > 0 && (
          <>
            <p className="mt-2 mb-1 px-3 font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">
              Recent
            </p>
            <div className="space-y-0.5">
              {adoptions.map((a) => (
                <Link
                  key={a.id}
                  href={`/adoptions?open=${a.id}`}
                  className="block truncate rounded-lg px-3 py-1.5 text-xs text-ink-soft transition hover:bg-paper-dim hover:text-navy"
                  title={a.meta?.name || 'New adoption'}
                >
                  {a.meta?.name || 'New adoption'}
                </Link>
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
      {/* Mobile trigger bar (SiteHeader owns branding; this is just the drawer toggle) */}
      <div className="flex h-10 items-center gap-2 border-b border-navy/10 bg-paper px-4 md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="text-lg leading-none text-navy"
        >
          ☰
        </button>
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">Menu</span>
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
