# Fase 6 — Jugadores y temporadas

## Estado

La estructura está preparada para migrar las fichas del Manager, pero no se ha enviado ningún dato de jugadores a Supabase. La carga inicial será privada y no publicará fichas automáticamente.

## Modelo

`catalog_players` conserva el identificador CTR y el nombre que podrá mostrarse cuando exista una autorización de publicación. `player_profiles` mantiene en el esquema privado la categoría y el año de nacimiento. `player_seasons` también es privado: vincula cada temporada al `club_id` ya existente y conserva el texto de club heredado para su trazabilidad.

Las temporadas sin relación fiable no se enlazan: `CTR0254 / 2025 / NAAS`, `CTR0269 / 2025 / BELENOS RC`, `CTR0274 / 2025 / VF` y `CTR0278 / 2025 / GIJON RC`. La temporada sin club indicado también queda sin vínculo.

## Preparación local

```powershell
npm run prepare:players -- "C:\CTRugbyApp\Copia_local_2026\01_CTRugby\01_Apps\CTRugby_Data_Manager\app"
```

El script valida los 373 jugadores y las 364 temporadas y genera en `data/staging/` los JSON, el informe y el SQL de carga. Esa carpeta no forma parte de Git y el SQL contiene datos personales; se revisará antes de cualquier envío a Supabase.

## Secuencia

1. Ejecutar la migración vacía `202609250005_players.sql` en Supabase.
2. Preparar y revisar localmente el informe de importación.
3. Con autorización expresa, importar las fichas y temporadas privadas.
4. Crear la pantalla de revisión de jugadores y decidir el criterio de publicación de cada ficha.