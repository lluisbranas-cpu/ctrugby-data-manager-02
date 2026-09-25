-- Importación atómica de staff, participantes históricos e hitos.
begin;

create or replace function public.admin_import_milestones(
  p_staff jsonb, p_participants jsonb, p_milestones jsonb, p_sources jsonb, p_metrics jsonb
) returns jsonb
language plpgsql security definer
set search_path = public, app_private
as $$
declare staff_count integer; participant_count integer; milestone_count integer; source_count integer; metric_count integer;
begin
  if not public.app_is_admin() then raise exception 'Acceso de administrador requerido.' using errcode = '42501'; end if;
  if exists(select 1 from public.catalog_milestones) or exists(select 1 from public.catalog_staff) then
    raise exception 'El catálogo histórico ya contiene datos. No se sobrescriben registros existentes.' using errcode = '23505';
  end if;
  insert into public.catalog_staff (id, first_name, last_name)
  select x.id, x.first_name, x.last_name from jsonb_to_recordset(p_staff) as x(id text, first_name text, last_name text);
  get diagnostics staff_count = row_count;
  insert into public.catalog_participants (id, kind, display_name, player_id, staff_id, source_key)
  select x.id, x.kind, x.display_name, x.player_id, x.staff_id, x.source_key from jsonb_to_recordset(p_participants) as x(id text, kind text, display_name text, player_id text, staff_id text, source_key text);
  get diagnostics participant_count = row_count;
  insert into public.catalog_milestones (id, participant_id, scope, category, season_label, club_text, position_text)
  select x.id, x.participant_id, x.scope, x.category, x.season_label, x.club_text, x.position_text from jsonb_to_recordset(p_milestones) as x(id text, participant_id text, scope text, category text, season_label text, club_text text, position_text text);
  get diagnostics milestone_count = row_count;
  insert into app_private.milestone_sources (milestone_id, source_type, source_ctr_id, source_name)
  select x.milestone_id, x.source_type, x.source_ctr_id, x.source_name from jsonb_to_recordset(p_sources) as x(milestone_id text, source_type text, source_ctr_id text, source_name text);
  get diagnostics source_count = row_count;
  insert into app_private.player_participation_metrics (player_id, participation_count, participation_years)
  select x.player_id, x.participation_count, x.participation_years from jsonb_to_recordset(p_metrics) as x(player_id text, participation_count integer, participation_years jsonb);
  get diagnostics metric_count = row_count;
  return jsonb_build_object('staff',staff_count,'participants',participant_count,'milestones',milestone_count,'sources',source_count,'metrics',metric_count);
end;
$$;
revoke all on function public.admin_import_milestones(jsonb,jsonb,jsonb,jsonb,jsonb) from public;
grant execute on function public.admin_import_milestones(jsonb,jsonb,jsonb,jsonb,jsonb) to authenticated;
commit;
