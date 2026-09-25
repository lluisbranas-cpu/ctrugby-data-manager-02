# Prueba mínima de almacenamiento

Ruta de la app: /prueba. Solo datos ficticios. No cambia la portada.
Estado: validada el 25-09-2026 con datos ficticios. No contiene datos reales.
La cuenta del panel Supabase (GitHub) y el usuario administrador de ESTA APP son identidades distintas.

## Conexión
1. Crear un proyecto Supabase de pruebas. Comprobar el plan antes de aceptar cargos.
2. Ejecutar supabase/migrations/202609250001_pilot.sql una sola vez en SQL Editor. Crea solo tablas pilot_* y dos buckets pilot-media-*.
3. En Authentication > Users crear el usuario de prueba. La contraseña la establece el usuario, sin compartirla por chat.
4. Darle acceso desde SQL Editor, sustituyendo el UUID por el ID de ese usuario:
   insert into pilot_private.admins(user_id) values ('UUID-DEL-USUARIO');
5. Crear .env.local (ignorado por Git) con:
   CTRUGBY_PILOT_ENABLED=true
   SUPABASE_URL=https://REFERENCIA.supabase.co
   SUPABASE_PUBLISHABLE_KEY=CLAVE-PUBLICABLE
   Usar clave publicable o anon, nunca service_role/secret. Reiniciar Next.js.
6. Abrir /prueba y entrar con el usuario de Authentication, no con la contraseña de GitHub.

### Recuperación de contraseña

En `/prueba`, usar **He olvidado la contraseña** e introducir el correo del usuario de Authentication. Supabase envía un enlace a `/recuperar`, donde se establece una contraseña nueva de 12 a 128 caracteres. Añadir `http://localhost:3001/recuperar` a las Redirect URLs de Authentication si Supabase rechaza la solicitud.

## Ensayo
- Como visitante, no hay ficha hasta crearla.
- Como administrador, guardar Jugador de prueba / Club de prueba / 2026/2027 y una evaluación ficticia.
- Recargar y verificar los cuatro campos.
- Publicar una imagen de prueba hasta 3 MB. Comprobar PNG 300 × 300 y esquinas transparentes.
- Cerrar sesión: ficha visible, evaluación ausente en UI Y en respuesta /api/prueba.
- Petición anónima directa a pilot_assessments debe denegarse; intento anónimo de escritura, también.
- Otro usuario autenticado sin entrada en pilot_private.admins no debe poder administrar.
- Original de Storage sin autorización no debe descargarse; copia pública sí.
- Dos sesiones editando: guardar una y luego la otra sin recargar debe producir conflicto 409.
- Reiniciar aplicación y verificar persistencia.

## Alcance deliberadamente pequeño
Una ficha fija TEST001 y un club TESTCLUB. Guardado de club/jugador/evaluación en una transacción.
Sin migración, sincronización, registro público, recuperación de contraseña ni gestión de roles.
La sesión dura como máximo una hora; volver a entrar al caducar.
Toda la ficha ficticia es pública: no hay publicación/despublicación de fichas ni borradores en este ensayo.
Los originales quedan privados. Sustituir una foto conserva versiones anteriores; limpieza pendiente antes de uso real.
No cargar datos reales: primero añadir publicación por ficha, gestión de archivos antiguos y verificar todos los permisos.
Si falta configuración, se muestra pendiente de conectar, sin simular guardados.
Fuentes técnicas: https://supabase.com/docs/guides/database/postgres/row-level-security y https://supabase.com/docs/guides/storage/security/access-control

## Verificación realizada (25-09-2026)

Conexión activa a ycppheupweprkyinhwfu. Migración ejecutada y administrador autorizado.
- npm run lint: correcto.
- npm run build: correcto.
- node --env-file=.env.local scripts/test-pilot-access.mjs: correcto contra Supabase real.
- Ensayo SQL con SET LOCAL ROLE authenticated y JWT sub de administrador: guardar y leer notas correcto; versión antigua rechazada sin cambios parciales.
- Mismo ensayo con otro sub: notas invisibles y escritura rechazada. ROLLBACK al finalizar; no deja fichas temporales.
- Pantalla de visitante revisada visualmente y conectada.
- El administrador inició sesión, guardó la ficha, el club y la evaluación ficticios, y publicó una foto de prueba.
- La respuesta pública de `/api/prueba` devuelve la ficha y la URL pública de la foto; no incluye la evaluación privada. Tras cerrar sesión, la pantalla conserva la ficha y la imagen como visitante.
- No hay datos reales migrados.
