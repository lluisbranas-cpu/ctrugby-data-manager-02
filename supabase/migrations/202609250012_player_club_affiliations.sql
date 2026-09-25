-- Relaciones privadas jugador-club y resumen histórico de participaciones por club.
begin;

create table app_private.player_club_affiliations (
  player_id text not null references public.catalog_players(id) on delete cascade,
  club_id text not null references public.catalog_clubs(id) on delete restrict,
  primary key (player_id, club_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table app_private.club_participation_totals (
  club_id text primary key references public.catalog_clubs(id) on delete cascade,
  participation_count integer not null check (participation_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table app_private.player_club_affiliations enable row level security;
alter table app_private.club_participation_totals enable row level security;

revoke all on app_private.player_club_affiliations, app_private.club_participation_totals from public, anon, authenticated;
grant select, insert, update, delete on app_private.player_club_affiliations, app_private.club_participation_totals to authenticated;

create policy player_club_affiliations_admin on app_private.player_club_affiliations
  for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());
create policy club_participation_totals_admin on app_private.club_participation_totals
  for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());

create or replace function public.admin_import_player_club_data(p_affiliations jsonb, p_club_participations jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, app_private
as $$
declare affiliation_count integer; club_count integer;
begin
  if not public.app_is_admin() then raise exception 'Acceso de administrador requerido.' using errcode = '42501'; end if;
  if exists(select 1 from app_private.player_club_affiliations) or exists(select 1 from app_private.club_participation_totals) then
    raise exception 'Las relaciones jugador-club ya contienen datos. No se sobrescriben registros existentes.' using errcode = '23505';
  end if;
  insert into app_private.player_club_affiliations (player_id, club_id)
  select x.player_id, x.club_id from jsonb_to_recordset(p_affiliations) as x(player_id text, club_id text);
  get diagnostics affiliation_count = row_count;
  insert into app_private.club_participation_totals (club_id, participation_count)
  select x.club_id, x.participation_count from jsonb_to_recordset(p_club_participations) as x(club_id text, participation_count integer);
  get diagnostics club_count = row_count;
  return jsonb_build_object('affiliations', affiliation_count, 'clubs', club_count);
end;
$$;

revoke all on function public.admin_import_player_club_data(jsonb, jsonb) from public;
grant execute on function public.admin_import_player_club_data(jsonb, jsonb) to authenticated;
commit;
