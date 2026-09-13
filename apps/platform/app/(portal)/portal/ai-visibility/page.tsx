import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getEntitlements, isEntitled } from '@/lib/entitlements';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, EmptyState } from '@/components/shell';
import { ScoreSparkline } from '@/components/nap';
import { ACTIVE_ENGINES, EngineRow, MentionRateTiles, type EngineResult } from '@/components/ai-visibility';

export default async function PortalAiVisibility() {
  const session = await getSession();
  const tenant = session?.tenants[0];
  if (!tenant) redirect('/portal');

  // Product gate, not a security one — RLS already restricts the rows.
  const entitlements = await getEntitlements(tenant.id);
  if (!isEntitled(entitlements, 'geo')) redirect('/portal');

  const supabase = await createClient();

  const { data: prompts } = await supabase
    .from('geo_prompts')
    .select('id, prompt')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('created_at');

  if (!prompts || prompts.length === 0) {
    return (
      <>
        <PageHeader
          title="AI search visibility"
          description="Whether ChatGPT, Perplexity, Gemini and Claude recommend you when a patient asks."
        />
        <div className="p-8">
          <EmptyState
            title="Not set up yet"
            description="Once we have added the questions patients actually ask an AI assistant, this page will show whether each one recommends you."
          />
        </div>
      </>
    );
  }

  // No geo_mentions query here, deliberately — that table names whichever
  // other businesses an engine listed, and this page is the one place that
  // information must never reach. The Console's "staff only" rivals panel is
  // the only place it appears.
  const { data: runs } = await supabase
    .from('geo_runs')
    .select('id, prompt_id, engine, status, was_mentioned, position, share_of_voice, run_at, error')
    .eq('tenant_id', tenant.id)
    .order('run_at', { ascending: false })
    .limit(500);

  const latestByKey = new Map<string, NonNullable<typeof runs>[number]>();
  for (const r of runs ?? []) {
    const key = `${r.prompt_id}|${r.engine}`;
    if (!latestByKey.has(key)) latestByKey.set(key, r);
  }

  const completed = [...latestByKey.values()].filter((r) => r.status === 'completed');

  if (completed.length === 0) {
    return (
      <>
        <PageHeader
          title="AI search visibility"
          description="Whether ChatGPT, Perplexity, Gemini and Claude recommend you when a patient asks."
        />
        <div className="p-8">
          <EmptyState
            title="No checks have run yet"
            description="Once the first check has run, you will see whether each AI assistant mentions you and where, for every question we track."
          />
        </div>
      </>
    );
  }

  const { data: snapshots } = await supabase
    .from('metric_snapshots')
    .select('period_start, value')
    .eq('tenant_id', tenant.id)
    .eq('metric_code', 'visibility_ai_score')
    .order('period_start', { ascending: true })
    .limit(24);

  const mentionedCount = completed.filter((r) => r.was_mentioned).length;

  return (
    <>
      <PageHeader
        title="AI search visibility"
        description="Whether ChatGPT, Perplexity, Gemini and Claude recommend you when a patient asks."
      />

      <div className="p-8 space-y-8 max-w-4xl">
        <MentionRateTiles mentioned={mentionedCount} total={completed.length} />

        {(snapshots ?? []).length >= 3 && (
          <ScoreSparkline
            points={(snapshots ?? []).map((s) => ({ date: s.period_start, value: Number(s.value) }))}
          />
        )}

        {prompts.map((prompt) => (
          <section key={prompt.id} className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-hairline">
              <h2 className="font-medium">&ldquo;{prompt.prompt}&rdquo;</h2>
            </div>
            <div className="divide-y divide-hairline">
              {ACTIVE_ENGINES.map((engine) => {
                const run = latestByKey.get(`${prompt.id}|${engine}`);
                const result: EngineResult | undefined = run
                  ? {
                      engine: run.engine,
                      status: run.status,
                      wasMentioned: run.was_mentioned,
                      position: run.position,
                      shareOfVoice: run.share_of_voice !== null ? Number(run.share_of_voice) : null,
                      error: run.error,
                    }
                  : undefined;
                return <EngineRow key={engine} engine={engine} result={result} />;
              })}
            </div>
          </section>
        ))}

        <p className="text-sm text-muted">
          Share of voice counts how many businesses the assistant named in total — it never names them
          to you, only how you compare.
        </p>
      </div>
    </>
  );
}
