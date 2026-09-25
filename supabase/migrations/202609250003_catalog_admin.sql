-- Ejecutar una vez después de 202609250002_catalogs.sql.
-- Reutiliza, únicamente para los catálogos reales, el administrador ya
-- autorizado en la prueba piloto. No cambia ni crea usuarios de Authentication.
insert into app_private.admins(user_id)
select user_id from pilot_private.admins
on conflict do nothing;
