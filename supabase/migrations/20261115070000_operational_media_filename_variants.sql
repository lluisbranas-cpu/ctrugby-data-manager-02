begin;

alter table app_private.operational_media
  drop constraint if exists operational_media_variant_check;

alter table app_private.operational_media
  add constraint operational_media_variant_check
  check (variant ~ '^[a-z0-9][a-z0-9_.-]{0,199}$');

commit;
