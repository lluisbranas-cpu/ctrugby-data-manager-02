-- Preserve the original CTRugby administrator after the private-access
-- security tables are introduced. The statement is safe to run repeatedly.
begin;

insert into app_private.administrator_contacts (email, phone_e164, active)
select lower(trim(email)), '+34690734746', true
from auth.users
where lower(trim(email)) = 'ctrugbyhub@gmail.com'
  and email_confirmed_at is not null
on conflict (email) do update
  set phone_e164 = excluded.phone_e164,
      active = true,
      updated_at = now();

notify pgrst, 'reload schema';
commit;
