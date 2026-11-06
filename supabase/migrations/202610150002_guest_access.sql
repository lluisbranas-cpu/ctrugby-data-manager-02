begin;
create table if not exists app_private.guest_contacts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 120),
  email text not null check (email = lower(trim(email))),
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  active boolean not null default true,
  verified_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table app_private.guest_contacts enable row level security;
revoke all on app_private.guest_contacts from public, anon, authenticated;

create or replace function public.app_register_guest(p_name text, p_phone text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_email text;
begin
  select lower(trim(email)) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null then raise exception 'Correo confirmado requerido.' using errcode = '42501'; end if;
  if length(trim(p_name)) not between 2 and 120 or trim(p_phone) !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Datos no válidos.' using errcode = '22023';
  end if;
  insert into app_private.guest_contacts(user_id,name,email,phone_e164)
  values(auth.uid(),trim(p_name),v_email,trim(p_phone))
  on conflict(user_id) do update set name=excluded.name,email=excluded.email,phone_e164=excluded.phone_e164,updated_at=now();
  -- Registration never reactivates a previously disabled guest.
end;
$$;
revoke all on function public.app_register_guest(text,text) from public,anon;
grant execute on function public.app_register_guest(text,text) to authenticated;

create or replace function public.app_has_guest_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from app_private.guest_contacts g join auth.users u on u.id=g.user_id
    where g.user_id=auth.uid() and g.active and u.email_confirmed_at is not null and g.email=lower(trim(u.email)))
$$;
revoke all on function public.app_has_guest_access() from public;
grant execute on function public.app_has_guest_access() to anon,authenticated;

create or replace function public.app_has_consultation_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.app_has_private_access() or public.app_has_guest_access()
$$;
revoke all on function public.app_has_consultation_access() from public;
grant execute on function public.app_has_consultation_access() to anon,authenticated;

-- Restrictive policies also protect direct database requests with the public key.
do $$ declare t text; begin
  foreach t in array array['catalog_players','catalog_clubs','catalog_federations','catalog_staff','catalog_participants','catalog_milestones','pilot_players','pilot_clubs','pilot_assessments'] loop
    execute format('drop policy if exists registered_consultation on public.%I',t);
    execute format('create policy registered_consultation on public.%I as restrictive for select to anon, authenticated using (public.app_has_consultation_access())',t);
  end loop;
end $$;
create table if not exists app_private.account_access_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  access_kind text not null check (access_kind in ('administrator','private','public')),
  accessed_at timestamptz not null default now(),
  primary key(user_id,session_id,access_kind)
);
alter table app_private.account_access_events enable row level security;
revoke all on app_private.account_access_events from public,anon,authenticated;

create or replace function public.app_record_access(p_kind text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_allowed boolean;
begin
  v_allowed := case p_kind
    when 'administrator' then public.app_is_admin()
    when 'private' then public.app_has_private_access() and not public.app_is_admin()
    when 'public' then public.app_has_guest_access()
    else false end;
  if not coalesce(v_allowed,false) or auth.jwt()->>'session_id' is null then
    raise exception 'Acceso no autorizado.' using errcode = '42501';
  end if;
  insert into app_private.account_access_events(user_id,session_id,access_kind)
  values(auth.uid(),(auth.jwt()->>'session_id')::uuid,p_kind) on conflict do nothing;
end;
$$;
revoke all on function public.app_record_access(text) from public,anon;
grant execute on function public.app_record_access(text) to authenticated;

create or replace function public.admin_access_accounts()
returns table(user_id uuid,name text,email text,phone_e164 text,access_kind text,active boolean,access_count bigint,last_access_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.app_is_admin() then raise exception 'Acceso de administrador requerido.' using errcode='42501'; end if;
  return query
  with candidates as (
    select u.id as uid,'Administrador'::text as display_name,a.email as mail,a.phone_e164 as phone,'administrator'::text as kind,a.active as enabled
    from app_private.administrator_contacts a left join auth.users u on lower(trim(u.email))=a.email
    union all
    select g.user_id,g.name,g.email,g.phone_e164,'public',g.active from app_private.guest_contacts g
    union all
    select u.id,max(concat_ws(' ',p.first_name,p.last_name)),lower(trim(u.email)),max(v.phone),'private',true
    from auth.users u join app_private.player_private_contacts c on lower(trim(u.email)) in (lower(trim(c.player_email)),lower(trim(c.tutor1_email)),lower(trim(c.tutor2_email)))
    join public.catalog_players p on p.id=c.player_id
    cross join lateral (values (c.player_email,c.player_phone_e164),(c.tutor1_email,c.tutor1_phone_e164),(c.tutor2_email,c.tutor2_phone_e164)) v(mail,phone)
    where lower(trim(v.mail))=lower(trim(u.email)) and u.email_confirmed_at is not null
      and not exists(select 1 from app_private.administrator_contacts a where a.email=lower(trim(u.email)))
    group by u.id,u.email
    union all
    select u.id,'Club',lower(trim(u.email)),a.phone_e164,'private',true
    from app_private.portal_accounts a join auth.users u on u.id=a.user_id
    where a.subject_kind='club' and u.email_confirmed_at is not null
      and not exists(select 1 from app_private.administrator_contacts d where d.email=lower(trim(u.email)))
  ), totals as (
    select e.user_id as uid,e.access_kind as kind,count(*) as n,max(e.accessed_at) as latest
    from app_private.account_access_events e group by e.user_id,e.access_kind
  )
  select c.uid,c.display_name,c.mail,c.phone,c.kind,c.enabled,coalesce(t.n,0),t.latest
  from candidates c left join totals t on t.uid=c.uid and t.kind=c.kind order by c.kind,c.mail;
end;
$$;
revoke all on function public.admin_access_accounts() from public,anon;
grant execute on function public.admin_access_accounts() to authenticated;
notify pgrst,'reload schema';
commit;
