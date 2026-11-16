-- Preparada en local: no aplicar sin la autorización expresa para modificar la base de datos.
begin;

alter table public.catalog_federations
  add column if not exists regional_association_ids text[] not null default '{}';

alter table public.catalog_federations
  drop constraint if exists catalog_federations_world_rugby_affiliation_check;

alter table public.catalog_federations
  add constraint catalog_federations_world_rugby_affiliation_check
  check (world_rugby_affiliation in ('miembro', 'no_miembro', 'no_aplica', 'pendiente'));

update public.catalog_federations
set regional_association_ids = case country
  when 'Andorra' then array['rugby-europe']
  when 'Argentina' then array['sudamerica-rugby']
  when 'Australia' then array['oceania-rugby']
  when 'Bélgica' then array['rugby-europe']
  when 'Canadá' then array['rugby-americas-north']
  when 'Chile' then array['sudamerica-rugby']
  when 'Escocia' then array['rugby-europe']
  when 'España' then array['rugby-europe']
  when 'Estados Unidos' then array['rugby-americas-north']
  when 'France' then array['rugby-europe']
  when 'Gales' then array['rugby-europe']
  when 'Georgia' then array['rugby-europe']
  when 'Irlanda' then array['rugby-europe']
  when 'Italia' then array['rugby-europe']
  when 'Japón' then array['asia-rugby']
  when 'Nueva Zelanda' then array['oceania-rugby']
  when 'Países Bajos' then array['rugby-europe']
  when 'Polonia' then array['rugby-europe']
  when 'Portugal' then array['rugby-europe']
  when 'Rumanía' then array['rugby-europe']
  when 'Samoa' then array['oceania-rugby']
  when 'Singapore' then array['asia-rugby']
  when 'Sudáfrica' then array['rugby-afrique']
  when 'Suiza' then array['rugby-europe']
  when 'Tonga' then array['oceania-rugby']
  when 'Uruguay' then array['sudamerica-rugby']
  else regional_association_ids
end;

insert into public.catalog_federations (id, name, scope, territory, country, active, published, world_rugby_affiliation, regional_association_ids) values
  ('FN027', 'Federación de Rugby de Bielorrusia', 'Nacional', 'Bielorrusia', 'Bielorrusia', false, true, 'no_miembro', array['rugby-europe']),
  ('FN028', 'Federación de Rugby de Estonia', 'Nacional', 'Estonia', 'Estonia', true, true, 'no_miembro', array['rugby-europe']),
  ('FN029', 'Federación de Rugby de Islandia', 'Nacional', 'Islandia', 'Islandia', true, true, 'no_miembro', array['rugby-europe']),
  ('FN030', 'Federación de Rugby de Kosovo', 'Nacional', 'Kosovo', 'Kosovo', true, true, 'no_miembro', array['rugby-europe']),
  ('FN031', 'Federación de Rugby de Liechtenstein', 'Nacional', 'Liechtenstein', 'Liechtenstein', true, true, 'no_miembro', array['rugby-europe']),
  ('FN032', 'Federación de Rugby de Montenegro', 'Nacional', 'Montenegro', 'Montenegro', true, true, 'no_miembro', array['rugby-europe']),
  ('FN033', 'Federación de Rugby de Rusia', 'Nacional', 'Rusia', 'Rusia', false, true, 'no_miembro', array['rugby-europe']),
  ('FN034', 'Federación de Rugby de San Marino', 'Nacional', 'San Marino', 'San Marino', true, true, 'no_miembro', array['rugby-europe']),
  ('FN035', 'Federación de Rugby de Benín', 'Nacional', 'Benín', 'Benín', true, true, 'no_miembro', array['rugby-afrique']),
  ('FN036', 'Federación de Rugby de Chad', 'Nacional', 'Chad', 'Chad', true, true, 'no_miembro', array['rugby-afrique']),
  ('FN037', 'Federación de Rugby de Congo (República del Congo)', 'Nacional', 'Congo (República del Congo)', 'Congo (República del Congo)', true, true, 'no_miembro', array['rugby-afrique']),
  ('FN038', 'Federación de Rugby de Etiopía', 'Nacional', 'Etiopía', 'Etiopía', true, true, 'no_miembro', array['rugby-afrique']),
  ('FN039', 'Federación de Rugby de Gabón', 'Nacional', 'Gabón', 'Gabón', true, true, 'no_miembro', array['rugby-afrique']),
  ('FN040', 'Federación de Rugby de Guinea', 'Nacional', 'Guinea', 'Guinea', true, true, 'no_miembro', array['rugby-afrique']),
  ('FN041', 'Federación de Rugby de Libia', 'Nacional', 'Libia', 'Libia', true, true, 'no_miembro', array['rugby-afrique']),
  ('FN042', 'Federación de Rugby de Malaui', 'Nacional', 'Malaui', 'Malaui', true, true, 'no_miembro', array['rugby-afrique']),
  ('FN043', 'Federación de Rugby de Mozambique', 'Nacional', 'Mozambique', 'Mozambique', true, true, 'no_miembro', array['rugby-afrique']),
  ('FN044', 'Federación de Rugby de Níger', 'Nacional', 'Níger', 'Níger', true, true, 'no_miembro', array['rugby-afrique']),
  ('FN045', 'Federación de Rugby de República Centroafricana', 'Nacional', 'República Centroafricana', 'República Centroafricana', true, true, 'no_miembro', array['rugby-afrique']),
  ('FN046', 'Federación de Rugby de Seychelles', 'Nacional', 'Seychelles', 'Seychelles', true, true, 'no_miembro', array['rugby-afrique']),
  ('FN047', 'Federación de Rugby de Sierra Leona', 'Nacional', 'Sierra Leona', 'Sierra Leona', true, true, 'no_miembro', array['rugby-afrique']),
  ('FN048', 'Federación de Rugby de Sudán', 'Nacional', 'Sudán', 'Sudán', true, true, 'no_miembro', array['rugby-afrique']),
  ('FN049', 'Federación de Rugby de Afganistán', 'Nacional', 'Afganistán', 'Afganistán', true, true, 'no_miembro', array['asia-rugby']),
  ('FN050', 'Federación de Rugby de Arabia Saudita', 'Nacional', 'Arabia Saudita', 'Arabia Saudita', true, true, 'no_miembro', array['asia-rugby']),
  ('FN051', 'Federación de Rugby de Bangladés', 'Nacional', 'Bangladés', 'Bangladés', true, true, 'no_miembro', array['asia-rugby']),
  ('FN052', 'Federación de Rugby de Baréin', 'Nacional', 'Baréin', 'Baréin', true, true, 'no_miembro', array['asia-rugby']),
  ('FN053', 'Federación de Rugby de Camboya', 'Nacional', 'Camboya', 'Camboya', true, true, 'no_miembro', array['asia-rugby']),
  ('FN054', 'Federación de Rugby de Macao', 'Nacional', 'Macao', 'Macao', true, true, 'no_miembro', array['asia-rugby']),
  ('FN055', 'Federación de Rugby de Omán', 'Nacional', 'Omán', 'Omán', true, true, 'no_miembro', array['asia-rugby']),
  ('FN056', 'Federación de Rugby de Palestina', 'Nacional', 'Palestina', 'Palestina', true, true, 'no_miembro', array['asia-rugby']),
  ('FN057', 'Federación de Rugby de Belice', 'Nacional', 'Belice', 'Belice', true, true, 'no_miembro', array['rugby-americas-north']),
  ('FN058', 'Federación de Rugby de Cuba', 'Nacional', 'Cuba', 'Cuba', true, true, 'no_miembro', array['rugby-americas-north']),
  ('FN059', 'Federación de Rugby de Curazao', 'Nacional', 'Curazao', 'Curazao', true, true, 'no_miembro', array['rugby-americas-north']),
  ('FN060', 'Federación de Rugby de Guadalupe', 'Nacional', 'Guadalupe', 'Guadalupe', true, true, 'no_miembro', array['rugby-americas-north']),
  ('FN061', 'Federación de Rugby de Guayana Francesa', 'Nacional', 'Guayana Francesa', 'Guayana Francesa', true, true, 'no_miembro', array['rugby-americas-north']),
  ('FN062', 'Federación de Rugby de Islas Turcas y Caicos', 'Nacional', 'Islas Turcas y Caicos', 'Islas Turcas y Caicos', true, true, 'no_miembro', array['rugby-americas-north']),
  ('FN063', 'Federación de Rugby de Martinica', 'Nacional', 'Martinica', 'Martinica', true, true, 'no_miembro', array['rugby-americas-north']),
  ('FN064', 'Federación de Rugby de República Dominicana', 'Nacional', 'República Dominicana', 'República Dominicana', true, true, 'no_miembro', array['rugby-americas-north', 'sudamerica-rugby']),
  ('FN065', 'Federación de Rugby de Bolivia', 'Nacional', 'Bolivia', 'Bolivia', true, true, 'no_miembro', array['sudamerica-rugby']),
  ('FN066', 'Federación de Rugby de Ecuador', 'Nacional', 'Ecuador', 'Ecuador', true, true, 'no_miembro', array['sudamerica-rugby']),
  ('FN067', 'Federación de Rugby de El Salvador', 'Nacional', 'El Salvador', 'El Salvador', true, true, 'no_miembro', array['sudamerica-rugby']),
  ('FN068', 'Federación de Rugby de Honduras', 'Nacional', 'Honduras', 'Honduras', true, true, 'no_miembro', array['sudamerica-rugby']),
  ('FN069', 'Federación de Rugby de Nicaragua', 'Nacional', 'Nicaragua', 'Nicaragua', true, true, 'no_miembro', array['sudamerica-rugby']),
  ('FN070', 'Federación de Rugby de Nauru', 'Nacional', 'Nauru', 'Nauru', true, true, 'no_miembro', array['oceania-rugby']),
  ('FN071', 'Federación de Rugby de Nueva Caledonia', 'Nacional', 'Nueva Caledonia', 'Nueva Caledonia', true, true, 'no_miembro', array['oceania-rugby']),
  ('FN072', 'Federación de Rugby de Tahití / Polinesia Francesa', 'Nacional', 'Tahití / Polinesia Francesa', 'Tahití / Polinesia Francesa', true, true, 'no_miembro', array['oceania-rugby']),
  ('FN073', 'Federación de Rugby de Tuvalu', 'Nacional', 'Tuvalu', 'Tuvalu', true, true, 'no_miembro', array['oceania-rugby']),
  ('FN074', 'Federación de Rugby de Wallis y Futuna', 'Nacional', 'Wallis y Futuna', 'Wallis y Futuna', true, true, 'no_miembro', array['oceania-rugby'])
on conflict (id) do update set
  name = excluded.name,
  territory = excluded.territory,
  country = excluded.country,
  active = excluded.active,
  published = excluded.published,
  world_rugby_affiliation = excluded.world_rugby_affiliation,
  regional_association_ids = excluded.regional_association_ids;

commit;
