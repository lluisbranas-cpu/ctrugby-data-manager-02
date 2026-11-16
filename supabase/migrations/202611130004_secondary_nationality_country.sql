begin;

alter table app_private.player_profiles
  add column if not exists secondary_nationality_country text
  check (secondary_nationality_country is null or length(trim(secondary_nationality_country)) between 1 and 120);

alter table app_private.staff_profiles
  add column if not exists secondary_nationality_country text
  check (secondary_nationality_country is null or length(trim(secondary_nationality_country)) between 1 and 120);

commit;
