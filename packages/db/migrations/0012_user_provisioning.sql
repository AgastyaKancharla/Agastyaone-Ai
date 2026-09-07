-- =============================================================================
-- 0012_user_provisioning
--
-- Supabase Auth creates a row in auth.users on first sign-in, but nothing in
-- public.profiles -- and profiles is what the platform actually reads. Without
-- this, a successful sign-in lands on "no account linked" forever.
--
-- Also bootstraps the first staff account. Someone has to be able to open the
-- Console before anyone can be invited into it, and that cannot be done from
-- inside the Console.
-- =============================================================================

create or replace function app.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_domain    text := lower(split_part(new.email, '@', 2));
  v_is_staff  boolean := v_domain = 'agastyaone.com';
  v_staff_id  uuid;
begin
  insert into public.profiles (id, email, full_name, user_type)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when v_is_staff then 'staff' else 'client' end
  )
  on conflict (id) do nothing;

  -- Anyone on the company domain is AgastyaOne staff. This is the bootstrap
  -- rule, and it is deliberately narrow: it grants Console access, not data
  -- access. Which tenants a staff member can actually see is still decided by
  -- tenant_scope and account_assignments, so a new joiner sees nothing until
  -- they are assigned an account.
  --
  -- The FIRST such user gets 'all' scope, because otherwise nobody could ever
  -- assign anybody. Everyone after them starts on 'assigned'.
  if v_is_staff then
    insert into public.staff_members (profile_id, tenant_scope, status, job_title)
    values (
      new.id,
      case when exists (select 1 from public.staff_members) then 'assigned' else 'all' end,
      'active',
      case when exists (select 1 from public.staff_members) then null else 'Founder' end
    )
    on conflict (profile_id) do nothing
    returning id into v_staff_id;

    -- First staff member is the owner; later ones get no role until granted.
    if v_staff_id is not null
       and (select count(*) from public.staff_members) = 1 then
      insert into public.user_roles (profile_id, role_id)
      select new.id, r.id from public.roles r where r.code = 'owner'
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- Keep profiles.email in step when a user changes their address in Auth.
create or replace function app.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email, updated_at = now() where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function app.handle_user_email_change();
