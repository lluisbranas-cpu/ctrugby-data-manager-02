# Fase 5 — Revisión y publicación de catálogos

Estado: pantalla y API implementadas el 25-09-2026.

La ruta `/catalogos` tiene dos comportamientos:

- Como visitante muestra únicamente clubs y federaciones con `published = true`.
- Como administrador permite buscar, revisar y publicar o retirar cada registro de forma individual.

El acceso usa la misma cuenta de Authentication de la prueba piloto, pero el servidor exige el permiso independiente `app_is_admin`. En esta primera pantalla las notas privadas y los correos de federación no se transportan por la API: seguirán en su almacén privado hasta que se cree una pantalla específica para tratarlos.

Cada cambio de publicación incluye la versión del registro. Si otra sesión lo cambia antes, el servidor devuelve un conflicto y obliga a recargar, en lugar de sustituir su estado.

## Verificación

- Sin sesión, `/catalogos` muestra únicamente los registros publicados. La comprobación inicial con todos pendientes devolvió 0 clubs y 0 federaciones.
- Tras la revisión manual, se publicaron `AND0002` (ISARDS Andorra) y `ARG0001` (Coihues Rugby Y Hockey); la vista visitante muestra exactamente esos dos clubs. `AND0001` (VPC Andorra Rugby XV) se retiró y no aparece.
- `npm run lint` y `npm run build` terminan correctamente.

## Siguiente uso

1. Abrir `http://localhost:3001/catalogos`.
2. Entrar con el usuario administrador de la app.
3. Buscar un registro, revisar su información y pulsar **Publicar**.
4. Cerrar sesión y comprobar que solo los registros publicados aparecen en la vista pública.

La publicación de un registro ya no requiere SQL. No se habilita carga de escudos ni se incorporan todavía jugadores, temporadas o hitos.
