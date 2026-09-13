-- =============================================================================
-- Seed 0001 — reference data
--
-- Idempotent: every insert is ON CONFLICT DO UPDATE / DO NOTHING, so this can
-- be re-run after a schema change without duplicating rows.
--
-- Seeds AgastyaOne as tenant #1 and all reference data. Client tenants are
-- NOT seeded -- they are created through the Console so the real names,
-- addresses and GSTINs come from the founder rather than from a guess. The
-- pgTAP isolation suite creates its own throwaway tenants, so tests never
-- depend on this file.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tenant #1: AgastyaOne itself.
-- Running the company inside its own product removes the need for a separate
-- sales CRM and exercises multi-tenancy every day.
-- -----------------------------------------------------------------------------
insert into tenants (slug, name, legal_name, is_internal, vertical, status, place_of_supply, billing_email)
values ('agastyaone', 'AgastyaOne', 'AgastyaOne', true, 'services', 'active', '29', 'agastya@agastyaone.com')
on conflict (slug) do update
  set name = excluded.name, is_internal = true, updated_at = now();

-- -----------------------------------------------------------------------------
-- RBAC. Capability only -- which TENANTS a staff member sees is decided by
-- staff_members.tenant_scope plus account_assignments, not by role.
-- -----------------------------------------------------------------------------
insert into permissions (code, description, category) values
  ('tenants.read',        'View client accounts',                 'tenants'),
  ('tenants.write',       'Create and edit client accounts',      'tenants'),
  ('contracts.read',      'View contracts and subscriptions',     'commercial'),
  ('contracts.write',     'Create and edit contracts',            'commercial'),
  ('invoices.read',       'View invoices and receivables',        'commercial'),
  ('invoices.write',      'Generate and issue invoices',          'commercial'),
  ('delivery.read',       'View engagements and tasks',           'delivery'),
  ('delivery.write',      'Manage engagements and tasks',         'delivery'),
  ('services.run',        'Trigger audits and automation runs',   'delivery'),
  ('reviews.respond',     'Publish responses to reviews',         'runtime'),
  ('contacts.read',       'View contacts',                        'runtime'),
  ('contacts.write',      'Create, edit and merge contacts',      'runtime'),
  ('staff.manage',        'Invite staff and assign roles',        'admin'),
  ('settings.manage',     'Manage platform settings and flags',   'admin'),
  ('audit.read',          'Read the audit log',                   'admin')
on conflict (code) do update set description = excluded.description;

insert into roles (code, name, description, scope, is_system) values
  ('owner',           'Owner',            'Full access to everything',                       'staff',  true),
  ('account_manager', 'Account Manager',  'Owns client relationships and commercials',       'staff',  true),
  ('delivery_lead',   'Delivery Lead',    'Runs engagements and assigns work',               'staff',  true),
  ('specialist',      'Specialist',       'Executes delivery on assigned accounts',          'staff',  true),
  ('finance',         'Finance',          'Contracts, invoicing and receivables',            'staff',  true),
  ('read_only',       'Read Only',        'View-only staff access',                          'staff',  true),
  ('client_owner',    'Client Owner',     'Client-side admin for their own organisation',    'client', true),
  ('client_member',   'Client Member',    'Client-side view of their own organisation',      'client', true)
on conflict (code) do update set name = excluded.name, description = excluded.description;

-- Owner gets everything.
insert into role_permissions (role_id, permission_id)
select r.id, p.id from roles r cross join permissions p where r.code = 'owner'
on conflict do nothing;

insert into role_permissions (role_id, permission_id)
select r.id, p.id
from (values
  ('account_manager', array['tenants.read','tenants.write','contracts.read','contracts.write',
                            'invoices.read','delivery.read','contacts.read','contacts.write']),
  ('delivery_lead',   array['tenants.read','delivery.read','delivery.write','services.run',
                            'contacts.read','contacts.write','reviews.respond']),
  ('specialist',      array['tenants.read','delivery.read','delivery.write','services.run',
                            'contacts.read','reviews.respond']),
  ('finance',         array['tenants.read','contracts.read','contracts.write',
                            'invoices.read','invoices.write']),
  ('read_only',       array['tenants.read','contracts.read','delivery.read','contacts.read'])
) as v(role_code, perms)
join roles r       on r.code = v.role_code
join permissions p on p.code = any (v.perms)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Service catalog: 10 sellable lines + 9 bundle components.
--
-- default_price is deliberately NULL -- pricing is per-client and is never
-- guessed. SAC codes below are sensible defaults for these service categories
-- and should be confirmed with the CA before the first GST invoice is issued.
-- -----------------------------------------------------------------------------
insert into service_catalog (code, name, category, description, is_bundle, billing_cycle, default_hsn_sac, default_gst_rate, sort_order) values
  ('website',            'Website',                    'presence',    'Design and build of the clinic website. The client buys and owns the domain; AgastyaOne tracks the build, the domain and uptime.', false, 'one_time', '998314', 18.00, 10),
  ('gbp_nap',            'GBP + Directory/NAP',        'presence',    'Google Business Profile management bundled with directory listing and NAP consistency across Indian directories.',                true,  'monthly',  '998361', 18.00, 20),
  ('gbp_management',     'GBP Management',             'presence',    'Google Business Profile optimisation, posts, categories and Q&A.',                                                                false, 'monthly',  '998361', 18.00, 21),
  ('directory_nap',      'Directory & NAP Consistency','presence',    'Listing coverage and Name/Address/Phone consistency auditing and correction.',                                                    false, 'monthly',  '998361', 18.00, 22),
  ('geo',                'GEO (AI Search Visibility)', 'presence',    'Visibility inside AI answer engines — ChatGPT, Perplexity, Gemini — tracked by prompt and share of voice.',                        false, 'monthly',  '998361', 18.00, 30),
  -- Sits above the individual presence lines rather than beside them: it scores
  -- map rank, website, citations, reviews, AI visibility and backlinks into one
  -- number. Deliberately not a bundle — a bundle grants its components, whereas
  -- this measures them whether or not the client buys them, which is precisely
  -- what makes it sellable to a clinic buying nothing else yet.
  ('visibility',         'Digital Visibility',         'insight',     'One 0–100 visibility score per location — map rank, website, citations, reviews, AI answer engines and backlinks — trended monthly.', false, 'monthly',  '998313', 18.00, 31),
  ('front_desk',         'Front Desk Bundle',          'engagement',  'WhatsApp automation, AI receptionist, missed-call recovery and a unified inbox.',                                                  true,  'monthly',  '998313', 18.00, 40),
  ('whatsapp_automation','WhatsApp Automation',        'engagement',  'Automated WhatsApp conversations and templates.',                                                                                 false, 'monthly',  '998313', 18.00, 41),
  ('ai_receptionist',    'AI Receptionist',            'engagement',  'AI front desk answering enquiries and handing off to staff.',                                                                      false, 'monthly',  '998313', 18.00, 42),
  ('missed_call',        'Missed-Call Recovery',       'engagement',  'Automatic follow-up on missed and abandoned calls.',                                                                               false, 'monthly',  '998313', 18.00, 43),
  ('unified_inbox',      'Unified Inbox',              'engagement',  'One inbox across WhatsApp, SMS, email and web chat.',                                                                              false, 'monthly',  '998313', 18.00, 44),
  ('call_tracking',      'Call Tracking',              'acquisition', 'Tracked numbers, call recording and source attribution.',                                                                          false, 'monthly',  '998313', 18.00, 50),
  ('booking_capture',    'Booking Capture & Routing',  'acquisition', 'Capture booking requests from every channel and route them by rule.',                                                              false, 'monthly',  '998313', 18.00, 60),
  ('crm',                'CRM',                        'operations',  'Contacts, leads, pipeline and activity history for the clinic.',                                                                   false, 'monthly',  '998313', 18.00, 70),
  ('reporting',          'Reporting Dashboard',        'insight',     'Client-facing reporting across every active service.',                                                                             false, 'monthly',  '998313', 18.00, 80),
  ('review_automation',  'Review Automation',          'engagement',  'Review requests, monitoring and AI-drafted responses.',                                                                            false, 'monthly',  '998361', 18.00, 90),
  ('lifecycle',          'Lifecycle Bundle',           'engagement',  'Recall, patient reactivation and post-treatment follow-up.',                                                                       true,  'monthly',  '998361', 18.00, 100),
  ('recall',             'Recall',                     'engagement',  'Scheduled recall reminders for due patients.',                                                                                     false, 'monthly',  '998361', 18.00, 101),
  ('patient_reactivation','Patient Reactivation',      'engagement',  'Win-back campaigns for lapsed patients.',                                                                                          false, 'monthly',  '998361', 18.00, 102),
  ('post_treatment_followup','Post-Treatment Follow-Up','engagement', 'Follow-up sequences after treatment.',                                                                                             false, 'monthly',  '998361', 18.00, 103)
on conflict (code) do update
  set name = excluded.name, category = excluded.category, description = excluded.description,
      is_bundle = excluded.is_bundle, billing_cycle = excluded.billing_cycle,
      default_hsn_sac = excluded.default_hsn_sac, sort_order = excluded.sort_order,
      updated_at = now();

-- Bundle composition. This is the whole point of the catalog being data:
-- selling "Front Desk Bundle" entitles the tenant to four modules, and that
-- fact is a row, not an if-statement.
insert into service_components (parent_service_id, child_service_id, sort_order)
select p.id, c.id, v.sort_order
from (values
  ('gbp_nap',   'gbp_management',          1),
  ('gbp_nap',   'directory_nap',           2),
  ('front_desk','whatsapp_automation',     1),
  ('front_desk','ai_receptionist',         2),
  ('front_desk','missed_call',             3),
  ('front_desk','unified_inbox',           4),
  ('lifecycle', 'recall',                  1),
  ('lifecycle', 'patient_reactivation',    2),
  ('lifecycle', 'post_treatment_followup', 3)
) as v(parent_code, child_code, sort_order)
join service_catalog p on p.code = v.parent_code
join service_catalog c on c.code = v.child_code
on conflict (parent_service_id, child_service_id) do update set sort_order = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- Indian directories the NAP engine audits.
-- -----------------------------------------------------------------------------
insert into directories (code, name, domain, country, verticals, weight, sort_order) values
  ('google_business', 'Google Business Profile', 'google.com',   'IN', array['dental','clinic','retail','services'], 3.00, 1),
  ('justdial',        'Justdial',                'justdial.com', 'IN', array['dental','clinic','retail','services'], 2.00, 2),
  ('practo',          'Practo',                  'practo.com',   'IN', array['dental','clinic'],                     2.00, 3),
  ('lybrate',         'Lybrate',                 'lybrate.com',  'IN', array['dental','clinic'],                     1.00, 4),
  ('sulekha',         'Sulekha',                 'sulekha.com',  'IN', array['dental','clinic','retail','services'], 1.00, 5)
on conflict (code) do update
  set name = excluded.name, domain = excluded.domain, verticals = excluded.verticals, weight = excluded.weight;

-- -----------------------------------------------------------------------------
-- Business calendar. SLA maths is simply wrong without one.
-- -----------------------------------------------------------------------------
insert into business_calendars (code, name, timezone, workdays, work_start, work_end)
values ('in_karnataka', 'India — Karnataka', 'Asia/Kolkata', '{1,2,3,4,5,6}', '09:30', '18:30')
on conflict (code) do update set name = excluded.name;

-- -----------------------------------------------------------------------------
-- Metric definitions for the first service slice. definition_version is pinned
-- on every snapshot so changing a definition never rewrites reported history.
-- -----------------------------------------------------------------------------
insert into metric_definitions (code, name, service_code, unit, description, version, is_client_visible) values
  ('nap_consistency_score',   'NAP Consistency Score',      'directory_nap', 'score',   'Mean confidence across directories that were successfully checked. Excludes errored directories so a blocked scraper never lowers the score.', 1, true),
  ('nap_coverage_pct',        'Directory Coverage',         'directory_nap', 'percent', 'Share of requested directories that were successfully checked.', 1, true),
  ('nap_issues_open',         'Open NAP Issues',            'directory_nap', 'count',   'Directories currently reporting drift or mismatch.', 1, true),
  ('nap_listings_found',      'Listings Found',             'directory_nap', 'count',   'Directories where a listing was confidently matched to this location.', 1, true),
  -- Review Automation measures the request funnel and nothing else. There is
  -- deliberately no rating metric: Google's rating may be shown live but not
  -- stored, and a snapshot row is storage. It arrives with GBP API access.
  ('review_requests_issued',  'Review Requests Issued',     'review_automation', 'count',   'Review links and QR codes handed to patients that day.', 1, true),
  ('review_requests_clicked', 'Review Requests Scanned',    'review_automation', 'count',   'How many of that day''s codes were scanned. Counted against the day the code was issued, so a late scan updates that day rather than today.', 1, true),
  ('review_click_rate',       'Review Scan Rate',           'review_automation', 'percent', 'Share of that day''s issued codes that were scanned. A scan is not a review — Google does not report who posted one.', 1, true),
  -- Digital Visibility. The composite and its coverage always travel together:
  -- a score of 71 means something different at 100% coverage than at 40%, and
  -- showing one without the other invites a conclusion the data cannot support.
  ('visibility_score',        'Digital Visibility Score',   'visibility', 'score',   'Weighted mean across the pillars that could be measured — map rank, website, citations, reviews, AI answer engines, backlinks. Unmeasured pillars are excluded and the remaining weights re-normalised, so an unreachable source never reads as a low score.', 1, true),
  ('visibility_coverage_pct', 'Visibility Coverage',        'visibility', 'percent', 'Share of the scoring model''s total weight that was actually measured on this run.', 1, true),
  ('visibility_website_score','Website Visibility Score',   'visibility', 'score',   'The website pillar on its own — search, AI-answer and answer-engine readiness of the clinic''s own site.', 1, true),
  ('visibility_issues_open',  'Open Visibility Issues',     'visibility', 'count',   'Website findings currently classed as issues rather than opportunities.', 1, true),
  -- Map rank. A scan below 80% coverage writes none of these at all rather than
  -- charting what a rate limit happened to let through.
  ('map_rank_score',          'Map Rank Score',             'visibility', 'score',   'Weighted visibility across the scan grid, weighted top-heavily because local-pack click-through collapses after third place.', 1, true),
  ('map_rank_solv',           'Share of Local Voice',       'visibility', 'percent', 'Share of grid points where the clinic ranks in the top 3 on Google Maps. The metric that tracks actual calls.', 1, true),
  ('map_rank_arp',            'Average Rank Position',      'visibility', 'score',   'Mean position across only the grid points where the clinic appears at all. Absent — not zero — when it appears nowhere.', 1, true),
  -- AI answer engines. Trended only at visibility-audit time, same discipline
  -- as the website pillar — geo_runs itself is too granular an event to chart
  -- point-by-point (see migration 0029).
  ('visibility_ai_score',     'AI Answer Engine Score',     'visibility', 'score',   'Weighted visibility across ChatGPT, Perplexity, Gemini and Claude, weighted top-heavily because most patients act on the first name an assistant gives them.', 1, true)
on conflict (code, version) do update
  set name = excluded.name, description = excluded.description, is_client_visible = excluded.is_client_visible;
