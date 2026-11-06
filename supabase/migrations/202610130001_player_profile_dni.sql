alter table app_private.player_profiles
  add column if not exists dni text
  check (dni is null or length(dni) <= 32);
