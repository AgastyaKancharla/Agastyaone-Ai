-- =============================================================================
-- 0035_invoice_generation
--
-- invoices.invoice_number was NOT NULL from 0003, which would force a
-- gapless number onto every invoice the moment a draft is even created --
-- including one composed with the wrong period and discarded before ever
-- being sent. Gapless numbering only means something for an invoice a client
-- actually receives, so this loosens the column the same way 0034 already
-- did for contracts.reference, and assigns it via trigger on the one
-- transition that matters: draft -> issued.
--
-- invoices_number_key stays exactly as it is: a plain (non-partial) unique
-- index on (issuer_tenant_id, invoice_number) already lets multiple NULLs
-- coexist per issuer -- Postgres treats each NULL as distinct from every
-- other NULL -- so any number of drafts can sit unnumbered with no conflict.
-- =============================================================================

alter table invoices alter column invoice_number drop not null;

create or replace function app.assign_invoice_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'draft' and new.status = 'issued' and new.invoice_number is null then
    new.invoice_number := app.next_reference(new.issuer_tenant_id, 'invoice', new.issue_date);
    new.issued_at := coalesce(new.issued_at, now());
  end if;
  return new;
end;
$$;

create trigger invoices_assign_number
  before update of status on invoices
  for each row execute function app.assign_invoice_number();
