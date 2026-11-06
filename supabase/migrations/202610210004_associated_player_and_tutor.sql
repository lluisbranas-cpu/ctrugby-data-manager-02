begin;

-- A person can be an administrator and also be a player's registered contact.
-- Email confirmation grants only the selected player scope, never admin access.
create or replace function public.app_login_contacts()
returns table(subject_kind text, subject_id text, phone_e164 text)
language sql stable security definer set search_path = '' as $$
  with account as (
    select lower(trim(email)) as email from auth.users
    where id=auth.uid() and email_confirmed_at is not null
  ), candidates as (
    select 'administrator'::text as subject_kind,'ADMIN'::text as subject_id,a.phone_e164
    from app_private.administrator_contacts a join account u on u.email=a.email where a.active
    union
    select 'player',c.player_id,v.phone
    from app_private.player_private_contacts c
    cross join lateral (values (c.player_email,c.player_phone_e164),
      (c.tutor1_email,c.tutor1_phone_e164),(c.tutor2_email,c.tutor2_phone_e164)) v(email,phone)
    join account u on lower(trim(v.email))=u.email
    union
    select a.subject_kind,a.subject_id,a.phone_e164
    from app_private.portal_accounts a join auth.users u on u.id=a.user_id
    where a.user_id=auth.uid() and a.subject_kind='club' and u.email_confirmed_at is not null
      and not exists(select 1 from app_private.administrator_contacts c where c.email=lower(trim(u.email)))
  ) select distinct c.subject_kind,c.subject_id,c.phone_e164 from candidates c
    order by c.subject_kind,c.subject_id,c.phone_e164
$$;
revoke all on function public.app_login_contacts() from public,anon;
grant execute on function public.app_login_contacts() to authenticated;

create or replace function public.app_email_login_allowed(p_email text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Acceso no autorizado.' using errcode='42501';
  end if;
  return exists(select 1 from app_private.player_private_contacts c
    where lower(trim(p_email)) in (lower(trim(c.player_email)),
      lower(trim(c.tutor1_email)),lower(trim(c.tutor2_email))));
end $$;
revoke all on function public.app_email_login_allowed(text) from public,anon,authenticated;
grant execute on function public.app_email_login_allowed(text) to service_role;
notify pgrst,'reload schema';
commit;
