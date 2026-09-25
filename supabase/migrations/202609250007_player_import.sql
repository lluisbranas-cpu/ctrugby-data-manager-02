-- Importación atómica de la preparación local de jugadores.
begin;

create or replace function public.admin_import_players(
  p_players jsonb,
  p_profiles jsonb,
  p_seasons jsonb
) returns jsonb
language plpgsql security definer
set search_path = public, app_private
as $$
declare
  player_count integer;
  profile_count integer;
  season_count integer;
begin
  if not public.app_is_admin() then
    raise exception 'Acceso de administrador requerido.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_players) <> 'array' or jsonb_typeof(p_profiles) <> 'array' or jsonb_typeof(p_seasons) <> 'array' then
    raise exception 'La preparación de jugadores no tiene el formato esperado.' using errcode = '22023';
  end if;
  if exists(select 1 from public.catalog_players) then
    raise exception 'El catálogo de jugadores ya contiene fichas. No se sobrescriben datos existentes.' using errcode = '23505';
  end if;

  insert into public.catalog_players (id, first_name, last_name)
  select x.id, x.first_name, x.last_name
  from jsonb_to_recordset(p_players) as x(id text, first_name text, last_name text);
  get diagnostics player_count = row_count;
  if player_count <> jsonb_array_length(p_players) then
    raise exception 'No se han podido insertar todas las fichas de jugadores.';
  end if;

  insert into app_private.player_profiles (player_id, category, birth_year)
  select x.player_id, x.category, x.birth_year
  from jsonb_to_recordset(p_profiles) as x(player_id text, category text, birth_year smallint);
  get diagnostics profile_count = row_count;
  if profile_count <> jsonb_array_length(p_profiles) then
    raise exception 'No se han podido insertar todos los perfiles privados.';
  end if;

  insert into app_private.player_seasons (player_id, season_year, club_id, legacy_club_name, position_text, weight_kg, height_cm)
  select x.player_id, x.season_year, x.club_id, x.legacy_club_name, x.position_text, x.weight_kg, x.height_cm
  from jsonb_to_recordset(p_seasons) as x(
    player_id text, season_year smallint, club_id text, legacy_club_name text,
    position_text text, weight_kg numeric, height_cm numeric
  );
  get diagnostics season_count = row_count;
  if season_count <> jsonb_array_length(p_seasons) then
    raise exception 'No se han podido insertar todas las temporadas privadas.';
  end if;

  return jsonb_build_object('players', player_count, 'profiles', profile_count, 'seasons', season_count);
end;
$$;

revoke all on function public.admin_import_players(jsonb, jsonb, jsonb) from public;
grant execute on function public.admin_import_players(jsonb, jsonb, jsonb) to authenticated;

commit;
