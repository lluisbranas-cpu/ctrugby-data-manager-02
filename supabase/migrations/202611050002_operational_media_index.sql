-- Índice de los objetos importados al almacén operativo de LikidHub.
-- No mueve ningún objeto ni modifica datos existentes.

create table if not exists app_private.operational_media (
  entity_type text not null check (entity_type ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  entity_id text not null check (entity_id ~ '^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,199}$'),
  variant text not null check (variant ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  bucket_id text not null references storage.buckets(id),
  object_key text not null,
  content_type text,
  byte_size bigint check (byte_size >= 0),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (entity_type, entity_id, variant),
  unique (bucket_id, object_key)
);

alter table app_private.operational_media enable row level security;

do $$ begin
  create policy operational_media_admin on app_private.operational_media for all to authenticated
    using (public.app_is_admin()) with check (public.app_is_admin());
exception when duplicate_object then null; end $$;

create index if not exists operational_media_bucket_object_idx
  on app_private.operational_media (bucket_id, object_key);
