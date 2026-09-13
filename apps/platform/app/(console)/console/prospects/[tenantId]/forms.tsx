'use client';

import { useActionState } from 'react';
import type { ProspectState } from '../actions';

type RunAction = (prev: ProspectState, formData: FormData) => Promise<ProspectState>;

function AuditButton({
  tenantId,
  action,
  label,
  pendingLabel,
  variant,
}: {
  tenantId: string;
  action: RunAction;
  label: string;
  pendingLabel: string;
  variant: 'primary' | 'secondary';
}) {
  const [state, formAction, pending] = useActionState(action, {} as ProspectState);

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <input type="hidden" name="tenant_id" value={tenantId} />
        <button type="submit" disabled={pending} className={variant === 'primary' ? 'btn-primary' : 'btn-secondary'}>
          {pending ? pendingLabel : label}
        </button>
      </form>
      {state.ok && <p className="text-xs text-brand-deep max-w-sm">{state.ok}</p>}
      {state.error && <p className="text-xs text-danger max-w-sm">{state.error}</p>}
    </div>
  );
}

export function ExpressAuditForm({ tenantId, action }: { tenantId: string; action: RunAction }) {
  return (
    <AuditButton tenantId={tenantId} action={action} label="Run Express audit" pendingLabel="Queuing…" variant="secondary" />
  );
}

export function DeepAuditForm({ tenantId, action }: { tenantId: string; action: RunAction }) {
  return (
    <AuditButton tenantId={tenantId} action={action} label="Run Deep audit" pendingLabel="Queuing…" variant="primary" />
  );
}
