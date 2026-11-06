begin;
create table public.catalog_client_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  characteristics text not null default '' check (length(characteristics) <= 4000),
  track_participations boolean not null default false,
  version integer not null default 1
);
create unique index catalog_client_types_name on public.catalog_client_types (lower(trim(name)));
create table public.catalog_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  type_id uuid not null references public.catalog_client_types(id) on delete restrict,
  characteristics text not null default '' check (length(characteristics) <= 4000),
  participations integer check (participations >= 0),
  primary_color text not null default '#171717' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text not null default '#ffffff' check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text not null default '#dc2626' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  style text not null default '' check (length(style) <= 2000),
  typography text not null default '' check (length(typography) <= 160),
  logo text not null default '' check (length(logo) <= 700000 and (logo = '' or logo ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$')),
  version integer not null default 1
);
create unique index catalog_clients_name on public.catalog_clients (lower(trim(name)));
create index catalog_clients_type on public.catalog_clients(type_id);
create function public.client_record_version() returns trigger language plpgsql set search_path = '' as $$
begin new.version := old.version + 1; return new; end;
$$;
create trigger client_types_version before update on public.catalog_client_types for each row execute function public.client_record_version();
create trigger clients_version before update on public.catalog_clients for each row execute function public.client_record_version();
alter table public.catalog_client_types enable row level security;
alter table public.catalog_clients enable row level security;
revoke all on public.catalog_client_types, public.catalog_clients from anon, authenticated;
grant select, insert, update, delete on public.catalog_client_types, public.catalog_clients to authenticated;
create policy client_types_admin on public.catalog_client_types for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());
create policy clients_admin on public.catalog_clients for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());
insert into public.catalog_client_types (name, characteristics, track_participations) values ('Campus', 'Registrar el número de participaciones del cliente.', true);
commit;
