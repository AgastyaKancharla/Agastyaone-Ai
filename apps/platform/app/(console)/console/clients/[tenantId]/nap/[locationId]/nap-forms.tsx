'use client';

import { useActionState } from 'react';
import { runAudit, saveSourceOfTruth, type NapState } from './actions';

type Sot = {
  business_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  locality: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  phone_raw: string | null;
  phone_e164: string | null;
  website: string | null;
  category: string | null;
  version: number;
} | null;

export function RunAuditButton({ tenantId, locationId, disabled }: {
  tenantId: string; locationId: string; disabled: boolean;
}) {
  const [state, action, pending] = useActionState(runAudit, {} as NapState);
  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <input type="hidden" name="location_id" value={locationId} />
      <input type="hidden" name="tenant_id" value={tenantId} />
      <button type="submit" disabled={pending || disabled} className="btn-accent">
        {pending ? 'Queueing…' : 'Run audit'}
      </button>
      {state.error && <p className="text-xs text-danger max-w-xs text-right">{state.error}</p>}
      {state.ok && <p className="text-xs text-muted max-w-xs text-right">{state.ok}</p>}
    </form>
  );
}

export function SourceOfTruthForm({ tenantId, locationId, sot }: {
  tenantId: string; locationId: string; sot: Sot;
}) {
  const [state, action, pending] = useActionState(saveSourceOfTruth, {} as NapState);

  return (
    <form action={action} className="card p-6 space-y-5">
      <input type="hidden" name="location_id" value={locationId} />
      <input type="hidden" name="tenant_id" value={tenantId} />

      <div>
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-medium">Source of truth</h2>
          {sot && <span className="pill bg-brand-wash text-brand-deep">version {sot.version}</span>}
        </div>
        <p className="hint">
          What every directory listing is compared against. Saving creates a new version rather than
          overwriting, so an audit from six months ago still shows what it actually checked.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="business_name" className="label">Business name *</label>
          <input id="business_name" name="business_name" required defaultValue={sot?.business_name ?? ''} className="input" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="address_line1" className="label">Address line 1</label>
          <input id="address_line1" name="address_line1" defaultValue={sot?.address_line1 ?? ''} className="input" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="address_line2" className="label">Address line 2</label>
          <input id="address_line2" name="address_line2" defaultValue={sot?.address_line2 ?? ''} className="input" />
        </div>
        <div>
          <label htmlFor="locality" className="label">Locality</label>
          <input id="locality" name="locality" defaultValue={sot?.locality ?? ''} className="input" placeholder="Koramangala" />
        </div>
        <div>
          <label htmlFor="city" className="label">City</label>
          <input id="city" name="city" defaultValue={sot?.city ?? ''} className="input" placeholder="Bengaluru" />
        </div>
        <div>
          <label htmlFor="state" className="label">State</label>
          <input id="state" name="state" defaultValue={sot?.state ?? ''} className="input" placeholder="Karnataka" />
        </div>
        <div>
          <label htmlFor="pincode" className="label">Pincode</label>
          <input id="pincode" name="pincode" defaultValue={sot?.pincode ?? ''} className="input" inputMode="numeric" />
        </div>
        <div>
          <label htmlFor="phone_raw" className="label">Phone</label>
          <input id="phone_raw" name="phone_raw" defaultValue={sot?.phone_raw ?? ''} className="input" placeholder="080 2345 6789" />
          {sot?.phone_e164 && <p className="hint">Stored as <code className="font-mono">{sot.phone_e164}</code></p>}
        </div>
        <div>
          <label htmlFor="category" className="label">Category</label>
          <input id="category" name="category" defaultValue={sot?.category ?? ''} className="input" placeholder="Dental Clinic" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="website" className="label">Website</label>
          <input id="website" name="website" defaultValue={sot?.website ?? ''} className="input" placeholder="https://clinic.com" />
        </div>
      </div>

      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-brand-deep">{state.ok}</p>}

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? 'Saving…' : sot ? 'Save new version' : 'Set source of truth'}
      </button>
    </form>
  );
}
