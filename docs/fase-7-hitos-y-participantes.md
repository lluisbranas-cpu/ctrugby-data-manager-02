# Fase 7 — Hitos, participantes históricos y staff

La fuente antigua contiene 3.058 hitos: 3.004 de jugadores y 54 de staff. Se importarán primero de forma privada.

Los hitos no se fusionan por nombre con las 373 fichas nuevas. Solo 149 registros ya incluyen un ID CTR vigente y se enlazan directamente. El resto se crea como participante histórico independiente, conservando su nombre y cada participación para revisión posterior. Así se evita convertir coincidencias de nombre en relaciones erróneas.

Las 319 métricas heredadas de participación usan IDs con ceros adicionales. Se normalizan de forma determinista y las 319 corresponden a jugadores actuales; sus contadores y años se conservan en el esquema privado.

La preparación local se ejecuta con:

```powershell
npm run prepare:milestones -- "C:\CTRugbyApp\Copia_local_2026\01_CTRugby\01_Apps\CTRugby_Data_Manager\app" "C:\ctrugby-data-manager-02\tmp\milestone-staging-check"
```

La carga a Supabase requerirá una confirmación separada porque incluye nombres, historial deportivo, ámbito, categoría, club y posición de participantes históricos.
