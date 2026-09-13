/** Shared presentation for contracts, invoices and payments. */

export function ContractStatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    draft: 'bg-hairline text-muted',
    sent: 'bg-accent/10 text-accent-deep',
    signed: 'bg-brand-wash text-brand-deep',
    active: 'bg-brand-wash text-brand-deep',
    completed: 'bg-hairline text-muted',
    terminated: 'bg-danger/10 text-danger',
  };
  return <span className={`pill ${tone[status] ?? 'bg-hairline text-muted'}`}>{status}</span>;
}

export function InvoiceStatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    draft: 'bg-hairline text-muted',
    issued: 'bg-accent/10 text-accent-deep',
    part_paid: 'bg-accent/10 text-accent-deep',
    paid: 'bg-brand-wash text-brand-deep',
    cancelled: 'bg-hairline text-muted',
    written_off: 'bg-danger/10 text-danger',
  };
  return <span className={`pill ${tone[status] ?? 'bg-hairline text-muted'}`}>{status.replace('_', ' ')}</span>;
}

export const CONTRACT_TYPE_LABEL: Record<string, string> = {
  msa: 'Master Service Agreement',
  sow: 'Statement of Work',
  change_request: 'Change Request',
};

export const COMMERCIAL_MODEL_LABEL: Record<string, string> = {
  retainer: 'Retainer',
  fixed_price: 'Fixed price',
  time_and_materials: 'Time & materials',
  outcome: 'Outcome-based',
};

export const BILLING_CYCLE_LABEL: Record<string, string> = {
  one_time: 'One-time',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
};
