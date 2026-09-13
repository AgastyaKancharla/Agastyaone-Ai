-- =============================================================================
-- AI search visibility (GEO) suite
--
-- Four things are asserted, in order of how expensive they would be to get
-- wrong:
--
--   1. The position/mention invariant added in 0030. A row claiming a list
--      position while was_mentioned is false is self-contradictory data, the
--      same class of defect map_scan_points' rank/status check exists for.
--   2. enqueue_geo_runs: staff-only, refuses a location with no active
--      prompts, skips inactive prompts, and queues exactly
--      active_prompts x 4 engines -- both as geo_runs rows and as real pgmq
--      messages.
--   3. The metrics trigger extension (0029): visibility_ai_score snapshots
--      when the ai_visibility pillar was measured, and stays absent -- not
--      zero -- when it was not.
--   4. Tenant isolation across all three tables.
--
-- Same conventions as map_rank.sql / visibility.sql: dependency-free, fully
-- transactional, roles simulated the way PostgREST does it.
-- =============================================================================

begin;

create temp table _assert (n serial, ok boolean, name text, detail text) on commit drop;
grant all on _assert to public;
grant usage, select on sequence _assert_n_seq to public;

create or replace function pg_temp.eq(actual anyelement, expected anyelement, name text)
returns void language plpgsql as $$
begin
  insert into _assert (ok, name, detail)
  values (actual is not distinct from expected, name,
          case when actual is not distinct from expected then ''
               else format('expected %L, got %L', expected, actual) end);
end;
$$;

create or replace function pg_temp.denied(stmt text, name text)
returns void language plpgsql as $$
begin
  execute stmt;
  insert into _assert (ok, name, detail) values (false, name, 'statement was ALLOWED');
exception when others then
  insert into _assert (ok, name, detail) values (true, name, 'refused: ' || sqlstate);
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures. Same fixed UUIDs as the other suites.
-- ---------------------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','staff-all@test.local'),
  ('33333333-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','client-a@test.local'),
  ('44444444-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','client-b@test.local');

insert into profiles (id, email, full_name, user_type) values
  ('11111111-0000-4000-8000-000000000001','staff-all@test.local','Staff All','staff'),
  ('33333333-0000-4000-8000-000000000003','client-a@test.local','Client A','client'),
  ('44444444-0000-4000-8000-000000000004','client-b@test.local','Client B','client')
on conflict (id) do update set full_name = excluded.full_name, user_type = excluded.user_type;

insert into tenants (id, slug, name, vertical, status) values
  ('aaaaaaaa-0000-4000-8000-000000000001','test-clinic-a','Test Clinic A','dental','active'),
  ('bbbbbbbb-0000-4000-8000-000000000002','test-clinic-b','Test Clinic B','dental','active');

insert into staff_members (profile_id, tenant_scope, status) values
  ('11111111-0000-4000-8000-000000000001','all','active')
on conflict (profile_id) do update set tenant_scope = excluded.tenant_scope;

insert into memberships (tenant_id, profile_id, role, status) values
  ('aaaaaaaa-0000-4000-8000-000000000001','33333333-0000-4000-8000-000000000003','client_owner','active'),
  ('bbbbbbbb-0000-4000-8000-000000000002','44444444-0000-4000-8000-000000000004','client_owner','active');

insert into tenant_locations (id, tenant_id, name, city, state_code, is_primary) values
  ('cccccccc-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001','Clinic A - Koramangala','Bengaluru','29',true);

-- Two active prompts, one inactive -- enqueue must count the first two only.
insert into geo_prompts (id, tenant_id, location_id, prompt, is_active) values
  ('eeeeeeee-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000001','best dental clinic in koramangala',true),
  ('eeeeeeee-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000001','root canal specialist near koramangala',true),
  ('eeeeeeee-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000001','retired prompt nobody asks anymore',false);

-- ===========================================================================
-- 1. The position/mention invariant (0030).
-- ===========================================================================
select pg_temp.denied(
  $q$insert into geo_runs (tenant_id, location_id, prompt_id, engine, status, was_mentioned, position)
     values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid,'cccccccc-0000-4000-8000-000000000001'::uuid,
             'eeeeeeee-0000-4000-8000-000000000001'::uuid,'chatgpt','completed',false,3)$q$,
  'schema: a run cannot claim a list position without claiming a mention');

insert into geo_runs (id, tenant_id, location_id, prompt_id, engine, status, was_mentioned, position, share_of_voice) values
  ('77777777-0000-4000-8000-000000000001','aaaaaaaa-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000001',
   'eeeeeeee-0000-4000-8000-000000000001','chatgpt','completed',true,1,33.3),
  ('77777777-0000-4000-8000-000000000002','aaaaaaaa-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000001',
   'eeeeeeee-0000-4000-8000-000000000002','perplexity','completed',false,null,0),
  ('77777777-0000-4000-8000-000000000003','aaaaaaaa-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000001',
   'eeeeeeee-0000-4000-8000-000000000001','gemini','failed',false,null,null);

select pg_temp.eq((select share_of_voice from geo_runs where id = '77777777-0000-4000-8000-000000000002'),
                  0.00, 'a real measured zero share of voice is allowed with no position -- a rival took the spot');

insert into geo_mentions (tenant_id, run_id, entity_name, is_client, position) values
  ('aaaaaaaa-0000-4000-8000-000000000001','77777777-0000-4000-8000-000000000001','Test Clinic A',true,1),
  ('aaaaaaaa-0000-4000-8000-000000000001','77777777-0000-4000-8000-000000000001','Demo Dental B',false,2),
  ('aaaaaaaa-0000-4000-8000-000000000001','77777777-0000-4000-8000-000000000002','Demo Dental A',false,1);

-- ===========================================================================
-- 2. enqueue_geo_runs.
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-0000-4000-8000-000000000003","role":"authenticated"}', true);
select pg_temp.denied(
  $q$select enqueue_geo_runs('cccccccc-0000-4000-8000-000000000001'::uuid)$q$,
  'enqueue: a client cannot queue checks, even on their own location');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated"}', true);

-- 2 active prompts x 4 engines (chatgpt, perplexity, gemini, claude).
select pg_temp.eq(enqueue_geo_runs('cccccccc-0000-4000-8000-000000000001'::uuid), 8,
                  'enqueue: queues active_prompts x 4 engines, skipping the inactive prompt');

select pg_temp.eq((select count(*)::int from geo_runs
                    where location_id = 'cccccccc-0000-4000-8000-000000000001' and status = 'queued'),
                  8, 'enqueue: 8 new queued rows exist alongside the 3 fixture rows');

select pg_temp.eq((select count(*)::int from geo_runs
                    where prompt_id = 'eeeeeeee-0000-4000-8000-000000000003'),
                  0, 'enqueue: the inactive prompt was never queued');
reset role;

-- pgmq is not exposed to PostgREST (authenticated has no grant on the schema
-- at all, by design -- geo_queue_read/etc are the only sanctioned door), so
-- this reads as the unrestricted role, same as the migrations that created it.
select pg_temp.eq((select count(*)::int from pgmq.messages where queue_name = 'geo_runs'),
                  8, 'enqueue: a real pgmq message exists for every queued run, not just a DB row');

-- Every prompt at this location is now inactive (all three, including the two
-- just used) -- enqueue must refuse rather than silently queueing nothing.
update geo_prompts set is_active = false where location_id = 'cccccccc-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-0000-4000-8000-000000000001","role":"authenticated"}', true);
select pg_temp.denied(
  $q$select enqueue_geo_runs('cccccccc-0000-4000-8000-000000000001'::uuid)$q$,
  'enqueue: refuses a location with no active prompts rather than queueing zero silently');
reset role;

-- ===========================================================================
-- 3. The metrics trigger extension (0029) -- visibility_ai_score.
-- ===========================================================================
insert into visibility_audits (id, tenant_id, location_id, status, website_url)
values ('ffffffff-0000-4000-8000-000000000010','aaaaaaaa-0000-4000-8000-000000000001',
        'cccccccc-0000-4000-8000-000000000001','running','https://testclinica.example');

insert into visibility_pillar_scores (tenant_id, audit_id, pillar, score, weight, measured) values
  ('aaaaaaaa-0000-4000-8000-000000000001','ffffffff-0000-4000-8000-000000000010','ai_visibility', 58.00, 15, true);

update visibility_audits
   set status = 'completed', composite_score = 58.00, coverage_pct = 15.00, completed_at = now()
 where id = 'ffffffff-0000-4000-8000-000000000010';

select pg_temp.eq((select value from metric_snapshots
                    where location_id = 'cccccccc-0000-4000-8000-000000000001'
                      and metric_code = 'visibility_ai_score'),
                  58.0000, 'trigger: visibility_ai_score snapshotted from the measured ai_visibility pillar');

-- A second audit where ai_visibility was NOT measured must leave no point --
-- a zero here would read as "no AI engine mentions you at all", not "nobody
-- has run a check yet".
insert into visibility_audits (id, tenant_id, location_id, status)
values ('ffffffff-0000-4000-8000-000000000011','bbbbbbbb-0000-4000-8000-000000000002',
        'cccccccc-0000-4000-8000-000000000001','running');
insert into visibility_pillar_scores (tenant_id, audit_id, pillar, score, weight, measured) values
  ('bbbbbbbb-0000-4000-8000-000000000002','ffffffff-0000-4000-8000-000000000011','ai_visibility', null, 15, false);
update visibility_audits
   set status = 'completed', composite_score = null, coverage_pct = 0, completed_at = now()
 where id = 'ffffffff-0000-4000-8000-000000000011';

select pg_temp.eq((select count(*)::int from metric_snapshots
                    where tenant_id = 'bbbbbbbb-0000-4000-8000-000000000002'
                      and metric_code = 'visibility_ai_score'),
                  0, 'trigger: an unmeasured ai_visibility pillar writes no point at all');

-- ===========================================================================
-- 4. Tenant isolation across all three tables.
-- ===========================================================================
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"44444444-0000-4000-8000-000000000004","role":"authenticated"}', true);
select pg_temp.eq((select count(*)::int from geo_prompts), 0, 'client B: sees no prompts of another clinic');
select pg_temp.eq((select count(*)::int from geo_runs), 0, 'client B: sees no runs of another clinic');
select pg_temp.eq((select count(*)::int from geo_mentions), 0, 'client B: sees no mentions of another clinic');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-0000-4000-8000-000000000003","role":"authenticated"}', true);
select pg_temp.eq((select count(*)::int from geo_prompts), 3, 'client A: sees their own prompts, active and inactive alike');
select pg_temp.eq((select count(*)::int from geo_runs), 11, 'client A: sees their own runs -- 3 fixtures plus 8 queued');
select pg_temp.eq((select count(*)::int from geo_mentions where entity_name = 'Demo Dental A'), 1,
                  'client A: can see mentions on their own tenant -- "Console only" is a UI choice, not an RLS boundary');
select pg_temp.denied(
  $q$insert into geo_prompts (tenant_id, location_id, prompt)
     values ('aaaaaaaa-0000-4000-8000-000000000001'::uuid,'cccccccc-0000-4000-8000-000000000001'::uuid,'injected')$q$,
  'client A: cannot add a prompt themselves -- staff only');
reset role;

-- ===========================================================================
-- Report. Raises on any failure so a non-zero exit fails the build.
-- ===========================================================================
select n, case when ok then 'ok  ' else 'FAIL' end as result, name, detail
from _assert order by n;

do $$
declare v_failed int;
begin
  select count(*) into v_failed from _assert where not ok;
  if v_failed > 0 then
    raise exception 'Geo visibility: % of % assertions FAILED',
      v_failed, (select count(*) from _assert);
  end if;
  raise notice 'Geo visibility: all % assertions passed', (select count(*) from _assert);
end $$;

rollback;
