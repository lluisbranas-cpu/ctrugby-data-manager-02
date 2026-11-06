-- Preparación de la transición desde data/staging y data/competition.
-- No migra datos: la carga se hará únicamente con los scripts de importación revisados.

create table if not exists app_private.operational_documents (
  namespace text not null check (namespace ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  document_key text not null check (document_key ~ '^[a-z0-9][a-z0-9_./-]{0,199}$'),
  payload jsonb not null,
  source_sha256 text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (namespace, document_key)
);

create table if not exists app_private.operational_import_runs (
  id uuid primary key default gen_random_uuid(),
  importer text not null,
  source_sha256 text not null,
  mode text not null check (mode in ('dry-run', 'apply')),
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (importer, source_sha256, mode)
);

alter table app_private.operational_documents enable row level security;
alter table app_private.operational_import_runs enable row level security;

do $$ begin
  create policy operational_documents_admin on app_private.operational_documents for all to authenticated
    using (public.app_is_admin()) with check (public.app_is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy operational_import_runs_admin on app_private.operational_import_runs for select to authenticated
    using (public.app_is_admin());
exception when duplicate_object then null; end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog-operational-private', 'catalog-operational-private', false, 20971520,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/pdf'])
on conflict (id) do update set public = false;

do $$ begin
  create policy catalog_operational_media_admin on storage.objects for all to authenticated
    using (bucket_id = 'catalog-operational-private' and public.app_is_admin())
    with check (bucket_id = 'catalog-operational-private' and public.app_is_admin());
exception when duplicate_object then null; end $$;
