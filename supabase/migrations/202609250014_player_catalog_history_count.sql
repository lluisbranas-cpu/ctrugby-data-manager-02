-- Añade al resumen administrativo el número de clubs verificados por jugador.
begin;

create function public.admin_player_catalog_with_history()
returns table (
  id text,
  first_name text,
  last_name text,
  published boolean,
  version integer,
  category text,
  birth_year smallint,
  season_count integer,
  linked_season_count integer,
  club_history_count integer
)
language sql stable security definer
set search_path = public, app_private
as $$
  select p.id, p.first_name, p.last_name, p.published, p.version,
    profile.category, profile.birth_year,
    seasons.season_count, seasons.linked_season_count, history.club_history_count
  from public.catalog_players p
  left join app_private.player_profiles profile on profile.player_id = p.id
  left join lateral (
    select count(*)::integer as season_count, count(club_id)::integer as linked_season_count
    from app_private.player_seasons
    where player_id = p.id
  ) seasons on true
  left join lateral (
    select count(*)::integer as club_history_count
    from app_private.player_club_affiliations
    where player_id = p.id
  ) history on true
  where public.app_is_admin()
  order by p.last_name nulls last, p.first_name;
$$;

revoke all on function public.admin_player_catalog_with_history() from public;
grant execute on function public.admin_player_catalog_with_history() to authenticated;

commit;
