import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shell';
import { CADENCE_LABEL } from '@/components/services';
import { formatINR } from '@/lib/india';
import { removeServiceComponent, removeServiceDeliverable } from '../actions';
import { AddComponentForm, AddDeliverableForm, EditServiceForm } from './forms';

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}) {
  const { serviceId } = await params;
  const supabase = await createClient();

  const { data: service } = await supabase
    .from('service_catalog')
    .select('id, code, name, category, description, is_bundle, default_price, billing_cycle, default_hsn_sac, default_gst_rate, sort_order, status')
    .eq('id', serviceId)
    .maybeSingle();

  if (!service) notFound();

  const [{ data: components }, { data: pickableServices }, { data: deliverables }] = await Promise.all([
    service.is_bundle
      ? supabase
          .from('service_components')
          .select('child_service_id, service_catalog!service_components_child_service_id_fkey ( id, name, default_price )')
          .eq('parent_service_id', serviceId)
          .order('sort_order')
      : Promise.resolve({ data: [] as never[] }),
    service.is_bundle
      ? supabase
          .from('service_catalog')
          .select('id, name')
          .eq('is_bundle', false)
          .eq('status', 'active')
          .neq('id', serviceId)
          .order('sort_order')
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    supabase
      .from('service_deliverables')
      .select('id, name, description, cadence')
      .eq('service_id', serviceId)
      .order('sort_order'),
  ]);

  const includedIds = new Set((components ?? []).map((c) => c.child_service_id));
  const availableToAdd = (pickableServices ?? []).filter((s) => !includedIds.has(s.id));

  return (
    <>
      <PageHeader
        title={service.name}
        description={`${service.code}${service.is_bundle ? ' · bundle' : ''}`}
        action={
          <Link href="/console/services" className="btn-ghost">
            ← All services
          </Link>
        }
      />

      <div className="p-8 space-y-8 max-w-3xl">
        <section className="card p-6">
          <h2 className="font-medium mb-4">Details</h2>
          <EditServiceForm service={service} />
        </section>

        {service.is_bundle && (
          <section className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-hairline">
              <h2 className="font-medium">Bundle includes</h2>
              <p className="hint">One level deep — a bundle cannot include another bundle.</p>
            </div>
            {(components ?? []).length > 0 && (
              <ul className="divide-y divide-hairline">
                {(components ?? []).map((c) => {
                  const child = c.service_catalog as unknown as { id: string; name: string; default_price: number | null };
                  return (
                    <li key={c.child_service_id} className="px-6 py-3 flex items-center justify-between gap-4 text-sm">
                      <span>{child?.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-muted tabular-nums">{formatINR(child?.default_price)}</span>
                        <form action={removeServiceComponent}>
                          <input type="hidden" name="parent_service_id" value={serviceId} />
                          <input type="hidden" name="child_service_id" value={c.child_service_id} />
                          <button type="submit" className="text-xs text-muted hover:text-danger">Remove</button>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="px-6 py-5 border-t border-hairline">
              <AddComponentForm parentServiceId={serviceId} options={availableToAdd} />
            </div>
          </section>
        )}

        <section className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-hairline">
            <h2 className="font-medium">Deliverables</h2>
            <p className="hint">The recurring checklist this service actually produces.</p>
          </div>
          {(deliverables ?? []).length > 0 && (
            <ul className="divide-y divide-hairline">
              {(deliverables ?? []).map((d) => (
                <li key={d.id} className="px-6 py-3 flex items-center justify-between gap-4 text-sm">
                  <div>
                    <span>{d.name}</span>
                    <span className="text-muted text-xs ml-2">{CADENCE_LABEL[d.cadence] ?? d.cadence}</span>
                    {d.description && <div className="hint">{d.description}</div>}
                  </div>
                  <form action={removeServiceDeliverable}>
                    <input type="hidden" name="service_id" value={serviceId} />
                    <input type="hidden" name="deliverable_id" value={d.id} />
                    <button type="submit" className="text-xs text-muted hover:text-danger">Remove</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <div className="px-6 py-5 border-t border-hairline">
            <AddDeliverableForm serviceId={serviceId} />
          </div>
        </section>
      </div>
    </>
  );
}
