-- Importación atómica desde la hoja de catálogo. Ejecutar tras las migraciones 002 y 003.
-- La función solo puede ser usada por un administrador autenticado.
begin;

create or replace function public.admin_import_catalog_sheet(
  p_clubs jsonb,
  p_federations jsonb,
  p_private jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, app_private
as $$
declare
  club_count integer;
  federation_count integer;
  private_count integer;
begin
  if not public.app_is_admin() then
    raise exception 'Acceso de administrador requerido.' using errcode = '42501';
  end if;

  with source as (
    select * from jsonb_to_recordset(p_clubs) as x(
      id text, name text, active boolean, founded_text text, disappeared_text text,
      city text, province text, region text, country text, latitude double precision,
      longitude double precision, maps_url text, website text, instagram text,
      published boolean, version integer
    )
  ), written as (
    insert into public.catalog_clubs (
      id, name, active, founded_text, disappeared_text, city, province, region,
      country, latitude, longitude, maps_url, website, instagram, published, version
    )
    select id, name, active, founded_text, disappeared_text, city, province, region,
      country, latitude, longitude, maps_url, website, instagram, published, version
    from source
    on conflict (id) do update set
      name = excluded.name, active = excluded.active, founded_text = excluded.founded_text,
      disappeared_text = excluded.disappeared_text, city = excluded.city,
      province = excluded.province, region = excluded.region, country = excluded.country,
      latitude = excluded.latitude, longitude = excluded.longitude, maps_url = excluded.maps_url,
      website = excluded.website, instagram = excluded.instagram, published = excluded.published,
      version = excluded.version, updated_at = now()
    where public.catalog_clubs.version = excluded.version - 1
    returning id
  ) select count(*) into club_count from written;
  if club_count <> jsonb_array_length(p_clubs) then
    raise exception 'Uno o más clubs cambiaron durante la importación. Recarga la hoja antes de volver a intentarlo.' using errcode = '40001';
  end if;

  with source as (
    select * from jsonb_to_recordset(p_federations) as x(
      id text, name text, scope text, territory text, country text, active boolean,
      website text, published boolean, version integer
    )
  ), written as (
    insert into public.catalog_federations (
      id, name, scope, territory, country, active, website, published, version
    )
    select id, name, scope, territory, country, active, website, published, version
    from source
    on conflict (id) do update set
      name = excluded.name, scope = excluded.scope, territory = excluded.territory,
      country = excluded.country, active = excluded.active, website = excluded.website,
      published = excluded.published, version = excluded.version, updated_at = now()
    where public.catalog_federations.version = excluded.version - 1
    returning id
  ) select count(*) into federation_count from written;
  if federation_count <> jsonb_array_length(p_federations) then
    raise exception 'Una o más federaciones cambiaron durante la importación. Recarga la hoja antes de volver a intentarlo.' using errcode = '40001';
  end if;

  insert into app_private.club_notes (club_id, note, updated_at)
  select x.id, x.note, now()
  from jsonb_to_recordset(p_private) as x(kind text, id text, note text, email text, legacy_club_count integer)
  where x.kind = 'club' and x.note is not null
  on conflict (club_id) do update set note = excluded.note, updated_at = now();

  insert into app_private.federation_notes (federation_id, email, legacy_club_count, updated_at)
  select x.id, x.email, x.legacy_club_count, now()
  from jsonb_to_recordset(p_private) as x(kind text, id text, note text, email text, legacy_club_count integer)
  where x.kind = 'federation' and (x.email is not null or x.legacy_club_count is not null)
  on conflict (federation_id) do update set
    email = excluded.email, legacy_club_count = excluded.legacy_club_count, updated_at = now();

  select count(*) into private_count
  from jsonb_to_recordset(p_private) as x(kind text, id text, note text, email text, legacy_club_count integer)
  where (x.kind = 'club' and x.note is not null)
     or (x.kind = 'federation' and (x.email is not null or x.legacy_club_count is not null));

  return jsonb_build_object('clubs', club_count, 'federations', federation_count, 'private_rows', private_count);
end;
$$;

revoke all on function public.admin_import_catalog_sheet(jsonb, jsonb, jsonb) from public;
grant execute on function public.admin_import_catalog_sheet(jsonb, jsonb, jsonb) to authenticated;

commit;
