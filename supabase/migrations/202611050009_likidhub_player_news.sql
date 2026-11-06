-- LikidHub: noticias históricas de jugador e índice de sus imágenes privadas.
-- No toca jugadores, clubes, participaciones, hitos, resúmenes ni objetos de Storage.
begin;

create table if not exists app_private.player_news (
  id uuid primary key,
  player_id text not null references public.catalog_players(id) on update cascade on delete restrict,
  kind text not null check (kind in ('news', 'selection', 'participation')),
  title text not null check (length(trim(title)) between 1 and 240),
  date_or_season text not null default '' check (length(date_or_season) <= 40),
  published boolean not null default false,
  source_url text not null default '' check (length(source_url) <= 2048),
  club_id text references public.catalog_clubs(id) on update cascade on delete restrict,
  club_name text not null default '' check (length(club_name) <= 160),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  source_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists player_news_player_published_date_idx on app_private.player_news(player_id, published, date_or_season desc);
create index if not exists player_news_kind_idx on app_private.player_news(kind);
create index if not exists player_news_club_idx on app_private.player_news(club_id) where club_id is not null;
create index if not exists player_news_source_sha256_idx on app_private.player_news(source_sha256);
alter table app_private.player_news enable row level security;
revoke all on app_private.player_news from public, anon, authenticated;

create or replace function public.likidhub_upsert_player_news(p_row jsonb)
returns void language plpgsql security definer set search_path = public, app_private as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service_role requerido' using errcode = '42501'; end if;
  if p_row->>'kind' not in ('news', 'selection', 'participation') then raise exception 'Tipo de noticia no válido' using errcode = '22023'; end if;
  insert into app_private.player_news(id,player_id,kind,title,date_or_season,published,source_url,club_id,club_name,payload,source_sha256,source_updated_at)
  values(
    (p_row->>'id')::uuid, p_row->>'player_id', p_row->>'kind', p_row->>'title', coalesce(p_row->>'date_or_season',''),
    coalesce((p_row->>'published')::boolean,false), coalesce(p_row->>'source_url',''), nullif(p_row->>'club_id',''),
    coalesce(p_row->>'club_name',''), coalesce(p_row->'payload','{}'::jsonb), p_row->>'source_sha256', (p_row->>'source_updated_at')::timestamptz
  )
  on conflict(id) do update set
    player_id=excluded.player_id, kind=excluded.kind, title=excluded.title, date_or_season=excluded.date_or_season,
    published=excluded.published, source_url=excluded.source_url, club_id=excluded.club_id, club_name=excluded.club_name,
    payload=excluded.payload, source_sha256=excluded.source_sha256, source_updated_at=excluded.source_updated_at, updated_at=now();
end $$;

create or replace function public.likidhub_upsert_player_news_media(p_row jsonb)
returns void language plpgsql security definer set search_path = public, app_private as $$
declare v_news_id uuid := (p_row->>'news_id')::uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role requerido' using errcode = '42501'; end if;
  if not exists(select 1 from app_private.player_news where id = v_news_id) then raise exception 'Noticia inexistente' using errcode = '23503'; end if;
  if p_row->>'bucket_id' <> 'catalog-operational-private' or p_row->>'object_key' <> 'player-news/' || v_news_id::text || '.webp' then
    raise exception 'Referencia de imagen no válida' using errcode = '22023';
  end if;
  insert into app_private.operational_media(entity_type,entity_id,variant,bucket_id,object_key,content_type,byte_size,source_sha256)
  values('player-news',v_news_id::text,'image','catalog-operational-private',p_row->>'object_key','image/webp',(p_row->>'byte_size')::bigint,p_row->>'source_sha256')
  on conflict(entity_type,entity_id,variant) do update set object_key=excluded.object_key,content_type=excluded.content_type,byte_size=excluded.byte_size,source_sha256=excluded.source_sha256,updated_at=now();
end $$;

create or replace function public.likidhub_preview_player_news(p_player_id text default null, p_club_id text default null, p_published_only boolean default true)
returns table(id uuid,player_id text,kind text,title text,date_or_season text,published boolean,source_url text,club_id text,club_name text,payload jsonb,source_updated_at timestamptz)
language sql stable security definer set search_path = app_private as $$
  select n.id,n.player_id,n.kind,n.title,n.date_or_season,n.published,n.source_url,n.club_id,n.club_name,n.payload,n.source_updated_at
  from app_private.player_news n
  where (p_player_id is null or n.player_id=p_player_id)
    and (p_club_id is null or n.club_id=p_club_id)
    and (not p_published_only or n.published)
  order by n.date_or_season desc, n.source_updated_at desc, n.id;
$$;

create or replace function public.likidhub_preview_player_news_media(p_news_id uuid)
returns table(bucket_id text,object_key text,content_type text,byte_size bigint,source_sha256 text)
language sql stable security definer set search_path = app_private as $$
  select bucket_id,object_key,content_type,byte_size,source_sha256
  from app_private.operational_media
  where entity_type='player-news' and entity_id=p_news_id::text and variant='image' and bucket_id='catalog-operational-private';
$$;

revoke all on function public.likidhub_upsert_player_news(jsonb), public.likidhub_upsert_player_news_media(jsonb), public.likidhub_preview_player_news(text,text,boolean), public.likidhub_preview_player_news_media(uuid) from public, anon, authenticated;
grant execute on function public.likidhub_upsert_player_news(jsonb), public.likidhub_upsert_player_news_media(jsonb), public.likidhub_preview_player_news(text,text,boolean), public.likidhub_preview_player_news_media(uuid) to service_role;

commit;
