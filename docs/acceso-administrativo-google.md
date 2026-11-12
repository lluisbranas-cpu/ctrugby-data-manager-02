# Acceso administrativo con Google

## Estado

La rama prepara el flujo de Google OAuth con PKCE S256, cookie HttpOnly para `state`/verifier y callback de origen fijo. La sesión administrativa solo se crea después de confirmar MFA TOTP y comprobar en el servidor las funciones `app_has_private_access()` y `app_is_admin()`. El acceso por contraseña y MFA no se elimina.

Google permanece desactivado mientras `CTRUGBY_GOOGLE_ADMIN_ENABLED` no sea exactamente `true`. La migración `supabase/migrations/202611060001_admin_google_oauth_mfa.sql` está pendiente: no se ha aplicado ni se ha conectado este cambio a una base de datos.

## Variables de entorno

No se han modificado `.env.local` ni credenciales.

| Variable | Uso |
| --- | --- |
| `SUPABASE_URL` | URL del proyecto Supabase existente. |
| `SUPABASE_PUBLISHABLE_KEY` | Clave pública para Auth y consultas protegidas por RLS; se usa solo desde el servidor en el callback. |
| `CTRUGBY_PUBLIC_URL` | Origen HTTPS canónico en producción, sin ruta ni barra final. En desarrollo se acepta solo `localhost`, `127.0.0.1` o `::1`. |
| `CTRUGBY_GOOGLE_ADMIN_ENABLED` | Activar como `true` únicamente después de terminar la configuración y las pruebas manuales. Por defecto, Google no aparece ni inicia el flujo. |
| `CTRUGBY_SESSION_SECRET` | Secreto de servidor recomendado para cookies firmadas. Si falta, la aplicación conserva el mecanismo existente que usa `SUPABASE_SERVICE_ROLE_KEY` solo en servidor. |
| `SUPABASE_SERVICE_ROLE_KEY` | Sigue siendo exclusivamente de servidor para operaciones administrativas existentes; nunca usar un prefijo `NEXT_PUBLIC_` ni enviarla al navegador. No es una credencial de Google. |

El Client ID y Client Secret de Google se guardan en la configuración del proveedor Google de Supabase Auth, no en el código ni en variables del navegador.

## URLs y configuración manual

1. En Google Cloud, configurar el origen autorizado del sitio (`https://<dominio-produccion>` y, solo para pruebas, `http://localhost:3000`).
2. En la credencial OAuth web de Google, registrar como URI de redirección el callback de Supabase que muestra el panel del proyecto: `https://<project-ref>.supabase.co/auth/v1/callback`. Para Supabase local, usar la URL de callback local que indique su configuración.
3. En Supabase → Authentication → Providers → Google, introducir el Client ID y Client Secret. Mantener el proveedor Email y el MFA TOTP habilitados.
4. En Supabase → Authentication → URL Configuration, añadir el callback de esta aplicación a la lista permitida:
   - `https://<dominio-produccion>/api/acceso/google/callback?state=*`
   - `http://localhost:3000/api/acceso/google/callback?state=*`
   - Si se usa otra dirección local: añadir por separado `http://127.0.0.1:3000/api/acceso/google/callback?state=*` o `http://[::1]:3000/api/acceso/google/callback?state=*`.
5. Configurar `CTRUGBY_PUBLIC_URL` con el origen canónico de producción. No se aceptan destinos `redirect_to` arbitrarios ni se confía en un parámetro de retorno enviado por el usuario.
6. Revisar y, si se autoriza, aplicar manualmente `supabase/migrations/202611060001_admin_google_oauth_mfa.sql` en la base existente. No cargar datos ni ejecutar importaciones. El cambio habilita Google + TOTP solo cuando `app_login_contacts()` identifica un contacto de administrador activo; las cuentas de jugador/club conservan sus reglas existentes.
7. Solo después de comprobar el flujo de extremo a extremo, activar `CTRUGBY_GOOGLE_ADMIN_ENABLED=true`. Mantener la contraseña + TOTP hasta que esas pruebas terminen correctamente.

La app no confiere el rol por el correo recibido de Google: el callback obtiene el usuario con Supabase Auth, comprueba los contactos de acceso en base de datos y exige MFA. La sesión final vuelve a validar `app_has_private_access()` y `app_is_admin()` en el servidor. Las cookies de transacción son HttpOnly y SameSite=Lax para permitir el retorno OAuth; la cookie de sesión existente sigue HttpOnly, SameSite=Strict y Secure en producción.

## Pruebas manuales pendientes

- Administrador con cuenta Google asociada a un contacto activo y TOTP: completar PKCE, MFA y confirmar acceso administrativo.
- Cuenta Google no autorizada, acceso revocado o proveedor cancelado: denegar y no dejar sesión privada.
- Repetir con `state` ausente, alterado o caducado y con `redirect_to` fuera de la lista permitida: denegar.
- Confirmar que contraseña + TOTP sigue funcionando y que un administrador sin TOTP no obtiene acceso.
- Confirmar que el inicio de sesión de jugador/tutor y representante de club no se convierte en acceso de administrador.

Referencias oficiales:

- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/social-login/auth-google
