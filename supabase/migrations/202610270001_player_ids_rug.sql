-- Player identifiers are sport-scoped. Rugby uses RUG####.
-- Upgrade each foreign key first so updating the primary key cascades to all
-- private and public player data (trajectory, access, contacts, news, etc.).
do $$
declare
  fk record;
  definition text;
begin
  for fk in
    select con.oid, con.conname, con.conrelid::regclass as relation
    from pg_constraint con
    where con.contype = 'f'
      and con.confrelid = 'public.catalog_players'::regclass
  loop
    definition := regexp_replace(
      pg_get_constraintdef(fk.oid),
      ' ON UPDATE (NO ACTION|RESTRICT|CASCADE|SET NULL|SET DEFAULT)',
      '',
      'i'
    );
    execute format('alter table %s drop constraint %I', fk.relation, fk.conname);
    execute format('alter table %s add constraint %I %s ON UPDATE CASCADE', fk.relation, fk.conname, definition);
  end loop;

  update public.catalog_players
  set id = 'RUG' || substring(id from 4)
  where id ~ '^CTR[0-9]{4}$';
end;
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
  if p_player_id !~ '^RUG[0-9]{4}$' or not exists (select 1 from public.catalog_players where id = p_player_id) then
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
