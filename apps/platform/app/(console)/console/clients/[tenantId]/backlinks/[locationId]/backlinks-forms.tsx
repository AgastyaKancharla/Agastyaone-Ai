'use client';

import { useActionState } from 'react';
import { runBacklinksCheck, type BacklinksState } from './actions';

export function RunCheckButton({ tenantId, locationId }: { tenantId: string; locationId: string }) {
  const [state, action, pending] = useActionState(runBacklinksCheck, {} as BacklinksState);

  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="location_id" value={locationId} />
      <button type="submit" disabled={pending} className="btn-accent">
        {pending ? 'Queueing…' : 'Run check'}
      </button>
      <div className="max-w-xs text-right">
        {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
        {state.ok && <p className="text-sm text-brand-deep">{state.ok}</p>}
      </div>
    </form>
  );
}
