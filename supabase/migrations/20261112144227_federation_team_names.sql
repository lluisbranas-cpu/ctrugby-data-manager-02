alter table public.catalog_federations
  add column if not exists masculine_nickname text,
  add column if not exists feminine_nickname text,
  add column if not exists regional_association_ids text[] not null default '{}',
  add column if not exists regional_membership_status text;

alter table public.catalog_federations
  add constraint catalog_federations_masculine_nickname_check
  check (masculine_nickname is null or length(trim(masculine_nickname)) between 1 and 120),
  add constraint catalog_federations_feminine_nickname_check
  check (feminine_nickname is null or length(trim(feminine_nickname)) between 1 and 120),
  add constraint catalog_federations_regional_membership_status_check
  check (regional_membership_status is null or regional_membership_status in ('Pleno derecho', 'Asociado'));
