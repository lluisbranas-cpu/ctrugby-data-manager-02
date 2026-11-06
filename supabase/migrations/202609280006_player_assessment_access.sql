-- Las tablas de app_private no se exponen por PostgREST. Estas funciones
-- mantienen los datos privados y permiten usarlos únicamente a administradores.
begin;

create table if not exists app_private.player_assessments (
  id uuid primary key,
  player_id text not null references public.catalog_players(id) on delete cascade,
  season text not null,
  label text not null,
  evaluated_on date,
  club text not null default '',
  position text not null default '',
  metrics jsonb not null default '{}'::jsonb,
  notes text not null default '',
  revision integer not null default 1,
  updated_at timestamptz not null default now()
);
create index if not exists player_assessments_player_date on app_private.player_assessments (player_id, evaluated_on);
alter table app_private.player_assessments enable row level security;
revoke all on app_private.player_assessments from public, anon, authenticated;
grant select, insert, update, delete on app_private.player_assessments to authenticated;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'app_private' and tablename = 'player_assessments' and policyname = 'player_assessments_admin') then
    create policy player_assessments_admin on app_private.player_assessments for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());
  end if;
end $$;

create or replace function public.app_player_assessments(p_player_id text)
returns table (
  id uuid, player_id text, season text, label text, evaluated_on date,
  club text, "position" text, metrics jsonb, notes text, revision integer
)
language plpgsql security definer set search_path = public, app_private
as $$
begin
  if not public.app_is_admin() then
    raise exception 'Acceso de administrador requerido.' using errcode = '42501';
  end if;

  return query
  select assessment.id, assessment.player_id, assessment.season, assessment.label,
    assessment.evaluated_on, assessment.club, assessment.position, assessment.metrics,
    assessment.notes, assessment.revision
  from app_private.player_assessments assessment
  where assessment.player_id = p_player_id
  order by assessment.evaluated_on nulls last, assessment.season;
end;
$$;

create or replace function public.app_save_player_assessment(p_record jsonb)
returns table (
  id uuid, player_id text, season text, label text, evaluated_on date,
  club text, "position" text, metrics jsonb, notes text, revision integer
)
language plpgsql security definer set search_path = public, app_private
as $$
begin
  if not public.app_is_admin() then
    raise exception 'Acceso de administrador requerido.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_record) <> 'object'
    or coalesce(trim(p_record->>'player_id'), '') !~ '^CTR[0-9]{4}$'
    or coalesce(trim(p_record->>'season'), '') = ''
    or coalesce(trim(p_record->>'label'), '') = '' then
    raise exception 'Datos de evaluación no válidos.' using errcode = '22023';
  end if;

  return query
  insert into app_private.player_assessments as assessment (
    id, player_id, season, label, evaluated_on, club, position, metrics, notes, revision
  ) values (
    (p_record->>'id')::uuid, p_record->>'player_id', trim(p_record->>'season'), trim(p_record->>'label'),
    nullif(p_record->>'evaluated_on', '')::date, coalesce(p_record->>'club', ''),
    coalesce(p_record->>'position', ''), coalesce(p_record->'metrics', '{}'::jsonb),
    coalesce(p_record->>'notes', ''), 1
  ) on conflict on constraint player_assessments_pkey do update set
    season = excluded.season, label = excluded.label, evaluated_on = excluded.evaluated_on,
    club = excluded.club, position = excluded.position, metrics = excluded.metrics,
    notes = excluded.notes, revision = assessment.revision + 1, updated_at = now()
  returning assessment.id, assessment.player_id, assessment.season, assessment.label,
    assessment.evaluated_on, assessment.club, assessment.position, assessment.metrics,
    assessment.notes, assessment.revision;
end;
$$;

revoke all on function public.app_player_assessments(text) from public;
revoke all on function public.app_save_player_assessment(jsonb) from public;
grant execute on function public.app_player_assessments(text) to authenticated;
grant execute on function public.app_save_player_assessment(jsonb) to authenticated;

commit;
