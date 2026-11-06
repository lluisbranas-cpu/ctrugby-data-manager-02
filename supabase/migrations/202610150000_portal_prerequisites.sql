-- Portal structure required before private access can be activated.
begin;
create table if not exists app_private.portal_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  subject_kind text not null check (subject_kind in ('administrator', 'player', 'club')),
  subject_id text not null,
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  created_at timestamptz not null default now()
);

alter table app_private.portal_accounts enable row level security;
revoke all on app_private.portal_accounts from public, anon, authenticated;

create or replace function public.app_current_portal_access()
returns table(subject_kind text, subject_id text, phone_e164 text)
language sql stable security definer set search_path = ''
as $$
  select account.subject_kind, account.subject_id, account.phone_e164
  from app_private.portal_accounts account
  where account.user_id = auth.uid()
$$;

revoke all on function public.app_current_portal_access() from public;
grant execute on function public.app_current_portal_access() to authenticated;

-- La creación de usuarios y sus contraseñas se hace en Supabase Auth.
-- Esta función vincula ese usuario ya creado con una ficha concreta.
create or replace function public.app_link_portal_account(
  p_user_id uuid,
  p_subject_kind text,
  p_subject_id text,
  p_phone_e164 text
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.app_is_admin() then
    raise exception 'Acceso de administrador requerido.' using errcode = '42501';
  end if;
  if p_subject_kind = 'administrator' and not exists (
    select 1 from app_private.admins where user_id = p_user_id
  ) then
    raise exception 'Administrador no encontrado.' using errcode = '23503';
  end if;
  if p_subject_kind = 'administrator' and p_subject_id <> 'ADMIN' then
    raise exception 'El identificador de administrador debe ser ADMIN.' using errcode = '22023';
  end if;
  if p_subject_kind = 'player' and not exists (
    select 1 from public.catalog_players where id = p_subject_id
  ) then
    raise exception 'Jugador no encontrado.' using errcode = '23503';
  end if;
  if p_subject_kind = 'club' and not exists (
    select 1 from public.catalog_clubs where id = p_subject_id
  ) then
    raise exception 'Club no encontrado.' using errcode = '23503';
  end if;
  if p_subject_kind not in ('administrator', 'player', 'club') then
    raise exception 'Tipo de acceso no válido.' using errcode = '22023';
  end if;
  if p_phone_e164 !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Teléfono no válido. Usa el formato internacional, por ejemplo +34600111222.' using errcode = '22023';
  end if;

  insert into app_private.portal_accounts (user_id, subject_kind, subject_id, phone_e164)
  values (p_user_id, p_subject_kind, p_subject_id, p_phone_e164)
  on conflict (user_id) do update
    set subject_kind = excluded.subject_kind,
        subject_id = excluded.subject_id,
        phone_e164 = excluded.phone_e164;
end;
$$;

revoke all on function public.app_link_portal_account(uuid, text, text, text) from public;
grant execute on function public.app_link_portal_account(uuid, text, text, text) to authenticated;

-- Contactos privados de jugador y acceso individual a su ficha.
alter table app_private.portal_accounts
  drop constraint if exists portal_accounts_subject_kind_subject_id_key;

create table if not exists app_private.player_private_contacts (
  player_id text primary key references public.catalog_players(id) on delete cascade,
  player_email text,
  player_phone_e164 text,
  tutor1_name text,
  tutor1_email text,
  tutor1_phone_e164 text,
  tutor2_name text,
  tutor2_email text,
  tutor2_phone_e164 text,
  updated_at timestamptz not null default now(),
  check (player_email is null or player_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  check (tutor1_email is null or tutor1_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  check (tutor2_email is null or tutor2_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  check (player_phone_e164 is null or player_phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  check (tutor1_phone_e164 is null or tutor1_phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  check (tutor2_phone_e164 is null or tutor2_phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);

alter table app_private.player_private_contacts enable row level security;
revoke all on app_private.player_private_contacts from public, anon, authenticated;
grant select, insert, update, delete on app_private.player_private_contacts to authenticated;

drop policy if exists player_private_contacts_admin on app_private.player_private_contacts;
create policy player_private_contacts_admin on app_private.player_private_contacts
  for all to authenticated
  using (public.app_is_admin())
  with check (public.app_is_admin());

create or replace function public.admin_upsert_player_private_contacts(
  p_player_id text,
  p_player_email text,
  p_player_phone_e164 text,
  p_tutor1_name text,
  p_tutor1_email text,
  p_tutor1_phone_e164 text,
  p_tutor2_name text,
  p_tutor2_email text,
  p_tutor2_phone_e164 text
)
returns app_private.player_private_contacts
language plpgsql security definer set search_path = ''
as $$
declare
  v_row app_private.player_private_contacts;
begin
  if not public.app_is_admin() then
    raise exception 'Acceso de administrador requerido.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.catalog_players where id = p_player_id) then
    raise exception 'Jugador no encontrado.' using errcode = '23503';
  end if;

  insert into app_private.player_private_contacts (
    player_id,
    player_email,
    player_phone_e164,
    tutor1_name,
    tutor1_email,
    tutor1_phone_e164,
    tutor2_name,
    tutor2_email,
    tutor2_phone_e164,
    updated_at
  )
  values (
    p_player_id,
    nullif(lower(trim(p_player_email)), ''),
    nullif(trim(p_player_phone_e164), ''),
    nullif(trim(p_tutor1_name), ''),
    nullif(lower(trim(p_tutor1_email)), ''),
    nullif(trim(p_tutor1_phone_e164), ''),
    nullif(trim(p_tutor2_name), ''),
    nullif(lower(trim(p_tutor2_email)), ''),
    nullif(trim(p_tutor2_phone_e164), ''),
    now()
  )
  on conflict (player_id) do update
    set player_email = excluded.player_email,
        player_phone_e164 = excluded.player_phone_e164,
        tutor1_name = excluded.tutor1_name,
        tutor1_email = excluded.tutor1_email,
        tutor1_phone_e164 = excluded.tutor1_phone_e164,
        tutor2_name = excluded.tutor2_name,
        tutor2_email = excluded.tutor2_email,
        tutor2_phone_e164 = excluded.tutor2_phone_e164,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.admin_upsert_player_private_contacts(text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.admin_upsert_player_private_contacts(text, text, text, text, text, text, text, text, text) to authenticated;


commit;
