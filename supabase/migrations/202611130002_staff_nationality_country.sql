begin;

create table if not exists app_private.staff_profiles (
  staff_id text primary key references public.catalog_staff(id) on delete cascade,
  nationality_country text check (nationality_country is null or length(trim(nationality_country)) between 1 and 120),
  updated_at timestamptz not null default now()
);
alter table app_private.staff_profiles add column if not exists nationality_country text;
alter table app_private.staff_profiles enable row level security;
revoke all on app_private.staff_profiles from public, anon, authenticated;
grant select, insert, update, delete on app_private.staff_profiles to authenticated;
drop policy if exists staff_profile_admin on app_private.staff_profiles;
create policy staff_profile_admin on app_private.staff_profiles for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

with staff_selection as (
  select participant.staff_id, federation.country,
    row_number() over (partition by participant.staff_id order by milestone.created_at, milestone.id) as rank
  from public.catalog_milestones milestone
  join public.catalog_participants participant on participant.id = milestone.participant_id
  join public.catalog_federations federation on federation.id = case upper(trim(coalesce(milestone.scope, '')))
    when 'FER' then 'FN003' when 'FCR' then 'FT009' when 'FRCV' then 'FT010'
    when 'FVR' then 'FT010' when 'FRM' then 'FT015' when 'FMR' then 'FT015'
    else upper(trim(coalesce(milestone.scope, ''))) end
  where participant.staff_id is not null
)
insert into app_private.staff_profiles (staff_id, nationality_country, updated_at)
select staff.id, selection.country, now()
from public.catalog_staff staff
join staff_selection selection on selection.staff_id = staff.id and selection.rank = 1
on conflict (staff_id) do update set nationality_country = excluded.nationality_country, updated_at = now()
where app_private.staff_profiles.nationality_country is distinct from excluded.nationality_country;

commit;
