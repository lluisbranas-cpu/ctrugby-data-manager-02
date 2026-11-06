-- Perfiles profesionales de staff y preparación para importaciones LinkedIn.
begin;

create table if not exists app_private.staff_profiles (
  staff_id text primary key references public.catalog_staff(id) on delete cascade,
  display_name text,
  headline text,
  location text,
  primary_role text,
  summary text,
  specialties jsonb not null default '[]'::jsonb,
  linkedin_url text,
  profile_status text not null default 'draft' check (profile_status in ('draft', 'review', 'published', 'linked')),
  source_id text,
  source_captured_at date,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(specialties) = 'array')
);

create table if not exists app_private.staff_profile_roles (
  id bigserial primary key,
  staff_id text not null references public.catalog_staff(id) on delete cascade,
  organization text not null,
  title text,
  location text,
  start_label text,
  end_label text,
  source_url text,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists app_private.staff_profile_credentials (
  id bigserial primary key,
  staff_id text not null references public.catalog_staff(id) on delete cascade,
  title text not null,
  issuer text,
  date_label text,
  source_url text,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists app_private.staff_profile_links (
  id bigserial primary key,
  staff_id text not null references public.catalog_staff(id) on delete cascade,
  kind text not null check (kind in ('linkedin', 'website', 'source', 'other')),
  label text,
  url text not null,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (staff_id, url)
);

create table if not exists app_private.staff_linkedin_imports (
  source_id text primary key,
  staff_id text references public.catalog_staff(id) on delete set null,
  display_name text not null,
  first_name text,
  last_name text,
  headline text,
  location text,
  profile_status text not null default 'candidate' check (profile_status in ('candidate', 'linked', 'ignored')),
  primary_role text,
  summary text,
  specialties jsonb not null default '[]'::jsonb,
  linkedin_url text,
  raw_profile jsonb not null default '{}'::jsonb,
  captured_at date,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(specialties) = 'array'),
  check (jsonb_typeof(raw_profile) = 'object')
);

alter table app_private.staff_profiles enable row level security;
alter table app_private.staff_profile_roles enable row level security;
alter table app_private.staff_profile_credentials enable row level security;
alter table app_private.staff_profile_links enable row level security;
alter table app_private.staff_linkedin_imports enable row level security;

revoke all on app_private.staff_profiles, app_private.staff_profile_roles, app_private.staff_profile_credentials, app_private.staff_profile_links, app_private.staff_linkedin_imports from public, anon, authenticated;
grant select, insert, update, delete on app_private.staff_profiles, app_private.staff_profile_roles, app_private.staff_profile_credentials, app_private.staff_profile_links, app_private.staff_linkedin_imports to authenticated;

create policy staff_profile_admin on app_private.staff_profiles for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());
create policy staff_profile_role_admin on app_private.staff_profile_roles for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());
create policy staff_profile_credential_admin on app_private.staff_profile_credentials for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());
create policy staff_profile_link_admin on app_private.staff_profile_links for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());
create policy staff_linkedin_import_admin on app_private.staff_linkedin_imports for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());

create or replace function public.admin_import_staff_linkedin_profiles(p_profiles jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, app_private
as $$
declare profile_count integer; linked_count integer;
begin
  if not public.app_is_admin() then raise exception 'Acceso de administrador requerido.' using errcode = '42501'; end if;
  if jsonb_typeof(p_profiles) <> 'array' then raise exception 'Los perfiles deben llegar como array JSON.' using errcode = '22023'; end if;

  insert into app_private.staff_linkedin_imports (source_id, staff_id, display_name, first_name, last_name, headline, location, profile_status, primary_role, summary, specialties, linkedin_url, raw_profile, captured_at, updated_at)
  select
    x.source_id, x.staff_id, x.display_name, x.first_name, x.last_name, x.headline, x.location,
    coalesce(x.profile_status, 'candidate'), x.primary_role, x.summary, coalesce(x.specialties, '[]'::jsonb),
    x.linkedin_url, x.raw_profile, x.captured_at, now()
  from jsonb_to_recordset(p_profiles) as x(
    source_id text, staff_id text, display_name text, first_name text, last_name text, headline text,
    location text, profile_status text, primary_role text, summary text, specialties jsonb,
    linkedin_url text, raw_profile jsonb, captured_at date
  )
  on conflict (source_id) do update set
    staff_id = excluded.staff_id,
    display_name = excluded.display_name,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    headline = excluded.headline,
    location = excluded.location,
    profile_status = excluded.profile_status,
    primary_role = excluded.primary_role,
    summary = excluded.summary,
    specialties = excluded.specialties,
    linkedin_url = excluded.linkedin_url,
    raw_profile = excluded.raw_profile,
    captured_at = excluded.captured_at,
    updated_at = now();
  get diagnostics profile_count = row_count;

  insert into app_private.staff_profiles (staff_id, display_name, headline, location, primary_role, summary, specialties, linkedin_url, profile_status, source_id, source_captured_at, updated_at)
  select staff_id, display_name, headline, location, primary_role, summary, specialties, linkedin_url, 'linked', source_id, captured_at, now()
  from app_private.staff_linkedin_imports
  where staff_id is not null and profile_status = 'linked'
  on conflict (staff_id) do update set
    display_name = excluded.display_name,
    headline = excluded.headline,
    location = excluded.location,
    primary_role = excluded.primary_role,
    summary = excluded.summary,
    specialties = excluded.specialties,
    linkedin_url = excluded.linkedin_url,
    profile_status = excluded.profile_status,
    source_id = excluded.source_id,
    source_captured_at = excluded.source_captured_at,
    updated_at = now();
  get diagnostics linked_count = row_count;

  return jsonb_build_object('imports', profile_count, 'linked_profiles', linked_count);
end;
$$;

revoke all on function public.admin_import_staff_linkedin_profiles(jsonb) from public;
grant execute on function public.admin_import_staff_linkedin_profiles(jsonb) to authenticated;

commit;
