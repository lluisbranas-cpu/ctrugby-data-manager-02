# Fase 2 — Almacenamiento sencillo

Fecha: 25-09-2026. Estado: definición terminada; almacenamiento todavía no contratado, conectado ni migrado.

## Criterio principal

Priorizar una aplicación sencilla y mantenible. El usuario acepta volver a cargar datos: no construir una sincronización compleja ni recuperar cada edición histórica a cualquier coste. Conservar la copia anterior como referencia. Un dato pendiente no se presenta como migrado.

## Solución propuesta

Next.js en Vercel para la aplicación. Supabase para una base PostgreSQL, acceso de administrador y archivos. Es una propuesta técnica para la siguiente fase; no se han creado cuentas ni servicios. Antes de conectarlos se comprobarán cuenta disponible, región y capacidad, sin contratar nada automáticamente.

Una sola fuente de verdad: la nueva base. Google Sheets y los JSON antiguos sirven para importar datos; no habrá sincronización bidireccional. localStorage solo guardará preferencias de interfaz, nunca las fichas.

Dos almacenes de archivos:

| Almacén | Contenido | Acceso |
| --- | --- | --- |
| Público | Fotos preparadas, escudos, camisetas y medios aprobados para mostrarse | Lectura pública; escritura solo administrador |
| Privado | Originales, borradores, documentos y PDF con información privada | Solo administrador autenticado |

La base guarda campos y referencias a archivos; los archivos se guardan en Storage, no dentro de las tablas ni del repositorio.

## Datos y permisos

Empezar con dos tipos de acceso: visitante y administrador. Sin equipos, roles técnicos ni asignaciones por jugador en esta etapa.

- Visitante: fichas y campos expresamente publicados.
- Administrador: crear, editar, cargar archivos y consultar datos privados.
- Toda ficha importada empieza pendiente de publicación.
- Datos sin clasificación clara permanecen privados hasta revisarlos.

Separar en tablas los datos publicables y privados. La API pública devuelve una lista explícita de campos de fichas publicadas. El servidor verifica la sesión y el permiso para cada operación privada o escritura. Activar permisos de base/RLS con denegación por defecto; iniciar sesión por sí solo no convierte a un usuario en administrador.

Públicos tras revisión: nombre deportivo, categoría, club, trayectoria, hitos y fotos seleccionadas; información institucional de clubs y federaciones.

Privados: evaluaciones, nutrición, peso, altura, contactos personales, notas internas, rolDecisor y observaciones. Revisar año de nacimiento, correo institucional y datos de staff antes de publicar.

No importar al cliente conjuntos completos que mezclen campos públicos y privados. No reutilizar las cabeceras de autenticación simulada ni el acceso libre de localhost de la app anterior. Claves administrativas solo en servidor. Respuestas privadas sin caché compartida; documentos privados mediante descarga autorizada, no URL pública.

## Tablas iniciales

Crear únicamente las tablas necesarias al incorporar cada módulo:

| Tabla o grupo | Contenido |
| --- | --- |
| Jugadores y datos privados de jugador | Identidad deportiva; información privada separada |
| Clubs y federaciones | Datos institucionales; notas/contactos internos separados |
| Trayectoria | Jugador, club, temporada y posición; admite varios clubs por temporada |
| Participaciones | Jugador, año y actividad conocida |
| Hitos | Tipo, temporada y jugador/club cuando se conoce |
| Evaluaciones privadas | Jugador, temporada, métricas y notas |
| Archivos | Propietario, uso, clave de Storage, visibilidad y orden |

Conservar IDs existentes cuando sean válidos. Relacionar mediante IDs, no por nombre. Los registros ambiguos quedan pendientes; no unir homónimos automáticamente. No inventar participaciones a partir de un total: conservar el total histórico identificado como tal hasta cargar su detalle.

Usar claves foráneas y restricciones de duplicados. Una versión por registro permite detectar ediciones simultáneas sin añadir un sistema complejo de historial. Staff y relaciones adicionales se incorporarán cuando haga falta su módulo.

## Qué podemos aprovechar

Inspección del catálogo local, no de los almacenes activos:

- app/players-data.json: 373 jugadores.
- app/clubs-data.json: 219 clubs.
- app/federations-data.json: 43 federaciones.
- app/milestones-data.json: 3058 hitos; existe además rwc-2025-spain.json.
- app/staff-data.json: 44 registros, reservados para su módulo.
- Archivos de temporadas, participaciones y fotos en app/ y public/.

También existen ediciones en localStorage, dos tablas D1 (player_overrides y club_verifications), archivos en un bucket y una posible fuente remota de clubs. No se han exportado ni comprobado sus valores activos.

No intentar reunir automáticamente todas esas fuentes. Importar primero los JSON limpios. Si un dato importante solo existe en navegador, D1, bucket o fuente remota, recuperarlo puntualmente si resulta sencillo; en caso contrario, anotarlo como pendiente de recarga. No sobrescribir una edición nueva con una importación antigua.

No copiar indiscriminadamente public/: clasificar las fotos que realmente se van a utilizar. Las evaluaciones existentes pueden recargarse después mediante un flujo privado.

## Fotos y archivos

Conservar el original y trabajar sobre una copia. Registro sencillo: ID, entidad propietaria, función, clave de archivo, tipo, tamaño, dimensiones, visibilidad y posición en galería. Claves únicas evitan sobrescribir otras fotos.

- Ficha y temporada: PNG 300 × 300, círculo con alfa real, sin damero ni relleno de esquinas.
- Cabecera: foto independiente sin fondo, cabeza completa y presentación hasta debajo del pecho. Si falta, marcar pendiente; no usar la foto circular como sustituto.
- Camisetas: máximo 800 px en el lado mayor y 900 KB (900 000 bytes), sin ampliar, conservando proporciones y alfa. Sin generación ni eliminación de fondo. Añadir al carrusel sin sustituir fotos anteriores y conservar su orden.
- Validar formato real, tamaño y permisos en servidor. Si la preparación falla, informar; no presentar el original como preparado.
- Cargar primero en privado y publicar solo la copia aprobada. Registrar el vínculo después de confirmar que la carga terminó; un fallo no debe vaciar la galería.

Una carpeta llamada private dentro de un almacén público no protege archivos: los dos almacenes tendrán permisos independientes. Para las copias de seguridad deben respaldarse tanto la base como los archivos; verificar una restauración antes de cargar datos reales.

## Fase 3 — Prueba pequeña

1. Conectar un entorno de pruebas con datos ficticios, un administrador y los dos almacenes.
2. Crear las tablas mínimas de jugadores, clubs y archivos, con sus permisos.
3. Probar una ficha, un club, una temporada y una foto. Añadir una evaluación ficticia para verificar la separación privada.
4. Comprobar: visitante ve solo publicado; visitante no puede escribir ni leer datos privados; administrador puede guardar; foto y transparencia se conservan.
5. Importar un grupo pequeño de datos limpios con IDs estables. Repetir la importación no debe duplicarlos ni reemplazar cambios más recientes.
6. Revisar el resultado y cargar el resto por módulos. Llevar una lista simple de pendientes para recarga manual.

No bloquearemos el avance por una migración exhaustiva. La copia antigua permanece disponible como referencia y las pantallas se modificarán después de validar esta prueba.

## Decisiones conservadas

Interfaz futura: menú mediante botón ☰ en móvil y ordenador, cerrado inicialmente y al elegir sección. Sin barra lateral fija.

Siguiente paso: implementar la prueba pequeña. Para conectar servicios harán falta el proyecto de Supabase y la cuenta administradora; no se necesitan para esta definición.

## Referencias del proveedor

- Control de acceso a Storage: https://supabase.com/docs/guides/storage/security/access-control
- Descargas públicas y privadas: https://supabase.com/docs/guides/storage/serving/downloads
- Permisos de filas (RLS): https://supabase.com/docs/guides/database/postgres/row-level-security

Estas referencias sustentan las capacidades de acceso. La selección del modelo sencillo es una decisión de diseño para CTRugby.
