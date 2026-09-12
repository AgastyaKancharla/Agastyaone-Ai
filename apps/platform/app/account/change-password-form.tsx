'use client';

import { useActionState } from 'react';
import { changePassword, type ChangePasswordState } from './actions';

const initial: ChangePasswordState = {};

export default function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, initial);

  if (state.success) {
    return (
      <div className="card p-6 text-center">
        <div className="mx-auto h-10 w-10 rounded-full bg-brand-wash grid place-items-center text-brand text-xl">
          ✓
        </div>
        <h3 className="mt-4 font-medium">Password changed</h3>
        <p className="hint mt-2">Use it next time you sign in.</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="currentPassword" className="label">Current password</label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className="input"
        />
      </div>

      <div>
        <label htmlFor="newPassword" className="label">New password</label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          autoComplete="new-password"
          className="input"
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="label">Confirm new password</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          className="input"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-danger">{state.error}</p>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? 'Working…' : 'Change password'}
      </button>
    </form>
  );
}
