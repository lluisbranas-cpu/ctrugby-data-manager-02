begin;

create table if not exists app_private.private_session_scopes (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_kind text not null check (subject_kind in ('player','club')),
  subject_id text not null,
  expires_at timestamptz not null default now() + interval '1 hour'
);
create table if not exists app_private.player_club_consents (
  player_id text not null references public.catalog_players(id) on delete cascade,
  club_id text not null references public.catalog_clubs(id) on delete cascade,
  active boolean not null default false,
  changed_by uuid not null references auth.users(id),
  changed_at timestamptz not null default now(),
  primary key (player_id, club_id)
);
create table if not exists app_private.player_club_consent_events (
  id bigint generated always as identity primary key,
  player_id text not null,
  club_id text not null,
  active boolean not null,
  actor_id uuid not null references auth.users(id),
  occurred_at timestamptz not null default now(),
  notice_version text not null default 'private-profile-v1'
);
alter table app_private.private_session_scopes enable row level security;
alter table app_private.player_club_consents enable row level security;
alter table app_private.player_club_consent_events enable row level security;
revoke all on app_private.private_session_scopes, app_private.player_club_consents,
  app_private.player_club_consent_events from public, anon, authenticated;

-- Keep the original administrator authentication requirement independent of OTP.
create or replace function public.app_has_strong_login()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt()->>'aal' = 'aal2', false)
    and exists (select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) a where a->>'method'='password')
    and exists (select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) a where a->>'method'='totp')
    and exists (select 1 from public.app_login_contacts())
$$;
create or replace function public.app_has_email_confirmation()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) a
    where a->>'method' in ('otp','magiclink'))
    and exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null)
$$;
create or replace function public.app_active_subject(p_kind text, p_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from app_private.private_session_scopes s
    join public.app_login_contacts() c on c.subject_kind=s.subject_kind and c.subject_id=s.subject_id
    where s.session_id=(auth.jwt()->>'session_id')::uuid and s.user_id=auth.uid()
      and s.subject_kind=p_kind and s.subject_id=p_id and s.expires_at>now()
  )
$$;
create or replace function public.app_has_private_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.app_has_strong_login() or (public.app_has_email_confirmation() and exists (
    select 1 from app_private.private_session_scopes s
    where public.app_active_subject(s.subject_kind,s.subject_id)
      and s.session_id=(auth.jwt()->>'session_id')::uuid and s.user_id=auth.uid()
  ))
$$;
create or replace function public.app_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.app_has_strong_login() and exists (
    select 1 from public.app_login_contacts() where subject_kind='administrator'
  )
$$;
create or replace function public.app_owns_player(p_player_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.app_has_private_access() and exists (
    select 1 from public.app_login_contacts() c where c.subject_kind='player' and c.subject_id=p_player_id
  ) and (
    public.app_active_subject('player',p_player_id) or (public.app_has_strong_login() and not exists (
      select 1 from app_private.private_session_scopes s
      where s.session_id=(auth.jwt()->>'session_id')::uuid and s.user_id=auth.uid()
    ))
  )
$$;
create or replace function public.app_represents_club(p_club_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.app_has_private_access() and exists (
    select 1 from public.app_login_contacts() c where c.subject_kind='club' and c.subject_id=p_club_id
  ) and (
    public.app_active_subject('club',p_club_id) or (public.app_has_strong_login() and not exists (
      select 1 from app_private.private_session_scopes s
      where s.session_id=(auth.jwt()->>'session_id')::uuid and s.user_id=auth.uid()
    ))
  )
$$;
create or replace function public.app_can_view_player(p_player_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.app_is_admin() or public.app_owns_player(p_player_id) or exists (
    select 1 from app_private.player_club_consents c where c.player_id=p_player_id
      and c.active and public.app_represents_club(c.club_id)
  )
$$;

create or replace function public.app_select_private_subject(p_kind text,p_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not (public.app_has_email_confirmation() or public.app_has_strong_login())
    or p_kind not in ('player','club') or not exists (
      select 1 from public.app_login_contacts() c where c.subject_kind=p_kind and c.subject_id=p_id
    ) or auth.jwt()->>'session_id' is null then
    raise exception 'Acceso no autorizado.' using errcode='42501';
  end if;
  insert into app_private.private_session_scopes(session_id,user_id,subject_kind,subject_id,expires_at)
    values((auth.jwt()->>'session_id')::uuid,auth.uid(),p_kind,p_id,now()+interval '1 hour')
    on conflict(session_id) do update set subject_kind=excluded.subject_kind,
      subject_id=excluded.subject_id,expires_at=excluded.expires_at;
end $$;

-- Preflight is server-only. Unknown addresses receive the same browser response.
create or replace function public.app_email_login_allowed(p_email text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Acceso no autorizado.' using errcode='42501'; end if;
  return not exists(select 1 from app_private.administrator_contacts a where a.email=lower(trim(p_email)))
    and (exists(select 1 from app_private.player_private_contacts c
      where lower(trim(p_email)) in (lower(trim(c.player_email)),lower(trim(c.tutor1_email)),lower(trim(c.tutor2_email))))
    or exists(select 1 from app_private.portal_accounts a join auth.users u on u.id=a.user_id
      where a.subject_kind='club' and lower(trim(u.email))=lower(trim(p_email))));
end $$;

create or replace function public.app_player_club_permissions(p_player_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.app_owns_player(p_player_id) then raise exception 'Solo el jugador o su tutor puede gestionar las autorizaciones.' using errcode='42501'; end if;
  return jsonb_build_object('clubs',coalesce((select jsonb_agg(jsonb_build_object(
    'id',c.id,'name',c.name,'authorized',coalesce(a.active,false),'changed_at',a.changed_at) order by c.name)
    from public.catalog_clubs c left join app_private.player_club_consents a
      on a.club_id=c.id and a.player_id=p_player_id), '[]'::jsonb));
end $$;
create or replace function public.app_set_player_club_permission(p_player_id text,p_club_id text,p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_active is null or not public.app_owns_player(p_player_id) then
    raise exception 'Solo el jugador o su tutor puede gestionar las autorizaciones.' using errcode='42501';
  end if;
  if not exists(select 1 from public.catalog_clubs where id=p_club_id) then
    raise exception 'Club no válido.' using errcode='22023';
  end if;
  insert into app_private.player_club_consents(player_id,club_id,active,changed_by)
    values(p_player_id,p_club_id,p_active,auth.uid())
    on conflict(player_id,club_id) do update set active=excluded.active,changed_by=excluded.changed_by,changed_at=now();
  insert into app_private.player_club_consent_events(player_id,club_id,active,actor_id)
    values(p_player_id,p_club_id,p_active,auth.uid());
end $$;
create or replace function public.app_club_authorized_players(p_club_id text)
returns table(id text,first_name text,last_name text) language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.app_represents_club(p_club_id) then raise exception 'Acceso no autorizado.' using errcode='42501'; end if;
  return query select p.id,p.first_name,p.last_name from public.catalog_players p
    join app_private.player_club_consents c on c.player_id=p.id
    where c.club_id=p_club_id and c.active order by p.first_name,p.last_name;
end $$;
-- Only these fields are needed for the private profile. Contacts stay admin-only.
create or replace function public.app_player_private_profile(p_player_id text)
returns table(allergies text,dietary_conditions text,medications text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.app_can_view_player(p_player_id) then raise exception 'Acceso no autorizado.' using errcode='42501'; end if;
  return query select p.allergies,p.dietary_conditions,p.medications
    from app_private.player_profiles p where p.player_id=p_player_id;
end $$;

create or replace function public.admin_club_access_ready(p_club_id text,p_email text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.app_is_admin() then raise exception 'Acceso no autorizado.' using errcode='42501'; end if;
  return exists(select 1 from public.catalog_clubs where id=p_club_id)
    and not exists(select 1 from app_private.administrator_contacts where email=lower(trim(p_email)));
end $$;
create or replace function public.admin_set_club_access(p_user_id uuid,p_club_id text,p_phone text,p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.app_is_admin() or p_active is null then raise exception 'Acceso no autorizado.' using errcode='42501'; end if;
  if not exists(select 1 from public.catalog_clubs where id=p_club_id)
    or not exists(select 1 from auth.users where id=p_user_id)
    or exists(select 1 from auth.users u join app_private.administrator_contacts a on lower(trim(u.email))=a.email where u.id=p_user_id)
    or p_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Cuenta o club no válidos.' using errcode='22023';
  end if;
  if not p_active then
    delete from app_private.portal_accounts where user_id=p_user_id and subject_kind='club' and subject_id=p_club_id;
    return;
  end if;
  if exists(select 1 from app_private.portal_accounts where user_id=p_user_id and (subject_kind<>'club' or subject_id<>p_club_id)) then
    raise exception 'La cuenta ya está vinculada a otro perfil.' using errcode='22023';
  end if;
  insert into app_private.portal_accounts(user_id,subject_kind,subject_id,phone_e164)
    values(p_user_id,'club',p_club_id,p_phone)
    on conflict(user_id) do update set phone_e164=excluded.phone_e164;
end $$;

revoke all on function public.app_email_login_allowed(text) from public,anon,authenticated;
grant execute on function public.app_email_login_allowed(text) to service_role;
do $$ declare signature text; begin
  foreach signature in array array[
    'app_has_strong_login()','app_has_email_confirmation()','app_active_subject(text,text)',
    'app_has_private_access()','app_is_admin()','app_owns_player(text)',
    'app_represents_club(text)','app_can_view_player(text)',
    'app_select_private_subject(text,text)','app_player_club_permissions(text)',
    'app_set_player_club_permission(text,text,boolean)','app_club_authorized_players(text)',
    'app_player_private_profile(text)','admin_club_access_ready(text,text)',
    'admin_set_club_access(uuid,text,text,boolean)'
  ] loop
    execute 'revoke all on function public.' || signature || ' from public,anon';
    execute 'grant execute on function public.' || signature || ' to authenticated';
  end loop;
end $$;
-- Anonymous callers must be able to evaluate existing RLS policies, yielding false.
grant execute on function public.app_has_private_access(),public.app_is_admin(),public.app_can_view_player(text) to anon;
notify pgrst,'reload schema';
commit;
