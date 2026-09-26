-- Edición de jugadores y temporadas desde hoja .xlsx.
-- Los datos importados permanecen privados; esta función no cambia la publicación.
begin;

create or replace function public.admin_import_player_sheet(
  p_players jsonb,
  p_seasons jsonb
) returns jsonb
language plpgsql security definer
set search_path = public, app_private
as $$
declare
  player_new_count integer := 0;
  player_updated_count integer := 0;
  season_new_count integer := 0;
  season_updated_count integer := 0;
  expected_player_updates integer;
  expected_season_updates integer;
begin
  if not public.app_is_admin() then
    raise exception 'Acceso de administrador requerido.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_players) <> 'array' or jsonb_typeof(p_seasons) <> 'array' then
    raise exception 'La hoja de jugadores no tiene el formato esperado.' using errcode = '22023';
  end if;

  select count(*) into expected_player_updates
  from jsonb_to_recordset(p_players) as x(action text, id text, version integer)
  where x.action = 'actualizar';

  update public.catalog_players as target
  set first_name = source.first_name,
      last_name = source.last_name,
      version = target.version + 1,
      updated_at = now()
  from jsonb_to_recordset(p_players) as source(
    action text, id text, first_name text, last_name text, category text, birth_year smallint, version integer
  )
  where source.action = 'actualizar'
    and target.id = source.id
    and target.version = source.version;
  get diagnostics player_updated_count = row_count;
  if player_updated_count <> expected_player_updates then
    raise exception 'Una o más fichas cambiaron en otra sesión. Recarga la hoja antes de reintentar.' using errcode = '40001';
  end if;

  insert into public.catalog_players (id, first_name, last_name)
  select source.id, source.first_name, source.last_name
  from jsonb_to_recordset(p_players) as source(
    action text, id text, first_name text, last_name text, category text, birth_year smallint, version integer
  )
  where source.action = 'nuevo';
  get diagnostics player_new_count = row_count;

  insert into app_private.player_profiles (player_id, category, birth_year, updated_at)
  select source.id, source.category, source.birth_year, now()
  from jsonb_to_recordset(p_players) as source(
    action text, id text, first_name text, last_name text, category text, birth_year smallint, version integer
  )
  on conflict (player_id) do update
  set category = excluded.category,
      birth_year = excluded.birth_year,
      updated_at = now();

  select count(*) into expected_season_updates
  from jsonb_to_recordset(p_seasons) as x(action text, player_id text, season_year smallint)
  where x.action = 'actualizar';

  update app_private.player_seasons as target
  set club_id = source.club_id,
      legacy_club_name = source.legacy_club_name,
      position_text = source.position_text,
      weight_kg = source.weight_kg,
      height_cm = source.height_cm,
      updated_at = now()
  from jsonb_to_recordset(p_seasons) as source(
    action text, player_id text, season_year smallint, club_id text, legacy_club_name text,
    position_text text, weight_kg numeric, height_cm numeric
  )
  where source.action = 'actualizar'
    and target.player_id = source.player_id
    and target.season_year = source.season_year;
  get diagnostics season_updated_count = row_count;
  if season_updated_count <> expected_season_updates then
    raise exception 'Una o más temporadas ya no existen. Descarga una hoja nueva antes de reintentar.' using errcode = '40001';
  end if;

  insert into app_private.player_seasons (
    player_id, season_year, club_id, legacy_club_name, position_text, weight_kg, height_cm
  )
  select source.player_id, source.season_year, source.club_id, source.legacy_club_name,
         source.position_text, source.weight_kg, source.height_cm
  from jsonb_to_recordset(p_seasons) as source(
    action text, player_id text, season_year smallint, club_id text, legacy_club_name text,
    position_text text, weight_kg numeric, height_cm numeric
  )
  where source.action = 'nuevo';
  get diagnostics season_new_count = row_count;

  return jsonb_build_object(
    'players_new', player_new_count,
    'players_updated', player_updated_count,
    'seasons_new', season_new_count,
    'seasons_updated', season_updated_count
  );
end;
$$;

create or replace function public.admin_player_sheet_data()
returns jsonb
language plpgsql security definer
set search_path = public, app_private
as $$
begin
  if not public.app_is_admin() then
    raise exception 'Acceso de administrador requerido.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'players', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', player.id, 'first_name', player.first_name, 'last_name', player.last_name,
        'category', profile.category, 'birth_year', profile.birth_year, 'version', player.version
      ) order by player.last_name nulls first, player.first_name, player.id), '[]'::jsonb)
      from public.catalog_players player
      left join app_private.player_profiles profile on profile.player_id = player.id
    ),
    'seasons', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'player_id', season.player_id, 'season_year', season.season_year, 'club_id', season.club_id,
        'legacy_club_name', season.legacy_club_name, 'position_text', season.position_text,
        'weight_kg', season.weight_kg, 'height_cm', season.height_cm
      ) order by season.player_id, season.season_year), '[]'::jsonb)
      from app_private.player_seasons season
    )
  );
end;
$$;

revoke all on function public.admin_import_player_sheet(jsonb, jsonb) from public;
grant execute on function public.admin_import_player_sheet(jsonb, jsonb) to authenticated;
grant execute on function public.admin_player_sheet_data() to authenticated;

commit;
