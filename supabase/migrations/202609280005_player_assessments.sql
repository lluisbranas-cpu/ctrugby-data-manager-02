create table if not exists app_private.player_assessments (id uuid primary key, player_id text not null references public.catalog_players(id) on delete cascade, season text not null, label text not null, evaluated_on date, club text not null default '', position text not null default '', metrics jsonb not null default '{}'::jsonb, notes text not null default '', revision integer not null default 1, updated_at timestamptz not null default now());
create index if not exists player_assessments_player_date on app_private.player_assessments (player_id,evaluated_on);
alter table app_private.player_assessments enable row level security;
revoke all on app_private.player_assessments from public, anon, authenticated;
grant select,insert,update,delete on app_private.player_assessments to authenticated;
create policy player_assessments_admin on app_private.player_assessments for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());
