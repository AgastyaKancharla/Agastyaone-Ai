'use client';

import { useActionState } from 'react';
import { createService, type ServiceState } from '../actions';

export default function NewServiceForm() {
  const [state, action, pending] = useActionState(createService, {} as ServiceState);

  return (
    <form action={action} className="space-y-8">
      <section className="card p-6 space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="label">Name *</label>
            <input id="name" name="name" required className="input" placeholder="AI Appointment Bot" />
          </div>
          <div>
            <label htmlFor="code" className="label">Code *</label>
            <input id="code" name="code" required className="input" placeholder="ai_appointment_bot" />
            <p className="hint">Short, stable, used internally — not shown to clients.</p>
          </div>
          <div>
            <label htmlFor="category" className="label">Category</label>
            <select id="category" name="category" defaultValue="engagement" className="input">
              <option value="presence">Presence</option>
              <option value="acquisition">Acquisition</option>
              <option value="engagement">Engagement</option>
              <option value="operations">Operations</option>
              <option value="insight">Insight</option>
            </select>
          </div>
          <div>
            <label htmlFor="status" className="label">Status</label>
            <select id="status" name="status" defaultValue="draft" className="input">
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="deprecated">Deprecated</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="description" className="label">Description</label>
            <textarea id="description" name="description" rows={2} className="input" />
          </div>
          <div>
            <label htmlFor="default_price" className="label">Default price (₹)</label>
            <input id="default_price" name="default_price" type="number" step="0.01" min="0" className="input" />
          </div>
          <div>
            <label htmlFor="billing_cycle" className="label">Billing cycle</label>
            <select id="billing_cycle" name="billing_cycle" defaultValue="monthly" className="input">
              <option value="one_time">One-time</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annual">Annual</option>
            </select>
          </div>
          <div>
            <label htmlFor="default_gst_rate" className="label">GST rate (%)</label>
            <input id="default_gst_rate" name="default_gst_rate" type="number" step="0.01" min="0" defaultValue="18" className="input" />
          </div>
          <div>
            <label htmlFor="default_hsn_sac" className="label">HSN/SAC code</label>
            <input id="default_hsn_sac" name="default_hsn_sac" className="input" placeholder="998314" />
          </div>
          <div>
            <label htmlFor="sort_order" className="label">Sort order</label>
            <input id="sort_order" name="sort_order" type="number" defaultValue="0" className="input" />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input id="is_bundle" name="is_bundle" type="checkbox" className="h-4 w-4" />
            <label htmlFor="is_bundle" className="text-sm">This is a bundle of other services</label>
          </div>
        </div>
      </section>

      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Creating…' : 'Create'}
        </button>
      </div>
    </form>
  );
}
