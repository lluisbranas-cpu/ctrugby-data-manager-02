-- LikidHub · estructura crítica para migración de jugadores y medios.
-- Ejecutar una vez desde el SQL Editor del proyecto correcto.
-- No inserta jugadores, participaciones, imágenes ni modifica datos existentes.

begin;

create schema if not exists app_private;

create table if not exists app_private.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.app_is_admin()
returns boolean language sql stable security definer set search_path = app_private, public as $$
  select auth.role() = 'service_role' or exists (select 1 from app_private.admins where user_id = auth.uid())
$$;
revoke all on function public.app_is_admin() from public, anon;
grant execute on function public.app_is_admin() to authenticated, service_role;

create table if not exists public.catalog_clubs (
  id text primary key check (id ~ '^[A-Z]{3}[0-9]{4}$'),
  name text not null,
  published boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_players (
  id text primary key check (id ~ '^CTR[0-9]{4}$'),
  first_name text not null check (length(trim(first_name)) between 1 and 100),
  last_name text,
  published boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_private.player_profiles (
  player_id text primary key references public.catalog_players(id) on update cascade on delete cascade,
  category text,
  birth_year smallint check (birth_year is null or birth_year between 1900 and 2100),
  updated_at timestamptz not null default now()
);

create table if not exists app_private.player_seasons (
  player_id text not null references public.catalog_players(id) on update cascade on delete cascade,
  season_year smallint not null check (season_year between 2000 and 2035),
  club_id text references public.catalog_clubs(id) on update cascade on delete set null,
  legacy_club_name text,
  registration_number text,
  position_text text,
  weight_kg numeric(5,1) check (weight_kg is null or weight_kg between 0 and 250),
  height_cm numeric(5,1) check (height_cm is null or height_cm between 0 and 260),
  updated_at timestamptz not null default now(),
  primary key (player_id, season_year)
);

create table if not exists app_private.player_season_photos (
  player_id text not null references public.catalog_players(id) on update cascade on delete cascade,
  season_year smallint not null check (season_year between 2000 and 2035),
  storage_key text not null unique,
  is_primary boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (player_id, season_year)
);
create unique index if not exists player_season_photos_one_primary on app_private.player_season_photos(player_id) where is_primary;

create table if not exists app_private.operational_media (
  entity_type text not null,
  entity_id text not null,
  variant text not null,
  bucket_id text not null references storage.buckets(id),
  object_key text not null,
  content_type text,
  byte_size bigint check (byte_size >= 0),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(entity_type, entity_id, variant), unique(bucket_id, object_key)
);
create index if not exists operational_media_bucket_object_idx on app_private.operational_media(bucket_id, object_key);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('catalog-operational-private', 'catalog-operational-private', false, 20971520,
  array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update set public = false;

alter table public.catalog_clubs enable row level security;
alter table public.catalog_players enable row level security;
alter table app_private.admins enable row level security;
alter table app_private.player_profiles enable row level security;
alter table app_private.player_seasons enable row level security;
alter table app_private.player_season_photos enable row level security;
alter table app_private.operational_media enable row level security;

do $$ begin create policy catalog_players_public_read on public.catalog_players for select to anon, authenticated using (published); exception when duplicate_object then null; end $$;
do $$ begin create policy catalog_players_admin_all on public.catalog_players for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy catalog_clubs_public_read on public.catalog_clubs for select to anon, authenticated using (published); exception when duplicate_object then null; end $$;
do $$ begin create policy catalog_clubs_admin_all on public.catalog_clubs for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy private_admins_admin on app_private.admins for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy player_profiles_admin on app_private.player_profiles for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy player_seasons_admin on app_private.player_seasons for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy player_season_photos_admin on app_private.player_season_photos for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy operational_media_admin on app_private.operational_media for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy operational_storage_admin on storage.objects for all to authenticated using (bucket_id = 'catalog-operational-private' and public.app_is_admin()) with check (bucket_id = 'catalog-operational-private' and public.app_is_admin()); exception when duplicate_object then null; end $$;

create or replace function public.admin_set_player_season_photo(p_player_id text, p_season_year smallint, p_storage_key text, p_is_primary boolean)
returns void language plpgsql security definer set search_path = public, app_private as $$
begin
  if not public.app_is_admin() then raise exception 'Acceso de administrador requerido.' using errcode = '42501'; end if;
  if p_is_primary then update app_private.player_season_photos set is_primary = false where player_id = p_player_id; end if;
  insert into app_private.player_season_photos(player_id, season_year, storage_key, is_primary)
  values(p_player_id, p_season_year, p_storage_key, p_is_primary)
  on conflict(player_id, season_year) do update set storage_key = excluded.storage_key, is_primary = excluded.is_primary, updated_at = now();
end $$;
revoke all on function public.admin_set_player_season_photo(text, smallint, text, boolean) from public, anon;
grant execute on function public.admin_set_player_season_photo(text, smallint, text, boolean) to authenticated, service_role;

commit;
