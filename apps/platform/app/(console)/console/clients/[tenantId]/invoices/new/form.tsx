'use client';

import { useActionState } from 'react';
import { generateInvoice, type InvoiceState } from '../actions';

export default function GenerateInvoiceForm({
  tenantId,
  contracts,
}: {
  tenantId: string;
  contracts: { id: string; title: string; reference: string | null }[];
}) {
  const [state, action, pending] = useActionState(generateInvoice, {} as InvoiceState);

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="tenant_id" value={tenantId} />

      <section className="card p-6 space-y-5">
        <div>
          <label htmlFor="contract_id" className="label">Contract *</label>
          <select id="contract_id" name="contract_id" required className="input" defaultValue="">
            <option value="" disabled>Choose an active contract…</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>{c.reference ? `${c.reference} — ` : ''}{c.title}</option>
            ))}
          </select>
          <p className="hint">Every active line on this contract goes onto the invoice.</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="period_start" className="label">Period start</label>
            <input id="period_start" name="period_start" type="date" className="input" />
          </div>
          <div>
            <label htmlFor="period_end" className="label">Period end</label>
            <input id="period_end" name="period_end" type="date" className="input" />
          </div>
          <div>
            <label htmlFor="issue_date" className="label">Issue date</label>
            <input id="issue_date" name="issue_date" type="date" className="input" />
            <p className="hint">Defaults to today.</p>
          </div>
          <div>
            <label htmlFor="due_date" className="label">Due date</label>
            <input id="due_date" name="due_date" type="date" className="input" />
          </div>
        </div>
      </section>

      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Generating…' : 'Generate draft'}
        </button>
      </div>
    </form>
  );
}
