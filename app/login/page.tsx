'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import CubeIcon from '@/components/CubeIcon';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } =
      mode === 'signup'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    router.replace(next);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#F5EFE6] flex flex-col items-center justify-center px-6">
      <div className="flex items-center gap-3 mb-8">
        <CubeIcon size={40} />
        <h1 className="text-3xl font-bold text-[#2C1A0E] tracking-tight">People+Possibilities Diffusion Lab</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white border border-[#7A5C44]/20 rounded-2xl p-8 flex flex-col gap-4"
      >
        <h2 className="text-lg font-semibold text-[#2C1A0E]">
          {mode === 'signin' ? 'Sign in' : 'Create an account'}
        </h2>

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
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
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
          {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError(null);
          }}
          className="text-xs text-[#7A5C44] hover:text-[#2C1A0E] transition-colors"
        >
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </form>
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
