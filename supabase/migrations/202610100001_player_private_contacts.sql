-- Contactos privados de jugador y acceso individual a su ficha.
begin;

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
