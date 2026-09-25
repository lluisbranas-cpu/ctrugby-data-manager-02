-- Ejecutar solo en el proyecto de PRUEBAS. No modifica tablas de negocio existentes.
begin;
create schema if not exists pilot_private;
revoke all on schema pilot_private from public, anon, authenticated;
create table pilot_private.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table pilot_private.admins enable row level security;
revoke all on pilot_private.admins from public, anon, authenticated;
create function public.pilot_is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from pilot_private.admins where user_id = auth.uid()) $$;
revoke all on function public.pilot_is_admin() from public;
grant execute on function public.pilot_is_admin() to anon, authenticated;

create table public.pilot_clubs (
  id text primary key check (id = 'TESTCLUB'),
  name text not null check (length(trim(name)) between 1 and 100)
);
create table public.pilot_players (
  id text primary key check (id = 'TEST001'),
  name text not null check (length(trim(name)) between 1 and 100),
  club_id text not null references public.pilot_clubs(id),
  season text not null check (season ~ '^[0-9]{4}/[0-9]{4}$'),
  photo_key text check (photo_key ~ '^TEST001/[a-f0-9-]{36}[.]png$'),
  version integer not null default 1 check (version > 0)
);
create table public.pilot_assessments (
  player_id text primary key references public.pilot_players(id),
  notes text not null default '' check (length(notes) <= 2000)
);
alter table public.pilot_clubs enable row level security;
alter table public.pilot_players enable row level security;
alter table public.pilot_assessments enable row level security;
revoke all on public.pilot_clubs, public.pilot_players, public.pilot_assessments from anon, authenticated;
grant select on public.pilot_clubs, public.pilot_players to anon, authenticated;
grant insert, update on public.pilot_clubs, public.pilot_players to authenticated;
grant select, insert, update on public.pilot_assessments to authenticated;
-- Solo ficha ficticia publicada. Esta prueba no implementa borradores ni datos reales.
create policy pilot_club_read on public.pilot_clubs for select to anon, authenticated using (true);
create policy pilot_player_read on public.pilot_players for select to anon, authenticated using (true);
create policy pilot_club_write on public.pilot_clubs for all to authenticated
  using (public.pilot_is_admin()) with check (public.pilot_is_admin());
create policy pilot_player_write on public.pilot_players for all to authenticated
  using (public.pilot_is_admin()) with check (public.pilot_is_admin());
create policy pilot_assessment_admin on public.pilot_assessments for all to authenticated
  using (public.pilot_is_admin()) with check (public.pilot_is_admin());

create function public.pilot_save(p_name text, p_club text, p_season text, p_notes text, p_version integer)
returns void language plpgsql security invoker set search_path = ''
as $$
begin
  if not public.pilot_is_admin() then raise insufficient_privilege; end if;
  if p_version is null or p_version < 0 then raise invalid_parameter_value; end if;
  insert into public.pilot_clubs(id,name) values ('TESTCLUB',p_club)
    on conflict (id) do update set name = excluded.name;
  if p_version = 0 then
    insert into public.pilot_players(id,name,club_id,season) values ('TEST001',p_name,'TESTCLUB',p_season)
      on conflict (id) do nothing;
  else
    update public.pilot_players set name=p_name, season=p_season, version=version+1
      where id='TEST001' and version=p_version;
  end if;
  if not found then raise exception 'Version conflict' using errcode='40001'; end if;
  insert into public.pilot_assessments(player_id,notes) values ('TEST001',p_notes)
    on conflict (player_id) do update set notes=excluded.notes;
end;
$$;
revoke all on function public.pilot_save(text,text,text,text,integer) from public;
grant execute on function public.pilot_save(text,text,text,text,integer) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('pilot-media-public','pilot-media-public',true,3000000,array['image/png']),
 ('pilot-media-private','pilot-media-private',false,3000000,array['image/png','image/jpeg','image/webp']);
create policy pilot_storage_admin on storage.objects for all to authenticated
 using (bucket_id in ('pilot-media-public','pilot-media-private') and public.pilot_is_admin())
 with check (bucket_id in ('pilot-media-public','pilot-media-private') and public.pilot_is_admin());
commit;
