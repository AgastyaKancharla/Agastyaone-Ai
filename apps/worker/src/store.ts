import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AuditSummary, DirectoryResult, SourceOfTruth } from '@agastyaone/nap-engine';
import { CONFIG } from './config.ts';

/**
 * The worker is the one place the service-role key legitimately lives. It runs
 * across every tenant by design, so RLS is bypassed here and tenancy is carried
 * explicitly on every row it writes — which is why tenant_id is threaded
 * through rather than inferred.
 */
export const db: SupabaseClient = createClient(CONFIG.supabaseUrl, CONFIG.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function loadSourceOfTruth(sotId: string): Promise<SourceOfTruth> {
  const { data, error } = await db
    .from('nap_source_of_truth')
    .select('business_name, address_line1, address_line2, locality, city, state, pincode, phone_e164, website, category')
    .eq('id', sotId)
    .single();

  if (error || !data) throw new Error(`Source of truth ${sotId} not found: ${error?.message}`);

  return {
    businessName: data.business_name ?? '',
    addressLine1: data.address_line1 ?? undefined,
    addressLine2: data.address_line2 ?? undefined,
    locality: data.locality ?? undefined,
    city: data.city ?? undefined,
    state: data.state ?? undefined,
    pincode: data.pincode ?? undefined,
    phoneE164: data.phone_e164 ?? undefined,
    website: data.website ?? undefined,
    category: data.category ?? undefined,
  };
}

let directoryIds: Map<string, string> | null = null;

/** Cached for the process — the registry changes about once a year. */
export async function getDirectoryIds(): Promise<Map<string, string>> {
  if (directoryIds) return directoryIds;
  const { data, error } = await db.from('directories').select('id, code').eq('is_enabled', true);
  if (error) throw new Error(`Could not load directories: ${error.message}`);
  directoryIds = new Map((data ?? []).map((d) => [d.code as string, d.id as string]));
  return directoryIds;
}

export async function markRunning(auditId: string): Promise<void> {
  await db.from('nap_audits').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', auditId);
}

export async function markFailed(auditId: string, message: string): Promise<void> {
  await db
    .from('nap_audits')
    .update({ status: 'failed', error_message: message.slice(0, 2000), completed_at: new Date().toISOString() })
    .eq('id', auditId);
}

/**
 * Results are written RELATIONALLY — one row per directory, one row per field
 * diff — not as a `report_json` blob the way the retired worker did it.
 *
 * The blob made the whole schema pointless: you could not ask "which clients
 * have a wrong phone on Justdial this month" without parsing every report in
 * the table. Queryable history is the reason the tables exist.
 */
export async function saveResults(
  auditId: string,
  tenantId: string,
  results: DirectoryResult[],
  summary: AuditSummary,
): Promise<void> {
  const dirIds = await getDirectoryIds();

  for (const r of results) {
    const directoryId = dirIds.get(r.directoryCode);
    if (!directoryId) continue;

    const { data: row, error } = await db
      .from('nap_audit_results')
      .insert({
        tenant_id: tenantId,
        audit_id: auditId,
        directory_id: directoryId,
        directory_code: r.directoryCode,
        status: r.status,
        listing_url: r.listingUrl,
        found: r.found,
        match_confidence: r.matchConfidence,
        runner_up_margin: r.runnerUpMargin,
        overall_confidence: r.overallConfidence,
        is_claimed: r.isClaimed,
        rating: r.rating,
        review_count: r.reviewCount,
        error_message: r.errorMessage,
      })
      .select('id')
      .single();

    if (error || !row) throw new Error(`Could not store ${r.directoryCode} result: ${error?.message}`);

    if (r.diffs.length > 0) {
      const { error: diffError } = await db.from('nap_field_diffs').insert(
        r.diffs.map((d) => ({
          tenant_id: tenantId,
          result_id: row.id,
          field_name: d.field,
          source_value: d.sourceValue,
          found_value: d.foundValue,
          match_status: d.status,
          similarity_score: d.similarity,
          notes: d.note,
        })),
      );
      if (diffError) throw new Error(`Could not store diffs: ${diffError.message}`);
    }
  }

  const { error: auditError } = await db
    .from('nap_audits')
    .update({
      status: 'completed',
      directories_checked: summary.directoriesChecked,
      directories_errored: summary.directoriesErrored,
      consistent_count: summary.consistentCount,
      drift_count: summary.driftCount,
      inconsistent_count: summary.inconsistentCount,
      not_found_count: summary.notFoundCount,
      ambiguous_count: summary.ambiguousCount,
      audit_score: summary.auditScore,
      coverage_pct: summary.coveragePct,
      completed_at: new Date().toISOString(),
    })
    .eq('id', auditId);

  // The nap_audits_counts_ck constraint fires here if the five status counters
  // ever stop summing to directories_checked — a schema-level backstop for the
  // exact arithmetic the retired tool got wrong.
  if (auditError) throw new Error(`Could not finalise audit: ${auditError.message}`);
}
