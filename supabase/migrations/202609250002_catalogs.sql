-- Catálogos reales de CTRugby. Ejecutar tras revisar esta migración y antes de
-- importar datos. No carga clubs, federaciones, escudos ni información privada.
begin;

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create table app_private.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table app_private.admins enable row level security;
revoke all on app_private.admins from public, anon, authenticated;

create function public.app_is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from app_private.admins where user_id = auth.uid()) $$;
revoke all on function public.app_is_admin() from public;
grant execute on function public.app_is_admin() to anon, authenticated;

create table public.catalog_clubs (
  id text primary key check (id ~ '^[A-Z]{3}[0-9]{4}$'),
  name text not null check (length(trim(name)) between 1 and 160),
  active boolean not null default true,
  founded_text text,
  disappeared_text text,
  city text not null check (length(trim(city)) between 1 and 120),
  province text not null check (length(trim(province)) between 1 and 120),
  region text not null check (length(trim(region)) between 1 and 120),
  country text not null check (length(trim(country)) between 1 and 120),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  maps_url text not null check (maps_url ~ '^https://'),
  website text check (website is null or website ~ '^https://'),
  instagram text check (instagram is null or instagram ~ '^@[^[:space:]]+$'),
  published boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table app_private.club_notes (
  club_id text primary key references public.catalog_clubs(id) on delete cascade,
  note text not null check (length(note) <= 5000),
  updated_at timestamptz not null default now()
);

create table public.catalog_federations (
  id text primary key check (id ~ '^F[A-Z][0-9]{3}$'),
  name text not null check (length(trim(name)) between 1 and 160),
  scope text not null check (length(trim(scope)) between 1 and 80),
  territory text not null check (length(trim(territory)) between 1 and 120),
  country text not null check (length(trim(country)) between 1 and 120),
  active boolean not null default true,
  website text check (website is null or website ~ '^https://'),
  published boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table app_private.federation_notes (
  federation_id text primary key references public.catalog_federations(id) on delete cascade,
  email text check (email is null or length(email) <= 320),
  legacy_club_count integer check (legacy_club_count is null or legacy_club_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.catalog_clubs enable row level security;
alter table public.catalog_federations enable row level security;
alter table app_private.club_notes enable row level security;
alter table app_private.federation_notes enable row level security;

revoke all on public.catalog_clubs, public.catalog_federations from anon, authenticated;
revoke all on app_private.club_notes, app_private.federation_notes from public, anon, authenticated;
grant select on public.catalog_clubs, public.catalog_federations to anon, authenticated;
grant insert, update, delete on public.catalog_clubs, public.catalog_federations to authenticated;
grant select, insert, update, delete on app_private.club_notes, app_private.federation_notes to authenticated;

create policy catalog_club_public_read on public.catalog_clubs for select to anon, authenticated
  using (published);
create policy catalog_club_admin_read on public.catalog_clubs for select to authenticated
  using (public.app_is_admin());
create policy catalog_club_admin_write on public.catalog_clubs for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

create policy catalog_federation_public_read on public.catalog_federations for select to anon, authenticated
  using (published);
create policy catalog_federation_admin_read on public.catalog_federations for select to authenticated
  using (public.app_is_admin());
create policy catalog_federation_admin_write on public.catalog_federations for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

create policy catalog_club_note_admin on app_private.club_notes for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());
create policy catalog_federation_note_admin on app_private.federation_notes for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

commit;
