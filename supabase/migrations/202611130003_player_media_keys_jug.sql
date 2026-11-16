-- Existing private media remains readable at its historical key while new
-- player uploads are stored under the canonical JUG identifier.
alter table app_private.player_profile_photos
  drop constraint if exists player_profile_photos_storage_key_check;
alter table app_private.player_profile_photos
  add constraint player_profile_photos_storage_key_check
  check (storage_key ~ '^player-portraits/(?:CTR|JUG)[0-9]{4}[.]png$');
