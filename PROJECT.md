# CTRugby Data Manager 02

## Propósito

Nueva base de CTRugby Data Manager. El objetivo vigente es publicarla y, durante esa preparación, reorganizar los datos para que puedan evolucionar sin depender de la copia local anterior.

## Estado recuperado

- Repositorio: `lluisbranas-cpu/ctrugby-data-manager-02`.
- Base: Next.js 16, React 19, TypeScript y Tailwind CSS.
- Git: un único commit inicial (`cab266a`, 24 de septiembre de 2026).
- Pantalla actual: bienvenida de CTRugby Diseño App en `app/page.tsx`; aún no se ha incorporado ninguna portada a `public/`.
- El repositorio no contiene todavía módulos de negocio ni una estructura de datos migrada.
- Se inició el proceso de publicación en Vercel. La configuración y una URL de producción no están guardadas en el repositorio, por lo que deben verificarse antes de publicar cambios.

## Decisiones de diseño recuperadas

- Identidad: negro/antracita, blanco y rojo CTRugby.
- Portada: representar el recorrido de niño y niña desde la iniciación hasta el rugby adulto, con una evolución sutil de siluetas a juego real.
- Elementos: mapa mundial con mayor presencia de puntos en España, y los cuatro pilares: Campus, Jugadores, Clubs e Hitos.
- No usar dos balones ni una silueta adicional detrás de la palabra Rugby.

## Plan de publicación y datos

1. Inventariar y normalizar las entidades y relaciones del proyecto anterior.
2. Definir el almacenamiento público, privado y multimedia para la versión online.
3. Migrar una copia de prueba y verificar los datos antes de cambiar pantallas.
4. Preparar variables de entorno, autenticación de edición y almacenamiento de archivos.
5. Desplegar una versión de pruebas y validarla.
6. Migrar datos reales y abrir la versión pública.

## Regla de trabajo

Todo desarrollo nuevo relacionado con esta versión se hace en `C:\ctrugby-data-manager-02`. La copia anterior solo se consulta como fuente de datos y comportamiento durante la migración.

## Actualización acordada — 25-09-2026

- Priorizar simplicidad. El usuario acepta volver a cargar datos; no construir una migración exhaustiva ni sincronización bidireccional.
- Fase 2 definida en [docs/fase-2-almacenamiento.md](docs/fase-2-almacenamiento.md): propuesta de una base PostgreSQL/Supabase, dos almacenes (público y privado) y un administrador inicial. Servicios todavía no conectados.
- Importar catálogos limpios; mantener una lista de datos pendientes de recarga. La copia anterior se conserva como referencia.
- Siguiente paso: fase 3, una prueba pequeña antes de ampliar la carga o cambiar pantallas. Preparar únicamente la autenticación y almacenamiento mínimos que esa prueba requiera.
- Menú mediante botón ☰ en ordenador y móvil, cerrado al entrar y al seleccionar sección; sin barra lateral fija.
- Existe public/CTRugby-data-manager-Portada.png; su integración en pantalla sigue pendiente.

## Fase 3 — estado del 25-09-2026

- Prueba implementada en /prueba; servidor de esta sesión en http://localhost:3001/prueba.
- Proyecto Supabase conectado: ycppheupweprkyinhwfu (organización CTRugby, región Irlanda). El panel conserva el nombre inicial del proyecto.
- Instaladas tablas pilot_clubs, pilot_players, pilot_assessments y pilot_private.admins, funciones y permisos; buckets pilot-media-public y pilot-media-private.
- Usuario administrador creado por el usuario y autorizado expresamente. No se guarda su contraseña en código ni documentación.
- Variables de conexión en .env.local, ignorado por Git. No se usa service_role.
- Comprobaciones superadas: lint, build, API anónima, bloqueo de escritura/fotos y lectura privada; ensayo SQL de administrador, usuario sin permisos, conflicto de versión y rollback atómico.
- Prueba visual autenticada completada: el administrador inició sesión, guardó la ficha, club y evaluación ficticios, y publicó una foto de prueba.
- Prueba pública completada: al cerrar sesión, la ficha y la foto siguen visibles; la evaluación privada no se expone.
- Recuperación de contraseña disponible desde /prueba mediante el enlace de Supabase Authentication. La URL local de recuperación es /recuperar.
- La Fase 3 queda validada. No se han migrado datos reales ni se ha cambiado la portada.
- Ver docs/fase-3-prueba.md. No se han migrado datos reales ni cambiado la portada.

## Fase 4 — estado del 25-09-2026

- Catálogo institucional inventariado en `docs/fase-4-catalogo-institucional.md`: 219 clubs y 43 federaciones, todos con IDs estables y sin duplicados.
- Ejecutadas en Supabase las migraciones `supabase/migrations/202609250002_catalogs.sql` y `202609250003_catalog_admin.sql`. Crean la estructura real de clubs y federaciones, separan notas privadas y autorizan al administrador de la prueba para este catálogo.
- Preparado y validado `scripts/prepare-catalog-import.mjs`: transforma los JSON limpios de la copia local sin copiar escudos remotos. Su salida es local e ignorada por Git. La importación ya se ejecutó de forma idempotente.
- Quedan cuatro textos de temporadas sin relación automática (`NAAS`, `BELENOS RC`, `VF` y `GIJON RC`); permanecen pendientes hasta revisión.
- Cargados 219 clubs, 43 federaciones, 57 notas privadas de club y 43 notas privadas de federación. Todos los catálogos permanecen sin publicar; una consulta anónima devuelve cero clubs.
- Validación de esta fase: preparación local correcta, consulta anónima sin resultados y `npm run lint` correcto. ESLint ignora ahora también las carpetas de compilación locales `.next-*`.
- Siguiente paso: crear la interfaz de revisión y publicación controlada de clubs y federaciones, antes de cargar jugadores, temporadas, hitos o archivos.

## Fase 5 — estado del 25-09-2026

- Implementadas `/catalogos` y `/api/catalogos`: vista visitante de datos publicados y panel de administración con búsqueda, filtros y publicación individual de clubs y federaciones.
- La API exige `app_is_admin` para leer los indicadores privados o cambiar publicación. La respuesta pública no contiene notas internas ni correos de federaciones.
- Comprobado visualmente sin sesión: inicialmente cero registros visibles mientras todo permanecía pendiente; tras publicar `AND0002` y `ARG0001`, la vista visitante muestra exactamente esos dos clubs. `AND0001` se retiró y no aparece. El cambio de publicación usa versión para detectar conflictos de edición.
- `npm run lint` y `npm run build` correctos.
- Siguiente paso: iniciar sesión en `/catalogos`, revisar y publicar el primer registro institucional; después verificarlo de nuevo como visitante.

## Fase 6 — Clubs públicos — estado del 25-09-2026

- Implementados `/clubs` y `/api/clubs`. La página recupera exclusivamente los clubs publicados mediante RLS; no consume JSON de la copia anterior.
- Estructura trasladada de la referencia: cabecera oscura, portada, tarjetas de territorio, búsqueda, listado, mapa de puntos y ficha de detalle.
- Verificados los dos clubs actualmente publicados (`AND0002` y `ARG0001`), incluida la apertura de ficha. Los campos heredados sin valor no se muestran en la ubicación.
- `npm run lint` y `npm run build` correctos.
- Siguiente paso: completar el mismo recorrido público para federaciones o ampliar la ficha de club con escudos y fotografías aprobadas.

## Fase 7 — Federaciones públicas — estado del 25-09-2026

- Implementados `/federaciones` y `/api/federaciones`. La pantalla pública usa únicamente los registros publicados de `catalog_federations`; las 43 federaciones importadas permanecen invisibles hasta revisarlas.
- La estructura mantiene la identidad del directorio: cabecera oscura, indicadores, buscador, listado y ficha. La portada incorpora enlaces a Clubs y Federaciones.
- Comprobados `npm run lint`, `npm run build` y la vista visitante: con cero federaciones aprobadas se muestra el estado vacío y no se expone ningún registro pendiente.
- Archivos locales de preparación: `data/staging/clubs.json`, `data/staging/federations.json`, `data/staging/catalog-import.sql` y `data/staging/report.json`. Son una copia de trabajo ignorada por Git; la fuente operativa es Supabase. No se han generado hojas de cálculo (`.xlsx`, `.csv` o Google Sheets).
- Siguiente paso: revisar y publicar una federación desde `/catalogos`; comprobar su presencia en `/federaciones`. Después, preparar el despliegue público con las variables de Supabase en el proveedor de alojamiento.

## Fase 8 — Edición mediante hoja — estado del 25-09-2026

- Creada la plantilla `outputs/catalogo-sheet-template/catalogo-ctrugby.xlsx`: 219 clubs, 43 federaciones y 100 datos privados en pestañas separadas. Se puede usar en Excel o subir a Google Sheets.
- Implementados `/api/catalogos/importar` y el formulario de administración en `/catalogos`. Lee un archivo `.xlsx`, valida los datos antes de guardarlos y mantiene los cambios de publicación dentro del mismo flujo.
- Añadida la migración `supabase/migrations/202609250004_catalog_sheet_import.sql`. Crea una función atómica para que el administrador importe datos públicos y privados sin exponer el esquema privado por REST.
- Comprobados `npm run lint`, `npm run build` y la plantilla de hoja mediante inspección y renderizado de sus cuatro pestañas.
- Ejecutada la migración 004 en Supabase SQL Editor. Se verificó que la función `admin_import_catalog_sheet` existe y que `authenticated` tiene permiso de ejecución; la función exige además `app_is_admin()`.
- Pendiente: primera importación de prueba desde `/catalogos` con un archivo `.xlsx` editado y posterior comprobación como visitante.
- Ver `docs/fase-8-hoja-catalogo.md`.
