-- Afiliación a World Rugby contrastada con la membresía oficial.
begin;

alter table public.catalog_federations
  add column if not exists world_rugby_affiliation text not null default 'no_aplica'
    check (world_rugby_affiliation in ('miembro', 'no_aplica', 'pendiente'));

update public.catalog_federations
set world_rugby_affiliation = case
  when id ~ '^FN[0-9]{3}$' then 'miembro'
  else 'no_aplica'
end;

commit;
