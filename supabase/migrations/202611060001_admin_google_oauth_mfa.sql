-- Pending manual review and application. This migration changes no data.
-- Google OAuth remains restricted to an active administrator contact and a
-- verified TOTP factor; other strong-login paths remain password + TOTP.
begin;

create or replace function public.app_has_strong_login()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt()->>'aal' = 'aal2', false)
    and exists (
      select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) a
      where a->>'method' = 'totp'
    )
    and exists (select 1 from public.app_login_contacts())
    and (
      exists (
        select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) a
        where a->>'method' = 'password'
      )
      or (
        exists (
          select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) a
          where a->>'method' = 'oauth'
        )
        and coalesce(auth.jwt()->'app_metadata'->'providers', '[]'::jsonb) ? 'google'
        and exists (
          select 1 from public.app_login_contacts()
          where subject_kind = 'administrator'
        )
      )
    )
$$;

commit;
