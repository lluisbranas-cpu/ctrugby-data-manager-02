# Auditoría de rutas API con dependencia local

Estado: **preparación, sin corte activo**. `app_private.operational_documents` y `catalog-operational-private` son el destino transitorio de los JSON y medios que aún no tienen una tabla normalizada. Los modelos `catalog_*` existentes prevalecen cuando ya cubren la entidad.

| Ruta API | Archivo local actual | Entidad funcional | Destino Supabase | Acción necesaria |
| --- | --- | --- | --- | --- |
| `/api/agrupaciones-temporales` | `temporary-*-groups.json` | Agrupaciones temporales | `operational_documents/club:temporary-groups` | Importar una vez; migrar lectura/escritura |
| `/api/camisetas` | `jerseys/originales`, `jerseys/manifest.json` | Camisetas | `catalog-operational-private`, `operational_documents/jerseys` | Importar una vez; migrar lectura/escritura |
| `/api/clubs` | `clubs.json`, temporadas e hitos | Clubes y resúmenes | `catalog_clubs`, `catalog_milestones` | Migrar lectura; conservar JSON como respaldo |
| `/api/clubs/[id]` | `data/staging/*.json` | Ficha e historial de club | `catalog_clubs`, `app_private.operational_documents/club` | Migrar lectura/escritura |
| `/api/clubs/escudo/[id]` | `club-shields/originales` | Escudos de club | `catalog-operational-private` | Importar medios; migrar lectura/escritura |
| `/api/clubs/paleta/[id]` | `club-palettes.json` | Paleta de club | `operational_documents/club:palettes` | Importar una vez; migrar lectura/escritura |
| `/api/clubs/portada/[id]` | `club-covers/originales` | Portadas de club | `catalog-operational-private` | Importar medios; migrar lectura/escritura |
| `/api/clubs/hoja` | clubs e historial local | Hoja de club | `catalog_clubs`, `operational_documents/club:histories` | Migrar lectura |
| `/api/catalogos` | orden destacado y categorías locales | Catálogos auxiliares | `catalog_*`, documentos operativos | Migrar lectura/escritura |
| `/api/contacto` | `contact-messages.json` | Mensajes de contacto | `operational_documents/contact:messages` | Importar una vez; migrar lectura/escritura |
| `/api/convocatorias` | `data/competition/callups-2026-27.json` | Convocatorias | `catalog_callups` | Migrar lectura/escritura; JSON solo respaldo |
| `/api/convocatorias/competicion` | `data/competition/2026-27.json` | Temporada/competición | `operational_documents/competition:season-2026-27` | Importar una vez; migrar lectura/escritura |
| `/api/destacados/hoja` | `staff.json` | Exportación de destacados | `catalog_staff` + documentos operativos | Migrar lectura |
| `/api/destacados/order` | `featured-player-order.json` | Orden de destacados | `operational_documents/player:featured-order` | Importar una vez; migrar lectura/escritura |
| `/api/federaciones` | clubs, jugadores, hitos locales | Federación y métricas | `catalog_federations`, `catalog_*` | Migrar lectura; conservar JSON como respaldo |
| `/api/federaciones/escudo/[id]` | `federation-shields/originales` | Escudos federativos | `catalog-operational-private` | Importar medios; migrar lectura/escritura |
| `/api/federaciones/portada/[id]` | `federation-covers/originales` | Portadas federativas | `catalog-operational-private` | Importar medios; migrar lectura/escritura |
| `/api/hitos` | hitos, participantes, fuentes, clubs | Hitos | `catalog_milestones`, `catalog_participants`, `app_private.milestone_sources` | Migrar lectura/escritura; JSON solo respaldo |
| `/api/hitos/convocatorias` | federaciones e hitos locales | Selecciones/convocatorias | `catalog_*`, `operational_documents/hito:manual-selection-callups` | Migrar lectura/escritura |
| `/api/hitos/profesionales` | categorías y fuentes locales | Trayectoria profesional | `catalog_milestones`, documentos operativos | Migrar lectura/escritura |
| `/api/hitos/profesionales/hoja` | categorías y trayectorias locales | Hoja de trayectoria | `catalog_milestones`, `catalog_clubs` | Migrar lectura |
| `/api/hitos/profesionales/categorias/[id]/escudo` | escudos locales | Escudos de categoría | `catalog-operational-private` | Importar medios; migrar lectura/escritura |
| `/api/hitos/importar-fuentes-local` | `milestone-sources.json` | Fuentes de hitos | `app_private.milestone_sources` | Importar una vez; desactivar como ruta operativa |
| `/api/hitos/importar-local` | staging de hitos | Carga histórica de hitos | Tablas `catalog_*` | Importar una vez; desactivar como ruta operativa |
| `/api/hitos/importar-rwc-2025-local` | `rwc-2025/*` | Carga histórica RWC | Tablas `catalog_*` y Storage | Importar una vez; desactivar como ruta operativa |
| `/api/jugadores` | jugadores, temporadas, métricas, noticias, fotos | Directorio de jugadores | `catalog_players`, `app_private.player_profiles`, temporadas, documentos | Migrar lectura/escritura; JSON solo respaldo |
| `/api/jugadores/[id]` | ficha, temporadas, perfiles locales | Ficha privada de jugador | `catalog_players`, `player_profiles`, `player_private_contacts` | Migrar lectura/escritura |
| `/api/jugadores/[id]/pdf` | fotos y datos de ficha locales | PDF de jugador | tablas anteriores + Storage | Migrar lectura |
| `/api/jugadores/[id]/convocatorias/enlace` | enlaces y fuentes locales | Enlace de convocatoria | `catalog_callups`, documentos operativos | Migrar lectura/escritura |
| `/api/jugadores/[id]/convocatorias/resumen` | enlaces y fuentes locales | Resumen de convocatoria | `catalog_callups`, documentos operativos | Migrar lectura/escritura |
| `/api/jugadores/foto/[id]` | fotos preparadas/temporada | Fotos de jugador | `player_profile_photos`, `player_season_photos`, Storage | Importar medios; migrar lectura/escritura |
| `/api/jugadores/portada/[id]` | originales/configuración de portada | Portada jugador | `catalog-operational-private` | Importar medios; migrar lectura/escritura |
| `/api/jugadores/hoja` | `staff.json` | Hoja de jugadores | `catalog_staff`, `catalog_players` | Migrar lectura |
| `/api/jugadores/alta` | auxiliares de ficha local | Alta de jugador | `catalog_players`, `player_profiles`, temporadas | Migrar escritura |
| `/api/jugadores/importar-local` | `players.json`, temporadas | Importación de jugadores | Tablas de jugadores | Importar una vez; no usar en producción |
| `/api/jugadores/importar-clubs-local` | `player-clubs/*` | Historial de clubs | Tablas de jugadores/clubs | Importar una vez; no usar en producción |
| `/api/jugadores/importar-fotos-local` | `player-photos/*` | Fotos de jugador | Storage y tabla de fotos | Importar una vez; no usar en producción |
| `/api/jugadores/importar-historial-local` | historial y staging | Historial de jugador | Tablas de jugadores/clubs | Importar una vez; no usar en producción |
| `/api/menu` | JSON de menú | Navegación | `operational_documents/menu:*` | Importar una vez; migrar lectura |
| `/api/noticias/[id]/imagen` | `player-news-images/*.webp` | Imagen de noticia | `catalog-operational-private` | Importar medios; migrar lectura |
| `/api/noticias` | `player-news/*.json` e imágenes | Noticias de jugador | `operational_documents/news:*`, Storage | Importar una vez; migrar lectura/escritura |
| `/api/noticias/[id]/vista-previa` | noticia JSON e imagen local | Previsualización de noticia | `operational_documents/news:*`, Storage | Migrar lectura |
| `/api/noticias/excel` | noticias JSON locales | Exportación de noticias | `operational_documents/news:*` | Migrar lectura |
| `/api/participaciones` | temporadas y fotos locales | Participaciones | `app_private.player_seasons`, `player_season_photos` | Migrar lectura/escritura |
| `/api/participaciones/hoja` | temporadas, clubs y jugadores | Hoja de participaciones | tablas de jugadores/clubs | Migrar lectura |
| `/api/player-assessments/import-legacy` | datos heredados | Evaluaciones | `app_private.player_assessments` | Importar una vez |
| `/api/prueba` | sin persistencia local operativa | Piloto | `pilot_*` | Ya centralizado; conservar solo pruebas |
| `/api/prueba/foto` | sin persistencia local operativa | Foto de piloto | `pilot-media-*` | Ya centralizado; conservar solo pruebas |
| `/api/staff` | `staff.json`, perfiles, destacados, hitos | Staff | `catalog_staff`, `app_private.staff_*`, documentos | Migrar lectura/escritura |
| `/api/staff/escudo/[id]` | `staff-shields/originales` | Escudo staff | `catalog-operational-private` | Importar medios; migrar lectura/escritura |
| `/api/staff/foto/[id]` | `staff-photos/originales` | Foto staff | `catalog-operational-private` | Importar medios; migrar lectura/escritura |
| `/api/staff/portada/[id]` | originales y settings | Portada staff | `catalog-operational-private` | Importar medios; migrar lectura/escritura |

Rutas ya apoyadas por Supabase pero con dependencia indirecta local se tratan como **migrar lectura**: no se eliminará el fallback hasta que la importación y las pruebas de paridad estén aprobadas.

## Orden técnico de corte

1. Aplicar la migración en un proyecto de pruebas y ejecutar las pruebas estáticas.
2. Ejecutar ambos importadores con su modo por defecto `dry-run`; revisar hashes y manifiestos.
3. Autorizar `--apply --confirm` por lotes, primero documentos y después medios.
4. Añadir a cada ruta un lector de `operational-store` con comprobación de paridad contra JSON; no habilitar escritura remota hasta que ambas lecturas coincidan.
5. Activar lectura/escritura Supabase con una variable de corte explícita y mantener JSON como respaldo de solo lectura durante una versión.
6. Validar local, preview y producción con el mismo commit limpio; solo entonces retirar fallbacks, nunca borrar las copias históricas sin una autorización separada.
