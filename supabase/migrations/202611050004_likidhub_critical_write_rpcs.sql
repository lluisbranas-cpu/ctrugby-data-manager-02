-- LikidHub: RPCs controladas para el lote crítico. No carga datos.
create or replace function public.likidhub_upsert_player(p_player jsonb, p_profile jsonb)
returns void language plpgsql security definer set search_path = public, app_private as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service_role requerido' using errcode='42501'; end if;
  insert into public.catalog_players(id,first_name,last_name,published) values (p_player->>'id',p_player->>'first_name',nullif(p_player->>'last_name',''),false)
  on conflict(id) do update set first_name=excluded.first_name,last_name=excluded.last_name,updated_at=now();
  insert into app_private.player_profiles(player_id,category,birth_year) values (p_player->>'id',nullif(p_profile->>'category',''),nullif(p_profile->>'birth_year','')::smallint)
  on conflict(player_id) do update set category=excluded.category,birth_year=excluded.birth_year,updated_at=now();
end $$;

create or replace function public.likidhub_upsert_player_season(p_row jsonb)
returns void language plpgsql security definer set search_path = public, app_private as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service_role requerido' using errcode='42501'; end if;
  insert into app_private.player_seasons(player_id,season_year,club_id,legacy_club_name,registration_number,position_text,weight_kg,height_cm)
  values(p_row->>'player_id',(p_row->>'season_year')::smallint,nullif(p_row->>'club_id',''),nullif(p_row->>'legacy_club_name',''),nullif(p_row->>'registration_number',''),nullif(p_row->>'position_text',''),nullif(p_row->>'weight_kg','')::numeric,nullif(p_row->>'height_cm','')::numeric)
  on conflict(player_id,season_year) do update set club_id=excluded.club_id,legacy_club_name=excluded.legacy_club_name,registration_number=excluded.registration_number,position_text=excluded.position_text,weight_kg=excluded.weight_kg,height_cm=excluded.height_cm,updated_at=now();
end $$;

create or replace function public.likidhub_upsert_season_photo(p_row jsonb)
returns void language plpgsql security definer set search_path = public, app_private as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service_role requerido' using errcode='42501'; end if;
  insert into app_private.player_season_photos(player_id,season_year,storage_key,is_primary) values(p_row->>'player_id',(p_row->>'season_year')::smallint,p_row->>'storage_key',coalesce((p_row->>'is_primary')::boolean,false))
  on conflict(player_id,season_year) do update set storage_key=excluded.storage_key,is_primary=excluded.is_primary,updated_at=now();
end $$;

create or replace function public.likidhub_upsert_operational_media(p_row jsonb)
returns void language plpgsql security definer set search_path = public, app_private as $$
begin
  if auth.role() <> 'service_role' then raise exception 'service_role requerido' using errcode='42501'; end if;
  insert into app_private.operational_media(entity_type,entity_id,variant,bucket_id,object_key,content_type,byte_size,source_sha256)
  values(p_row->>'entity_type',p_row->>'entity_id',p_row->>'variant',p_row->>'bucket_id',p_row->>'object_key',nullif(p_row->>'content_type',''),(p_row->>'byte_size')::bigint,p_row->>'source_sha256')
  on conflict(entity_type,entity_id,variant) do update set object_key=excluded.object_key,content_type=excluded.content_type,byte_size=excluded.byte_size,source_sha256=excluded.source_sha256,updated_at=now();
end $$;
revoke all on function public.likidhub_upsert_player(jsonb,jsonb), public.likidhub_upsert_player_season(jsonb), public.likidhub_upsert_season_photo(jsonb), public.likidhub_upsert_operational_media(jsonb) from public,anon,authenticated;
grant execute on function public.likidhub_upsert_player(jsonb,jsonb), public.likidhub_upsert_player_season(jsonb), public.likidhub_upsert_season_photo(jsonb), public.likidhub_upsert_operational_media(jsonb) to service_role;

commit;
