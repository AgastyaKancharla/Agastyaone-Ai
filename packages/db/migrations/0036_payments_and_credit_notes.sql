-- =============================================================================
-- 0036_payments_and_credit_notes
--
-- Two independent pieces that both hang off an issued invoice:
--
--  * credit_notes.credit_note_number had the same NOT NULL problem
--    invoices.invoice_number had before 0035, for the same reason: a draft
--    credit note composed with the wrong amount and discarded should not
--    burn a gapless number. Same fix, same shape -- nullable, assigned by a
--    trigger on draft -> issued.
--
--  * payments has no derived state of its own, but invoices.amount_received
--    and invoices.status ('issued'/'part_paid'/'paid') are derived FROM
--    payments, and nothing wrote them until now. A trigger recomputes both
--    from scratch on every insert/update/delete against payments, rather
--    than incrementing amount_received in application code -- recomputing
--    is what makes correcting or deleting a mis-recorded payment self-
--    correcting instead of requiring its own reversal logic.
-- =============================================================================

alter table credit_notes alter column credit_note_number drop not null;

create or replace function app.assign_credit_note_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'draft' and new.status = 'issued' and new.credit_note_number is null then
    new.credit_note_number := app.next_reference(new.issuer_tenant_id, 'credit_note', new.issue_date);
    new.issued_at := coalesce(new.issued_at, now());
  end if;
  return new;
end;
$$;

create trigger credit_notes_assign_number
  before update of status on credit_notes
  for each row execute function app.assign_credit_note_number();

-- A draft or cancelled invoice's status is never something a payment should
-- override -- amount_received still tracks reality, but status only moves
-- among issued/part_paid/paid, and only for an invoice already in that
-- family. Recomputed as a sum, not an increment, so deleting or correcting a
-- payment naturally recovers the right status with no separate reversal path.
create or replace function app.recalculate_invoice_payment_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invoice_id uuid := coalesce(new.invoice_id, old.invoice_id);
  v_received   numeric(14,2);
  v_total      numeric(14,2);
  v_status     text;
begin
  if v_invoice_id is null then
    return coalesce(new, old);
  end if;

  select coalesce(sum(amount), 0) into v_received
  from public.payments
  where invoice_id = v_invoice_id;

  select total_amount, status into v_total, v_status
  from public.invoices
  where id = v_invoice_id;

  if v_status in ('issued', 'part_paid', 'paid') then
    update public.invoices
    set amount_received = v_received,
        status = case
          when v_received <= 0 then 'issued'
          when v_received < v_total then 'part_paid'
          else 'paid'
        end
    where id = v_invoice_id;
  else
    update public.invoices set amount_received = v_received where id = v_invoice_id;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger payments_recalculate_invoice
  after insert or update or delete on payments
  for each row execute function app.recalculate_invoice_payment_status();
