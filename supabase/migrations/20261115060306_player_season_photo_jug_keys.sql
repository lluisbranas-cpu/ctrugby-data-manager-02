-- Conserva las rutas históricas CTR y permite las rutas canónicas JUG.
alter table app_private.player_season_photos
  drop constraint if exists player_season_photos_storage_key_check;

alter table app_private.player_season_photos
  add constraint player_season_photos_storage_key_check
  check (storage_key ~ '^player-season-photos/(?:CTR|JUG)[0-9]{4}/[0-9]{4}(?:-[0-9a-f]{64})?[.]png$');
