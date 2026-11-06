begin;
alter table public.catalog_clients add column surname_color text not null default '#171717' check (surname_color ~ '^#[0-9A-Fa-f]{6}$');
comment on column public.catalog_clients.primary_color is 'Color de la cabecera';
comment on column public.catalog_clients.accent_color is 'Color de los botones';
comment on column public.catalog_clients.surname_color is 'Color de los apellidos de jugadores';
commit;
