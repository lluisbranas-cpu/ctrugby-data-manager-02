# Corte operativo a LikidHub

Estado: preparado localmente; ninguna migración, importación ni cambio de ruta ha sido ejecutado.

## Inventario de rutas con dependencia local

| Ruta | Fuente local actual | Entidad | Destino LikidHub | Prioridad | Migración necesaria |
| --- | --- | --- | --- | --- | --- |
| `/api/camisetas` | `data/staging/jerseys`, `public/jerseys` | camisetas | `operational_documents`, `catalog-operational-private` | alta | lectura y escritura |
| `/api/clubs` y `/api/clubs/[id]` | `clubs.json`, players, seasons, milestones | clubs e historial | `catalog_clubs`, `catalog_milestones`, documentos `club/*` | alta | lectura; después escritura de extensiones |
| `/api/clubs/escudo/[id]`, `/paleta/[id]`, `/portada/[id]` | escudos, paletas, portadas | media de club | bucket operativo + `operational_media`; paletas en documentos | alta | importación única; lectura/escritura |
| `/api/clubs/hoja` | agregados locales | exportación de clubs | tablas de catálogo y documentos | media | solo lectura |
| `/api/catalogos` | órdenes/categorías locales indirectas | catálogos auxiliares | `catalog_*`, documentos | media | lectura/escritura |
| `/api/contacto` | `contact-messages.json` | mensajes | `operational_documents/contact/messages` | alta | importación única; lectura/escritura |
| `/api/convocatorias` y `/competicion` | `data/competition/*.json` | convocatorias y temporada | `catalog_callups`, `operational_documents/competition/*` | alta | importación única; lectura/escritura |
| `/api/destacados/hoja`, `/destacados/order` | staff y orden JSON | destacados | `catalog_staff`, `operational_documents/player/featured-order` | media | lectura; escritura del orden |
| `/api/federaciones` | clubs, players, milestones | federaciones y métricas | `catalog_federations`, `catalog_*` | media | lectura |
| `/api/federaciones/escudo/[id]`, `/portada/[id]` | ficheros de medios | media federación | bucket operativo + `operational_media` | alta | importación única; lectura/escritura |
| `/api/hitos`, `/convocatorias`, `/profesionales` | milestones, fuentes, categorías, JSON de selección | hitos y trayectorias | `catalog_milestones`, `catalog_participants`, `milestone_sources`, documentos | alta | lectura/escritura |
| `/api/hitos/profesionales/categorias/[id]/escudo` | escudos locales | escudo de categoría | bucket operativo + índice | media | importación única; lectura/escritura |
| rutas `/api/hitos/importar-*-local` | staging e históricos | importaciones históricas | tablas y bucket existentes | baja | conservar solo como importadores administrativos |
| `/api/jugadores`, `/[id]`, `/alta` | players, seasons, perfiles, contactos | jugador y ficha privada | `catalog_players`, perfiles y contactos existentes | crítica | lectura/escritura |
| `/api/jugadores/foto/[id]`, `/portada/[id]` | fotos/originales/portadas locales | media de jugador | tablas de fotos existentes + bucket operativo + índice | crítica | importación única; lectura/escritura |
| `/api/jugadores/hoja`, `/[id]/pdf` | datos y fotos locales | exportaciones | tablas y Storage | media | lectura |
| rutas `/api/jugadores/importar-*-local` | staging de jugadores | importación histórica | tablas y Storage existentes | baja | conservar solo como importadores administrativos |
| `/api/menu` | JSON de menú y recuentos locales | navegación | documentos `menu/*`, tablas de catálogo | media | lectura |
| `/api/noticias`, `/[id]/imagen`, `/[id]/vista-previa`, `/excel` | `player-news/*.json`, imágenes | noticias | documentos `news/*`, bucket operativo + índice | alta | importación única; lectura/escritura |
| `/api/participaciones`, `/hoja` | seasons, fotos, clubs | participaciones | `player_seasons`, fotos de temporada y catálogo | crítica | lectura/escritura |
| `/api/player-assessments/import-legacy` | JSON externo heredado | evaluaciones | `player_assessments` existente | baja | importador puntual, no ruta operativa |
| `/api/seleccionados/pdf` | tipografía local | plantilla de PDF | `public/fonts` empaquetado | baja | conservar como asset de aplicación, no dato operativo |
| `/api/staff` | `staff.json`, perfiles, destacados, categorías | staff | `catalog_staff`, `staff_*`, documentos | alta | lectura/escritura |
| `/api/staff/escudo/[id]`, `/foto/[id]`, `/portada/[id]` | medios y settings locales | media de staff | bucket operativo + índice; settings en documentos | alta | importación única; lectura/escritura |

Las rutas de acceso, usuarios, clientes, patrocinadores, evaluaciones normales y piloto ya usan Supabase; no tienen un fichero operativo local que migrar.

## Artefactos preparados

- `202611050001_operational_store.sql`: documentos JSON y bucket privado.
- `202611050002_operational_media_index.sql`: índice idempotente de medios y su hash de origen.
- `scripts/import-operational-local-data.mjs`: importación JSON idempotente, `dry-run` por defecto.
- `scripts/import-operational-media.mjs`: importación idempotente de medios, `dry-run` por defecto.
- `scripts/verify-operational-parity.mjs`: compara hashes locales/remotos; solo lee cuando recibe `--remote`.
- `lib/operational-store.ts` y `lib/operational-cutover.ts`: adaptadores para los reemplazos de rutas, con modo local por defecto.

## Orden de ejecución seguro

1. Aplicar ambas migraciones en un proyecto de prueba y ejecutar `npm run test:operational-cutover`.
2. Ejecutar ambos importadores sin argumentos; revisar sus manifiestos y hashes.
3. Ejecutar importación JSON, después media, solo con `--apply --confirm` y una credencial local temporal.
4. Ejecutar `node scripts/verify-operational-parity.mjs --remote`; debe devolver cero diferencias y cero extras antes de activar una ruta.
5. Cambiar rutas por grupos, usando `LIKIDHUB_OPERATIONAL_READ_MODE=supabase` solo tras aprobar paridad: jugadores/participaciones, clubs/federaciones, hitos/staff, y finalmente noticias/medios auxiliares.
6. Validar el mismo commit en local, preview y producción. Conservar JSON e imágenes locales como respaldo de solo lectura durante una versión completa; no borrarlos sin autorización separada.

## Build sin credenciales de escritura

`npm run build` ejecuta únicamente `next build`. Los sincronizadores que escriben permanecen disponibles de forma explícita en `npm run build:with-review-sync` y nunca deben formar parte de CI o del build de Vercel.
