alter table public.catalog_federations
  drop column if exists original_name,
  drop column if exists spanish_name;
