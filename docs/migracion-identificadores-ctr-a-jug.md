# Unificación de identificadores de jugadores: CTR → JUG

Estado: AUDITORÍA REALIZADA, MIGRACIÓN DE PRODUCCIÓN **NO EJECUTADA** (06/11/2026).

## Identificador acordado

- Código definitivo visible y referencial: `JUG0001`, `JUG0002`, ...
- Supabase (proyecto `ycppheupweprkyinhwfu`) sigue usando `CTR0001`, `CTR0002`, ...
- La rama de permisos `fix/accesos-2026-11-06` ya resuelve la lectura pública mediante `canonicalLikidHubPlayerId`. No retirarla hasta la transición completa.

## Inventario comprobado mediante consultas SQL de solo lectura

- `public.catalog_players`: 389 registros, 389 IDs `CTR####`, 0 `JUG####`, 389 publicados.
- La aplicación local recibió 388 jugadores publicados después de reparar el puente. La diferencia pendiente incluye `CTR0381` (Oriol Casanovas), que requiere verificar su presencia en el catálogo local y en el mapa generado antes de migrar.
- Referencias FK al ID de jugadores: `app_private.player_assessments`, `player_club_affiliations`, `player_club_consents`, `player_participation_metrics`, `player_private_contacts`, `player_profile_photos`, `player_profiles`, `player_seasons`, `public.catalog_participants`.
- Ninguna de esas claves externas tiene `ON UPDATE CASCADE`; actualmente son `NO ACTION` y no diferibles. Un `UPDATE catalog_players SET id=...` aislado fallaría.
- Otras referencias que hay que auditar: `app_private.player_club_consent_events`, `public.pilot_assessments` (apunta a `pilot_players`), funciones de importación y consulta, políticas RLS, objetos de Storage, claves de fotos, JSON de `data/staging`, noticias y convocatorias.
- Funciones RPC detectadas: `admin_import_players`, `admin_import_player_sheet`, `admin_import_player_club_data`, `admin_import_player_profile_photos`, `admin_player_catalog_with_history`, `admin_player_sheet_data`, `admin_replace_player_trajectory`, `app_owns_player`, `app_can_view_player`, `app_club_authorized_players`, `app_player_club_permissions`, `player_trajectory_public` y otras. Revisar sus definiciones y su comportamiento, sin asumir que todas codifican el prefijo CTR.

## Condiciones para una migración segura

1. Obtener y verificar una **copia de seguridad restaurable** de la base, esquema, funciones y objetos de Storage, con ventana de mantenimiento y plan de reversión probado.
2. Exportar correspondencias y comprobar uno a uno los 389 nombres/IDs; resolver `CTR0381` y cualquier diferencia en el mapa generado. Rechazar conversiones ambiguas o destinos `JUG` ya existentes.
3. Inventariar referencias por **FK y por columnas sin FK**; revisar funciones SQL, triggers, vistas, políticas, claves de Storage, rutas del frontend, y scripts de importación.
4. Preparar una migración SQL **atómica**, con comprobaciones de cardinalidad antes/después, ajuste temporal de las FK o actualización coordinada de claves, y rollback completo ante cualquier inconsistencia. No cambiar ni borrar registros a ciegas.
5. Actualizar el código para usar `JUG` en lecturas y escrituras. Durante la transición, permitir `CTR` solo como alias de entrada para enlaces antiguos.
6. Ejecutar pruebas: público / privado / clubes / administrador, fotos, trayectorias, noticias, convocatorias, participaciones, inserción y edición. Verificar las 389 fichas y los enlaces.
7. Solo después de la validación, retirar el puente de compatibilidad y desplegar.

## Consultas diagnósticas (solo lectura)

```sql
select count(*) as total,
       count(*) filter (where id ~ '^CTR[0-9]{4}$') as ctr,
       count(*) filter (where id ~ '^JUG[0-9]{4}$') as jug,
       count(*) filter (where published) as publicados
from public.catalog_players;

select id, first_name, last_name
from public.catalog_players
where id in ('CTR0374','CTR0381','CTR0391')
order by id;

select conrelid::regclass::text as tabla, conname,
       condeferrable, condeferred, pg_get_constraintdef(oid) as definicion
from pg_constraint
where contype = 'f' and confrelid = 'public.catalog_players'::regclass
order by 1;
```

Este documento no es autorización para cambiar IDs en producción sin copia validada y prueba del procedimiento.
