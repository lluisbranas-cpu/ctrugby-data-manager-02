-- Consulta privada del historial de clubs de una ficha de jugador.
begin;

create or replace function public.admin_player_club_history(p_player_id text)
returns table (
  player_id text,
  club_id text,
  club_name text,
  city text,
  country text,
  participation_count integer
)
language sql stable security definer
set search_path = public, app_private
as $$
  select affiliation.player_id, club.id, club.name, club.city, club.country,
    coalesce(totals.participation_count, 0)::integer
  from app_private.player_club_affiliations affiliation
  join public.catalog_clubs club on club.id = affiliation.club_id
  left join app_private.club_participation_totals totals on totals.club_id = affiliation.club_id
  where affiliation.player_id = p_player_id and public.app_is_admin()
  order by club.name;
$$;

revoke all on function public.admin_player_club_history(text) from public;
grant execute on function public.admin_player_club_history(text) to authenticated;

commit;
