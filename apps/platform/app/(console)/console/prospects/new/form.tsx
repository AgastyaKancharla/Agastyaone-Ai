'use client';

import { useActionState } from 'react';
import { createProspect, type ProspectState } from '../actions';

export default function NewProspectForm() {
  const [state, action, pending] = useActionState(createProspect, {} as ProspectState);

  return (
    <form action={action} className="space-y-8">
      <section className="card p-6 space-y-5">
        <div>
          <h2 className="font-medium">The business</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="name" className="label">Business name *</label>
            <input id="name" name="name" required className="input" placeholder="Smile Care Dental" />
          </div>
          <div>
            <label htmlFor="vertical" className="label">Vertical</label>
            <select id="vertical" name="vertical" defaultValue="dental" className="input">
              <option value="dental">Dental</option>
              <option value="clinic">Clinic</option>
              <option value="retail">Retail</option>
              <option value="services">Services</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label htmlFor="city" className="label">City</label>
            <input id="city" name="city" className="input" placeholder="Bengaluru" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="address_line1" className="label">Address</label>
            <input id="address_line1" name="address_line1" className="input" />
          </div>
          <div>
            <label htmlFor="website" className="label">Website</label>
            <input id="website" name="website" type="url" className="input" placeholder="https://…" />
          </div>
          <div>
            <label htmlFor="phone" className="label">Phone</label>
            <input id="phone" name="phone" className="input" />
          </div>
        </div>
      </section>

      <section className="card p-6 space-y-5">
        <div>
          <h2 className="font-medium">Google listing</h2>
          <p className="hint">
            Needed for map-pack ranking and their live rating. Find it via Google&rsquo;s{' '}
            <a
              href="https://developers.google.com/maps/documentation/places/web-service/place-id"
              target="_blank"
              rel="noreferrer"
              className="text-brand hover:underline"
            >
              Place ID Finder
            </a>{' '}
            — search the business, copy the ID it shows.
          </p>
        </div>
        <div>
          <label htmlFor="gbp_place_id" className="label">Google Place ID</label>
          <input id="gbp_place_id" name="gbp_place_id" className="input font-mono" placeholder="ChIJ…" />
          <p className="hint">Optional — you can add this later, but ranking data needs it.</p>
        </div>
      </section>

      <section className="card p-6 space-y-5">
        <div>
          <h2 className="font-medium">How patients find them (optional)</h2>
          <p className="hint">Leave blank and I&rsquo;ll guess something reasonable from the vertical and city.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="search_phrase" className="label">A Google search phrase</label>
            <input id="search_phrase" name="search_phrase" className="input" placeholder="dentist near Koramangala" />
          </div>
          <div>
            <label htmlFor="question" className="label">A question for an AI assistant</label>
            <input id="question" name="question" className="input" placeholder="best dentist in Koramangala for root canal" />
          </div>
        </div>
      </section>

      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Creating…' : 'Add prospect'}
        </button>
      </div>
    </form>
  );
}
