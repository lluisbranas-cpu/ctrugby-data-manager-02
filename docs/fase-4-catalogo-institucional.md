# Fase 4 — Catálogo institucional limpio

Fecha: 25-09-2026. Estado: catálogo cargado en Supabase y aún no publicado.

## Objetivo

Crear el primer catálogo real de la nueva aplicación: clubs y federaciones. Es la referencia para enlazar temporadas, jugadores e hitos mediante IDs, sin depender de coincidencias de texto.

No se ejecuta todavía ninguna importación contra Supabase ni se publica ningún dato real. Esta fase prepara la estructura, el mapeo y la lista de revisiones necesarias.

## Inventario de la copia local

| Fuente | Registros | Identificador | Resultado |
| --- | ---: | --- | --- |
| `app/clubs-data.json` | 219 | `id` | Sin IDs duplicados |
| `app/federations-data.json` | 43 | `id` | Sin IDs duplicados |
| `app/players-data.json` | 373 | `id` | Sin IDs duplicados |
| `app/player-seasons-data.json` | 364 temporadas de 280 jugadores | ID de jugador + año | Base para las relaciones posteriores |

Los clubs mantienen campos institucionales y geográficos: nombre, estado, ciudad, provincia, región, país, fechas, web, Instagram, coordenadas, mapa, nota y referencia de escudo. Las federaciones mantienen nombre, ámbito, territorio, país, web, correo, estado, recuento histórico de clubs y referencia de escudo.

## Modelo de datos que se aplicará

### Clubs

Cada club conservará el ID existente como clave primaria. Se separan los datos que pueden publicarse de las notas de trabajo:

| Campo nuevo | Origen | Visibilidad inicial |
| --- | --- | --- |
| `id`, `name`, `active` | Directo | Público cuando el registro esté publicado |
| `founded`, `disappeared` | Directo, como texto mientras haya formatos distintos | Privado hasta normalizar o revisar |
| `city`, `province`, `region`, `country`, `latitude`, `longitude`, `maps_url` | Directo | Público cuando el registro esté publicado |
| `website`, `instagram` | Directo | Público cuando el registro esté publicado |
| `note` | Directo | Privado por defecto |
| `published`, `version` | Nuevo | Solo administración |

La columna `shield` no se copiará como URL de terceros. Cada escudo aprobado será un archivo propio en Storage, vinculado por la tabla de archivos y publicado solo después de revisarlo.

### Federaciones

También conservan su ID actual. `clubs` es un total heredado y no una relación: se mantiene como `legacy_club_count` para consulta interna, pero el recuento publicado se calculará a partir de las relaciones reales cuando existan.

| Campo nuevo | Origen | Visibilidad inicial |
| --- | --- | --- |
| `id`, `name`, `scope`, `territory`, `country`, `active` | Directo | Público cuando el registro esté publicado |
| `website` | Directo | Público cuando el registro esté publicado |
| `email`, `legacy_club_count` | Directo | Privado por defecto |
| `published`, `version` | Nuevo | Solo administración |

## Relaciones de temporadas revisadas

Las 364 temporadas citan 58 nombres de club. Cuatro entradas no coinciden exactamente con el catálogo y quedarán sin `club_id` hasta que se revisen:

| Jugador | Año | Texto heredado | Tratamiento |
| --- | ---: | --- | --- |
| `CTR0254` | 2025 | `NAAS` | Pendiente: no existe club con ese nombre |
| `CTR0269` | 2025 | `BELENOS RC` | Pendiente: probable referencia a `ESP0146`, pero requiere confirmación |
| `CTR0274` | 2025 | `VF` | Pendiente: abreviatura ambigua |
| `CTR0278` | 2025 | `GIJON RC` | Pendiente: no existe club con ese nombre exacto |

Las demás relaciones no se cargan todavía en esta fase. Cuando se importe el módulo de temporadas, solo se enlazarán las coincidencias revisadas por ID; el texto de origen se conservará como referencia de importación cuando sea necesario.

El archivo antiguo `player-clubs-data.json` usa nombre completo de jugador y nombre de club. Tiene 108 filas y no será una fuente de relaciones automáticas: 35 no tienen coincidencia exacta con los catálogos actuales.

## Secuencia de implementación

1. Añadir las tablas reales de clubs, federaciones y sus notas privadas con RLS de denegación por defecto.
2. Añadir una importación idempotente que acepte solo los JSON limpios, preserve IDs y no actualice registros modificados posteriormente por un administrador.
3. Ejecutar la importación en modo de revisión: todos los registros quedan sin publicar y sin escudos copiados.
4. Revisar una muestra de clubs y federaciones en la interfaz nueva; después habilitar publicación individual o por lote confirmado.
5. Incorporar el módulo de jugadores y temporadas utilizando `club_id`, con los cuatro pendientes anteriores en una lista visible de recarga.

## Preparación local de la importación

El script `scripts/prepare-catalog-import.mjs` valida y prepara una copia local de los catálogos sin hablar con Supabase. La salida queda ignorada por Git para que los datos reales no entren en el repositorio.

Desde la carpeta de esta nueva aplicación:

```powershell
npm run prepare:catalogs -- "C:\CTRugbyApp\Copia_local_2026\01_CTRugby\01_Apps\CTRugby_Data_Manager\app"
```

Si los 219 clubs y las 43 federaciones pasan las validaciones, genera `data/staging/clubs.json`, `data/staging/federations.json`, `data/staging/report.json` y `data/staging/catalog-import.sql`. El SQL inserta solamente IDs que aún no existen, deja todo sin publicar y no sobrescribe ediciones posteriores. El script se niega a sobrescribir una preparación existente. La carga a Supabase será un paso independiente, una vez revisada esta salida.

Verificación realizada el 25-09-2026: el script se ejecutó contra la copia local y preparó correctamente 219 clubs y 43 federaciones sin incidencias. La prueba se hizo en una carpeta temporal, sin cargar datos a Supabase ni incorporar datos reales al repositorio.

## Ejecución en Supabase

La estructura vacía de `202609250002_catalogs.sql` se ejecutó correctamente en el proyecto de Supabase. Después se completaron dos acciones separadas:

1. Se ejecutó `202609250003_catalog_admin.sql`. Copia la autorización del único administrador de la prueba piloto al catálogo real; no crea ni modifica usuarios de Authentication.
2. Se revisó y ejecutó `data/staging/catalog-import.sql` en SQL Editor. Insertó 219 clubs, 43 federaciones, 57 notas privadas de club y 43 notas privadas de federación. El uso de `on conflict do nothing` evita duplicados y no sobrescribe ediciones posteriores.

Comprobación posterior: los 219 clubs y las 43 federaciones siguen con `published = false`; la consulta REST anónima recibe cero clubs. No se ha publicado ningún registro ni se ha subido ningún escudo.

## Criterios de aceptación

- Una segunda importación no duplica clubs ni federaciones.
- Un registro editado en la nueva aplicación no se sobrescribe por una importación antigua.
- Una petición anónima solo devuelve campos públicos de registros publicados.
- Notas, correo de federación y fechas no revisadas no se exponen públicamente.
- No se descarga ni se publica ningún escudo remoto durante la importación.
- Las relaciones ambiguas permanecen pendientes y son trazables.
