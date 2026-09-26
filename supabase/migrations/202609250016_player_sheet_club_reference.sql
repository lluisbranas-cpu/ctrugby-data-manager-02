-- Añade la referencia de IDs oficiales de clubs a la descarga de jugadores.
begin;

create or replace function public.admin_player_sheet_data()
returns jsonb
language plpgsql security definer
set search_path = public, app_private
as $$
begin
  if not public.app_is_admin() then
    raise exception 'Acceso de administrador requerido.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'players', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', player.id, 'first_name', player.first_name, 'last_name', player.last_name,
        'category', profile.category, 'birth_year', profile.birth_year, 'version', player.version
      ) order by player.last_name nulls first, player.first_name, player.id), '[]'::jsonb)
      from public.catalog_players player
      left join app_private.player_profiles profile on profile.player_id = player.id
    ),
    'seasons', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'player_id', season.player_id, 'season_year', season.season_year, 'club_id', season.club_id,
        'legacy_club_name', season.legacy_club_name, 'position_text', season.position_text,
        'weight_kg', season.weight_kg, 'height_cm', season.height_cm
      ) order by season.player_id, season.season_year), '[]'::jsonb)
      from app_private.player_seasons season
    ),
    'clubs', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', club.id, 'name', club.name, 'country', club.country
      ) order by club.name, club.id), '[]'::jsonb)
      from public.catalog_clubs club
    )
  );
end;
$$;

commit;
