'use client';

import { useActionState, useState } from 'react';
import { addContractLine, type ContractState } from '../actions';

type Service = { id: string; code: string; name: string; default_hsn_sac: string | null; default_gst_rate: number };

export function AddLineForm({
  tenantId,
  contractId,
  services,
}: {
  tenantId: string;
  contractId: string;
  services: Service[];
}) {
  const [state, action, pending] = useActionState(addContractLine, {} as ContractState);
  const [serviceId, setServiceId] = useState('');
  const selected = services.find((s) => s.id === serviceId);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="contract_id" value={contractId} />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <label htmlFor="service_id" className="label">Service</label>
          <select
            id="service_id"
            name="service_id"
            required
            className="input"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
          >
            <option value="">Choose a service…</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="quantity" className="label">Quantity</label>
          <input id="quantity" name="quantity" type="number" step="1" min="1" defaultValue="1" className="input" />
        </div>
        <div>
          <label htmlFor="unit_price" className="label">Unit price (₹)</label>
          <input id="unit_price" name="unit_price" type="number" step="0.01" min="0" required className="input" placeholder="15000" />
        </div>
        <div>
          <label htmlFor="discount_pct" className="label">Discount %</label>
          <input id="discount_pct" name="discount_pct" type="number" step="0.01" min="0" max="100" defaultValue="0" className="input" />
        </div>
        <div>
          <label htmlFor="gst_rate" className="label">GST rate %</label>
          <input
            id="gst_rate"
            name="gst_rate"
            type="number"
            step="0.01"
            min="0"
            defaultValue={selected?.default_gst_rate ?? 18}
            key={selected?.id ?? 'default'}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="hsn_sac_code" className="label">HSN/SAC</label>
          <input
            id="hsn_sac_code"
            name="hsn_sac_code"
            defaultValue={selected?.default_hsn_sac ?? ''}
            key={`${selected?.id ?? 'default'}-hsn`}
            className="input"
          />
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
          <label htmlFor="starts_on" className="label">Starts</label>
          <input id="starts_on" name="starts_on" type="date" className="input" />
        </div>
        <div className="sm:col-span-3">
          <label htmlFor="description" className="label">Description</label>
          <input id="description" name="description" className="input" placeholder="Optional — shown on the invoice line" />
        </div>
      </div>

      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-brand-deep">{state.ok}</p>}

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? 'Adding…' : 'Add line'}
      </button>
    </form>
  );
}
