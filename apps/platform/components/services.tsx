/** Shared presentation for the service catalog. */

export function ServiceStatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    active: 'bg-brand-wash text-brand-deep',
    draft: 'bg-accent/10 text-accent-deep',
    deprecated: 'bg-hairline text-muted',
  };
  return <span className={`pill ${tone[status] ?? 'bg-hairline text-muted'}`}>{status}</span>;
}

export const CATEGORY_LABEL: Record<string, string> = {
  presence: 'Presence',
  acquisition: 'Acquisition',
  engagement: 'Engagement',
  operations: 'Operations',
  insight: 'Insight',
};

export const CADENCE_LABEL: Record<string, string> = {
  once: 'Once',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
  on_demand: 'On demand',
};
