-- Fase de jugadores. Ejecutar solo después de revisar la preparación local.
-- La migración no carga datos: crea la estructura privada y el control de publicación.
begin;

create table public.catalog_players (
  id text primary key check (id ~ '^CTR[0-9]{4}$'),
  first_name text not null check (length(trim(first_name)) between 1 and 100),
  last_name text check (last_name is null or length(trim(last_name)) between 1 and 160),
  published boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table app_private.player_profiles (
  player_id text primary key references public.catalog_players(id) on delete cascade,
  category text,
  birth_year smallint check (birth_year is null or birth_year between 1900 and 2026),
  updated_at timestamptz not null default now()
);

create table app_private.player_seasons (
  player_id text not null references public.catalog_players(id) on delete cascade,
  season_year smallint not null check (season_year between 2000 and 2035),
  club_id text references public.catalog_clubs(id) on delete set null,
  legacy_club_name text,
  position_text text,
  weight_kg numeric(5,1) check (weight_kg is null or weight_kg between 0 and 250),
  height_cm numeric(5,1) check (height_cm is null or height_cm between 0 and 260),
  updated_at timestamptz not null default now(),
  primary key (player_id, season_year)
);

alter table public.catalog_players enable row level security;
alter table app_private.player_profiles enable row level security;
alter table app_private.player_seasons enable row level security;

revoke all on public.catalog_players from anon, authenticated;
revoke all on app_private.player_profiles, app_private.player_seasons from public, anon, authenticated;
grant select on public.catalog_players to anon, authenticated;
grant insert, update, delete on public.catalog_players to authenticated;
grant select, insert, update, delete on app_private.player_profiles, app_private.player_seasons to authenticated;

create policy catalog_player_public_read on public.catalog_players for select to anon, authenticated
  using (published);
create policy catalog_player_admin_read on public.catalog_players for select to authenticated
  using (public.app_is_admin());
create policy catalog_player_admin_write on public.catalog_players for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());
create policy player_profile_admin on app_private.player_profiles for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());
create policy player_season_admin on app_private.player_seasons for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

commit;