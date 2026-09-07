import { getSession } from '@/lib/session';
import { getEntitlements, isEntitled } from '@/lib/entitlements';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, EmptyState } from '@/components/shell';
import { PORTAL_MODULES } from '@/lib/modules';

export default async function PortalOverview() {
  const session = await getSession();
  const tenant = session?.tenants[0];
  if (!tenant) return null;

  const supabase = await createClient();
  const [entitlements, { data: locations }, { data: actions }] = await Promise.all([
    getEntitlements(tenant.id),
    supabase.from('tenant_locations').select('id, name, city').eq('status', 'active'),
    supabase
      .from('client_action_items')
      .select('id, title, description, category, priority, due_on')
      .in('status', ['open', 'in_progress'])
      .order('due_on', { nullsFirst: false })
      .limit(5),
  ]);

  const active = PORTAL_MODULES.filter((m) => isEntitled(entitlements, m.code));

  return (
    <>
      <PageHeader
        title={tenant.name}
        description={
          locations && locations.length > 0
            ? locations.map((l) => l.name).join(' · ')
            : 'Your account with AgastyaOne'
        }
      />

      <div className="p-8 space-y-8">
        {/* Waiting-on-you comes first. It is the single biggest cause of delay in
            agency delivery, and burying it is how weeks disappear. */}
        {actions && actions.length > 0 && (
          <section className="card overflow-hidden border-accent/30">
            <div className="px-6 py-4 border-b border-hairline bg-accent/5">
              <h2 className="font-medium">Waiting on you</h2>
              <p className="hint">We need these from your side to keep things moving.</p>
            </div>
            <ul className="divide-y divide-hairline">
              {actions.map((a) => (
                <li key={a.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{a.title}</div>
                      {a.description && <p className="hint">{a.description}</p>}
                    </div>
                    {a.due_on && (
                      <span className="pill bg-accent/10 text-accent-deep shrink-0">
                        due {new Date(a.due_on).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="font-medium mb-4">Your services</h2>
          {active.length === 0 ? (
            <EmptyState
              title="Nothing switched on yet"
              description="Once your services are live they will appear here, each with its own reporting. Your account manager will let you know as they go live."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((m) => (
                <div key={m.code} className="card p-5">
                  <div className="h-9 w-9 rounded-lg bg-brand-wash grid place-items-center text-brand">
                    {m.icon}
                  </div>
                  <div className="mt-3 font-medium text-sm">{m.label}</div>
                  <div className="text-xs text-muted mt-1">Active</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
