-- Trayectorias editables: lectura pública solo para fichas publicadas y edición administrativa atómica.
begin;

create or replace function public.player_trajectory_public(p_player_id text)
returns table (
  season_year smallint,
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
  select s.season_year, s.club_id, s.legacy_club_name, s.position_text, s.weight_kg, s.height_cm,
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
  insert into app_private.player_seasons (player_id, season_year, club_id, legacy_club_name, position_text, weight_kg, height_cm)
  select p_player_id, x.season_year, x.club_id, nullif(trim(x.legacy_club_name), ''), nullif(trim(x.position_text), ''), x.weight_kg, x.height_cm
  from jsonb_to_recordset(p_seasons) as x(
    season_year smallint, club_id text, legacy_club_name text, position_text text,
    weight_kg numeric, height_cm numeric
  )
  order by x.season_year;
end;
$$;

revoke all on function public.player_trajectory_public(text) from public;
grant execute on function public.player_trajectory_public(text) to anon, authenticated;
revoke all on function public.admin_replace_player_trajectory(text, jsonb) from public;
grant execute on function public.admin_replace_player_trajectory(text, jsonb) to authenticated;

commit;
