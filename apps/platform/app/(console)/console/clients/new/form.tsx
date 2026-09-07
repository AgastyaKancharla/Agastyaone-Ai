'use client';

import { useActionState } from 'react';
import { createTenant, type CreateState } from './actions';
import { GST_STATES } from '@/lib/india';

export default function NewClientForm() {
  const [state, action, pending] = useActionState(createTenant, {} as CreateState);

  return (
    <form action={action} className="space-y-8">
      <section className="card p-6 space-y-5">
        <div>
          <h2 className="font-medium">The business</h2>
          <p className="hint">How the client appears across the platform and on documents.</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="name" className="label">Business name *</label>
            <input id="name" name="name" required className="input" placeholder="Nissa Dental Clinic" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="legal_name" className="label">Legal name</label>
            <input id="legal_name" name="legal_name" className="input" placeholder="As registered, if different" />
            <p className="hint">Used on invoices when it differs from the trading name.</p>
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
            <label htmlFor="billing_email" className="label">Billing email</label>
            <input id="billing_email" name="billing_email" type="email" className="input" placeholder="accounts@clinic.com" />
          </div>
        </div>
      </section>

      <section className="card p-6 space-y-5">
        <div>
          <h2 className="font-medium">Tax</h2>
          <p className="hint">
            Place of supply decides whether their invoices carry CGST + SGST or IGST. It cannot be
            reconstructed later, so it is captured now even if the GSTIN is not ready.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="place_of_supply" className="label">Place of supply *</label>
            <select id="place_of_supply" name="place_of_supply" required defaultValue="29" className="input">
              {GST_STATES.map((s) => (
                <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="gstin" className="label">GSTIN</label>
            <input id="gstin" name="gstin" className="input font-mono uppercase" placeholder="29ABCDE1234F1Z5" maxLength={15} />
            <p className="hint">Optional now; needed before their first invoice.</p>
          </div>
        </div>
      </section>

      <section className="card p-6 space-y-5">
        <div>
          <h2 className="font-medium">First location</h2>
          <p className="hint">
            Listings, calls, reviews and bookings all attach to a branch rather than to the
            business, so there is always at least one.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="location_name" className="label">Location name</label>
            <input id="location_name" name="location_name" className="input" placeholder="Koramangala" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="address_line1" className="label">Address</label>
            <input id="address_line1" name="address_line1" className="input" placeholder="No. 45, 100 Feet Road, 4th Block" />
          </div>
          <div>
            <label htmlFor="city" className="label">City</label>
            <input id="city" name="city" className="input" placeholder="Bengaluru" />
          </div>
          <div>
            <label htmlFor="pincode" className="label">Pincode</label>
            <input id="pincode" name="pincode" className="input" placeholder="560034" inputMode="numeric" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="phone" className="label">Phone</label>
            <input id="phone" name="phone" className="input" placeholder="080 2345 6789" />
            <p className="hint">Stored in international format, so every channel resolves to one contact.</p>
          </div>
        </div>
      </section>

      {state.error && (
        <p role="alert" className="text-sm text-danger">{state.error}</p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Creating…' : 'Create client'}
        </button>
      </div>
    </form>
  );
}
