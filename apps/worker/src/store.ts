import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@agastyaone/db/types';
import type { AuditSummary, DirectoryResult, NmcComplianceResult, SourceOfTruth } from '@agastyaone/nap-engine';
import type { VisibilityRun } from './visibility.ts';
import { rollupCompetitors, type PointResult, type ScanRun, type ScanTarget } from './mapRank.ts';
import { CONFIG } from './config.ts';

/**
 * The worker is the one place the service-role key legitimately lives. It runs
 * across every tenant by design, so RLS is bypassed here and tenancy is carried
 * explicitly on every row it writes — which is why tenant_id is threaded
 * through rather than inferred.
 */
export const db: SupabaseClient<Database> = createClient<Database>(CONFIG.supabaseUrl, CONFIG.serviceRoleKey, {
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

/** Everything the worker needs to scan one keyword, in one round trip. */
export async function loadScanTarget(scanId: string): Promise<ScanTarget> {
  const { data, error } = await db
    .from('map_scans')
    .select('id, tenant_id, location_id, keyword, grid_size, spacing_m, center_lat, center_lng, tenant_locations ( name, gbp_place_id )')
    .eq('id', scanId)
    .single();

  if (error || !data) throw new Error(`Scan ${scanId} not found: ${error?.message}`);

  const location = data.tenant_locations as { name: string | null; gbp_place_id: string | null } | null;

  return {
    scanId: data.id,
    tenantId: data.tenant_id,
    locationId: data.location_id,
    keyword: data.keyword,
    businessName: location?.name ?? '',
    placeId: location?.gbp_place_id ?? null,
    centreLat: Number(data.center_lat),
    centreLng: Number(data.center_lng),
    gridSize: data.grid_size,
    spacingM: data.spacing_m,
  };
}

/**
 * Points a previous attempt already completed.
 *
 * This is what makes a pgmq redelivery free rather than a second full bill.
 * Only settled outcomes count: a point that was blocked or errored last time is
 * worth retrying, so it is deliberately not loaded here.
 */
export async function loadCompletedPoints(scanId: string): Promise<Map<number, PointResult>> {
  const { data } = await db
    .from('map_scan_points')
    .select('idx, row_n, col_n, lat, lng, status, rank, matched_place_id, result_count')
    .eq('scan_id', scanId)
    .in('status', ['found', 'not_ranked', 'ambiguous']);

  const done = new Map<number, PointResult>();
  for (const row of data ?? []) {
    done.set(row.idx, {
      point: { idx: row.idx, row: row.row_n, col: row.col_n, lat: Number(row.lat), lng: Number(row.lng) },
      status: row.status as PointResult['status'],
      rank: row.rank,
      matchedPlaceId: row.matched_place_id,
      resultCount: row.result_count,
      errorMessage: null,
      // Competitors were already persisted on the first attempt; re-reading them
      // only to re-write them would be work for nothing.
      competitors: [],
    });
  }
  return done;
}

export async function markMapScanRunning(
  scanId: string,
  providerCode: string,
  zoom: number,
  fingerprint: string,
): Promise<void> {
  await db
    .from('map_scans')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
      provider_code: providerCode,
      zoom,
      grid_fingerprint: fingerprint,
    })
    .eq('id', scanId);
}

export async function markMapScanFailed(scanId: string, message: string): Promise<void> {
  await db
    .from('map_scans')
    .update({ status: 'failed', error_message: message.slice(0, 2000), completed_at: new Date().toISOString() })
    .eq('id', scanId);
}

/** Upsert on (scan_id, idx) so a resumed scan overwrites rather than duplicates. */
export async function saveScanPoint(
  scanId: string,
  tenantId: string,
  result: PointResult,
): Promise<void> {
  const { error } = await db.from('map_scan_points').upsert(
    {
      tenant_id: tenantId,
      scan_id: scanId,
      idx: result.point.idx,
      row_n: result.point.row,
      col_n: result.point.col,
      lat: result.point.lat,
      lng: result.point.lng,
      status: result.status,
      rank: result.rank,
      matched_place_id: result.matchedPlaceId,
      result_count: result.resultCount,
      error_message: result.errorMessage,
      checked_at: new Date().toISOString(),
    },
    { onConflict: 'scan_id,idx' },
  );
  if (error) throw new Error(`Could not store point ${result.point.idx}: ${error.message}`);

  if (result.competitors.length > 0) {
    await db.from('map_scan_competitors').insert(
      result.competitors.map((c) => ({
        tenant_id: tenantId,
        scan_id: scanId,
        point_idx: result.point.idx,
        rank: c.rank,
        place_id: c.placeId,
        name: c.name,
        rating: c.rating,
        review_count: c.reviewCount,
      })),
    );
  }
}

/**
 * Finalise the scan. Points are already stored; this writes the rollup and the
 * header, in that order, because the metrics trigger fires on the header's
 * status change and a snapshot should never precede the data it summarises.
 */
export async function finaliseMapScan(run: ScanRun, target: ScanTarget): Promise<void> {
  const rollup = rollupCompetitors(run.points);
  if (rollup.length > 0) {
    await db.from('map_scan_competitor_rollup').upsert(
      rollup.map((c) => ({
        tenant_id: target.tenantId,
        scan_id: target.scanId,
        place_id: c.placeId,
        name: c.name,
        points_seen: c.pointsSeen,
        avg_rank: c.avgRank,
        solv: c.solv,
      })),
      { onConflict: 'scan_id,name' },
    );
  }

  const m = run.metrics;
  const blocked = run.points.filter((p) => p.status === 'blocked').length;
  const errored = run.points.filter((p) => p.status === 'error').length;

  const { error } = await db
    .from('map_scans')
    .update({
      // 'partial' is not a failure: it is a scan that lost points but still has
      // something to say. The coverage gate in the trigger decides separately
      // whether it earned a place on the trend line.
      status: m.pointsScanned === m.pointsRequested ? 'completed' : 'partial',
      points_scanned: m.pointsScanned,
      points_found: m.pointsFound,
      points_blocked: blocked,
      points_errored: errored,
      arp: m.arp,
      atrp: m.atrp,
      solv: m.solv,
      score: m.score,
      coverage_pct: m.coveragePct,
      cost_micros: run.costMicros,
      completed_at: new Date().toISOString(),
    })
    .eq('id', target.scanId);

  if (error) throw new Error(`Could not finalise scan: ${error.message}`);
}

export async function markVisibilityRunning(auditId: string): Promise<void> {
  await db
    .from('visibility_audits')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', auditId);
}

export async function markVisibilityFailed(auditId: string, message: string): Promise<void> {
  await db
    .from('visibility_audits')
    .update({ status: 'failed', error_message: message.slice(0, 2000), completed_at: new Date().toISOString() })
    .eq('id', auditId);
}

/**
 * Children first, header last.
 *
 * The order is load-bearing: app.snapshot_visibility_metrics() fires on the
 * transition into 'completed' and reads the pillar rows and findings to
 * snapshot the website sub-score and the open-issue count. Flipping the status
 * first would snapshot an audit that had no children yet.
 */
export async function saveVisibilityResults(
  auditId: string,
  tenantId: string,
  run: VisibilityRun,
): Promise<void> {
  const { error: pillarError } = await db.from('visibility_pillar_scores').upsert(
    run.composite.pillars.map((p) => ({
      tenant_id: tenantId,
      audit_id: auditId,
      pillar: p.pillar,
      score: p.score,
      weight: p.weight,
      measured: p.measured,
      detail: p.detail,
    })),
    { onConflict: 'audit_id,pillar' },
  );
  if (pillarError) throw new Error(`Could not store pillar scores: ${pillarError.message}`);

  if (run.website) {
    const { error: findingsError } = await db.from('visibility_website_findings').insert(
      run.website.findings.map((f) => ({
        tenant_id: tenantId,
        audit_id: auditId,
        kind: f.kind,
        signal_group: f.signalGroup,
        rule_label: f.ruleLabel,
        severity: f.severity,
        snippet: f.snippet,
        remediation: f.remediation,
      })),
    );
    if (findingsError) throw new Error(`Could not store website findings: ${findingsError.message}`);
  }

  const { error: auditError } = await db
    .from('visibility_audits')
    .update({
      status: 'completed',
      composite_score: run.composite.score,
      coverage_pct: run.composite.coveragePct,
      website_url: run.websiteUrl,
      completed_at: new Date().toISOString(),
    })
    .eq('id', auditId);

  if (auditError) throw new Error(`Could not finalise visibility audit: ${auditError.message}`);
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
  compliance: NmcComplianceResult | null,
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

  // Same relational-not-blob rule as nap_field_diffs: one row per finding, so
  // "which clients are missing a privacy policy this month" is a query.
  if (compliance) {
    const { error: findingsError } = await db.from('nap_compliance_findings').insert(
      compliance.findings.map((f) => ({
        tenant_id: tenantId,
        audit_id: auditId,
        kind: f.kind,
        rule_label: f.ruleLabel,
        severity: f.severity,
        snippet: f.snippet,
        remediation: f.remediation,
      })),
    );
    if (findingsError) throw new Error(`Could not store compliance findings: ${findingsError.message}`);
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
      website_checked_for_compliance: compliance !== null,
      compliance_score: compliance?.score ?? null,
      is_compliant: compliance?.isCompliant ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', auditId);

  // The nap_audits_counts_ck constraint fires here if the five status counters
  // ever stop summing to directories_checked — a schema-level backstop for the
  // exact arithmetic the retired tool got wrong.
  if (auditError) throw new Error(`Could not finalise audit: ${auditError.message}`);
}
