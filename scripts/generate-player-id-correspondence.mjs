import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import nextEnv from "@next/env";

const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
const out = path.join("reports", `player-id-reconciliation-${date}`);
nextEnv.loadEnvConfig(process.cwd());
const normalize = (value) => String(value ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const csv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const localPlayers = JSON.parse(await readFile("data/staging/players.json", "utf8"));
const localSeasons = JSON.parse(await readFile("data/staging/player-seasons.json", "utf8"));
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) throw new Error("Faltan credenciales locales de solo lectura de Supabase.");
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const all = async (table, columns, schema = "public") => { const result = await db.schema(schema).from(table).select(columns); if (result.error) throw new Error(`${table}: ${result.error.message}`); return result.data ?? []; };
const optional = async (...args) => { try { return await all(...args); } catch { return []; } };
const [remotePlayers, remoteProfiles, remoteSeasons, remoteClubs] = await Promise.all([
  all("catalog_players", "id,first_name,last_name"), optional("player_profiles", "player_id,birth_year", "app_private"), optional("player_seasons", "player_id,season_year,club_id,legacy_club_name", "app_private"), all("catalog_clubs", "id,name"),
]);
const profiles = new Map(remoteProfiles.map((row) => [row.player_id, row]));
const clubNames = new Map(remoteClubs.map((row) => [row.id, normalize(row.name)]));
const localById = new Map(localPlayers.map((row) => [row.id, row]));
const seasonsByLocal = new Map(); for (const row of localSeasons) seasonsByLocal.set(row.player_id, [...(seasonsByLocal.get(row.player_id) ?? []), row]);
const seasonsByRemote = new Map(); for (const row of remoteSeasons) seasonsByRemote.set(row.player_id, [...(seasonsByRemote.get(row.player_id) ?? []), row]);
function score(local, remote) {
  const name = normalize(`${local.first_name} ${local.last_name}`); const remoteName = normalize(`${remote.first_name} ${remote.last_name}`);
  let points = name === remoteName ? 100 : 0; const reasons = name === remoteName ? ["nombre completo normalizado"] : [];
  const profile = profiles.get(remote.id); if (local.birth_year && profile?.birth_year === local.birth_year) { points += 20; reasons.push("año de nacimiento"); }
  const localClubs = new Set((seasonsByLocal.get(local.id) ?? []).map((row) => normalize(row.legacy_club_name)).filter(Boolean));
  const remoteClubSet = new Set((seasonsByRemote.get(remote.id) ?? []).map((row) => clubNames.get(row.club_id) ?? normalize(row.legacy_club_name)).filter(Boolean));
  const sharedClubs = [...localClubs].filter((club) => remoteClubSet.has(club)); if (sharedClubs.length) { points += 10; reasons.push(`club compartido (${sharedClubs.length})`); }
  const localYears = new Set((seasonsByLocal.get(local.id) ?? []).map((row) => row.season_year)); const remoteYears = new Set((seasonsByRemote.get(remote.id) ?? []).map((row) => row.season_year)); const sharedYears = [...localYears].filter((year) => remoteYears.has(year)); if (sharedYears.length) { points += 5; reasons.push(`temporada compartida (${sharedYears.length})`); }
  return { points, reasons: reasons.join("; ") };
}
const rows = localPlayers.map((local) => {
  const ranked = remotePlayers.map((remote) => ({ remote, ...score(local, remote) })).filter((candidate) => candidate.points > 0).sort((a, b) => b.points - a.points || a.remote.id.localeCompare(b.remote.id));
  const best = ranked[0]; const next = ranked[1];
  const sameNumber = best && local.id.slice(3) === best.remote.id.slice(3) && normalize(`${local.first_name} ${local.last_name}`) === normalize(`${best.remote.first_name} ${best.remote.last_name}`);
  const uniqueExactName = best && best.points === 100 && ranked.filter((candidate) => candidate.points === 100).length === 1;
  const status = !best ? "sin correspondencia" : sameNumber || uniqueExactName || (best.points >= 120 && (!next || best.points - next.points >= 20)) ? "correspondencia segura" : "ambiguo";
  return { local_id: local.id, local_name: `${local.first_name} ${local.last_name ?? ""}`.trim(), local_birth_year: local.birth_year ?? "", local_seasons: (seasonsByLocal.get(local.id) ?? []).map((row) => `${row.season_year}:${row.club_id ?? row.legacy_club_name ?? ""}`).join(" | "), candidate_id: best?.remote.id ?? "", candidate_name: best ? `${best.remote.first_name} ${best.remote.last_name ?? ""}`.trim() : "", score: best?.points ?? 0, evidence: best?.reasons ?? "sin nombre normalizado coincidente", alternatives: ranked.slice(1, 4).map((item) => item.remote.id).join(" | "), status };
});
const headers = Object.keys(rows[0]); await mkdir(out, { recursive: true });
await writeFile(path.join(out, "jugadores-jug-a-rug-revision.csv"), [headers.join(","), ...rows.map((row) => headers.map((key) => csv(row[key])).join(","))].join("\n") + "\n");
await writeFile(path.join(out, "puente-jug-a-ctr.csv"), ["local_jug_id,canonical_ctr_id,status,evidence", ...rows.map((row) => [row.local_id, row.candidate_id, row.status, row.evidence].map(csv).join(","))].join("\n") + "\n");
const counts = Object.fromEntries(["correspondencia segura", "ambiguo", "sin correspondencia"].map((status) => [status, rows.filter((row) => row.status === status).length]));
const photo = "JUG0320.png"; const owner = localById.get("JUG0320"); const declared = rows.find((row) => row.local_id === "JUG0320");
await writeFile(path.join(out, "informe.md"), `# Conciliación JUG → RUG\n\n- Jugadores locales: ${rows.length}\n- Seguras: ${counts["correspondencia segura"]}\n- Revisión: ${counts["posible coincidencia que requiere revisión"]}\n- Sin correspondencia: ${counts["sin correspondencia"]}\n\n## Foto no declarada\n\n\`${photo}\` pertenece localmente a **${owner ? `${owner.first_name} ${owner.last_name}` : "ID no encontrado"}** (${photo.slice(0, 7)}). ${declared?.candidate_id ? `Su candidato remoto es ${declared.candidate_id};` : "No tiene candidato remoto;"} no se debe añadir al manifiesto hasta aprobar esa correspondencia y decidir su temporada.\n`);
console.log(JSON.stringify({ out, counts, doubtful: rows.filter((row) => row.status !== "correspondencia segura"), photo: { file: photo, owner: owner ? `${owner.first_name} ${owner.last_name}` : null, candidate: declared?.candidate_id ?? null } }, null, 2));
