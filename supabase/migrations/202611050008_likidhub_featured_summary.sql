-- LikidHub: resumen privado y autocontenido de jugadores destacados.
-- No toca jugadores, clubes, participaciones, medios ni Storage.
begin;

create table if not exists app_private.player_featured_summary (
  player_id text primary key references public.catalog_players(id) on update cascade on delete cascade,
  featured_rank smallint not null unique check (featured_rank between 1 and 9999),
  milestone_count integer not null default 0 check (milestone_count >= 0),
  selected_federation_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(selected_federation_ids) = 'array'),
  selected_federation_counts jsonb not null default '{}'::jsonb check (jsonb_typeof(selected_federation_counts) = 'object'),
  professional_club_records jsonb not null default '[]'::jsonb check (jsonb_typeof(professional_club_records) = 'array'),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  source_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table app_private.player_featured_summary enable row level security;
revoke all on app_private.player_featured_summary from public, anon, authenticated;

create or replace function public.likidhub_upsert_player_featured_summary(p_row jsonb)
returns void language plpgsql security definer set search_path = public, app_private as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service_role requerido' using errcode = '42501'; end if;
  insert into app_private.player_featured_summary(player_id,featured_rank,milestone_count,selected_federation_ids,selected_federation_counts,professional_club_records,source_sha256,source_updated_at)
  values(
    p_row->>'player_id', (p_row->>'featured_rank')::smallint, coalesce((p_row->>'milestone_count')::integer,0),
    coalesce(p_row->'selected_federation_ids','[]'::jsonb), coalesce(p_row->'selected_federation_counts','{}'::jsonb),
    coalesce(p_row->'professional_club_records','[]'::jsonb), p_row->>'source_sha256', (p_row->>'source_updated_at')::timestamptz
  )
  on conflict(player_id) do update set
    featured_rank=excluded.featured_rank, milestone_count=excluded.milestone_count,
    selected_federation_ids=excluded.selected_federation_ids, selected_federation_counts=excluded.selected_federation_counts,
    professional_club_records=excluded.professional_club_records, source_sha256=excluded.source_sha256,
    source_updated_at=excluded.source_updated_at, updated_at=now();
end $$;

create or replace function public.likidhub_preview_featured_summary()
returns table(player_id text, featured_rank smallint, milestone_count integer, selected_federation_ids jsonb, selected_federation_counts jsonb, professional_club_records jsonb, source_sha256 text, source_updated_at timestamptz)
language sql stable security definer set search_path = app_private as $$
  select player_id,featured_rank,milestone_count,selected_federation_ids,selected_federation_counts,professional_club_records,source_sha256,source_updated_at
  from app_private.player_featured_summary
  order by featured_rank, player_id;
$$;
revoke all on function public.likidhub_upsert_player_featured_summary(jsonb), public.likidhub_preview_featured_summary() from public, anon, authenticated;
grant execute on function public.likidhub_upsert_player_featured_summary(jsonb), public.likidhub_preview_featured_summary() to service_role;

commit;
