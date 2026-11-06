-- LikidHub: estructura y RPC controlada para participaciones de campus.
-- No inserta ni modifica participaciones. Ejecutar solo tras revisión.
begin;

create table if not exists app_private.player_participations (
  player_id text not null references public.catalog_players(id) on update cascade on delete cascade,
  campus_id text not null check (campus_id ~ '^[A-Z]{3}[0-9]{3}$'),
  season_year smallint not null check (season_year = 0 or season_year between 2000 and 2035),
  participation_count smallint not null default 1 check (participation_count > 0 and participation_count <= 100),
  registration_number text,
  email_enabled boolean not null default true,
  pending_year boolean not null default false,
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (player_id, campus_id, season_year),
  check ((season_year = 0) = pending_year)
);
create index if not exists player_participations_campus_year_idx on app_private.player_participations(campus_id, season_year);
alter table app_private.player_participations enable row level security;

create or replace function public.likidhub_upsert_club(p_row jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service_role requerido' using errcode = '42501'; end if;
  insert into public.catalog_clubs(id,name,published)
  values(p_row->>'id',p_row->>'name',coalesce((p_row->>'published')::boolean,false))
  on conflict(id) do update set name=excluded.name,published=excluded.published,updated_at=now();
end $$;

create or replace function public.likidhub_upsert_player_participation(p_row jsonb)
returns void language plpgsql security definer set search_path = public, app_private as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service_role requerido' using errcode = '42501'; end if;
  insert into app_private.player_participations(player_id,campus_id,season_year,participation_count,registration_number,email_enabled,pending_year,source_sha256)
  values(
    p_row->>'player_id', p_row->>'campus_id', (p_row->>'season_year')::smallint,
    coalesce((p_row->>'participation_count')::smallint, 1), nullif(p_row->>'registration_number',''),
    coalesce((p_row->>'email_enabled')::boolean, true), coalesce((p_row->>'pending_year')::boolean, false), p_row->>'source_sha256'
  )
  on conflict(player_id,campus_id,season_year) do update set
    participation_count=excluded.participation_count, registration_number=excluded.registration_number,
    email_enabled=excluded.email_enabled, pending_year=excluded.pending_year,
    source_sha256=excluded.source_sha256, updated_at=now();
end $$;
revoke all on function public.likidhub_upsert_player_participation(jsonb) from public, anon, authenticated;
revoke all on function public.likidhub_upsert_club(jsonb) from public, anon, authenticated;
grant execute on function public.likidhub_upsert_player_participation(jsonb), public.likidhub_upsert_club(jsonb) to service_role;

commit;
