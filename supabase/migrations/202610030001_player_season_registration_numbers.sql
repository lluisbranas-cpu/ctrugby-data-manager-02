-- Conserva el número de inscripción/registro de cada jugador en cada temporada.
begin;

alter table app_private.player_seasons
  add column if not exists registration_number text
  check (registration_number is null or length(trim(registration_number)) between 1 and 40);

drop function if exists public.player_trajectory_public(text);

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

  insert into app_private.player_seasons (player_id, season_year, registration_number, club_id, legacy_club_name, position_text, weight_kg, height_cm)
  select x.player_id, x.season_year, nullif(trim(x.registration_number), ''), x.club_id, x.legacy_club_name, x.position_text, x.weight_kg, x.height_cm
  from jsonb_to_recordset(p_seasons) as x(
    player_id text, season_year smallint, registration_number text, club_id text, legacy_club_name text,
    position_text text, weight_kg numeric, height_cm numeric
  );
  get diagnostics season_count = row_count;
  if season_count <> jsonb_array_length(p_seasons) then
    raise exception 'No se han podido insertar todas las temporadas privadas.';
  end if;

  return jsonb_build_object('players', player_count, 'profiles', profile_count, 'seasons', season_count);
end;
$$;

create or replace function public.player_trajectory_public(p_player_id text)
returns table (
  season_year smallint,
  registration_number text,
  club_id text,
  legacy_club_name text,
  position_text text,
  weight_kg numeric,
  height_cm numeric,
  club_name text
)
language sql stable security definer
set search_path = public, app_private
as $$
  select s.season_year, s.registration_number, s.club_id, s.legacy_club_name, s.position_text, s.weight_kg, s.height_cm,
         coalesce(c.name, s.legacy_club_name) as club_name
  from app_private.player_seasons s
  join public.catalog_players p on p.id = s.player_id and p.published
  left join public.catalog_clubs c on c.id = s.club_id
  where s.player_id = p_player_id
  order by s.season_year desc;
$$;

create or replace function public.admin_replace_player_trajectory(p_player_id text, p_seasons jsonb)
returns void
language plpgsql security definer
set search_path = public, app_private
as $$
begin
  if not public.app_is_admin() then
    raise exception 'Acceso de administrador requerido.' using errcode = '42501';
  end if;
  if p_player_id !~ '^CTR[0-9]{4}$' or not exists (select 1 from public.catalog_players where id = p_player_id) then
    raise exception 'Jugador no válido.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_seasons) <> 'array' then
    raise exception 'La trayectoria no tiene un formato válido.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_seasons) as x(season_year smallint)
    where x.season_year is null or x.season_year < 2000 or x.season_year > 2035
  ) or exists (
    select season_year from jsonb_to_recordset(p_seasons) as x(season_year smallint)
    group by season_year having count(*) > 1
  ) then
    raise exception 'Cada temporada debe ser única y estar entre 2000 y 2035.' using errcode = '22023';
  end if;

  delete from app_private.player_seasons where player_id = p_player_id;
  insert into app_private.player_seasons (player_id, season_year, registration_number, club_id, legacy_club_name, position_text, weight_kg, height_cm)
  select p_player_id, x.season_year, nullif(trim(x.registration_number), ''), x.club_id, nullif(trim(x.legacy_club_name), ''), nullif(trim(x.position_text), ''), x.weight_kg, x.height_cm
  from jsonb_to_recordset(p_seasons) as x(
    season_year smallint, registration_number text, club_id text, legacy_club_name text, position_text text,
    weight_kg numeric, height_cm numeric
  )
  order by x.season_year;
end;
$$;

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
  set registration_number = nullif(trim(source.registration_number), ''),
      club_id = source.club_id,
      legacy_club_name = source.legacy_club_name,
      position_text = source.position_text,
      weight_kg = source.weight_kg,
      height_cm = source.height_cm,
      updated_at = now()
  from jsonb_to_recordset(p_seasons) as source(
    action text, player_id text, season_year smallint, registration_number text, club_id text, legacy_club_name text,
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
    player_id, season_year, registration_number, club_id, legacy_club_name, position_text, weight_kg, height_cm
  )
  select source.player_id, source.season_year, nullif(trim(source.registration_number), ''), source.club_id, source.legacy_club_name,
         source.position_text, source.weight_kg, source.height_cm
  from jsonb_to_recordset(p_seasons) as source(
    action text, player_id text, season_year smallint, registration_number text, club_id text, legacy_club_name text,
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
        'player_id', season.player_id, 'season_year', season.season_year, 'registration_number', season.registration_number,
        'club_id', season.club_id, 'legacy_club_name', season.legacy_club_name, 'position_text', season.position_text,
        'weight_kg', season.weight_kg, 'height_cm', season.height_cm
      ) order by season.player_id, season.season_year), '[]'::jsonb)
      from app_private.player_seasons season
    ),
    'clubs', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', club.id, 'name', club.name, 'country', club.country
      ) order by club.name, club.id), '[]'::jsonb)
      from public.catalog_clubs club
    )
  );
end;
$$;

commit;
