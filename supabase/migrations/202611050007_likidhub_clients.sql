-- LikidHub: catálogo aislado de clientes para la preview local.
-- No toca jugadores, clubes, participaciones, medios ni Storage.
begin;

create table if not exists public.catalog_client_types (
  id uuid primary key,
  name text not null check (length(trim(name)) between 1 and 160),
  characteristics text not null default '' check (length(characteristics) <= 4000),
  track_participations boolean not null default false,
  version integer not null default 1 check (version > 0)
);
create unique index if not exists catalog_client_types_name on public.catalog_client_types (lower(trim(name)));

create table if not exists public.catalog_clients (
  id uuid primary key,
  name text not null check (length(trim(name)) between 1 and 160),
  type_id uuid not null references public.catalog_client_types(id) on update cascade on delete restrict,
  characteristics text not null default '' check (length(characteristics) <= 4000),
  participations integer check (participations >= 0),
  primary_color text not null default '#171717' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  secondary_color text not null default '#ffffff' check (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text not null default '#dc2626' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  surname_color text not null default '#171717' check (surname_color ~ '^#[0-9A-Fa-f]{6}$'),
  style text not null default '' check (length(style) <= 2000),
  typography text not null default '' check (length(typography) <= 160),
  logo text not null default '' check (length(logo) <= 700000 and (logo = '' or logo ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$')),
  version integer not null default 1 check (version > 0)
);
create unique index if not exists catalog_clients_name on public.catalog_clients (lower(trim(name)));
create index if not exists catalog_clients_type on public.catalog_clients(type_id);

create or replace function public.client_record_version() returns trigger language plpgsql set search_path = '' as $$
begin new.version := old.version + 1; return new; end;
$$;
drop trigger if exists client_types_version on public.catalog_client_types;
create trigger client_types_version before update on public.catalog_client_types for each row execute function public.client_record_version();
drop trigger if exists clients_version on public.catalog_clients;
create trigger clients_version before update on public.catalog_clients for each row execute function public.client_record_version();

alter table public.catalog_client_types enable row level security;
alter table public.catalog_clients enable row level security;
revoke all on public.catalog_client_types, public.catalog_clients from anon, authenticated;
grant select, insert, update, delete on public.catalog_client_types, public.catalog_clients to authenticated;
drop policy if exists client_types_admin on public.catalog_client_types;
create policy client_types_admin on public.catalog_client_types for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());
drop policy if exists clients_admin on public.catalog_clients;
create policy clients_admin on public.catalog_clients for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());

create or replace function public.likidhub_upsert_client_type(p_row jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service_role requerido' using errcode = '42501'; end if;
  insert into public.catalog_client_types(id,name,characteristics,track_participations,version)
  values((p_row->>'id')::uuid,p_row->>'name',coalesce(p_row->>'characteristics',''),coalesce((p_row->>'track_participations')::boolean,false),coalesce((p_row->>'version')::integer,1))
  on conflict(id) do update set name=excluded.name,characteristics=excluded.characteristics,track_participations=excluded.track_participations;
end $$;

create or replace function public.likidhub_upsert_client(p_row jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service_role requerido' using errcode = '42501'; end if;
  insert into public.catalog_clients(id,name,type_id,characteristics,participations,primary_color,secondary_color,accent_color,surname_color,style,typography,logo,version)
  values((p_row->>'id')::uuid,p_row->>'name',(p_row->>'type_id')::uuid,coalesce(p_row->>'characteristics',''),nullif(p_row->>'participations','')::integer,coalesce(p_row->>'primary_color','#171717'),coalesce(p_row->>'secondary_color','#ffffff'),coalesce(p_row->>'accent_color','#dc2626'),coalesce(p_row->>'surname_color','#171717'),coalesce(p_row->>'style',''),coalesce(p_row->>'typography',''),coalesce(p_row->>'logo',''),coalesce((p_row->>'version')::integer,1))
  on conflict(id) do update set name=excluded.name,type_id=excluded.type_id,characteristics=excluded.characteristics,participations=excluded.participations,primary_color=excluded.primary_color,secondary_color=excluded.secondary_color,accent_color=excluded.accent_color,surname_color=excluded.surname_color,style=excluded.style,typography=excluded.typography,logo=excluded.logo;
end $$;
revoke all on function public.likidhub_upsert_client_type(jsonb), public.likidhub_upsert_client(jsonb) from public, anon, authenticated;
grant execute on function public.likidhub_upsert_client_type(jsonb), public.likidhub_upsert_client(jsonb) to service_role;

commit;
