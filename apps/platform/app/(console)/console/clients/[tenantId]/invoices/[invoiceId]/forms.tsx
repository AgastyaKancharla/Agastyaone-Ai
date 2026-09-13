'use client';

import { useActionState } from 'react';
import { recordPayment, issueCreditNote, type InvoiceState } from '../actions';

export function RecordPaymentForm({ tenantId, invoiceId }: { tenantId: string; invoiceId: string }) {
  const [state, action, pending] = useActionState(recordPayment, {} as InvoiceState);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="invoice_id" value={invoiceId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="amount" className="label">Amount received *</label>
          <input id="amount" name="amount" type="number" step="0.01" min="0.01" required className="input" />
        </div>
        <div>
          <label htmlFor="tds_amount" className="label">TDS deducted</label>
          <input id="tds_amount" name="tds_amount" type="number" step="0.01" min="0" defaultValue="0" className="input" />
        </div>
        <div>
          <label htmlFor="method" className="label">Method</label>
          <select id="method" name="method" defaultValue="upi" className="input">
            <option value="upi">UPI</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
            <option value="card">Card</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="received_on" className="label">Received on</label>
          <input id="received_on" name="received_on" type="date" className="input" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="reference" className="label">Reference</label>
          <input id="reference" name="reference" className="input" placeholder="UTR / transaction ID" />
        </div>
      </div>

      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-brand-deep">{state.ok}</p>}

      <button type="submit" disabled={pending} className="btn-secondary">
        {pending ? 'Recording…' : 'Record payment'}
      </button>
    </form>
  );
}

export function IssueCreditNoteForm({
  tenantId,
  invoiceId,
  remaining,
}: {
  tenantId: string;
  invoiceId: string;
  remaining: number;
}) {
  const [state, action, pending] = useActionState(issueCreditNote, {} as InvoiceState);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="invoice_id" value={invoiceId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="taxable_amount" className="label">Taxable amount to credit *</label>
          <input
            id="taxable_amount"
            name="taxable_amount"
            type="number"
            step="0.01"
            min="0.01"
            max={remaining}
            defaultValue={remaining > 0 ? remaining.toFixed(2) : undefined}
            required
            className="input"
          />
          <p className="hint">Up to {remaining.toFixed(2)} left on this invoice. GST is scaled to match.</p>
        </div>
        <div>
          <label htmlFor="reason" className="label">Reason *</label>
          <input id="reason" name="reason" required className="input" placeholder="Billing error, service not delivered…" />
        </div>
      </div>

      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-brand-deep">{state.ok}</p>}

      <button type="submit" disabled={pending || remaining <= 0} className="btn-secondary">
        {pending ? 'Drafting…' : 'Draft credit note'}
      </button>
    </form>
  );
}
