import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, EmptyState } from '@/components/shell';

export default async function ProspectsPage() {
  const supabase = await createClient();

  const { data: prospects } = await supabase
    .from('tenants')
    .select('id, name, vertical, created_at, tenant_locations ( city )')
    .eq('status', 'prospect')
    .order('created_at', { ascending: false });

  return (
    <>
      <PageHeader
        title="Prospects"
        description="Businesses you're researching before pitching them — not paying clients yet. Convert one once they sign."
        action={
          <Link href="/console/prospects/new" className="btn-primary">
            Add prospect
          </Link>
        }
      />

      <div className="p-8 max-w-4xl">
        {(prospects ?? []).length === 0 ? (
          <EmptyState
            title="No prospects yet"
            description="Add a business to run an Express or Deep audit against it — no contract or billing details needed."
            action={
              <Link href="/console/prospects/new" className="btn-primary">
                Add prospect
              </Link>
            }
          />
        ) : (
          <section className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-brand-wash border-b border-hairline">
                <tr>
                  <th className="th">Business</th>
                  <th className="th">City</th>
                  <th className="th">Vertical</th>
                  <th className="th">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {(prospects ?? []).map((p) => {
                  const locations = p.tenant_locations as unknown as { city: string | null }[];
                  return (
                    <tr key={p.id} className="hover:bg-brand-wash/40 transition">
                      <td className="td text-sm">
                        <Link href={`/console/prospects/${p.id}`} className="font-medium hover:text-brand">
                          {p.name}
                        </Link>
                      </td>
                      <td className="td text-sm text-muted">{locations?.[0]?.city ?? '—'}</td>
                      <td className="td text-xs text-muted capitalize">{p.vertical}</td>
                      <td className="td text-xs text-muted">
                        {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </>
  );
}
