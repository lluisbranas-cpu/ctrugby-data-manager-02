-- La edición del identificador de una federación debe conservar sus notas y
-- deportes asociados. Las claves externas iniciales solo contemplaban borrado.
alter table app_private.federation_notes
  drop constraint if exists federation_notes_federation_id_fkey,
  add constraint federation_notes_federation_id_fkey
    foreign key (federation_id) references public.catalog_federations(id)
    on delete cascade on update cascade;

alter table public.catalog_federation_sports
  drop constraint if exists catalog_federation_sports_federation_id_fkey,
  add constraint catalog_federation_sports_federation_id_fkey
    foreign key (federation_id) references public.catalog_federations(id)
    on delete cascade on update cascade;
