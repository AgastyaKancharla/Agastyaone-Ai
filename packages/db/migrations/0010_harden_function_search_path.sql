-- =============================================================================
-- 0010_harden_function_search_path
--
-- Six `app` functions were created without a pinned search_path. A mutable
-- search_path lets a caller decide what an unqualified name inside the function
-- resolves to -- the classic escalation route for SECURITY DEFINER code, and
-- still worth closing on trigger functions that run under the caller's rights.
--
-- ALTER FUNCTION rather than CREATE OR REPLACE on purpose: contacts.
-- primary_phone_e164 and nap_source_of_truth.phone_e164 are STORED generated
-- columns that depend on app.normalize_phone_e164, and altering only the
-- function's configuration leaves the body -- and therefore every stored value
-- -- untouched.
--
-- Every body already schema-qualifies its references (public.*, app.*), and the
-- remaining calls resolve from pg_catalog, which is always implicitly on the
-- search path. So pinning to '' changes hardening, not behaviour.
-- =============================================================================

alter function app.touch_updated_at()                           set search_path = '';
alter function app.financial_year(date)                         set search_path = '';
alter function app.client_action_items_blocked_days()           set search_path = '';
alter function app.normalize_phone_e164(text, text)             set search_path = '';
alter function app.normalize_identity(text, text)               set search_path = '';
alter function app.contacts_maintain_canonical()                set search_path = '';
