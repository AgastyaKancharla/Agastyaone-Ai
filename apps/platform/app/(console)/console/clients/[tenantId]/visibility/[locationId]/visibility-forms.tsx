'use client';

import { useActionState } from 'react';
import { runVisibilityAudit, type VisibilityState } from './actions';

export function RunVisibilityAuditButton({
  tenantId,
  locationId,
}: {
  tenantId: string;
  locationId: string;
}) {
  const [state, action, pending] = useActionState(runVisibilityAudit, {} as VisibilityState);

  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <input type="hidden" name="location_id" value={locationId} />
      <input type="hidden" name="tenant_id" value={tenantId} />
      <button type="submit" disabled={pending} className="btn-accent">
        {pending ? 'Queueing…' : 'Run visibility audit'}
      </button>
      {state.error && <p className="text-xs text-danger max-w-xs text-right">{state.error}</p>}
      {state.ok && <p className="text-xs text-muted max-w-xs text-right">{state.ok}</p>}
    </form>
  );
}
