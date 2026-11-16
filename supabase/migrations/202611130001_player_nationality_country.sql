-- País de nacionalidad privado, inicializado desde la primera selección registrada
-- o, si no existe, desde el primer club conocido del jugador.
begin;

alter table app_private.player_profiles
  add column if not exists nationality_country text
  check (nationality_country is null or length(trim(nationality_country)) between 1 and 120);

with selection_countries as (
  select
    participant.player_id,
    federation.country,
    row_number() over (
      partition by participant.player_id
      order by
        coalesce(substring(milestone.season_label from '(20[0-9]{2})')::integer, 9999),
        milestone.created_at,
        milestone.id
    ) as rank
  from public.catalog_milestones milestone
  join public.catalog_participants participant on participant.id = milestone.participant_id
  join public.catalog_federations federation on federation.id = case upper(trim(coalesce(milestone.scope, '')))
    when 'FER' then 'FN003'
    when 'SELECCIÓN FER' then 'FN003'
    when 'FFR' then 'FN004'
    when 'SELECCIÓN FFR' then 'FN004'
    when 'FRPA' then 'FT003'
    when 'SELECCIÓN FRPA' then 'FT003'
    when 'FCR' then 'FT009'
    when 'SELECCIÓN FCR' then 'FT009'
    when 'FVR' then 'FT010'
    when 'FRCV' then 'FT010'
    when 'SELECCIÓN FRCV' then 'FT010'
    when 'FMR' then 'FT015'
    when 'FRM' then 'FT015'
    when 'SELECCIÓN FMR' then 'FT015'
    else upper(trim(coalesce(milestone.scope, '')))
  end
  where participant.player_id is not null
), first_club_countries as (
  select
    season.player_id,
    club.country,
    row_number() over (
      partition by season.player_id
      order by season.season_year, season.club_id
    ) as rank
  from app_private.player_seasons season
  join public.catalog_clubs club on club.id = season.club_id
  where club.country is not null and trim(club.country) <> ''
), derived_nationalities as (
  select
    player.id as player_id,
    coalesce(selection.country, club.country) as nationality_country
  from public.catalog_players player
  left join selection_countries selection on selection.player_id = player.id and selection.rank = 1
  left join first_club_countries club on club.player_id = player.id and club.rank = 1
)
insert into app_private.player_profiles (player_id, nationality_country, updated_at)
select player_id, nationality_country, now()
from derived_nationalities
on conflict (player_id) do update
set nationality_country = excluded.nationality_country,
    updated_at = now()
where app_private.player_profiles.nationality_country is distinct from excluded.nationality_country;

commit;
