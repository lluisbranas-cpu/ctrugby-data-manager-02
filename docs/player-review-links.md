# URL privada de edición por jugador

La ficha muestra a administración un campo de solo lectura «URL de edición». No requiere un botón y no aparece en el PDF. Los enlaces conceden acceso a la hoja de revisión del jugador; no se incluyen en respuestas de catálogos públicos.

`npm run build` ejecuta la preparación antes de compilar. En producción Vercel crea únicamente los enlaces que falten en el bucket privado configurado y conserva las URL existentes. Los enlaces permanecen fuera del sistema de archivos temporal de Vercel. Si falla el catálogo o el almacenamiento privado, la publicación se detiene. Las vistas previas no modifican el registro de producción.

Configuración: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, bucket privado `CTRUGBY_REVIEW_BUCKET` (por defecto `catalog-media-private`). `CTRUGBY_PUBLIC_URL` fija el dominio de los mensajes; si falta se utiliza `VERCEL_PROJECT_PRODUCTION_URL` y finalmente el origen de la petición en la ficha local. No debe configurarse un dominio de vista previa para mensajes reales.

La copia local se guarda en `data/staging/player-edit-urls.json` y conserva también los tokens y códigos en sus archivos privados existentes. Esa carpeta está excluida de Git. No se debe copiar a `public` ni compartirla.

- `npm run prepare:review-links`: prepara la copia local con todos los jugadores actuales.
- `npm run sync:review-links`: recupera los enlaces persistentes del almacén privado, crea los que falten y actualiza la copia local con los mismos códigos.
- `node scripts/sync-player-review-links.mjs --publish`: prepara una publicación fuera de Vercel con almacenamiento persistente.

Una compilación en la nube no puede escribir en el disco del ordenador: tras publicar desde la nube, ejecutar la sincronización local para actualizar esa copia. Los registros remotos existentes tienen prioridad frente a una copia local antigua.

Los enlaces conservan el plazo de validez existente, actualmente un año. Este cambio no envía mensajes ni publica la aplicación.

Validación: `node --test scripts/test-player-review-links.mjs` comprueba conservación en publicaciones repetidas, migración local, concurrencia, reparación de índices y fallos de almacenamiento.

Acceso directo: el código personal y su token activo autorizan la revisión de ese jugador sin iniciar sesión. La creación de enlaces sigue reservada a administración. Las fotos de revisión usan una cookie HttpOnly limitada a /api/jugadores y al jugador del token; se comprueban vigencia y estado en cada petición. No concede acceso al directorio ni a otras fichas.

Las fichas de revisión se sincronizan en objetos privados player-review-data/<jugador>.json. npm run build ejecuta sync:review-data cuando existen los datos locales; una compilación en la nube sin staging conserva la copia persistente. El servidor usa esta copia cuando no tiene archivos locales. Tras cambios locales se puede ejecutar npm run sync:review-data para actualizar las fichas privadas sin publicar el código.

Cada envío genera una copia PDF privada, disponible para descarga desde el enlace y guardada junto a la revisión. Desde el equipo que tiene Google Drive sincronizado, `npm run sync:review-pdfs` copia los PDF nuevos en `CTRUGBY_PLAYER_EDIT_DRIVE_DIR/revisiones-publicadas/`.
