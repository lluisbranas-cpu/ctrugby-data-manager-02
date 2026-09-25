-- Copias preparadas de fotografías de ficha: privadas mientras la ficha no se publique.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog-media-private', 'catalog-media-private', false, 900000, array['image/webp', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = 900000, allowed_mime_types = array['image/webp', 'image/png'];

create table app_private.player_profile_photos (
  player_id text primary key references public.catalog_players(id) on delete cascade,
  storage_key text not null unique check (storage_key ~ '^player-portraits/CTR[0-9]{4}[.]png$'),
  updated_at timestamptz not null default now()
);
alter table app_private.player_profile_photos enable row level security;
revoke all on app_private.player_profile_photos from public, anon, authenticated;
grant select, insert, update, delete on app_private.player_profile_photos to authenticated;
create policy player_profile_photo_admin on app_private.player_profile_photos for all to authenticated
  using (public.app_is_admin()) with check (public.app_is_admin());

create or replace function public.admin_import_player_profile_photos(p_photos jsonb)
returns jsonb language plpgsql security definer set search_path = public, app_private
as $$
declare photo_count integer;
begin
  if not public.app_is_admin() then raise exception 'Acceso de administrador requerido.' using errcode = '42501'; end if;
  if jsonb_typeof(p_photos) <> 'array' then raise exception 'La preparación de fotografías no tiene el formato esperado.' using errcode = '22023'; end if;
  insert into app_private.player_profile_photos (player_id, storage_key)
  select x.player_id, x.storage_key
  from jsonb_to_recordset(p_photos) as x(player_id text, storage_key text)
  on conflict (player_id) do update set storage_key = excluded.storage_key, updated_at = now();
  get diagnostics photo_count = row_count;
  return jsonb_build_object('photos', photo_count);
end;
$$;
revoke all on function public.admin_import_player_profile_photos(jsonb) from public;
grant execute on function public.admin_import_player_profile_photos(jsonb) to authenticated;

commit;
