# Acceso privado por correo y autorizaciones a clubes

Estado: implementación local. No se ha aplicado esta actualización en Supabase ni publicado en Vercel. No se han enviado códigos reales ni concedido autorizaciones a clubes.

## Comportamiento

- Público: entrada directa al catálogo publicado.
- Jugador o tutor: introduce un correo ya asociado en `player_private_contacts`, confirma el código recibido y elige una ficha si tiene varias. La sesión privada queda limitada a esa ficha durante una hora. El resto conserva la lectura pública.
- Club: un administrador vincula su representante desde la ficha del club. El representante confirma su correo y entra en la lista de jugadores con autorización activa a ese club. No puede concederse permisos ni editar jugadores.
- Consentimiento: el jugador o tutor, desde su ficha privada, elige un club y marca la autorización expresa. Incluye las necesidades alimenticias y médicas visibles en la ficha privada; no incluye contactos, DNI ni evaluaciones internas. Puede retirarla desde la misma sección. Se conserva un registro de cada cambio y su autor.
- Administrador: conserva correo, contraseña y TOTP. Confirmar solo un correo nunca concede el rol de administrador.

Cada consulta privada comprueba el permiso en la base de datos. Cambiar el identificador de la URL no concede acceso. La retirada del consentimiento o de la cuenta del representante bloquea las siguientes consultas; la información que ya se haya mostrado no puede retirarse de la memoria del destinatario.

## Activación pendiente

1. Revisar y aplicar `supabase/migrations/202610210002_email_and_club_access.sql` en el proyecto Supabase correcto. La migración no concede consentimientos existentes ni convierte a ningún club en administrador. La apertura del catálogo público es una migración separada: `202610210001_public_consultation.sql`.
2. Configurar un remitente SMTP propio en Authentication → Emails → SMTP Settings. El 21 de octubre de 2026 se comprobó que el proyecto mostraba «Set up custom SMTP to edit templates». El remitente de prueba de Supabase no sirve para entregar códigos a todos los jugadores/tutores.
3. En Magic link or OTP y Confirm sign up, incluir `{{ .Token }}` en el correo. Conservar el enlace existente `{{ .ConfirmationURL }}` en Confirm sign up para no romper el registro de invitados. Hay una plantilla de ejemplo en `supabase/templates/private-access-email.html`.
4. Mantener activado el proveedor Email y confirmar que el registro por correo permite crear cuentas al confirmar un correo ya asociado a una ficha. La aplicación comprueba la asociación antes de enviar y vuelve a comprobarla después de verificar el código.
5. Confirmar en el entorno servidor SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY y CTRUGBY_SESSION_SECRET (o la clave del servidor como alternativa para las cookies firmadas). Nunca exponer la clave de servicio al navegador.
6. Probar con correos de prueba autorizados: jugador, tutor, representante del club, otro club y correo sin asociación. No marcar correos/teléfonos como verificados manualmente para sustituir la confirmación real.
7. Publicar el código solamente cuando se autorice. Hasta entonces, la web de Vercel conserva su comportamiento anterior.

Los códigos se comprueban con Supabase Auth. La solicitud de acceso de la aplicación caduca en diez minutos; la sesión privada, en una hora. La opción de teléfono se guarda como contacto, pero esta implementación envía la confirmación al correo; no envía SMS.

## Verificaciones realizadas

- ESLint y TypeScript sin errores en la implementación final.
- 36 comprobaciones con PostgreSQL aislado: alcance de una sola ficha, acceso de club sin consentimiento bloqueado, consentimiento explícito, retirada inmediata para futuras consultas, separación entre clubes, caducidad, cambio de correo asociado, denegación de escritura directa y TOTP de administrador conservado.
- Peticiones HTTP locales: correo inválido rechazado, código sin solicitud rechazado, autorización de jugador anónimo rechazada y configuración de club sin administrador rechazada.
- Revisión de la pantalla local: Público, Privado por correo y administrador con contraseña separados.
- Pendiente: aplicar SQL en Supabase, configurar remitente y plantillas, verificar entrega real de códigos y probar con sesiones reales de jugador/tutor/club. Los datos reales no se han usado para conceder permisos de prueba.

Referencias oficiales:

- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/auth/auth-email-templates
- https://supabase.com/docs/guides/auth/auth-smtp
