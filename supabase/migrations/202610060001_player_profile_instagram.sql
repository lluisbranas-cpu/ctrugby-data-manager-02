-- Añade la cuenta de Instagram al perfil privado de cada jugador.
begin;

alter table app_private.player_profiles
  add column if not exists instagram text
  check (instagram is null or instagram ~ '^@[^[:space:]@]+$');

commit;
