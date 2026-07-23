'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import CubeIcon from '@/components/CubeIcon';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';

  const [mode, setMode] = useState<'signin' | 'request-access'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    router.replace(next);
    router.refresh();
  }

  async function handleRequestAccess(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, organization } },
    });

    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    // The account exists with a session but zero roles — app/(app)/layout.tsx
    // shows a "pending approval" message until an admin grants a role.
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#F5EFE6] flex flex-col items-center justify-center px-6">
      <div className="flex items-center gap-3 mb-8">
        <CubeIcon size={40} />
        <h1 className="text-3xl font-bold text-[#2C1A0E] tracking-tight leading-tight">
          <span className="block">People+Possibilities</span>
          <span className="block">AI Diffusion Studio</span>
        </h1>
      </div>

      <div className="w-full max-w-sm bg-white border border-[#7A5C44]/20 rounded-2xl p-8 flex flex-col gap-4">
        {mode === 'signin' ? (
          <form onSubmit={handleSignIn} className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-[#2C1A0E]">Sign in</h2>

            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-xs text-[#7A5C44]">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border border-[#7A5C44]/30 rounded-lg px-3 py-2 text-sm text-[#2C1A0E] focus:outline-none focus:border-[#7A5C44]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="password" className="text-xs text-[#7A5C44]">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border border-[#7A5C44]/30 rounded-lg px-3 py-2 text-sm text-[#2C1A0E] focus:outline-none focus:border-[#7A5C44]"
              />
            </div>

            {error && <p className="text-xs text-[#D64045]">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 bg-[#2C1A0E] hover:bg-[#3a2414] disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
            >
              {loading ? 'Please wait…' : 'Sign in'}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('request-access');
                setError(null);
              }}
              className="text-xs text-[#7A5C44] hover:text-[#2C1A0E] transition-colors"
            >
              Don&apos;t have an account? Request access
            </button>
          </form>
        ) : (
          <form onSubmit={handleRequestAccess} className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-[#2C1A0E]">Request access</h2>

            <div className="flex flex-col gap-1">
              <label htmlFor="name" className="text-xs text-[#7A5C44]">
                Name
              </label>
              <input
                id="name"
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border border-[#7A5C44]/30 rounded-lg px-3 py-2 text-sm text-[#2C1A0E] focus:outline-none focus:border-[#7A5C44]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="request-email" className="text-xs text-[#7A5C44]">
                Email
              </label>
              <input
                id="request-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border border-[#7A5C44]/30 rounded-lg px-3 py-2 text-sm text-[#2C1A0E] focus:outline-none focus:border-[#7A5C44]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="organization" className="text-xs text-[#7A5C44]">
                Organization
              </label>
              <input
                id="organization"
                type="text"
                required
                autoComplete="organization"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                className="border border-[#7A5C44]/30 rounded-lg px-3 py-2 text-sm text-[#2C1A0E] focus:outline-none focus:border-[#7A5C44]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="request-password" className="text-xs text-[#7A5C44]">
                Password
              </label>
              <input
                id="request-password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="border border-[#7A5C44]/30 rounded-lg px-3 py-2 text-sm text-[#2C1A0E] focus:outline-none focus:border-[#7A5C44]"
              />
            </div>

            {error && <p className="text-xs text-[#D64045]">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 bg-[#2C1A0E] hover:bg-[#3a2414] disabled:opacity-60 text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
            >
              {loading ? 'Please wait…' : 'Request access'}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
              className="text-xs text-[#7A5C44] hover:text-[#2C1A0E] transition-colors"
            >
              Already have an account? Sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
