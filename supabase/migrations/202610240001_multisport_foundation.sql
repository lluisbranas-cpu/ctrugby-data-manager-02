begin;

-- Deportes disponibles para la plataforma. Los identificadores son estables y
-- se usan en relaciones, filtros y configuraciones de cada cliente.
create table public.catalog_sports (
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  name text not null unique,
  active boolean not null default true,
  sort_order smallint not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.catalog_sports (id, name, sort_order)
values ('rugby', 'Rugby', 1)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- Un club o federación puede operar en más de un deporte.
create table public.catalog_club_sports (
  club_id text not null references public.catalog_clubs(id) on delete cascade,
  sport_id text not null references public.catalog_sports(id) on delete restrict,
  primary key (club_id, sport_id)
);

create table public.catalog_federation_sports (
  federation_id text not null references public.catalog_federations(id) on delete cascade,
  sport_id text not null references public.catalog_sports(id) on delete restrict,
  primary key (federation_id, sport_id)
);

-- Una persona mantiene una ficha única. Su actividad deportiva sí pertenece a
-- una disciplina: permite registrar varias trayectorias en la misma temporada.
alter table app_private.player_seasons
  add column if not exists sport_id text references public.catalog_sports(id) on delete restrict;

update app_private.player_seasons set sport_id = 'rugby' where sport_id is null;
alter table app_private.player_seasons alter column sport_id set not null;

alter table app_private.player_seasons drop constraint if exists player_seasons_pkey;
alter table app_private.player_seasons add primary key (player_id, season_year, sport_id);

insert into public.catalog_club_sports (club_id, sport_id)
select id, 'rugby' from public.catalog_clubs
on conflict do nothing;

insert into public.catalog_federation_sports (federation_id, sport_id)
select id, 'rugby' from public.catalog_federations
on conflict do nothing;

alter table public.catalog_sports enable row level security;
alter table public.catalog_club_sports enable row level security;
alter table public.catalog_federation_sports enable row level security;

revoke all on public.catalog_sports, public.catalog_club_sports, public.catalog_federation_sports from anon, authenticated;
grant select on public.catalog_sports, public.catalog_club_sports, public.catalog_federation_sports to anon, authenticated;
grant insert, update, delete on public.catalog_sports, public.catalog_club_sports, public.catalog_federation_sports to authenticated;

create policy catalog_sports_public_read on public.catalog_sports for select to anon, authenticated using (active);
create policy catalog_sports_admin_read on public.catalog_sports for select to authenticated using (public.app_is_admin());
create policy catalog_sports_admin_write on public.catalog_sports for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());
create policy catalog_club_sports_public_read on public.catalog_club_sports for select to anon, authenticated using (true);
create policy catalog_club_sports_admin_write on public.catalog_club_sports for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());
create policy catalog_federation_sports_public_read on public.catalog_federation_sports for select to anon, authenticated using (true);
create policy catalog_federation_sports_admin_write on public.catalog_federation_sports for all to authenticated using (public.app_is_admin()) with check (public.app_is_admin());

notify pgrst, 'reload schema';
commit;
