alter table public.catalog_federations
  add column if not exists original_name text,
  add column if not exists spanish_name text;

alter table public.catalog_federations
  add constraint catalog_federations_original_name_check
  check (original_name is null or length(trim(original_name)) between 1 and 160),
  add constraint catalog_federations_spanish_name_check
  check (spanish_name is null or length(trim(spanish_name)) between 1 and 160);
