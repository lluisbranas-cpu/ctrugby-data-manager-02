begin;

create or replace function public.app_player_assessments_for_private_pdf(p_player_id text)
returns table (
  id uuid, player_id text, season text, label text, evaluated_on date,
  club text, "position" text, metrics jsonb, notes text, revision integer
)
language plpgsql security definer set search_path = public, app_private
as $$
begin
  return query
  select assessment.id, assessment.player_id, assessment.season, assessment.label,
    assessment.evaluated_on, assessment.club, assessment.position, assessment.metrics,
    assessment.notes, assessment.revision
  from app_private.player_assessments assessment
  where assessment.player_id = p_player_id
  order by assessment.evaluated_on nulls last, assessment.season;
end;
$$;

revoke all on function public.app_player_assessments_for_private_pdf(text) from public, anon, authenticated;
grant execute on function public.app_player_assessments_for_private_pdf(text) to service_role;

commit;
