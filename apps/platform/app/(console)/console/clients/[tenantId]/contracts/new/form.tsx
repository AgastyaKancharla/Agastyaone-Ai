'use client';

import { useActionState, useState } from 'react';
import { createContract, type ContractState } from '../actions';

export default function NewContractForm({
  tenantId,
  masterAgreements,
}: {
  tenantId: string;
  masterAgreements: { id: string; title: string; reference: string | null }[];
}) {
  const [state, action, pending] = useActionState(createContract, {} as ContractState);
  const [type, setType] = useState('sow');

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="tenant_id" value={tenantId} />

      <section className="card p-6 space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="title" className="label">Title *</label>
            <input id="title" name="title" required className="input" placeholder="Digital Visibility — annual retainer" />
          </div>
          <div>
            <label htmlFor="type" className="label">Type</label>
            <select
              id="type"
              name="type"
              className="input"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="msa">Master Service Agreement</option>
              <option value="sow">Statement of Work</option>
              <option value="change_request">Change Request</option>
            </select>
          </div>
          <div>
            <label htmlFor="commercial_model" className="label">Commercial model</label>
            <select id="commercial_model" name="commercial_model" defaultValue="retainer" className="input">
              <option value="retainer">Retainer</option>
              <option value="fixed_price">Fixed price</option>
              <option value="time_and_materials">Time & materials</option>
              <option value="outcome">Outcome-based</option>
            </select>
          </div>

          {type !== 'msa' && masterAgreements.length > 0 && (
            <div className="sm:col-span-2">
              <label htmlFor="parent_contract_id" className="label">Under which MSA?</label>
              <select id="parent_contract_id" name="parent_contract_id" className="input" defaultValue="">
                <option value="">None — standalone</option>
                {masterAgreements.map((m) => (
                  <option key={m.id} value={m.id}>{m.reference ? `${m.reference} — ` : ''}{m.title}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="starts_on" className="label">Starts</label>
            <input id="starts_on" name="starts_on" type="date" className="input" />
          </div>
          <div>
            <label htmlFor="ends_on" className="label">Ends</label>
            <input id="ends_on" name="ends_on" type="date" className="input" />
            <p className="hint">Leave blank for an open-ended retainer.</p>
          </div>
        </div>
      </section>

      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Creating…' : 'Create draft'}
        </button>
      </div>
    </form>
  );
}
