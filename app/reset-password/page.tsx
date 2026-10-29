'use client';

import Link from 'next/link';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function ResetPasswordRequestPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordRequestForm />
    </Suspense>
  );
}

function ResetPasswordRequestForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [devUrl, setDevUrl] = useState('');

  useEffect(() => {
    const q = searchParams.get('email');
    if (q) setEmail(q);
    else {
      (async () => {
        try {
          const res = await fetch('/api/auth/me', { cache: 'no-store' });
          if (!res.ok) return;
          const me = await res.json();
          if (me.email) setEmail(String(me.email));
        } catch {
          /* ignore */
        }
      })();
    }
  }, [searchParams]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    setDevUrl('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error || 'Could not send reset link');
        return;
      }
      setMessage(payload.message || 'If that email is registered, we sent a reset link.');
      if (typeof payload.devResetUrl === 'string') setDevUrl(payload.devResetUrl);
    } catch {
      setError('Could not send reset link');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6 pt-20">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <img
              alt="SFS Shanthinagar Emblem"
              className="h-12 w-auto object-contain"
              src="/images/emblem.png"
            />
          </div>
          <h1 className="text-headline-lg text-primary mb-2">Reset password</h1>
          <p className="text-body-sm text-on-surface-variant">
            Prefer help without email? Contact the alumni committee — an admin can set a temporary
            password for you. Optional email link below if mail is configured.
          </p>
        </div>

        <div className="bg-surface-paper rounded-xl shadow-md p-8 border border-surface-container-low">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="flex flex-col">
              <label
                className="text-label-md text-primary mb-2 uppercase tracking-wider"
                htmlFor="reset-email"
              >
                Email
              </label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={loading}
                className="px-4 py-3 rounded-lg border border-outline-variant text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:bg-surface-container"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-error-container text-error text-body-sm">{error}</div>
            )}
            {message && (
              <div className="p-3 rounded-lg bg-secondary-container text-on-secondary-fixed text-body-sm">
                {message}
              </div>
            )}
            {devUrl && (
              <p className="text-body-sm text-on-surface-variant break-all">
                Dev only — open{' '}
                <Link href={devUrl} className="text-primary font-bold underline underline-offset-2">
                  this reset link
                </Link>
                .
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-primary text-on-primary text-label-md uppercase tracking-wider font-bold hover:bg-navy-subtle disabled:bg-surface-container disabled:text-on-surface-variant transition-all mt-2"
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        </div>

        <div className="text-center mt-6">
          <Link
            href="/login"
            className="text-label-sm text-primary hover:text-navy-subtle transition-colors uppercase tracking-wider"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
