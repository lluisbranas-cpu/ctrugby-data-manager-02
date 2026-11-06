-- Acceso privado unificado para administradores, jugadores y clubs.
begin;

create table app_private.portal_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  subject_kind text not null check (subject_kind in ('administrator', 'player', 'club')),
  subject_id text not null,
  phone_e164 text not null check (phone_e164 ~ '^\\+[1-9][0-9]{7,14}$'),
  created_at timestamptz not null default now(),
  unique (subject_kind, subject_id)
);

-- Cuenta inicial del portal. Se vincula únicamente si ya existe en
-- Supabase Auth; la contraseña se crea mediante el flujo de recuperación.
insert into app_private.admins(user_id)
select id
from auth.users
where lower(email) = 'ctrugbyhub@gmail.com'
on conflict do nothing;

insert into app_private.portal_accounts (user_id, subject_kind, subject_id, phone_e164)
select id, 'administrator', 'ADMIN', '+34690734746'
from auth.users
where lower(email) = 'ctrugbyhub@gmail.com'
on conflict (user_id) do update
  set subject_kind = excluded.subject_kind,
      subject_id = excluded.subject_id,
      phone_e164 = excluded.phone_e164;

alter table app_private.portal_accounts enable row level security;
revoke all on app_private.portal_accounts from public, anon, authenticated;

create function public.app_current_portal_access()
returns table(subject_kind text, subject_id text, phone_e164 text)
language sql stable security definer set search_path = ''
as $$
  select account.subject_kind, account.subject_id, account.phone_e164
  from app_private.portal_accounts account
  where account.user_id = auth.uid()
$$;

revoke all on function public.app_current_portal_access() from public;
grant execute on function public.app_current_portal_access() to authenticated;

-- La creación de usuarios y sus contraseñas se hace en Supabase Auth.
-- Esta función vincula ese usuario ya creado con una ficha concreta.
create function public.app_link_portal_account(
  p_user_id uuid,
  p_subject_kind text,
  p_subject_id text,
  p_phone_e164 text
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.app_is_admin() then
    raise exception 'Acceso de administrador requerido.' using errcode = '42501';
  end if;
  if p_subject_kind = 'administrator' and not exists (
    select 1 from app_private.admins where user_id = p_user_id
  ) then
    raise exception 'Administrador no encontrado.' using errcode = '23503';
  end if;
  if p_subject_kind = 'administrator' and p_subject_id <> 'ADMIN' then
    raise exception 'El identificador de administrador debe ser ADMIN.' using errcode = '22023';
  end if;
  if p_subject_kind = 'player' and not exists (
    select 1 from public.catalog_players where id = p_subject_id
  ) then
    raise exception 'Jugador no encontrado.' using errcode = '23503';
  end if;
  if p_subject_kind = 'club' and not exists (
    select 1 from public.catalog_clubs where id = p_subject_id
  ) then
    raise exception 'Club no encontrado.' using errcode = '23503';
  end if;
  if p_subject_kind not in ('administrator', 'player', 'club') then
    raise exception 'Tipo de acceso no válido.' using errcode = '22023';
  end if;
  if p_phone_e164 !~ '^\\+[1-9][0-9]{7,14}$' then
    raise exception 'Teléfono no válido. Usa el formato internacional, por ejemplo +34600111222.' using errcode = '22023';
  end if;

  insert into app_private.portal_accounts (user_id, subject_kind, subject_id, phone_e164)
  values (p_user_id, p_subject_kind, p_subject_id, p_phone_e164)
  on conflict (user_id) do update
    set subject_kind = excluded.subject_kind,
        subject_id = excluded.subject_id,
        phone_e164 = excluded.phone_e164;
end;
$$;

revoke all on function public.app_link_portal_account(uuid, text, text, text) from public;
grant execute on function public.app_link_portal_account(uuid, text, text, text) to authenticated;

commit;
