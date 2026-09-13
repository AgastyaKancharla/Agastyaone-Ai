import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shell';
import GenerateInvoiceForm from './form';

export default async function NewInvoicePage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const supabase = await createClient();

  const { data: tenant } = await supabase.from('tenants').select('id, name, gstin').eq('id', tenantId).maybeSingle();
  if (!tenant) notFound();

  const { data: contracts } = await supabase
    .from('contracts')
    .select('id, title, reference')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  return (
    <>
      <PageHeader
        title={`Generate invoice — ${tenant.name}`}
        description="Pulls every currently-active line from the contract you pick. Starts as a draft — nothing is numbered or final until you mark it issued."
        action={
          <Link href={`/console/clients/${tenantId}/invoices`} className="btn-secondary">
            Cancel
          </Link>
        }
      />
      <div className="p-8 max-w-2xl space-y-6">
        {!tenant.gstin && (
          <p className="card p-4 text-sm text-accent-deep border-accent/30">
            This client has no GSTIN on file. The invoice will still generate — the GSTIN field will just be blank
            until one is added.
          </p>
        )}
        {(contracts ?? []).length === 0 ? (
          <p className="card p-6 text-sm text-muted">
            No active contracts for this client yet. A contract has to be signed and active before it has anything
            billable on it.
          </p>
        ) : (
          <GenerateInvoiceForm tenantId={tenantId} contracts={contracts ?? []} />
        )}
      </div>
    </>
  );
}
