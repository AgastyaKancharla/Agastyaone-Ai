import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/shell';
import { ACTIVE_ENGINES, EngineRow, MentionRateTiles, type EngineResult } from '@/components/ai-visibility';
import { removePrompt } from './actions';
import { AddPromptForm, RunChecksButton } from './ai-visibility-forms';

export default async function LocationAiVisibilityPage({
  params,
}: {
  params: Promise<{ tenantId: string; locationId: string }>;
}) {
  const { tenantId, locationId } = await params;
  const supabase = await createClient();

  const { data: location } = await supabase
    .from('tenant_locations')
    .select('id, name, tenant_id')
    .eq('id', locationId)
    .maybeSingle();

  if (!location || location.tenant_id !== tenantId) notFound();

  await supabase.rpc('log_tenant_access', {
    p_tenant_id: tenantId,
    p_reason: 'console_ai_visibility_detail',
  });

  const [{ data: prompts }, { data: runs }] = await Promise.all([
    supabase
      .from('geo_prompts')
      .select('id, prompt, is_active')
      .eq('location_id', locationId)
      .order('created_at'),
    supabase
      .from('geo_runs')
      .select('id, prompt_id, engine, status, was_mentioned, position, share_of_voice, response_text, run_at, error')
      .eq('location_id', locationId)
      .order('run_at', { ascending: false })
      .limit(500),
  ]);

  // Latest completed-or-failed run per (prompt, engine) — sorted newest first
  // above, so the first one seen per key is the one that counts.
  const latestByKey = new Map<string, NonNullable<typeof runs>[number]>();
  for (const r of runs ?? []) {
    const key = `${r.prompt_id}|${r.engine}`;
    if (!latestByKey.has(key)) latestByKey.set(key, r);
  }

  const latestRunIds = [...latestByKey.values()].map((r) => r.id);
  const { data: mentions } = latestRunIds.length
    ? await supabase
        .from('geo_mentions')
        .select('run_id, entity_name, is_client')
        .in('run_id', latestRunIds)
        .eq('is_client', false)
    : { data: null };

  const rivalsByRun = new Map<string, string[]>();
  for (const m of mentions ?? []) {
    const list = rivalsByRun.get(m.run_id) ?? [];
    list.push(m.entity_name);
    rivalsByRun.set(m.run_id, list);
  }

  const completed = [...latestByKey.values()].filter((r) => r.status === 'completed');
  const mentionedCount = completed.filter((r) => r.was_mentioned).length;

  return (
    <>
      <PageHeader
        title={`${location.name} — AI search visibility`}
        description="Whether ChatGPT, Perplexity, Gemini and Claude recommend this clinic when a patient asks."
        action={
          <RunChecksButton
            tenantId={tenantId}
            locationId={locationId}
            disabled={(prompts ?? []).length === 0}
          />
        }
      />

      <div className="p-8 space-y-8 max-w-4xl">
        {completed.length > 0 && (
          <MentionRateTiles mentioned={mentionedCount} total={completed.length} />
        )}

        <section className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-hairline">
            <h2 className="font-medium">Prompts tracked</h2>
            <p className="hint">
              Questions a patient would actually type into ChatGPT or ask Gemini — not the clinic&rsquo;s
              own name.
            </p>
          </div>

          {(prompts ?? []).length === 0 ? (
            <p className="px-6 py-6 text-sm text-muted">
              Nothing tracked yet. Add a prompt below to make checking possible.
            </p>
          ) : null}

          <div className="px-6 py-5 border-t border-hairline">
            <AddPromptForm tenantId={tenantId} locationId={locationId} />
          </div>
        </section>

        {(prompts ?? []).map((prompt) => {
          const results = new Map<string, EngineResult>();
          let rivals: string[] = [];
          let anyResponse = false;

          for (const engine of ACTIVE_ENGINES) {
            const run = latestByKey.get(`${prompt.id}|${engine}`);
            if (!run) continue;
            results.set(engine, {
              engine: run.engine,
              status: run.status,
              wasMentioned: run.was_mentioned,
              position: run.position,
              shareOfVoice: run.share_of_voice !== null ? Number(run.share_of_voice) : null,
              error: run.error,
            });
            if (run.response_text) anyResponse = true;
            rivals = [...rivals, ...(rivalsByRun.get(run.id) ?? [])];
          }
          const uniqueRivals = [...new Set(rivals)];

          return (
            <section key={prompt.id} className="card overflow-hidden">
              <div className="px-6 py-4 border-b border-hairline flex items-center justify-between gap-4">
                <h2 className="font-medium">&ldquo;{prompt.prompt}&rdquo;</h2>
                <form action={removePrompt}>
                  <input type="hidden" name="tenant_id" value={tenantId} />
                  <input type="hidden" name="location_id" value={locationId} />
                  <input type="hidden" name="prompt_id" value={prompt.id} />
                  <button type="submit" className="text-xs text-muted hover:text-danger shrink-0">
                    Remove
                  </button>
                </form>
              </div>

              <div className="divide-y divide-hairline">
                {ACTIVE_ENGINES.map((engine) => (
                  <EngineRow key={engine} engine={engine} result={results.get(engine)} />
                ))}
              </div>

              {uniqueRivals.length > 0 && (
                <div className="px-6 py-4 border-t border-hairline bg-brand-wash/20">
                  <p className="text-xs text-muted mb-1">
                    Other businesses named for this prompt — staff only, never shown on the client&rsquo;s
                    Portal.
                  </p>
                  <p className="text-sm">{uniqueRivals.join(', ')}</p>
                </div>
              )}

              {anyResponse && (
                <details className="px-6 py-4 border-t border-hairline">
                  <summary className="text-sm text-muted cursor-pointer">See the raw answers</summary>
                  <div className="mt-3 space-y-3">
                    {ACTIVE_ENGINES.map((engine) => {
                      const run = latestByKey.get(`${prompt.id}|${engine}`);
                      if (!run?.response_text) return null;
                      return (
                        <div key={engine}>
                          <div className="text-xs font-medium text-muted mb-1">
                            {engine} ·{' '}
                            {new Date(run.run_at).toLocaleString('en-IN', {
                              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                            })}
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{run.response_text}</p>
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}
            </section>
          );
        })}

        <p className="text-sm text-muted">
          <Link href={`/console/clients/${tenantId}`} className="text-brand hover:underline">
            ← Back to client
          </Link>
        </p>
      </div>
    </>
  );
}
