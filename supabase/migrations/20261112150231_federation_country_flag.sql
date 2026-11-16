alter table public.catalog_federations
  add column if not exists country_flag_url text
  check (country_flag_url is null or country_flag_url ~ '^https://');
