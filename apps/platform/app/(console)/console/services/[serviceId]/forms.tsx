'use client';

import { useActionState } from 'react';
import { addServiceComponent, addServiceDeliverable, updateService, type ServiceState } from '../actions';

type Service = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  default_price: number | null;
  billing_cycle: string;
  default_hsn_sac: string | null;
  default_gst_rate: number;
  sort_order: number;
  status: string;
};

export function EditServiceForm({ service }: { service: Service }) {
  const [state, action, pending] = useActionState(updateService, {} as ServiceState);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="service_id" value={service.id} />

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="label">Name *</label>
          <input id="name" name="name" required defaultValue={service.name} className="input" />
        </div>
        <div>
          <label htmlFor="category" className="label">Category</label>
          <select id="category" name="category" defaultValue={service.category} className="input">
            <option value="presence">Presence</option>
            <option value="acquisition">Acquisition</option>
            <option value="engagement">Engagement</option>
            <option value="operations">Operations</option>
            <option value="insight">Insight</option>
          </select>
        </div>
        <div>
          <label htmlFor="status" className="label">Status</label>
          <select id="status" name="status" defaultValue={service.status} className="input">
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="deprecated">Deprecated</option>
          </select>
          <p className="hint">Deprecated hides it from new contracts without touching what&rsquo;s already sold.</p>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="description" className="label">Description</label>
          <textarea id="description" name="description" rows={2} defaultValue={service.description ?? ''} className="input" />
        </div>
        <div>
          <label htmlFor="default_price" className="label">Default price (₹)</label>
          <input id="default_price" name="default_price" type="number" step="0.01" min="0" defaultValue={service.default_price ?? ''} className="input" />
        </div>
        <div>
          <label htmlFor="billing_cycle" className="label">Billing cycle</label>
          <select id="billing_cycle" name="billing_cycle" defaultValue={service.billing_cycle} className="input">
            <option value="one_time">One-time</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Annual</option>
          </select>
        </div>
        <div>
          <label htmlFor="default_gst_rate" className="label">GST rate (%)</label>
          <input id="default_gst_rate" name="default_gst_rate" type="number" step="0.01" min="0" defaultValue={service.default_gst_rate} className="input" />
        </div>
        <div>
          <label htmlFor="default_hsn_sac" className="label">HSN/SAC code</label>
          <input id="default_hsn_sac" name="default_hsn_sac" defaultValue={service.default_hsn_sac ?? ''} className="input" />
        </div>
        <div>
          <label htmlFor="sort_order" className="label">Sort order</label>
          <input id="sort_order" name="sort_order" type="number" defaultValue={service.sort_order} className="input" />
        </div>
      </div>

      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-brand-deep">{state.ok}</p>}

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}

export function AddComponentForm({
  parentServiceId,
  options,
}: {
  parentServiceId: string;
  options: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(addServiceComponent, {} as ServiceState);

  return (
    <form action={action} className="flex items-end gap-3">
      <input type="hidden" name="parent_service_id" value={parentServiceId} />
      <div className="flex-1">
        <label htmlFor="child_service_id" className="label">Add a service</label>
        {options.length === 0 ? (
          <p className="hint">Every active, non-bundle service is already included.</p>
        ) : (
          <select id="child_service_id" name="child_service_id" required className="input" defaultValue="">
            <option value="" disabled>Choose…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        )}
      </div>
      {options.length > 0 && (
        <button type="submit" disabled={pending} className="btn-secondary">
          {pending ? 'Adding…' : 'Add'}
        </button>
      )}
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}

export function AddDeliverableForm({ serviceId }: { serviceId: string }) {
  const [state, action, pending] = useActionState(addServiceDeliverable, {} as ServiceState);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="service_id" value={serviceId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <input name="name" required className="input sm:col-span-2" placeholder="Monthly ranking report" />
        <select name="cadence" defaultValue="monthly" className="input">
          <option value="once">Once</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="annual">Annual</option>
          <option value="on_demand">On demand</option>
        </select>
      </div>
      <input name="description" className="input" placeholder="Description (optional)" />
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-secondary">
        {pending ? 'Adding…' : 'Add deliverable'}
      </button>
    </form>
  );
}
