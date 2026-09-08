import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, EmptyState } from '@/components/shell';
import { AddContactForm, ImportForm, ConsentToggle } from './contact-forms';

export default async function ClientContacts({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const supabase = await createClient();

  // RLS scopes every read below; a wrong id returns nothing rather than
  // someone else's patient list.
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('id', tenantId)
    .maybeSingle();

  if (!tenant) notFound();

  await supabase.rpc('log_tenant_access', {
    p_tenant_id: tenantId,
    p_reason: 'console_contacts',
  });

  const [{ data: locations }, { data: contacts, count }, { data: candidates }] = await Promise.all([
    supabase
      .from('tenant_locations')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .order('is_primary', { ascending: false }),
    supabase
      .from('contacts')
      .select(
        'id, full_name, primary_phone_e164, primary_email, consent_source, whatsapp_opt_in_at, whatsapp_opt_out_at, created_at',
        { count: 'exact' },
      )
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(100),
    // Populated when an import attaches an identity that already belongs to
    // someone else. Never auto-merged: a wrong merge is unrecoverable across
    // eight tables, so it waits for a person.
    supabase
      .from('contact_match_candidates')
      .select('id, contact_a_id, contact_b_id, score, signals')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .limit(20),
  ]);

  const locationOptions = (locations ?? []).map((l) => ({ id: l.id, name: l.name }));

  return (
    <>
      <PageHeader
        title={`${tenant.name} — patients`}
        description="The shared record every service line recognises a person by."
        action={
          <Link href={`/console/clients/${tenantId}`} className="btn-ghost">
            ← Back to client
          </Link>
        }
      />

      <div className="p-8 space-y-8 max-w-4xl">
        <div className="grid gap-6 lg:grid-cols-2 items-start">
          <AddContactForm tenantId={tenantId} locations={locationOptions} />
          <ImportForm tenantId={tenantId} locations={locationOptions} />
        </div>

        {candidates && candidates.length > 0 && (
          <section className="card overflow-hidden border-accent/40">
            <div className="px-6 py-4 border-b border-hairline">
              <h2 className="font-medium">Possible duplicates</h2>
              <p className="hint">
                The same phone or email turned up on two records. Nothing has been merged — a merge
                that turns out to be wrong is not something we can cleanly undo, so these wait for a
                person.
              </p>
            </div>
            <ul className="divide-y divide-hairline">
              {candidates.map((c) => (
                <li key={c.id} className="px-6 py-3 text-sm">
                  <span className="text-muted">
                    {(c.signals as { detail?: string } | null)?.detail ??
                      'Two records share an identity.'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-hairline flex items-baseline justify-between gap-4">
            <div>
              <h2 className="font-medium">Patients</h2>
              <p className="hint">
                {count !== null && count > 100
                  ? `Showing the 100 most recent of ${count}.`
                  : 'Everyone on file for this client.'}
              </p>
            </div>
          </div>

          {!contacts || contacts.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No patients yet"
                description="Add one above, or paste the clinic's existing list. Numbers written three different ways still land on one record."
              />
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-brand-wash border-b border-hairline">
                <tr>
                  <th className="th">Name</th>
                  <th className="th">Phone</th>
                  <th className="th">Source</th>
                  <th className="th">Messaging</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {contacts.map((c) => {
                  // Opted in only while there is an opt-in and no later opt-out.
                  const optedIn =
                    c.whatsapp_opt_in_at !== null &&
                    (c.whatsapp_opt_out_at === null || c.whatsapp_opt_out_at < c.whatsapp_opt_in_at);

                  return (
                    <tr key={c.id} className="hover:bg-brand-wash/40 transition">
                      <td className="td font-medium">{c.full_name ?? '—'}</td>
                      <td className="td font-mono text-xs">{c.primary_phone_e164 ?? '—'}</td>
                      <td className="td text-xs text-muted">{c.consent_source ?? '—'}</td>
                      <td className="td">
                        <ConsentToggle
                          tenantId={tenantId}
                          contactId={c.id}
                          channel="whatsapp"
                          optedIn={optedIn}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <p className="text-xs text-muted max-w-2xl">
          An imported record says where it came from, not that anyone agreed to be messaged. Until an
          opt-in is recorded here, a patient can be handed a review QR code — which is not messaging
          them — but WhatsApp, SMS and email are refused by the database itself.
        </p>
      </div>
    </>
  );
}
