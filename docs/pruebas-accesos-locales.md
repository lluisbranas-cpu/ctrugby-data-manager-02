# Verificación de acceso local aislado

Rama: `fix/aislamiento-accesos-local-2026-11-06`. No desplegar en producción sin ejecutar pruebas.

## Cambio funcional
- Abrir `localhost:3000` sin cookies ya **no** concede privilegios de administrador.
- El botón **Entrar como administrador local** hace un POST de mismo origen a `/api/acceso` y recibe una cookie HTTP-only firmada y limitada a ocho horas.
- La cookie se invalida al elegir Público, Privado o Clubs, al cerrar sesión y al iniciar Google OAuth.
- La ruta heredada GET `/acceso/local` solo redirige a `/acceso`; no concede privilegios.
- En producción no puede emitirse ni validarse la sesión de administrador local.

## Comprobaciones desde localhost (sin modificar datos)
1. Iniciar el servidor dev y abrir ventana privada en `http://localhost:3000/api/acceso/estado`. Esperado: `admin:false` y `authenticated:false`.
2. Ir a `/acceso` y pulsar **Entrar como administrador local**. Consultar `/api/acceso/estado`. Esperado: `admin:true`, `authenticated:true`.
3. Volver a `/acceso` y pulsar **Acceso público**. Consultar estado: `admin:false`. Comprobar que no hay botones ni acciones de edición autorizadas.
4. Volver a entrar como Administrador local y pulsar **Acceso privado**. Consultar estado antes de identificarse: `admin:false`. No rellenar credenciales reales para esta prueba.
5. Repetir entrando como Administrador local y pulsando **Acceso por club**. Antes de identificarse: `admin:false`.
6. Visitar `/acceso/local` en ventana privada. Debe redirigir a la pantalla de acceso, manteniendo `admin:false`.
7. Comprobar una compilación local con `npx tsc --noEmit` y `npm run build`. Resolver los errores antes de mezclar la rama.
8. Probar posteriormente usuarios reales de Privado y Clubs y verificar las reglas RLS a nivel de servidor (lecturas y escrituras permitidas/denegadas), no solo ocultación de botones.

## Advertencias
- Con una misma Supabase en local y producción, las escrituras realizadas en local también son reales. Las pruebas propuestas son de **solo lectura**, salvo las operaciones de sesión.
- No añadir el servicio `SUPABASE_SERVICE_ROLE_KEY` al navegador ni a variables públicas.
- Esta rama se creó a partir de `fix/accesos-2026-11-06`. No contiene cambios de la rama separada de migración de IDs `CTR → JUG`.
- No se ha verificado el resultado HTTP de `localhost` desde GitHub; la validación en el ordenador del usuario está pendiente.
