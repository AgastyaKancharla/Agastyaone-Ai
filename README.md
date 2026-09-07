# AgastyaOne Platform

Multi-tenant service delivery platform for AgastyaOne — accounts into contracts,
contracts into engagements, engagements into delivery, delivery into billing and
reporting, all of it visible to the client through a portal.

One product, one design system, **two workspaces**: a dense internal Console for
AgastyaOne staff and a simpler Portal for clients. Your login decides which
organisation's data you see, which modules are switched on, and what you may do.

## Service lines

The ten services are **catalog rows, not features**. Bundles are rows too, so
selling the Front Desk Bundle entitles a tenant to its four components without a
line of code. Adding an eleventh service is an INSERT.

| | Service | |
| --- | --- | --- |
| 1 | Website | build + client-owned domain + uptime |
| 2 | GBP + Directory/NAP | *bundle* → GBP Management, Directory & NAP |
| 3 | GEO (AI Search Visibility) | |
| 4 | Front Desk Bundle | *bundle* → WhatsApp Automation, AI Receptionist, Missed-Call, Unified Inbox |
| 5 | Call Tracking | |
| 6 | Booking Capture & Routing | |
| 7 | CRM | |
| 8 | Reporting Dashboard | |
| 9 | Review Automation | |
| 10 | Lifecycle Bundle | *bundle* → Recall, Patient Reactivation, Post-Treatment Follow-Up |

## Layout

```
apps/
  platform/     Next.js 15 — Console + Portal   (not yet built)
  worker/       Playwright + queue consumer     (not yet built)
packages/
  db/           schema, RLS, seeds, tests       ✅
  nap-engine/   NAP normaliser + diff engine    (not yet built)
  ui/           shared design system            (not yet built)
```

## Design decisions worth knowing

- **Tenancy is enforced in the database.** Every table has RLS enabled *and*
  forced, so a forgotten check in application code cannot leak across tenants.
  18 pgTAP assertions prove it; see `packages/db/tests/`.
- **`contacts` is the spine.** A call, a booking, a review request and a
  WhatsApp thread all resolve to the same contact through
  `app.resolve_contact()`, which normalises to E.164 inside Postgres. Without
  this the platform would be ten silos sharing a login.
- **Locations, not businesses.** NAP, GBP, calls and reviews are per-branch, so
  every runtime table carries `location_id` alongside `tenant_id`.
- **GST is modelled properly.** CGST/SGST vs IGST is decided by place of supply
  and cannot be reconstructed retroactively; TDS is explicit because B2B clients
  deduct it and payments arrive short; invoice numbers come from a gapless
  per-financial-year sequence; issued invoices are corrected by credit note.
- **Consent exists before the first contact row.** WhatsApp lifecycle messaging
  needs opt-in provenance under Meta policy and lawful basis under the DPDP Act,
  and consent cannot be invented after the fact.
- **Entitlement is not security.** RLS answers "is this your data"; entitlement
  answers "did you buy this module". Conflating them makes a lapsed subscription
  hide a client's own history.

## Deployments

`vercel.json` disables Git-triggered deployments for this repository.

The retired `citation-audit-agent` Vercel project is still Git-linked here, so
every push fired a deployment against a paused project and failed with
"Deployment was blocked" — red CI caused entirely by a retired app rather than
by any code in the repo.

When the platform gets its own Vercel project it will set its root directory to
`apps/platform` and carry its own config, at which point this file can be
removed or scoped to specific branches. The tidier fix is to delete the
`citation-audit-agent` project outright.

## Status

Slice 0 (foundations) is in progress. The schema, RLS and tests are done; the
Next.js app is next. See `packages/db/README.md` for the migration order.
