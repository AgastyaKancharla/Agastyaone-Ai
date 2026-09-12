'use client';

import { useActionState, useState } from 'react';
import { signInWithMagicLink, signInWithPassword, type SignInState } from './actions';

const initial: SignInState = {};

// Off for now: Supabase's shared free-tier email sender rate-limits fast,
// which blocked sign-in entirely during early solo testing. Password auth
// doesn't touch email at all. Flip back on once real SMTP is configured --
// a client with no password has no other way in.
const MAGIC_LINK_ENABLED = false;

export default function SignInForm() {
  const [mode, setMode] = useState<'link' | 'password'>(MAGIC_LINK_ENABLED ? 'link' : 'password');
  const [linkState, linkAction, linkPending] = useActionState(signInWithMagicLink, initial);
  const [pwState, pwAction, pwPending] = useActionState(signInWithPassword, initial);

  const state = mode === 'link' ? linkState : pwState;
  const pending = mode === 'link' ? linkPending : pwPending;

  if (linkState.sent) {
    return (
      <div className="card p-6 text-center">
        <div className="mx-auto h-10 w-10 rounded-full bg-brand-wash grid place-items-center text-brand text-xl">
          ✉
        </div>
        <h3 className="mt-4 font-medium">Check your email</h3>
        <p className="hint mt-2">
          If that address has an account, a sign-in link is on its way. It expires in an hour.
        </p>
      </div>
    );
  }

  return (
    <div>
      {MAGIC_LINK_ENABLED && (
        <div role="tablist" className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-brand-wash mb-6">
          {(['link', 'password'] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                mode === m ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink'
              }`}
            >
              {m === 'link' ? 'Email link' : 'Password'}
            </button>
          ))}
        </div>
      )}

      <form action={mode === 'link' ? linkAction : pwAction} className="space-y-4">
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@clinic.com"
            className="input"
          />
        </div>

        {mode === 'password' && (
          <div>
            <label htmlFor="password" className="label">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="input"
            />
          </div>
        )}

        {state.error && (
          <p role="alert" className="text-sm text-danger">{state.error}</p>
        )}

        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? 'Working…' : mode === 'link' ? 'Email me a link' : 'Sign in'}
        </button>
      </form>

      <p className="hint text-center mt-6">
        {mode === 'link'
          ? 'No password needed — we email you a one-time link.'
          : MAGIC_LINK_ENABLED
            ? 'Team accounts only. Clients should use the email link.'
            : 'Team sign-in.'}
      </p>
    </div>
  );
}
