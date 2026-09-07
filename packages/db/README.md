# @agastyaone/db

Schema, RLS, seeds and tests. SQL is the source of truth — there is no ORM,
because RLS policies are SQL regardless and one source beats two.

## Order

| File | Contents |
| --- | --- |
| `migrations/0001_foundation.sql` | `app` schema, extensions, access helpers |
| `migrations/0002_core.sql` | Identity, tenancy, RBAC, documents, GST sequences |
| `migrations/0003_commercial.sql` | Catalog, contracts, GST invoicing, entitlements |
| `migrations/0004_delivery.sql` | Service instances, engagements, playbooks, resourcing |
| `migrations/0005_contacts_spine.sql` | Contacts, consent, identity resolution |
| `migrations/0006_runtime_presence.sql` | Website, NAP/GBP, GEO, reviews |
| `migrations/0007_runtime_engagement.sql` | Calls, bookings, front desk, CRM, lifecycle |
| `migrations/0008_insight_automation_integration.sql` | Activity, metrics, automation, integrations |
| `migrations/0009_rls.sql` | RLS on every table |
| `migrations/0010_harden_function_search_path.sql` | Pin `search_path` on `app` functions |
| `seeds/0001_reference_data.sql` | AgastyaOne tenant #1, catalog, roles, directories |

## Tests

- `tests/rls_isolation.sql` — 18 pgTAP assertions proving tenant isolation.
  Fully transactional; rolls back and leaves nothing behind.
- `tests/schema_guards.sql` — invariants that must hold on every change:
  RLS enabled and forced everywhere, no table without a policy, no view without
  `security_invoker`, no `SECURITY DEFINER` function with a mutable
  `search_path`, and a `tenant_id`-leading index on every tenant table.

Both are safe to run against any environment.

## Conventions

- Status columns are `text` + `CHECK`, never Postgres `enum` — enum values
  cannot be dropped or reordered.
- Money is `numeric(14,2)`. Never float.
- Every tenant-scoped table carries `tenant_id`; every runtime table also
  carries `location_id`, because NAP, calls, reviews and bookings are
  per-branch facts.
- RLS predicates are `tenant_id in (select unnest(app.accessible_tenant_ids()))`
  — row-independent, so it evaluates once per query rather than once per row.

## Bootstrapping access

`migrations/0012_user_provisioning.sql` provisions a `profiles` row whenever
Supabase Auth creates a user, and applies the bootstrap rule for staff:

- An `@agastyaone.com` address becomes staff. The **first** one gets
  `tenant_scope = 'all'` and the `owner` role, because otherwise nobody could
  ever assign anybody. Every one after starts on `'assigned'` with no role
  until granted.
- Any other address becomes a client, with no staff row and no tenant until an
  account manager links them.

Staff status grants Console *access*, not data access — which tenants a staff
member can actually see is still decided by `tenant_scope` and
`account_assignments`, so a new joiner sees nothing until assigned.
