#!/usr/bin/env bash
# =============================================================================
# The database job, as a script.
#
# CI calls this, and so does anyone running it against a throwaway local
# cluster. That is the point: if the two were separate lists of steps they
# would drift, and the local run would stop being evidence about CI.
#
# Expects a running, EMPTY database and standard PG* environment variables.
# Never point this at a real project — it drops policies and disables RLS at
# the end, on purpose.
# =============================================================================
set -uo pipefail
cd "$(dirname "$0")/../../.."

PSQL=${PSQL:-psql -v ON_ERROR_STOP=1 --no-psqlrc}
$PSQL -q -c 'select 1' >/dev/null || { echo "cannot reach database"; exit 1; }

step() { printf '\n\033[1m── %s\033[0m\n' "$1"; }
die()  { printf '\033[31m%s\033[0m\n' "$1"; exit 1; }

step "Bootstrap the Supabase-equivalent environment"
$PSQL -q -f packages/db/ci/00_bootstrap.sql || die "bootstrap failed"

step "Apply migrations in order"
for f in packages/db/migrations/*.sql; do
  echo "   $(basename "$f")"
  $PSQL -q -f "$f" || die "migration failed: $f"
done

step "Apply seeds"
for f in packages/db/seeds/*.sql; do
  echo "   $(basename "$f")"
  $PSQL -q -f "$f" || die "seed failed: $f"
done

step "Schema guards"
$PSQL -f packages/db/tests/schema_guards.sql || die "schema guards failed"

step "Tenant isolation"
$PSQL -f packages/db/tests/rls_isolation.sql || die "tenant isolation failed"

step "Contacts spine"
$PSQL -f packages/db/tests/contacts_spine.sql || die "contacts spine failed"

step "Review runtime"
$PSQL -f packages/db/tests/review_runtime.sql || die "review runtime failed"

step "NAP compliance"
$PSQL -f packages/db/tests/nap_compliance.sql || die "NAP compliance failed"

step "Visibility"
$PSQL -f packages/db/tests/visibility.sql || die "visibility failed"

step "Map rank"
$PSQL -f packages/db/tests/map_rank.sql || die "map rank failed"

step "Geo visibility"
$PSQL -f packages/db/tests/geo_visibility.sql || die "geo visibility failed"

# ---------------------------------------------------------------------------
# A guard that has never failed is not known to work. Each case below breaks
# exactly one invariant and asserts the guards catch THAT one, then repairs it
# and asserts they pass again — because without the repair check, a later case
# could be "caught" by damage left over from an earlier one.
#
# The first version of this step dropped a single SELECT policy and expected a
# failure. It did not fail, and it was right not to: the table still had its
# other policies, and a missing SELECT policy denies reads rather than leaking
# them. The sabotage has to match what a guard actually claims.
#
# EVERY TEST MUST RUN ABOVE THIS LINE. What follows leaves the database with
# RLS off and no policies on `contacts`, so anything run against it afterwards
# sees an unprotected schema and will draw the wrong conclusion.
# ---------------------------------------------------------------------------
step "Prove each guard can fail"

guards_pass() { $PSQL -q -f packages/db/tests/schema_guards.sql >/dev/null 2>&1; }

expect_caught() {
  if guards_pass; then die "NOT CAUGHT: $1 — that guard is not guarding anything"; fi
  printf '   caught:  %s\n' "$1"
}
expect_clean() {
  if ! guards_pass; then die "guards still failing after repairing: $1"; fi
  printf '   repaired: %s\n' "$1"
}

# Guard 3 — a view without security_invoker runs as its owner and bypasses RLS.
$PSQL -q -c "create view public.guard_probe_view as select id from public.contacts;"
expect_caught "view without security_invoker"
$PSQL -q -c "drop view public.guard_probe_view;"
expect_clean "view without security_invoker"

# Guard 4 — SECURITY DEFINER with a mutable search_path is hijackable.
$PSQL -q -c "create function public.guard_probe_fn() returns int language sql security definer as \$fn\$ select 1 \$fn\$;"
expect_caught "SECURITY DEFINER with mutable search_path"
$PSQL -q -c "drop function public.guard_probe_fn();"
expect_clean "SECURITY DEFINER with mutable search_path"

# Guard 5 — a tenant_id policy with no tenant_id-leading index seq-scans.
$PSQL -q -c "create table public.guard_probe_tbl (id uuid primary key default gen_random_uuid(), tenant_id uuid not null);
             alter table public.guard_probe_tbl enable row level security;
             alter table public.guard_probe_tbl force row level security;
             create policy guard_probe_sel on public.guard_probe_tbl for select to authenticated
               using ( tenant_id in (select unnest(app.accessible_tenant_ids())) );"
expect_caught "tenant_id policy with no tenant_id-leading index"
$PSQL -q -c "drop table public.guard_probe_tbl;"
expect_clean "tenant_id policy with no tenant_id-leading index"

# Guard 1 — RLS off is the whole table exposed.
$PSQL -q -c "alter table public.contacts disable row level security;"
expect_caught "RLS disabled on public.contacts"
$PSQL -q -c "alter table public.contacts enable row level security;
             alter table public.contacts force row level security;"
expect_clean "RLS disabled on public.contacts"

# Guard 2 — RLS on with zero policies. Destructive, so it goes last.
$PSQL -q -c "do \$g\$
             declare r record;
             begin
               for r in select policyname from pg_policies
                         where schemaname = 'public' and tablename = 'contacts'
               loop execute format('drop policy %I on public.contacts', r.policyname); end loop;
             end \$g\$;"
expect_caught "every policy dropped on public.contacts"

printf '\n\033[32mDATABASE JOB PASSED\033[0m — schema applies, isolation holds, and all five guards detect their own violation.\n'
