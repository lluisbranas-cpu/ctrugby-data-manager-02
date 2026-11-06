-- LikidHub: puente de lectura mínima para la preview local.
-- No crea tablas, no inserta ni modifica filas u objetos de Storage.
begin;

create or replace function public.likidhub_preview_players()
returns table(
  id text,
  first_name text,
  last_name text,
  published boolean,
  category text,
  birth_year smallint,
  current_season_year smallint,
  current_club_id text,
  current_club_name text,
  position_text text
)
language sql stable security definer set search_path = public, app_private as $$
  select p.id, p.first_name, p.last_name, p.published, profile.category, profile.birth_year,
    current.season_year, current.club_id, club.name, current.position_text
  from public.catalog_players p
  left join app_private.player_profiles profile on profile.player_id = p.id
  left join lateral (
    select s.season_year, s.club_id, s.position_text
    from app_private.player_seasons s
    where s.player_id = p.id
    order by s.season_year desc
    limit 1
  ) current on true
  left join public.catalog_clubs club on club.id = current.club_id
  order by p.last_name nulls last, p.first_name, p.id;
$$;

create or replace function public.likidhub_preview_player(p_player_id text)
returns jsonb
language plpgsql stable security definer set search_path = public, app_private as $$
declare payload jsonb;
begin
  select jsonb_build_object(
    'id', p.id,
    'first_name', p.first_name,
    'last_name', p.last_name,
    'published', p.published,
    'profile', jsonb_build_object('category', profile.category, 'birth_year', profile.birth_year),
    'seasons', coalesce((
      select jsonb_agg(jsonb_build_object(
        'season_year', s.season_year, 'club_id', s.club_id, 'club_name', c.name,
        'legacy_club_name', s.legacy_club_name, 'registration_number', s.registration_number,
        'position_text', s.position_text, 'weight_kg', s.weight_kg, 'height_cm', s.height_cm
      ) order by s.season_year desc)
      from app_private.player_seasons s left join public.catalog_clubs c on c.id = s.club_id
      where s.player_id = p.id
    ), '[]'::jsonb)
  ) into payload
  from public.catalog_players p
  left join app_private.player_profiles profile on profile.player_id = p.id
  where p.id = p_player_id;
  return payload;
end;
$$;

create or replace function public.likidhub_preview_player_season_photo(p_player_id text, p_season_year smallint)
returns table(player_id text, season_year smallint, storage_key text, is_primary boolean)
language sql stable security definer set search_path = public, app_private as $$
  select photo.player_id, photo.season_year, photo.storage_key, photo.is_primary
  from app_private.player_season_photos photo
  where photo.player_id = p_player_id and photo.season_year = p_season_year;
$$;

create or replace function public.likidhub_preview_media(p_entity_type text, p_entity_id text, p_variant text)
returns table(bucket_id text, object_key text, content_type text, byte_size bigint, source_sha256 text)
language sql stable security definer set search_path = public, app_private as $$
  select media.bucket_id, media.object_key, media.content_type, media.byte_size, media.source_sha256
  from app_private.operational_media media
  where media.entity_type = p_entity_type
    and media.entity_id = p_entity_id
    and media.variant = p_variant
    and media.bucket_id = 'catalog-operational-private';
$$;

-- Las participaciones de campus aún no tienen tabla en LikidHub. La RPC permite
-- a la preview detectar explícitamente esa ausencia sin recurrir a JSON local.
create or replace function public.likidhub_preview_participations(p_player_id text default null)
returns jsonb
language plpgsql stable security definer set search_path = public, app_private as $$
declare rows jsonb;
begin
  if to_regclass('app_private.player_participations') is null then
    return jsonb_build_object('available', false, 'rows', '[]'::jsonb, 'reason', 'player_participations no está centralizada');
  end if;
  execute 'select coalesce(jsonb_agg(to_jsonb(item)), ''[]''::jsonb) from app_private.player_participations item where ($1 is null or item.player_id = $1)'
    into rows using p_player_id;
  return jsonb_build_object('available', true, 'rows', rows);
end;
$$;

revoke all on function public.likidhub_preview_players() from public, anon, authenticated;
revoke all on function public.likidhub_preview_player(text) from public, anon, authenticated;
revoke all on function public.likidhub_preview_player_season_photo(text, smallint) from public, anon, authenticated;
revoke all on function public.likidhub_preview_media(text, text, text) from public, anon, authenticated;
revoke all on function public.likidhub_preview_participations(text) from public, anon, authenticated;
grant execute on function public.likidhub_preview_players(), public.likidhub_preview_player(text), public.likidhub_preview_player_season_photo(text, smallint), public.likidhub_preview_media(text, text, text), public.likidhub_preview_participations(text) to service_role;

commit;
