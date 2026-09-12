-- =============================================================================
-- 0021_nap_compliance
--
-- NMC/DCI healthcare-advertising compliance, folded into the existing
-- directory_nap audit rather than shipped as a new service. The worker
-- already opens a Playwright context per audit and already carries the
-- client's website as part of the source of truth (nap_source_of_truth.website)
-- -- this adds one more thing that audit run checks and one more place its
-- findings live, not a new subsystem.
--
-- Findings are stored relationally, one row per finding, for the same reason
-- nap_field_diffs exists instead of a report blob on nap_audits: "which
-- clients are missing a privacy policy this month" has to be answerable with
-- a query.
-- =============================================================================

alter table nap_audits
  add column website_checked_for_compliance boolean not null default false,
  add column compliance_score               numeric(5,2),
  add column is_compliant                   boolean;

-- False/null until a check actually runs. A location with no website on file
-- is skipped, never penalised -- the same "coverage, not score-drag"
-- principle the five directory-status counters already apply.

create table nap_compliance_findings (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  audit_id      uuid not null references nap_audits(id) on delete cascade,
  -- 'violation': a prohibited claim was found on the page.
  -- 'missing_disclosure': a mandatory disclosure was NOT found.
  -- 'disclosure_present': a mandatory disclosure WAS found -- kept so the
  --   client sees a complete checklist, not just what's wrong.
  kind          text not null
                  check (kind in ('violation','missing_disclosure','disclosure_present')),
  rule_label    text not null,
  severity      text check (severity is null or severity in ('high','medium','low')),
  snippet       text,
  remediation   text
);
create index nap_compliance_findings_audit_idx on nap_compliance_findings (audit_id);
-- tenant_id-leading, matching nap_field_diffs_tenant_idx from 0011: every RLS
-- policy above filters on tenant_id, and a bare or trailing tenant_id column
-- is ~1% selective at 100 tenants -- schema_guards.sql enforces this.
create index nap_compliance_findings_tenant_idx on nap_compliance_findings (tenant_id, audit_id);

-- -----------------------------------------------------------------------------
-- RLS: same shape as nap_audits/nap_audit_results/nap_field_diffs in the
-- `shared_tables` group of 0009_rls.sql -- visible to staff-with-access AND to
-- client users of that tenant, writable by staff only. Written out by hand
-- here because the generic DO-loop in 0009 already ran; this is the first
-- table added since.
-- -----------------------------------------------------------------------------
alter table nap_compliance_findings enable row level security;
alter table nap_compliance_findings force  row level security;

create policy nap_compliance_findings_sel on nap_compliance_findings for select to authenticated
  using ( tenant_id in (select unnest(app.accessible_tenant_ids())) );
create policy nap_compliance_findings_ins on nap_compliance_findings for insert to authenticated
  with check ( tenant_id in (select unnest(app.accessible_tenant_ids())) and (select app.is_staff()) );
create policy nap_compliance_findings_upd on nap_compliance_findings for update to authenticated
  using      ( tenant_id in (select unnest(app.accessible_tenant_ids())) and (select app.is_staff()) )
  with check ( tenant_id in (select unnest(app.accessible_tenant_ids())) and (select app.is_staff()) );
create policy nap_compliance_findings_del on nap_compliance_findings for delete to authenticated
  using ( tenant_id in (select unnest(app.accessible_tenant_ids())) and (select app.is_staff()) );
