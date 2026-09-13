import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, EmptyState } from '@/components/shell';
import { CATEGORY_LABEL, ServiceStatusPill } from '@/components/services';
import { formatINR } from '@/lib/india';

export default async function ServicesPage() {
  const supabase = await createClient();

  const { data: services } = await supabase
    .from('service_catalog')
    .select('id, code, name, category, is_bundle, default_price, billing_cycle, status')
    .order('sort_order');

  return (
    <>
      <PageHeader
        title="Service catalog"
        description="What AgastyaOne sells. Selling a bundle entitles its components automatically."
        action={
          <Link href="/console/services/new" className="btn-primary">
            Add service
          </Link>
        }
      />

      <div className="p-8 max-w-4xl">
        {(services ?? []).length === 0 ? (
          <EmptyState
            title="No services yet"
            description="Add the first one — everything sold through a contract comes from this list."
            action={
              <Link href="/console/services/new" className="btn-primary">
                Add service
              </Link>
            }
          />
        ) : (
          <section className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-brand-wash border-b border-hairline">
                <tr>
                  <th className="th">Name</th>
                  <th className="th">Category</th>
                  <th className="th">Price</th>
                  <th className="th">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {(services ?? []).map((s) => (
                  <tr key={s.id} className="hover:bg-brand-wash/40 transition">
                    <td className="td text-sm">
                      <Link href={`/console/services/${s.id}`} className="hover:underline">
                        {s.name}
                      </Link>
                      {s.is_bundle && <span className="pill bg-hairline text-muted ml-2">bundle</span>}
                      <div className="hint font-mono">{s.code}</div>
                    </td>
                    <td className="td text-xs text-muted">{CATEGORY_LABEL[s.category] ?? s.category}</td>
                    <td className="td tabular-nums text-sm">{formatINR(s.default_price)}</td>
                    <td className="td"><ServiceStatusPill status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </>
  );
}
