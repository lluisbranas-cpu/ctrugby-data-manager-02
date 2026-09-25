-- Participantes históricos, hitos y métricas privadas de participación.
begin;

create table public.catalog_staff (
  id text primary key check (id ~ '^STF[0-9]{4}$'),
  first_name text not null check (length(trim(first_name)) between 1 and 100),
  last_name text check (last_name is null or length(trim(last_name)) between 1 and 160),
  published boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.catalog_participants (
  id text primary key check (id ~ '^(?:PLR_CTR[0-9]{4}|STF_STF[0-9]{4}|EXT_[A-F0-9]{16})$'),
  kind text not null check (kind in ('player', 'staff')),
  display_name text not null check (length(trim(display_name)) between 1 and 260),
  player_id text references public.catalog_players(id) on delete set null,
  staff_id text references public.catalog_staff(id) on delete set null,
  source_key text not null unique,
  published boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'player' and staff_id is null) or (kind = 'staff' and player_id is null))
);

create table public.catalog_milestones (
  id text primary key check (id ~ '^MIL[0-9]{6}$'),
  participant_id text not null references public.catalog_participants(id) on delete restrict,
  scope text,
  category text,
  season_label text,
  club_text text,
  position_text text,
  published boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table app_private.milestone_sources (
  milestone_id text primary key references public.catalog_milestones(id) on delete cascade,
  source_type text not null check (source_type in ('player', 'staff')),
  source_ctr_id text,
  source_name text not null,
  updated_at timestamptz not null default now()
);

create table app_private.player_participation_metrics (
  player_id text primary key references public.catalog_players(id) on delete cascade,
  participation_count integer not null check (participation_count >= 0),
  participation_years jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(participation_years) = 'array')
);

alter table public.catalog_staff enable row level security;
alter table public.catalog_participants enable row level security;
alter table public.catalog_milestones enable row level security;
alter table app_private.milestone_sources enable row level security;
alter table app_private.player_participation_metrics enable row level security;

revoke all on public.catalog_staff, public.catalog_participants, public.catalog_milestones from anon, authenticated;
revoke all on app_private.milestone_sources, app_private.player_participation_metrics from public, anon, authenticated;
grant select on public.catalog_staff, public.catalog_participants, public.catalog_milestones to anon, authenticated;
grant insert, update, delete on public.catalog_staff, public.catalog_participants, public.catalog_milestones to authenticated;
grant select, insert, update, delete on app_private.milestone_sources, app_private.player_participation_metrics to authenticated;

create policy catalog_staff_public_read on public.catalog_staff for select to anon, authenticated using (published);
create policy catalog_staff_admin_read on public.catalog_staff for select to authenticated using (public.app_is_admin());
create policy catalog_staff_admin_write on public.catalog_staff for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());
create policy participant_public_read on public.catalog_participants for select to anon, authenticated using (published);
create policy participant_admin_read on public.catalog_participants for select to authenticated using (public.app_is_admin());
create policy participant_admin_write on public.catalog_participants for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());
create policy milestone_public_read on public.catalog_milestones for select to anon, authenticated using (published);
create policy milestone_admin_read on public.catalog_milestones for select to authenticated using (public.app_is_admin());
create policy milestone_admin_write on public.catalog_milestones for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());
create policy milestone_source_admin on app_private.milestone_sources for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());
create policy player_participation_metric_admin on app_private.player_participation_metrics for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());

commit;
