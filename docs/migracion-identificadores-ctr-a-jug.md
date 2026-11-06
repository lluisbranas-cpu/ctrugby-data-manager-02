# Unificación de identificadores de jugadores: CTR → JUG

Estado: AUDITORÍA REALIZADA, MIGRACIÓN DE PRODUCCIÓN **NO EJECUTADA** (06/11/2026).

## Identificador acordado

- Código definitivo visible y referencial: `JUG0001`, `JUG0002`, ...
- Supabase (proyecto `ycppheupweprkyinhwfu`) sigue usando `CTR0001`, `CTR0002`, ...
- La rama de permisos `fix/accesos-2026-11-06` ya resuelve la lectura pública mediante `canonicalLikidHubPlayerId`. No retirarla hasta la transición completa.

## Inventario comprobado mediante consultas SQL de solo lectura

- `public.catalog_players`: 389 registros, 389 IDs `CTR####`, 0 `JUG####`, 389 publicados.
- La aplicación local recibió 388 jugadores publicados después de reparar el puente. La comparación de los 389 IDs remotos con el puente generado confirma que **el único remoto excluido es `CTR0381` (Oriol Casanovas)**. El generador `scripts/generate-likidhub-preview-id-bridge.mjs` exige expresamente 388 correspondencias y excluye `JUG0381`: no debe inventarse la equivalencia de este registro sin analizar el informe de conciliación y su identidad.
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

## Nuevos resultados verificables (consultas 06/11/2026)

- Proyección numérica de los 389 `CTR####` a `JUG####`: **389 destinos distintos, 0 colisiones** dentro de `catalog_players`. Esto no valida por sí solo la identidad del jugador excluido del puente.
- `app_private.player_profile_photos`: **103 registros**, todos con `player_id` que comienza por `CTR`.
- `storage.objects`: **874 objetos** con un código `CTR####` en el nombre bajo el bucket `catalog-media-private`. La actualización de referencias SQL debe ir acompañada de una estrategia de traslado/copia de objetos y verificación de hashes/rutas, en otra fase reversible; no se logra solo con SQL sobre la tabla de jugadores.
- `app_private.player_club_consent_events`: **0 eventos** en el momento de la consulta (pero el procedimiento debe seguir contemplando referencias futuras).
- La auditoría automática de lectura previa está en `scripts/preflight-migracion-ids-ctr-jug.sql`; no contiene escrituras.

**Bloqueo activo:** no ejecutar la migración hasta confirmar copia restaurable que incluya Storage y resolver la correspondencia de `CTR0381`. La rama de compatibilidad actualmente preserva la funcionalidad de los 388 jugadores conciliados.

## Investigación de CTR0381 (continuación)

Las comprobaciones directas de solo lectura de Supabase muestran:

| ID | Nombre | Temporadas | Fotos vinculadas en `player_profile_photos` | Participantes |
| --- | --- | ---: | ---: | ---: |
| `CTR0059` | Oriol Casanovas Gonzalez | 1 | 0 | 0 |
| `CTR0381` | Oriol Casanovas | 0 | 0 | 0 |

`CTR0381` tiene además una fila en `app_private.player_profiles` y **dos objetos** con `CTR0381` en su nombre dentro del bucket privado `catalog-media-private`, aunque no hay filas de fotos en `player_profile_photos`. La identidad **no está confirmada** como duplicado de `CTR0059`: nombres parecidos no justifican unir fichas.

**Regla para el cutover:** preservar ambos registros y todos sus archivos hasta revisión documental de identidades. Ninguna migración automática podrá fusionar o borrar jugadores. `CTR0381` se convertiría en `JUG0381` solo tras confirmar que no colisiona semánticamente con otra ficha local; mientras tanto se mantiene sin cambio.

## Bloqueadores para ejecutar en producción

- Falta una copia restaurable e independiente de la **base de datos y de Storage**: una transacción SQL no revierte operaciones sobre objetos en Storage.
- Es necesario actualizar las nueve claves externas sin alterar sus reglas de borrado y revisar relaciones adicionales sin FK.
- Las imágenes antiguas en el bucket privado requieren copia y comprobación de integridad antes de actualizar `storage_key` u otras referencias; no modificar `storage.objects` directamente para trasladar archivos.
- Faltan los informes CSV de conciliación `reports/player-id-reconciliation-20261105/*` en el repositorio accesible, aunque sí existe el puente generado. Sin esos originales, no se puede verificar el motivo documental de la exclusión.
- La aplicación y sus rutas de lectura/escritura aún esperan formatos mezclados. La migración deberá desplegar una versión compatible antes de cambiar los identificadores en Supabase.

**Decisión de seguridad:** mantener en producción la solución funcional con puente de 388 jugadores y seguir preparando el cambio en una rama aislada, sin ejecutar un `UPDATE` masivo.

## Confirmación del titular (06/11/2026)

El responsable de los datos ha revisado expresamente las dos fichas y **confirma que corresponden a dos personas distintas**:

- `CTR0059` — Oriol Casanovas González: conservar su identidad y sus relaciones; destino propuesto `JUG0059`.
- `CTR0381` — Oriol Casanovas: conservar como persona y ficha independiente; destino propuesto `JUG0381`.

Por tanto, queda **descartada la fusión de ambos registros**. Esta validación resuelve la duda de identidad, pero no demuestra por sí sola que todos los datos locales y rutas de archivos estén ya conciliados. Antes de ejecutar la migración deben comprobarse la reserva del ID `JUG0381`, las referencias locales, el respaldo restaurable y los 874 objetos de Storage. El generador actual excluye `JUG0381` y deberá ajustarse en una revisión separada, sin asignarlo a `CTR0059`.
