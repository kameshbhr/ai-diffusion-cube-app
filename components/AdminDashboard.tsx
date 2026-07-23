'use client';

import { useState } from 'react';
import type { Role } from '@/lib/roles';

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  organization: string;
  roles: Role[];
}

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'general_user', label: 'General User' },
  { value: 'adopter', label: 'Adopter' },
  { value: 'pathway_contributor', label: 'Pathway Contributor' },
];

export default function AdminDashboard({ initialRows }: { initialRows: AdminUserRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [pending, setPending] = useState<string | null>(null);

  async function toggleRole(userId: string, role: Role, hasIt: boolean) {
    const key = `${userId}:${role}`;
    setPending(key);
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role, action: hasIt ? 'remove' : 'add' }),
      });
      if (!res.ok) return;
      setRows((prev) =>
        prev.map((r) =>
          r.id === userId ? { ...r, roles: hasIt ? r.roles.filter((x) => x !== role) : [...r.roles, role] } : r
        )
      );
    } finally {
      setPending(null);
    }
  }

  async function reject(userId: string) {
    if (!window.confirm('Reject and delete this account? This cannot be undone.')) return;
    setPending(`${userId}:reject`);
    try {
      const res = await fetch('/api/admin/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      if (!res.ok) return;
      setRows((prev) => prev.filter((r) => r.id !== userId));
    } finally {
      setPending(null);
    }
  }

  if (rows.length === 0) {
    return <p className="text-sm text-[#7A5C44]">No users yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-[#7A5C44] border-b border-[#7A5C44]/20">
            <th className="py-2 pr-4">Name</th>
            <th className="py-2 pr-4">Email</th>
            <th className="py-2 pr-4">Organization</th>
            {ROLE_OPTIONS.map((r) => (
              <th key={r.value} className="py-2 pr-4">
                {r.label}
              </th>
            ))}
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isPendingRow = row.roles.length === 0;
            return (
              <tr key={row.id} className={`border-b border-[#7A5C44]/10 ${isPendingRow ? 'bg-[#E8A838]/10' : ''}`}>
                <td className="py-2 pr-4">{row.name || '—'}</td>
                <td className="py-2 pr-4">{row.email}</td>
                <td className="py-2 pr-4">{row.organization || '—'}</td>
                {ROLE_OPTIONS.map((r) => {
                  const hasIt = row.roles.includes(r.value);
                  const key = `${row.id}:${r.value}`;
                  return (
                    <td key={r.value} className="py-2 pr-4">
                      <input
                        type="checkbox"
                        checked={hasIt}
                        disabled={pending === key}
                        onChange={() => toggleRole(row.id, r.value, hasIt)}
                      />
                    </td>
                  );
                })}
                <td className="py-2">
                  {isPendingRow && (
                    <button
                      onClick={() => reject(row.id)}
                      disabled={pending === `${row.id}:reject`}
                      className="text-xs text-[#D64045] border border-[#D64045]/40 rounded-lg px-2.5 py-1 hover:bg-[#D64045]/10 transition-colors disabled:opacity-50"
                    >
                      Reject
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
