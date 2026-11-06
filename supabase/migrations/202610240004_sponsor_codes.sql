-- Código legible y estable para identificar patrocinadores en la administración.
alter table public.catalog_sponsors add column sponsor_code text;

with numbered_sponsors as (
  select id, row_number() over (order by name, id)::integer as sequence
  from public.catalog_sponsors
)
update public.catalog_sponsors sponsor
set sponsor_code = 'SPN' || lpad(numbered_sponsors.sequence::text, 3, '0')
from numbered_sponsors
where sponsor.id = numbered_sponsors.id;

alter table public.catalog_sponsors
  alter column sponsor_code set not null,
  add constraint catalog_sponsors_sponsor_code_unique unique (sponsor_code),
  add constraint catalog_sponsors_sponsor_code_format check (sponsor_code ~ '^SPN[0-9]{3,}$');

create or replace function public.assign_sponsor_code() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  next_sequence integer;
begin
  if new.sponsor_code is null or btrim(new.sponsor_code) = '' then
    perform pg_advisory_xact_lock(240004);
    select coalesce(max(substring(sponsor_code from 4)::integer), 0) + 1
      into next_sequence
      from public.catalog_sponsors;
    new.sponsor_code := 'SPN' || lpad(next_sequence::text, 3, '0');
  end if;
  return new;
end;
$$;

revoke all on function public.assign_sponsor_code() from public;
create trigger catalog_sponsors_assign_code
  before insert on public.catalog_sponsors
  for each row execute function public.assign_sponsor_code();
