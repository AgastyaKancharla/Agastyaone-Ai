'use client';

import { useActionState } from 'react';
import { addPrompt, runChecks, type AiVisibilityState } from './actions';

function Feedback({ state }: { state: AiVisibilityState }) {
  return (
    <>
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-brand-deep">{state.ok}</p>}
    </>
  );
}

export function RunChecksButton({
  tenantId,
  locationId,
  disabled,
}: {
  tenantId: string;
  locationId: string;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(runChecks, {} as AiVisibilityState);

  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="location_id" value={locationId} />
      <button type="submit" disabled={pending || disabled} className="btn-accent">
        {pending ? 'Queueing…' : 'Run checks'}
      </button>
      <div className="max-w-xs text-right">
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function AddPromptForm({ tenantId, locationId }: { tenantId: string; locationId: string }) {
  const [state, action, pending] = useActionState(addPrompt, {} as AiVisibilityState);

  return (
    <form action={action} className="flex items-end gap-3 flex-wrap">
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="location_id" value={locationId} />
      <div className="flex-1 min-w-[20rem]">
        <label htmlFor="prompt" className="label">Question a patient might ask</label>
        <input
          id="prompt"
          name="prompt"
          type="text"
          required
          placeholder="best dental clinic in koramangala for root canal"
          className="input"
        />
      </div>
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? 'Adding…' : 'Add prompt'}
      </button>
      <div className="w-full">
        <Feedback state={state} />
      </div>
    </form>
  );
}
