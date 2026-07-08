'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import CubeIcon from '@/components/CubeIcon';
import SignOutButton from '@/components/SignOutButton';

const NAV_ITEMS = [
  { href: '/', label: 'Home', icon: '🏠' },
  { href: '/explore', label: 'Explore', icon: '🔍' },
  { href: '/design', label: 'Design', icon: '🧩' },
];

interface RecentDesign {
  id: string;
  meta: { name?: string } | null;
  updated_at: string;
}

interface Props {
  email: string | null;
  recentDesigns: RecentDesign[];
}

export default function Sidebar({ email, recentDesigns }: Props) {
  const pathname = usePathname();

  return (
    <aside className="w-[220px] flex-shrink-0 h-screen flex flex-col bg-[#F5EFE6] text-[#2C1A0E] border-r border-[#7A5C44]/20">
      <Link href="/" className="p-4 flex items-center gap-2 border-b border-[#7A5C44]/20 hover:bg-[#7A5C44]/10 transition-colors">
        <CubeIcon size={24} />
        <span className="font-semibold text-sm leading-tight">People+Possibilities Diffusion Lab</span>
      </Link>

      <nav className="p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          // Home's href is "/", which is a prefix of every path — so it needs
          // an exact match instead of the startsWith used for the other tabs.
          const active = item.href === '/' ? pathname === '/' : pathname?.startsWith(item.href);
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
        {recentDesigns.length > 0 && (
          <>
            <p className="text-[10px] uppercase tracking-wide text-[#7A5C44]/70 px-3 mt-2 mb-1">Recent deployments</p>
            <div className="space-y-0.5">
              {recentDesigns.map((d) => (
                <Link
                  key={d.id}
                  href={`/design?open=${d.id}`}
                  className="block px-3 py-1.5 rounded-lg text-xs text-[#7A5C44] hover:bg-[#7A5C44]/10 hover:text-[#2C1A0E] truncate transition-colors"
                  title={d.meta?.name || 'New deployment'}
                >
                  {d.meta?.name || 'New deployment'}
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
  );
}
