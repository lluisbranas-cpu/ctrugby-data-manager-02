# Fase 8 — edición del catálogo mediante hoja

## Objetivo

Permitir que la gestión diaria de clubs y federaciones se haga en una hoja de cálculo, sin convertir la hoja en la base de datos pública. Supabase sigue siendo la fuente operativa y la app conserva sus reglas de publicación y privacidad.

## Plantilla

La plantilla generada está en `outputs/catalogo-sheet-template/catalogo-ctrugby.xlsx`.

- **Clubs**: 219 filas con datos públicos. `Acción` indica si se actualiza una entidad existente o se crea una nueva. Los campos `Activo` y `Publicar` se editan con `Sí` o `No`.
- **Federaciones**: 43 filas con la misma mecánica.
- **Datos privados**: 100 filas de notas, correos o recuentos heredados. No aparecen en la web pública. El archivo debe mantenerse con acceso restringido.
- **Guía**: explica los campos y las reglas de edición.

La hoja se puede abrir en Excel o subir a Google Sheets. Para aplicarla, se descarga como `.xlsx` y se carga desde `/catalogos` con una sesión de administrador.

## Validación y guardado

`/api/catalogos/importar` comprueba antes de guardar:

1. Las pestañas y las columnas necesarias.
2. Formato y unicidad de los IDs.
3. Textos obligatorios, URLs HTTPS, coordenadas y valores `Sí`/`No`.
4. Que una fila marcada como `actualizar` exista y una marcada como `nuevo` no exista.
5. Que el catálogo no haya cambiado desde la exportación de la hoja.

La migración `supabase/migrations/202609250004_catalog_sheet_import.sql` instala una única función protegida. Guarda clubs, federaciones y datos privados en la misma operación de base de datos. Solo puede ejecutarla un usuario de `app_private.admins`.

## Instalación y primer uso

La migración `202609250004_catalog_sheet_import.sql` se ejecutó en Supabase el 25-09-2026. Se comprobó que la función existe y que `authenticated` puede invocarla. La propia función exige además `app_is_admin()` antes de aceptar una importación.

Para el primer uso:

1. Subir la plantilla a Google Sheets si se quiere editar desde el navegador, o abrirla en Excel.
2. Iniciar sesión en `/catalogos`.
3. Descargar la hoja editada como `.xlsx`.
4. Seleccionar ese archivo en **Importar hoja de catálogo**.
5. Pulsar **Importar cambios**.
6. Recargar `/clubs` y `/federaciones` como visitante para comprobar lo publicado.

La importación no borra registros. Para retirar una ficha de la vista pública se usa `Publicar = No`; las eliminaciones se diseñarán expresamente si se necesitan.
