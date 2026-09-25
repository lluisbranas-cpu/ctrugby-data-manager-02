-- Resumen privado de jugadores para la interfaz de administración.
begin;

create or replace function public.admin_player_catalog()
returns table (
  id text,
  first_name text,
  last_name text,
  published boolean,
  version integer,
  category text,
  birth_year smallint,
  season_count integer,
  linked_season_count integer
)
language sql stable security definer
set search_path = public, app_private
as $$
  select p.id, p.first_name, p.last_name, p.published, p.version,
    profile.category, profile.birth_year,
    count(season.player_id)::integer as season_count,
    count(season.club_id)::integer as linked_season_count
  from public.catalog_players p
  left join app_private.player_profiles profile on profile.player_id = p.id
  left join app_private.player_seasons season on season.player_id = p.id
  where public.app_is_admin()
  group by p.id, p.first_name, p.last_name, p.published, p.version, profile.category, profile.birth_year
  order by p.last_name nulls last, p.first_name;
$$;

revoke all on function public.admin_player_catalog() from public;
grant execute on function public.admin_player_catalog() to authenticated;

commit;
