import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { getEntitlements, isEntitled } from '@/lib/entitlements';
import { createClient } from '@/lib/supabase/server';
import { PageHeader, EmptyState } from '@/components/shell';
import { ScoreSparkline } from '@/components/nap';
import {
  FindingKindPill,
  PillarBars,
  SIGNAL_GROUP_LABEL,
  VisibilityScoreHero,
} from '@/components/visibility';

/**
 * What a finding means to the CLIENT — what it costs them, not what the rule
 * is called. Same translation layer as CLIENT_MEANING on the Listings page:
 * the Console and the Portal report identical numbers in different words.
 */
const KIND_MEANING: Record<string, string> = {
  issue: 'Something here is actively costing you visibility.',
  opportunity: "Nothing is broken — this is visibility you're leaving on the table.",
};

const GROUP_MEANING: Record<string, string> = {
  seo: 'What decides whether you appear in ordinary Google results.',
  geo: 'What decides whether ChatGPT, Perplexity and Gemini recommend you when someone asks for a clinic.',
  aeo: 'What decides whether your answer is the one read aloud, or shown at the top of the page.',
};

export default async function PortalVisibility() {
  const session = await getSession();
  const tenant = session?.tenants[0];
  if (!tenant) redirect('/portal');

  // Product gate, not a security one — RLS already restricts the rows.
  const entitlements = await getEntitlements(tenant.id);
  if (!isEntitled(entitlements, 'visibility')) redirect('/portal');

  const supabase = await createClient();

  const { data: latest } = await supabase
    .from('visibility_audits')
    .select('id, composite_score, coverage_pct, website_url, completed_at, tenant_locations ( name )')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest) {
    return (
      <>
        <PageHeader title="Your visibility" description="One score for how findable you are online." />
        <div className="p-8">
          <EmptyState
            title="No visibility check has run yet"
            description="Once the first check has run you will see a single score here, built from your map ranking, your website, your directory listings, your reviews and how AI assistants describe you — along with exactly what to fix first."
          />
        </div>
      </>
    );
  }

  const [{ data: pillars }, { data: findings }, { data: snapshots }] = await Promise.all([
    supabase
      .from('visibility_pillar_scores')
      .select('pillar, score, weight, measured')
      .eq('audit_id', latest.id),
    supabase
      .from('visibility_website_findings')
      .select('kind, signal_group, rule_label, severity, remediation')
      .eq('audit_id', latest.id)
      .neq('kind', 'passed'),
    supabase
      .from('metric_snapshots')
      .select('period_start, value')
      .eq('metric_code', 'visibility_score')
      .order('period_start', { ascending: true })
      .limit(24),
  ]);

  const ORDER = ['map_rank', 'website', 'citations', 'reviews', 'ai_visibility', 'backlinks'];
  const orderedPillars = (pillars ?? []).slice().sort(
    (a, b) => ORDER.indexOf(a.pillar) - ORDER.indexOf(b.pillar),
  );
  const measuredCount = orderedPillars.filter((p) => p.measured).length;

  const issues = (findings ?? []).filter((f) => f.kind === 'issue');
  const opportunities = (findings ?? []).filter((f) => f.kind === 'opportunity');

  return (
    <>
      <PageHeader
        title="Your visibility"
        description="One score for how findable you are online, and what to fix first."
      />

      <div className="p-8 space-y-8 max-w-4xl">
        <VisibilityScoreHero
          score={latest.composite_score}
          coverage={latest.coverage_pct}
          measured={measuredCount}
          asOf={latest.completed_at}
        />

        <ScoreSparkline
          points={(snapshots ?? []).map((s) => ({ date: s.period_start, value: Number(s.value) }))}
        />

        <section className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-hairline">
            <h2 className="font-medium">Where your score comes from</h2>
            <p className="hint">
              Six things decide how findable you are. Anything we could not measure this time is left
              out of the average entirely — it never counts against you.
            </p>
          </div>
          <PillarBars pillars={orderedPillars} />
        </section>

        {(issues.length > 0 || opportunities.length > 0) && (
          <section className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-hairline">
              <h2 className="font-medium">What to fix on your website</h2>
              <p className="hint">
                In order. The first list costs you visibility today; the second is visibility you
                could add.
              </p>
            </div>
            <div className="divide-y divide-hairline">
              {[...issues, ...opportunities].map((f, i) => (
                <div key={i} className="px-6 py-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FindingKindPill kind={f.kind} />
                    <span className="pill bg-hairline text-muted">
                      {SIGNAL_GROUP_LABEL[f.signal_group] ?? f.signal_group}
                    </span>
                    <span className="text-sm font-medium">{f.rule_label}</span>
                  </div>
                  <p className="hint mt-1">{KIND_MEANING[f.kind]}</p>
                  {f.remediation && <p className="text-sm mt-1">{f.remediation}</p>}
                  <p className="hint mt-1 text-muted">{GROUP_MEANING[f.signal_group]}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
