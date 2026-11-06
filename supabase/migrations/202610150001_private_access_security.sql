-- Registered email + password + TOTP for every private account. No SMS subscription.
begin;

create table if not exists app_private.administrator_contacts (
  email text primary key check (email = lower(trim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table app_private.administrator_contacts enable row level security;
revoke all on app_private.administrator_contacts from public, anon, authenticated;

create or replace function public.app_login_contacts()
returns table(subject_kind text, subject_id text, phone_e164 text)
language sql stable security definer set search_path = ''
as $$
  with account as (
    select lower(trim(email)) as email from auth.users
    where id = auth.uid() and email_confirmed_at is not null
  ), candidates as (
    select 'administrator'::text as subject_kind, 'ADMIN'::text as subject_id, a.phone_e164
    from app_private.administrator_contacts a join account u on u.email = a.email where a.active
    union
    select 'player', c.player_id, v.phone
    from app_private.player_private_contacts c
    cross join lateral (values (c.player_email, c.player_phone_e164), (c.tutor1_email, c.tutor1_phone_e164), (c.tutor2_email, c.tutor2_phone_e164)) v(email, phone)
    join account u on lower(trim(v.email)) = u.email
    where not exists (select 1 from app_private.administrator_contacts a where a.email = u.email)
    union
    select a.subject_kind, a.subject_id, a.phone_e164
    from app_private.portal_accounts a join auth.users u on u.id = a.user_id
    where a.user_id = auth.uid() and a.subject_kind = 'club' and u.email_confirmed_at is not null
      and not exists (select 1 from app_private.administrator_contacts c where c.email = lower(trim(u.email)))
  ) select distinct c.subject_kind, c.subject_id, c.phone_e164 from candidates c
    order by c.subject_kind, c.subject_id, c.phone_e164
$$;
revoke all on function public.app_login_contacts() from public, anon;
grant execute on function public.app_login_contacts() to authenticated;

create or replace function public.app_has_private_access()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(auth.jwt()->>'aal' = 'aal2', false)
    and exists (select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) a where a->>'method' = 'password')
    and exists (select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) a where a->>'method' = 'totp')
    and exists (select 1 from public.app_login_contacts())
$$;
revoke all on function public.app_has_private_access() from public;
grant execute on function public.app_has_private_access() to anon, authenticated;

create or replace function public.app_is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.app_has_private_access() and exists (
    select 1 from public.app_login_contacts() where subject_kind = 'administrator'
  )
$$;

create or replace function public.app_can_view_player(p_player_id text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.app_is_admin() or (public.app_has_private_access() and exists (
    select 1 from public.app_login_contacts() c where c.subject_kind = 'player' and c.subject_id = p_player_id
  ))
$$;
revoke all on function public.app_can_view_player(text) from public;
grant execute on function public.app_can_view_player(text) to anon, authenticated;

drop policy if exists catalog_player_private_read on public.catalog_players;
create policy catalog_player_private_read on public.catalog_players for select to authenticated
using (public.app_can_view_player(id));

create or replace function public.admin_list_administrators()
returns table(email text, phone_e164 text, active boolean, updated_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.app_is_admin() then raise exception 'Acceso de administrador requerido.' using errcode = '42501'; end if;
  return query select a.email, a.phone_e164, a.active, a.updated_at from app_private.administrator_contacts a order by a.email;
end;
$$;

create or replace function public.admin_save_administrator(p_email text, p_phone text, p_active boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_email text := lower(trim(p_email)); v_own_email text;
begin
  if not public.app_is_admin() then raise exception 'Acceso de administrador requerido.' using errcode = '42501'; end if;
  select lower(trim(email)) into v_own_email from auth.users where id = auth.uid();
  if v_email = v_own_email and p_active is distinct from true then
    raise exception 'Otro administrador debe desactivar tu acceso.' using errcode = '22023';
  end if;
  insert into app_private.administrator_contacts(email, phone_e164, active)
  values (v_email, trim(p_phone), p_active)
  on conflict (email) do update set phone_e164 = excluded.phone_e164, active = excluded.active, updated_at = now();
end;
$$;
revoke all on function public.admin_list_administrators() from public;
revoke all on function public.admin_save_administrator(text, text, boolean) from public;
grant execute on function public.admin_list_administrators() to authenticated;
grant execute on function public.admin_save_administrator(text, text, boolean) to authenticated;

-- Import local contact records once without overwriting subsequent online edits.
create or replace function public.app_import_private_contacts(p_records jsonb)
returns integer language plpgsql security definer set search_path = ''
as $$
declare inserted integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Acceso no permitido.' using errcode = '42501'; end if;
  if jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records) > 10000 then raise exception 'Datos no válidos.' using errcode = '22023'; end if;
  insert into app_private.player_private_contacts (player_id, player_email, player_phone_e164, tutor1_name, tutor1_email, tutor1_phone_e164, tutor2_name, tutor2_email, tutor2_phone_e164)
  select r.player_id, r.player_email, r.player_phone_e164, r.tutor1_name, r.tutor1_email, r.tutor1_phone_e164, r.tutor2_name, r.tutor2_email, r.tutor2_phone_e164
  from jsonb_to_recordset(p_records) as r(player_id text, player_email text, player_phone_e164 text, tutor1_name text, tutor1_email text, tutor1_phone_e164 text, tutor2_name text, tutor2_email text, tutor2_phone_e164 text)
  join public.catalog_players p on p.id = r.player_id
  on conflict (player_id) do nothing;
  get diagnostics inserted = row_count;
  return inserted;
end;
$$;
revoke all on function public.app_import_private_contacts(jsonb) from public, anon, authenticated;
grant execute on function public.app_import_private_contacts(jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
