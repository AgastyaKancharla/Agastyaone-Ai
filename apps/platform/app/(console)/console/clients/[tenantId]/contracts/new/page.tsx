import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shell';
import NewContractForm from './form';

export default async function NewContractPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const supabase = await createClient();

  const { data: tenant } = await supabase.from('tenants').select('id, name').eq('id', tenantId).maybeSingle();
  if (!tenant) notFound();

  const { data: masterAgreements } = await supabase
    .from('contracts')
    .select('id, title, reference')
    .eq('tenant_id', tenantId)
    .eq('type', 'msa')
    .order('created_at', { ascending: false });

  return (
    <>
      <PageHeader
        title={`New contract — ${tenant.name}`}
        description="Starts as a draft. Nothing is entitled until it's signed and active."
        action={
          <Link href={`/console/clients/${tenantId}/contracts`} className="btn-secondary">
            Cancel
          </Link>
        }
      />
      <div className="p-8 max-w-2xl">
        <NewContractForm tenantId={tenantId} masterAgreements={masterAgreements ?? []} />
      </div>
    </>
  );
}
