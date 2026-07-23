'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import CubeIcon from '@/components/CubeIcon';
import SignOutButton from '@/components/SignOutButton';
import { Pathway, fetchPathways } from '@/lib/pathways';

const NAV_ITEMS = [
  { href: '/explore', label: 'Explore', icon: '🔍' },
  { href: '/design', label: 'Design', icon: '🧩' },
];

interface DesignSummary {
  id: string;
  meta: { name?: string } | null;
  updated_at: string;
}

interface Props {
  email: string | null;
  designs: DesignSummary[];
  isAdmin?: boolean;
}

export default function Sidebar({ email, designs, isAdmin }: Props) {
  const pathname = usePathname();
  const inExploreContext = pathname?.startsWith('/explore') ?? false;

  const [pathways, setPathways] = useState<Pathway[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);

  // Fetched client-side (unlike the designs list) so browsing Explore doesn't
  // add a blocking GitHub fetch to every navigation's server-side render.
  useEffect(() => {
    if (!inExploreContext) return;
    fetchPathways()
      .then(setPathways)
      .catch(() => {});
  }, [inExploreContext]);

  // Auto-close the mobile drawer whenever the route changes (link clicked).
  // Adjusted during render (React's documented pattern for this) rather than
  // in an effect, since it's a pure derivation with no external side effect.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    if (mobileOpen) setMobileOpen(false);
  }

  const items = inExploreContext
    ? pathways.map((p) => ({ key: p.slug, href: `/explore?pathway=${p.slug}`, label: p.name }))
    : designs.map((d) => ({ key: d.id, href: `/design?open=${d.id}`, label: d.meta?.name || 'New deployment' }));

  return (
    <>
      {/* Mobile-only top bar — the aside below is off-canvas by default under md */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 flex items-center gap-3 px-4 bg-[#F5EFE6] border-b border-[#7A5C44]/20">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="text-xl text-[#2C1A0E] leading-none p-1 -ml-1"
        >
          ☰
        </button>
        <CubeIcon size={20} />
        <span className="font-semibold text-sm truncate">People+Possibilities AI Diffusion Studio</span>
      </div>

      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={`w-[220px] flex-shrink-0 h-screen flex flex-col bg-[#F5EFE6] text-[#2C1A0E] border-r border-[#7A5C44]/20 fixed md:static top-0 left-0 z-50 transition-transform duration-200 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
      >
      <Link href="/" className="p-4 flex items-center gap-2 border-b border-[#7A5C44]/20 hover:bg-[#7A5C44]/10 transition-colors">
        <CubeIcon size={24} />
        <span className="font-semibold text-sm leading-tight">
          <span className="block">People+Possibilities</span>
          <span className="block">AI Diffusion Studio</span>
        </span>
      </Link>

      <nav className="p-3 space-y-1">
        {[...NAV_ITEMS, ...(isAdmin ? [{ href: '/admin', label: 'Admin', icon: '🛠️' }] : [])].map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                active ? 'bg-[#2C1A0E] text-white font-medium' : 'text-[#7A5C44] hover:bg-[#7A5C44]/10 hover:text-[#2C1A0E]'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {items.length > 0 && (
          <>
            <p className="text-[10px] uppercase tracking-wide text-[#7A5C44]/70 px-3 mt-2 mb-1">Deployments</p>
            <div className="space-y-0.5">
              {items.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="block px-3 py-1.5 rounded-lg text-xs text-[#7A5C44] hover:bg-[#7A5C44]/10 hover:text-[#2C1A0E] truncate transition-colors"
                  title={item.label}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="p-3 border-t border-[#7A5C44]/20 flex items-center justify-between gap-2">
        <span className="text-xs text-[#7A5C44] truncate" title={email ?? undefined}>
          {email ?? ''}
        </span>
        <SignOutButton />
      </div>
      </aside>
    </>
  );
}
