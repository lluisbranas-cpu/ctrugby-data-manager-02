-- JUG is the canonical player identifier across the shared catalogue.
-- CTR remains reserved for Campus data and is never used as a player key.
begin;

-- Make every dependent key follow the primary-key rename, including private
-- profiles and historical participants/milestones.
do $$
declare fk record; definition text;
begin
  for fk in
    select con.oid, con.conname, con.conrelid::regclass as relation
    from pg_constraint con
    where con.contype = 'f' and con.confrelid = 'public.catalog_players'::regclass
  loop
    definition := regexp_replace(pg_get_constraintdef(fk.oid), ' ON UPDATE (NO ACTION|RESTRICT|CASCADE|SET NULL|SET DEFAULT)', '', 'i');
    execute format('alter table %s drop constraint %I', fk.relation, fk.conname);
    execute format('alter table %s add constraint %I %s ON UPDATE CASCADE', fk.relation, fk.conname, definition);
  end loop;
  for fk in
    select con.oid, con.conname, con.conrelid::regclass as relation
    from pg_constraint con
    where con.contype = 'f' and con.confrelid = 'public.catalog_participants'::regclass
  loop
    definition := regexp_replace(pg_get_constraintdef(fk.oid), ' ON UPDATE (NO ACTION|RESTRICT|CASCADE|SET NULL|SET DEFAULT)', '', 'i');
    execute format('alter table %s drop constraint %I', fk.relation, fk.conname);
    execute format('alter table %s add constraint %I %s ON UPDATE CASCADE', fk.relation, fk.conname, definition);
  end loop;
end;
$$;

alter table public.catalog_players drop constraint if exists catalog_players_id_check;
alter table public.catalog_players add constraint catalog_players_id_check check (id ~ '^(?:CTR|JUG)[0-9]{4}$');
alter table public.catalog_participants drop constraint if exists catalog_participants_id_check;
alter table public.catalog_participants add constraint catalog_participants_id_check check (id ~ '^(?:PLR_(?:CTR|JUG)[0-9]{4}|STF_STF[0-9]{4}|EXT_[A-F0-9]{16})$') not valid;

-- Rename values only after the constraints accept both historical and target IDs.
update public.catalog_players set id = 'JUG' || substring(id from 4) where id ~ '^CTR[0-9]{4}$';
update public.catalog_participants set id = 'PLR_JUG' || substring(id from 8) where id ~ '^PLR_CTR[0-9]{4}$';

alter table public.catalog_players drop constraint catalog_players_id_check;
alter table public.catalog_players add constraint catalog_players_id_check check (id ~ '^JUG[0-9]{4}$');
alter table public.catalog_participants validate constraint catalog_participants_id_check;

create or replace function public.admin_replace_player_trajectory(p_player_id text, p_seasons jsonb)
returns void language plpgsql security definer set search_path = public, app_private as $$
begin
  if not public.app_is_admin() then raise exception 'Acceso de administrador requerido.' using errcode = '42501'; end if;
  if p_player_id !~ '^JUG[0-9]{4}$' or not exists (select 1 from public.catalog_players where id = p_player_id) then raise exception 'Jugador no válido.' using errcode = '22023'; end if;
  if jsonb_typeof(p_seasons) <> 'array' then raise exception 'La trayectoria no tiene un formato válido.' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_to_recordset(p_seasons) as x(season_year smallint) where x.season_year is null or x.season_year < 2000 or x.season_year > 2035)
     or exists (select season_year from jsonb_to_recordset(p_seasons) as x(season_year smallint) group by season_year having count(*) > 1) then
    raise exception 'Cada temporada debe ser única y estar entre 2000 y 2035.' using errcode = '22023';
  end if;
  delete from app_private.player_seasons where player_id = p_player_id;
  insert into app_private.player_seasons (player_id, season_year, club_id, legacy_club_name, position_text, weight_kg, height_cm)
  select p_player_id, x.season_year, x.club_id, nullif(trim(x.legacy_club_name), ''), nullif(trim(x.position_text), ''), x.weight_kg, x.height_cm
  from jsonb_to_recordset(p_seasons) as x(season_year smallint, club_id text, legacy_club_name text, position_text text, weight_kg numeric, height_cm numeric)
  order by x.season_year;
end;
$$;

create or replace function public.app_save_player_assessment(p_record jsonb)
returns table(id uuid, player_id text, season text, label text, evaluated_on date, club text, "position" text, metrics jsonb, notes text, revision integer)
language plpgsql security definer set search_path = public, app_private as $$
begin
  if not public.app_is_admin() then raise exception 'Acceso de administrador requerido.' using errcode = '42501'; end if;
  if jsonb_typeof(p_record) <> 'object' or coalesce(trim(p_record->>'player_id'), '') !~ '^JUG[0-9]{4}$' or coalesce(trim(p_record->>'season'), '') = '' or coalesce(trim(p_record->>'label'), '') = '' then raise exception 'Datos de evaluación no válidos.' using errcode = '22023'; end if;
  return query insert into app_private.player_assessments as assessment (id, player_id, season, label, evaluated_on, club, position, metrics, notes, revision)
  values ((p_record->>'id')::uuid, p_record->>'player_id', trim(p_record->>'season'), trim(p_record->>'label'), nullif(p_record->>'evaluated_on', '')::date, coalesce(p_record->>'club', ''), coalesce(p_record->>'position', ''), coalesce(p_record->'metrics', '{}'::jsonb), coalesce(p_record->>'notes', ''), 1)
  on conflict on constraint player_assessments_pkey do update set season=excluded.season,label=excluded.label,evaluated_on=excluded.evaluated_on,club=excluded.club,position=excluded.position,metrics=excluded.metrics,notes=excluded.notes,revision=assessment.revision+1,updated_at=now()
  returning assessment.id,assessment.player_id,assessment.season,assessment.label,assessment.evaluated_on,assessment.club,assessment.position,assessment.metrics,assessment.notes,assessment.revision;
end;
$$;

commit;
