import Link from 'next/link';
import { getSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shell';

export default async function ConsoleOverview() {
  const session = await getSession();
  const supabase = await createClient();

  const clients = (session?.tenants ?? []).filter((t) => !t.is_internal);
  const { count: serviceCount } = await supabase
    .from('service_catalog')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  const stats = [
    { label: 'Client accounts', value: clients.length },
    { label: 'Active', value: clients.filter((c) => c.status === 'active').length },
    { label: 'Onboarding', value: clients.filter((c) => c.status === 'onboarding').length },
    { label: 'Services in catalog', value: serviceCount ?? 0 },
  ];

  return (
    <>
      <PageHeader
        title={`Good to see you, ${session?.fullName.split(' ')[0]}`}
        description="Every client and every service line, in one place."
      />
      <div className="p-8 space-y-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="card p-5">
              <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
              <div className="text-sm text-muted mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {clients.length === 0 && (
          <div className="card p-8">
            <h2 className="font-medium">Add your first client</h2>
            <p className="hint max-w-lg mt-2">
              Nothing is seeded — real names, branches and GST details should come from you,
              not from a guess. Adding a client creates their account, their first location
              and the portal they will sign into.
            </p>
            <Link href="/console/clients/new" className="btn-primary mt-6">
              Add a client
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
