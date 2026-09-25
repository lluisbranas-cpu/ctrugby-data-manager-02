-- Convocatoria RWC 2025: imágenes privadas y anexado protegido de hitos.
begin;

alter table public.catalog_milestones add column image_key text;
alter table public.catalog_milestones add constraint catalog_milestones_image_key_check
  check (image_key is null or image_key ~ '^rwc-2025-spain/[A-Za-z0-9-]+[.]webp$');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog-media-private', 'catalog-media-private', false, 900000, array['image/webp'])
on conflict (id) do update set public = false, file_size_limit = 900000, allowed_mime_types = array['image/webp'];

create policy catalog_media_private_admin on storage.objects for all to authenticated
using (bucket_id = 'catalog-media-private' and public.app_is_admin())
with check (bucket_id = 'catalog-media-private' and public.app_is_admin());

create or replace function public.admin_import_rwc_2025(
  p_participants jsonb, p_milestones jsonb, p_sources jsonb
) returns jsonb
language plpgsql security definer
set search_path = public, app_private
as $$
declare participant_count integer; milestone_count integer; source_count integer;
begin
  if not public.app_is_admin() then raise exception 'Acceso de administrador requerido.' using errcode = '42501'; end if;
  if exists (select 1 from public.catalog_milestones where image_key like 'rwc-2025-spain/%') then
    raise exception 'La convocatoria RWC 2025 ya está cargada.' using errcode = '23505';
  end if;
  insert into public.catalog_participants (id, kind, display_name, player_id, staff_id, source_key)
  select x.id, x.kind, x.display_name, x.player_id, x.staff_id, x.source_key
  from jsonb_to_recordset(p_participants) as x(id text, kind text, display_name text, player_id text, staff_id text, source_key text)
  on conflict (id) do nothing;
  get diagnostics participant_count = row_count;
  insert into public.catalog_milestones (id, participant_id, scope, category, season_label, club_text, position_text, image_key)
  select x.id, x.participant_id, x.scope, x.category, x.season_label, x.club_text, x.position_text, x.image_key
  from jsonb_to_recordset(p_milestones) as x(id text, participant_id text, scope text, category text, season_label text, club_text text, position_text text, image_key text);
  get diagnostics milestone_count = row_count;
  insert into app_private.milestone_sources (milestone_id, source_type, source_ctr_id, source_name)
  select x.milestone_id, x.source_type, x.source_ctr_id, x.source_name
  from jsonb_to_recordset(p_sources) as x(milestone_id text, source_type text, source_ctr_id text, source_name text);
  get diagnostics source_count = row_count;
  return jsonb_build_object('new_participants', participant_count, 'milestones', milestone_count, 'sources', source_count);
end;
$$;
revoke all on function public.admin_import_rwc_2025(jsonb, jsonb, jsonb) from public;
grant execute on function public.admin_import_rwc_2025(jsonb, jsonb, jsonb) to authenticated;

commit;
