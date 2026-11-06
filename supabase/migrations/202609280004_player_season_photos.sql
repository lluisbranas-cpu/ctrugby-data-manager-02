-- Fotos de trayectoria independientes de la foto de ficha.
begin;

create table if not exists app_private.player_season_photos (
  player_id text not null references public.catalog_players(id) on delete cascade,
  season_year smallint not null check (season_year between 2000 and 2035),
  storage_key text not null unique check (storage_key ~ '^player-season-photos/CTR[0-9]{4}/[0-9]{4}[.]png$'),
  is_primary boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (player_id, season_year)
);
create unique index if not exists player_season_photos_one_primary
  on app_private.player_season_photos (player_id) where is_primary;
alter table app_private.player_season_photos enable row level security;
revoke all on app_private.player_season_photos from public, anon, authenticated;
grant select, insert, update, delete on app_private.player_season_photos to authenticated;
create policy player_season_photos_admin on app_private.player_season_photos for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

create or replace function public.admin_set_player_season_photo(p_player_id text, p_season_year smallint, p_storage_key text, p_is_primary boolean)
returns void language plpgsql security definer set search_path = public, app_private as $$
begin
  if not public.app_is_admin() then raise exception 'Acceso de administrador requerido.' using errcode = '42501'; end if;
  if p_is_primary then update app_private.player_season_photos set is_primary = false where player_id = p_player_id; end if;
  insert into app_private.player_season_photos (player_id, season_year, storage_key, is_primary)
  values (p_player_id, p_season_year, p_storage_key, p_is_primary)
  on conflict (player_id, season_year) do update set storage_key = excluded.storage_key, is_primary = excluded.is_primary, updated_at = now();
end;
$$;
revoke all on function public.admin_set_player_season_photo(text, smallint, text, boolean) from public;
grant execute on function public.admin_set_player_season_photo(text, smallint, text, boolean) to authenticated;
commit;
