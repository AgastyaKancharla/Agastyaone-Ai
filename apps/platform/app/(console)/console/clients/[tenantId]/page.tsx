import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getEntitlements } from '@/lib/entitlements';
import { PageHeader, StatusPill } from '@/components/shell';
import { stateName } from '@/lib/india';
import { createActionItem } from './actions';

export default async function ClientDetail({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ warn?: string }>;
}) {
  const { tenantId } = await params;
  const { warn } = await searchParams;
  const supabase = await createClient();

  // No .eq('tenant_id', …) guard needed — RLS already restricts this to tenants
  // the caller may see, so a wrong id returns nothing rather than someone
  // else's client.
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, slug, legal_name, vertical, status, health_status, gstin, place_of_supply, billing_email, created_at')
    .eq('id', tenantId)
    .maybeSingle();

  if (!tenant) notFound();

  // Record privileged cross-account access. The function decides whether this
  // qualifies — it no-ops for clients, for assigned staff, and for any scope
  // other than 'all' — so the call site stays unconditional and cannot get the
  // condition wrong. Postgres has no SELECT trigger, so the read path is the
  // only place this can happen.
  await supabase.rpc('log_tenant_access', { p_tenant_id: tenantId, p_reason: 'console_client_detail' });

  const [{ data: locations }, entitlements, { data: catalog }, { data: actionItems }] = await Promise.all([
    supabase
      .from('tenant_locations')
      .select('id, name, address_line1, city, pincode, phone_e164, is_primary, status')
      .eq('tenant_id', tenantId)
      .order('is_primary', { ascending: false }),
    getEntitlements(tenantId),
    supabase.from('service_catalog').select('code, name, is_bundle').eq('status', 'active').order('sort_order'),
    supabase
      .from('client_action_items')
      .select('id, title, status, priority, due_on, blocked_days')
      .eq('tenant_id', tenantId)
      .order('status')
      .order('due_on', { nullsFirst: false }),
  ]);

  const entitledCodes = new Set(entitlements.map((e) => e.service_code));

  return (
    <>
      <PageHeader
        title={tenant.name}
        description={`/${tenant.slug} · ${tenant.vertical}`}
        action={<Link href="/console/clients" className="btn-secondary">Back</Link>}
      />

      <div className="p-8 space-y-8">
        {warn === 'location' && (
          <p className="card p-4 text-sm text-accent-deep border-accent/30">
            The account was created but its first location was not saved. Add one below.
          </p>
        )}

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            <section className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-hairline flex items-center justify-between">
                <h2 className="font-medium">Locations</h2>
                <span className="text-xs text-muted">{locations?.length ?? 0}</span>
              </div>
              {locations && locations.length > 0 ? (
                <ul className="divide-y divide-hairline">
                  {locations.map((l) => (
                    <li key={l.id} className="px-6 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{l.name}</span>
                          {l.is_primary && <span className="pill bg-brand-wash text-brand-deep">primary</span>}
                        </div>
                        <Link
                          href={`/console/clients/${tenantId}/nap/${l.id}`}
                          className="text-xs text-brand hover:underline shrink-0"
                        >
                          Listings →
                        </Link>
                      </div>
                      <div className="text-sm text-muted mt-1">
                        {[l.address_line1, l.city, l.pincode].filter(Boolean).join(', ') || 'No address on file'}
                      </div>
                      {l.phone_e164 && (
                        <div className="text-sm text-muted font-mono mt-0.5">{l.phone_e164}</div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-6 py-8 text-sm text-muted">No locations yet.</p>
              )}
            </section>

            <section className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-hairline">
                <h2 className="font-medium">Services</h2>
                <p className="hint">
                  Switched on by contract. Selling a bundle entitles its components automatically.
                </p>
              </div>
              <ul className="divide-y divide-hairline">
                {(catalog ?? []).map((s) => {
                  const on = entitledCodes.has(s.code);
                  return (
                    <li key={s.code} className="px-6 py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className={`text-sm ${on ? 'font-medium' : 'text-muted'}`}>{s.name}</div>
                        {s.is_bundle && <div className="text-[11px] text-muted">bundle</div>}
                      </div>
                      {on ? (
                        <span className="pill bg-brand-wash text-brand-deep">active</span>
                      ) : (
                        <span className="pill bg-hairline text-muted">not sold</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-hairline">
                <h2 className="font-medium">Waiting on the client</h2>
                <p className="hint">
                  Appears in their portal immediately. Recording it here is what turns
                  &ldquo;we were blocked on you&rdquo; from a memory into a number at renewal.
                </p>
              </div>

              {actionItems && actionItems.length > 0 && (
                <ul className="divide-y divide-hairline">
                  {actionItems.map((a) => (
                    <li key={a.id} className="px-6 py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className={`text-sm ${a.status === 'completed' ? 'text-muted line-through' : 'font-medium'}`}>
                          {a.title}
                        </div>
                        <div className="text-xs text-muted">
                          {a.status === 'completed' && a.blocked_days !== null
                            ? `Closed after ${a.blocked_days} day${a.blocked_days === 1 ? '' : 's'}`
                            : a.due_on
                              ? `Due ${new Date(a.due_on).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                              : 'No due date'}
                        </div>
                      </div>
                      <StatusPill status={a.status === 'completed' ? 'active' : 'onboarding'} />
                    </li>
                  ))}
                </ul>
              )}

              <form action={createActionItem} className="px-6 py-4 border-t border-hairline space-y-3">
                <input type="hidden" name="tenant_id" value={tenantId} />
                <input name="title" required placeholder="What do you need from them?" className="input" />
                <div className="grid gap-3 sm:grid-cols-3">
                  <select name="category" defaultValue="access" className="input">
                    <option value="access">Access</option>
                    <option value="content">Content</option>
                    <option value="approval">Approval</option>
                    <option value="information">Information</option>
                    <option value="payment">Payment</option>
                    <option value="other">Other</option>
                  </select>
                  <select name="priority" defaultValue="normal" className="input">
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                  <input type="date" name="due_on" className="input" />
                </div>
                <button type="submit" className="btn-secondary">Request from client</button>
              </form>
            </section>
          </div>

          <aside className="space-y-8">
            <section className="card p-6 space-y-4">
              <h2 className="font-medium">Account</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Status</dt>
                  <dd><StatusPill status={tenant.status} /></dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Health</dt>
                  <dd><StatusPill status={tenant.health_status} /></dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Legal name</dt>
                  <dd className="text-right">{tenant.legal_name ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Billing email</dt>
                  <dd className="text-right break-all">{tenant.billing_email ?? '—'}</dd>
                </div>
              </dl>
            </section>

            <section className="card p-6 space-y-4">
              <h2 className="font-medium">Tax</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Place of supply</dt>
                  <dd className="text-right">
                    {tenant.place_of_supply
                      ? `${tenant.place_of_supply} — ${stateName(tenant.place_of_supply)}`
                      : '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">GSTIN</dt>
                  <dd className="font-mono text-right break-all">{tenant.gstin ?? 'Not provided'}</dd>
                </div>
              </dl>
              {!tenant.gstin && (
                <p className="hint">Needed before their first invoice can be issued.</p>
              )}
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
