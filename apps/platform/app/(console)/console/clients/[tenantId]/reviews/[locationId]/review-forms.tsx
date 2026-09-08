'use client';

import { useActionState } from 'react';
import { connectPlace, issueRequest, type ReviewState } from './actions';

type Source = { id: string; external_id: string | null; profile_url: string | null } | null;
type Patient = { id: string; label: string };

export function ConnectPlaceForm({ tenantId, locationId, source }: {
  tenantId: string;
  locationId: string;
  source: Source;
}) {
  const [state, action, pending] = useActionState(connectPlace, {} as ReviewState);

  return (
    <form action={action} className="card p-6 space-y-5">
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="location_id" value={locationId} />

      <div>
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-medium">Google listing</h2>
          {source && <span className="pill bg-brand-wash text-brand-deep">connected</span>}
        </div>
        <p className="hint">
          The place ID is the stable identifier — a listing can be renamed or moved and it stays the
          same. Find it in the clinic&rsquo;s Business Profile, or with Google&rsquo;s Place ID Finder.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="external_id">Place ID</label>
          <input
            id="external_id"
            name="external_id"
            className="input font-mono text-xs"
            placeholder="ChIJ…"
            defaultValue={source?.external_id ?? ''}
          />
        </div>
        <div>
          <label className="label" htmlFor="profile_url">Review link</label>
          <input
            id="profile_url"
            name="profile_url"
            className="input text-xs"
            placeholder="https://g.page/r/…/review"
            defaultValue={source?.profile_url ?? ''}
          />
          <p className="hint mt-1">Where a scanned code sends the patient.</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Saving…' : source ? 'Update' : 'Connect'}
        </button>
        {state.error && <p className="text-xs text-danger">{state.error}</p>}
        {state.ok && <p className="text-xs text-muted">{state.ok}</p>}
      </div>
    </form>
  );
}

/**
 * Picks a patient and issues a code. It deliberately does NOT render the result
 * itself: the action revalidates, and the new code appears at the top of the
 * list below with its QR encoded server-side. A code you can only see once
 * cannot be reprinted, which is the first thing a front desk needs.
 */
export function IssueRequestForm({ tenantId, locationId, sourceId, patients }: {
  tenantId: string;
  locationId: string;
  sourceId: string;
  patients: Patient[];
}) {
  const [state, action, pending] = useActionState(issueRequest, {} as ReviewState);

  if (patients.length === 0) {
    return (
      <p className="text-sm text-muted">
        No patients on file yet. Add them under{' '}
        <a href={`/console/clients/${tenantId}/contacts`} className="text-brand hover:underline">
          patients
        </a>{' '}
        first.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="location_id" value={locationId} />
      <input type="hidden" name="source_id" value={sourceId} />

      <div className="flex-1 min-w-[16rem]">
        <label className="label" htmlFor="contact_id">Patient</label>
        <select id="contact_id" name="contact_id" className="input">
          {patients.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </div>

      <button type="submit" disabled={pending} className="btn-accent">
        {pending ? 'Creating…' : 'Create code'}
      </button>

      {state.error && <p className="w-full text-xs text-danger">{state.error}</p>}
      {state.ok && <p className="w-full text-xs text-muted">{state.ok}</p>}
    </form>
  );
}

export function CopyLinkButton({ url }: { url: string }) {
  return (
    <button
      type="button"
      className="text-[11px] text-brand hover:underline"
      onClick={() => {
        void navigator.clipboard.writeText(url);
      }}
    >
      copy link
    </button>
  );
}
