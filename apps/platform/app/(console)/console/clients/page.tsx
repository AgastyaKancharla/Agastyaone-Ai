import Link from 'next/link';
import { getSession } from '@/lib/session';
import { PageHeader, StatusPill, EmptyState } from '@/components/shell';

export default async function ClientsPage() {
  const session = await getSession();
  const tenants = session?.tenants ?? [];

  return (
    <>
      <PageHeader
        title="Clients"
        description="Every account you have visibility of."
        action={
          <Link href="/console/clients/new" className="btn-primary">
            Add client
          </Link>
        }
      />
      <div className="p-8">
        {tenants.length === 0 ? (
          <EmptyState
            title="No accounts yet"
            description="Add your first client to create their account, their first location and the portal they sign into."
            action={
              <Link href="/console/clients/new" className="btn-primary">
                Add client
              </Link>
            }
          />
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-brand-wash border-b border-hairline">
                <tr>
                  <th className="th">Account</th>
                  <th className="th">Vertical</th>
                  <th className="th">Status</th>
                  <th className="th">Health</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-brand-wash/40 transition">
                    <td className="td">
                      <Link href={`/console/clients/${t.id}`} className="font-medium hover:text-brand">
                        {t.name}
                      </Link>
                      {t.is_internal && (
                        <span className="pill bg-accent/10 text-accent-deep ml-2">internal</span>
                      )}
                      <div className="text-xs text-muted">/{t.slug}</div>
                    </td>
                    <td className="td capitalize text-muted">{t.vertical}</td>
                    <td className="td"><StatusPill status={t.status} /></td>
                    <td className="td"><StatusPill status={t.health_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
