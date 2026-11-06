-- LikidHub: validación de estructura sin exponer app_private por PostgREST.
-- No inserta, actualiza ni elimina datos.
create or replace function public.likidhub_critical_structure()
returns table(component text, present boolean, detail text)
language sql stable security definer set search_path = public, app_private, storage as $$
  select 'public.catalog_players', to_regclass('public.catalog_players') is not null, null
  union all select 'app_private.player_profiles', to_regclass('app_private.player_profiles') is not null, null
  union all select 'app_private.player_seasons', to_regclass('app_private.player_seasons') is not null, null
  union all select 'app_private.player_season_photos', to_regclass('app_private.player_season_photos') is not null, null
  union all select 'app_private.operational_media', to_regclass('app_private.operational_media') is not null, null
  union all select 'storage.catalog-operational-private', exists(select 1 from storage.buckets where id = 'catalog-operational-private' and public = false), 'private required'
$$;
revoke all on function public.likidhub_critical_structure() from public, anon, authenticated;
grant execute on function public.likidhub_critical_structure() to service_role;
