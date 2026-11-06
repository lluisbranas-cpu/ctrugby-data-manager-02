-- Los logotipos administrados localmente se guardan como WebP compacto.
alter table public.catalog_sponsors drop constraint if exists catalog_sponsors_logo_url_check;
alter table public.catalog_sponsors add constraint catalog_sponsors_logo_url_check
  check (logo_url is null or logo_url ~ '^https://' or logo_url ~ '^data:image/(png|jpeg|webp);base64,');
