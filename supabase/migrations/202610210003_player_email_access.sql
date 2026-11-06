begin;

-- This entry point is for players and their tutors. Clubs use their separate
-- password + authenticator entry point.
create or replace function public.app_email_login_allowed(p_email text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Acceso no autorizado.' using errcode='42501';
  end if;
  return not exists (
    select 1 from app_private.administrator_contacts a
    where a.email=lower(trim(p_email))
  ) and exists (
    select 1 from app_private.player_private_contacts c
    where lower(trim(p_email)) in (
      lower(trim(c.player_email)),lower(trim(c.tutor1_email)),lower(trim(c.tutor2_email))
    )
  );
end $$;
revoke all on function public.app_email_login_allowed(text) from public,anon,authenticated;
grant execute on function public.app_email_login_allowed(text) to service_role;
notify pgrst,'reload schema';
commit;
