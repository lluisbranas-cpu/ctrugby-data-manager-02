begin;

create table public.catalog_callups (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  call_time time not null,
  venue text not null check (venue in ('local', 'visitante')),
  home text not null check (home ~ '^[A-Z]{3}[0-9]{4}$'),
  away text not null check (away ~ '^[A-Z]{3}[0-9]{4}$'),
  home_label text not null default '' check (length(home_label) <= 80),
  away_label text not null default '' check (length(away_label) <= 80),
  field text not null check (length(trim(field)) between 1 and 160),
  category text not null default '' check (length(category) <= 80),
  phase text not null default '' check (length(phase) <= 160),
  updated_at timestamptz not null default now()
);

create index catalog_callups_day on public.catalog_callups (day, call_time);
alter table public.catalog_callups enable row level security;
revoke all on public.catalog_callups from anon;
grant select, insert, update, delete on public.catalog_callups to authenticated;
create policy catalog_callups_admin on public.catalog_callups for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

create function public.catalog_callups_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger catalog_callups_updated_at before update on public.catalog_callups
  for each row execute function public.catalog_callups_updated_at();

commit;
