'use client';

import { useActionState } from 'react';
import {
  addContact,
  commitImport,
  previewImport,
  setConsent,
  type ContactState,
} from './actions';

type LocationOption = { id: string; name: string };

const CONSENT_SOURCES = [
  ['in_clinic', 'At the clinic'],
  ['booking_form', 'Booking form'],
  ['website_form', 'Website form'],
  ['phone_call', 'Phone call'],
  ['whatsapp_inbound', 'They messaged us'],
  ['import', 'Existing records'],
  ['other', 'Other'],
] as const;

export function AddContactForm({ tenantId, locations }: {
  tenantId: string;
  locations: LocationOption[];
}) {
  const [state, action, pending] = useActionState(addContact, {} as ContactState);

  return (
    <form action={action} className="card p-6 space-y-5">
      <input type="hidden" name="tenant_id" value={tenantId} />

      <div>
        <h2 className="font-medium">Add a patient</h2>
        <p className="hint">
          A phone number is what every later service recognises them by. Stored as +91… however it
          is typed here.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="full_name">Name</label>
          <input id="full_name" name="full_name" className="input" placeholder="Kruthika R" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Phone</label>
          <input id="phone" name="phone" className="input" placeholder="98765 43210" inputMode="tel" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" className="input" type="email" placeholder="optional" />
        </div>
        {locations.length > 0 && (
          <div>
            <label className="label" htmlFor="location_id">Branch</label>
            <select id="location_id" name="location_id" className="input">
              <option value="">No particular branch</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label" htmlFor="consent_source">Where this came from</label>
          <select id="consent_source" name="consent_source" className="input" defaultValue="in_clinic">
            {CONSENT_SOURCES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <p className="hint mt-1">
            Recorded now because it cannot be reconstructed later.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Saving…' : 'Add patient'}
        </button>
        {state.error && <p className="text-xs text-danger">{state.error}</p>}
        {state.ok && <p className="text-xs text-muted">{state.ok}</p>}
      </div>
    </form>
  );
}

export function ImportForm({ tenantId, locations }: {
  tenantId: string;
  locations: LocationOption[];
}) {
  const [preview, previewAction, previewing] = useActionState(previewImport, {} as ContactState);
  const [committed, commitAction, committing] = useActionState(commitImport, {} as ContactState);

  const result = committed.preview ?? preview.preview;
  const showCommit = Boolean(preview.preview) && !committed.ok;

  return (
    <div className="card p-6 space-y-5">
      <div>
        <h2 className="font-medium">Import a list</h2>
        <p className="hint">
          One patient per line: <code className="font-mono">name, phone, email</code>. A header row is
          fine. Check it first — the preview writes nothing.
        </p>
      </div>

      {/* Two forms over one textarea would lose what was typed between preview
          and commit, so both buttons submit the same form to different actions. */}
      <form action={showCommit ? commitAction : previewAction} className="space-y-4">
        <input type="hidden" name="tenant_id" value={tenantId} />

        {locations.length > 0 && (
          <div className="max-w-xs">
            <label className="label" htmlFor="import_location">Branch</label>
            <select id="import_location" name="location_id" className="input">
              <option value="">No particular branch</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="label" htmlFor="csv">Rows</label>
          <textarea
            id="csv"
            name="csv"
            rows={8}
            className="input font-mono text-xs"
            placeholder={'Kruthika R, 98765 43210, kruthika@example.com\nArjun M, 09876500000,'}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={previewing || committing}
            className={showCommit ? 'btn-accent' : 'btn-secondary'}
          >
            {previewing || committing
              ? 'Working…'
              : showCommit
                ? `Import ${preview.preview?.created ?? 0} new`
                : 'Check the file'}
          </button>
          {showCommit && (
            <span className="text-xs text-muted">Nothing has been written yet.</span>
          )}
          {(preview.error || committed.error) && (
            <p className="text-xs text-danger">{preview.error ?? committed.error}</p>
          )}
          {committed.ok && <p className="text-xs text-muted">{committed.ok}</p>}
        </div>
      </form>

      {result && (
        <div className="rounded-lg border border-hairline overflow-hidden">
          <div className="grid grid-cols-3 divide-x divide-hairline bg-brand-wash/40">
            <Stat label="New" value={result.created} />
            <Stat label="Already on file" value={result.matched} />
            <Stat label="Unusable" value={result.skipped} tone={result.skipped > 0 ? 'warn' : undefined} />
          </div>

          {result.errors.length > 0 && (
            <div className="px-4 py-3 border-t border-hairline">
              <p className="text-xs text-muted mb-2">
                These rows have no phone number and no email, so there is no way to recognise them
                again. They will be left out:
              </p>
              <ul className="text-xs space-y-1">
                {result.errors.slice(0, 10).map((e) => (
                  <li key={e.row} className="text-muted">
                    <span className="font-mono">line {e.row}</span> — {e.name || 'no name'}
                  </li>
                ))}
                {result.errors.length > 10 && (
                  <li className="text-muted">…and {result.errors.length - 10} more.</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'warn' | undefined }) {
  return (
    <div className="px-4 py-3 text-center">
      <div className={`text-xl tabular-nums ${tone === 'warn' && value > 0 ? 'text-accent-deep' : ''}`}>
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}

export function ConsentToggle({ tenantId, contactId, channel, optedIn }: {
  tenantId: string;
  contactId: string;
  channel: 'whatsapp' | 'sms' | 'email';
  optedIn: boolean;
}) {
  const [state, action, pending] = useActionState(setConsent, {} as ContactState);

  return (
    <form action={action} className="inline">
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="contact_id" value={contactId} />
      <input type="hidden" name="channel" value={channel} />
      <input type="hidden" name="opted_in" value={optedIn ? 'false' : 'true'} />
      <input type="hidden" name="source" value="in_clinic" />
      <button
        type="submit"
        disabled={pending}
        title={optedIn ? 'Record that they have opted out' : 'Record an opt-in given at the clinic'}
        className={`pill transition ${
          optedIn
            ? 'bg-brand-wash text-brand-deep hover:bg-brand-line'
            : 'bg-hairline text-muted hover:text-ink'
        }`}
      >
        {pending ? '…' : optedIn ? 'WhatsApp ok' : 'no WhatsApp'}
      </button>
      {state.error && <span className="text-[11px] text-danger ml-2">{state.error}</span>}
    </form>
  );
}
