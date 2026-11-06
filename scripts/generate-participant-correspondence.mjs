import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const outputIndex = process.argv.indexOf("--out");
const outputDirectory = outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined;
if (!outputDirectory || !path.isAbsolute(outputDirectory)) throw new Error("Usa --out <carpeta-absoluta-fuera-del-repositorio>");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Faltan las credenciales locales de Supabase.");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const normalize = (value) => String(value ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("es").replace(/[^a-z0-9]+/g, " ").trim();
const nameOfPlayer = (player) => `${player?.first_name ?? ""} ${player?.last_name ?? ""}`.trim();
const contextKey = (club, season) => `${normalize(club)}|${normalize(season)}`;
const toCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

async function readJson(file) { return JSON.parse(await readFile(file, "utf8")); }
async function fetchAll(table) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select("*").range(from, from + 999);
    if (error) throw new Error(`No se pudo leer ${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

const [localParticipants, localMilestones, localPlayers, localSeasons, localClubs, remoteParticipants, remoteMilestones, remotePlayers] = await Promise.all([
  readJson("data/staging/milestone-participants.json"),
  readJson("data/staging/milestones.json"),
  readJson("data/staging/players.json"),
  readJson("data/staging/player-seasons.json"),
  readJson("data/staging/clubs.json"),
  fetchAll("catalog_participants"),
  fetchAll("catalog_milestones"),
  fetchAll("catalog_players"),
]);

const remoteParticipantIds = new Set(remoteParticipants.map((row) => row.id));
const onlyLocal = localParticipants.filter((row) => !remoteParticipantIds.has(row.id));
const localPlayersById = new Map(localPlayers.map((row) => [row.id, row]));
const remotePlayersById = new Map(remotePlayers.map((row) => [row.id, row]));
const localClubsById = new Map(localClubs.map((row) => [row.id, row.name]));

function contexts(milestones, participantId) {
  return milestones.filter((row) => row.participant_id === participantId).map((row) => ({
    club: row.club_text ?? "",
    season: row.season_label ?? "",
  }));
}
function contextText(rows) { return [...new Set(rows.map((row) => `${row.club || "—"} · ${row.season || "—"}`))].join(" || "); }
function contextOverlap(left, right) {
  const set = new Set(left.map((row) => contextKey(row.club, row.season)));
  return right.filter((row) => set.has(contextKey(row.club, row.season))).length;
}

const remoteContexts = new Map(remoteParticipants.map((row) => [row.id, contexts(remoteMilestones, row.id)]));
const localContexts = new Map(onlyLocal.map((row) => {
  const direct = contexts(localMilestones, row.id);
  const playerSeasons = localSeasons.filter((season) => season.player_id === row.player_id).map((season) => ({
    club: season.legacy_club_name || localClubsById.get(season.club_id) || season.club_id || "",
    season: season.season_year ?? "",
  }));
  return [row.id, [...direct, ...playerSeasons]];
}));

function candidatesFor(local) {
  const localPlayer = localPlayersById.get(local.player_id);
  const localNames = new Set([normalize(local.display_name), normalize(nameOfPlayer(localPlayer))].filter(Boolean));
  const localContext = localContexts.get(local.id) ?? [];
  return remoteParticipants.map((remote) => {
    const remotePlayer = remotePlayersById.get(remote.player_id);
    const exactSource = Boolean(local.source_key && remote.source_key && local.source_key === remote.source_key);
    const exactPlayer = Boolean(local.player_id && remote.player_id && local.player_id === remote.player_id);
    const exactName = localNames.has(normalize(remote.display_name));
    const exactPlayerName = localNames.has(normalize(nameOfPlayer(remotePlayer)));
    const overlap = contextOverlap(localContext, remoteContexts.get(remote.id) ?? []);
    const score = (exactSource ? 100 : 0) + (exactPlayer ? 90 : 0) + (exactName ? 60 : 0) + (exactPlayerName ? 45 : 0) + Math.min(overlap, 2) * 25;
    return { remote, exactSource, exactPlayer, exactName, exactPlayerName, overlap, score };
  }).filter((candidate) => candidate.score > 0).sort((a, b) => b.score - a.score || a.remote.id.localeCompare(b.remote.id));
}

function playerReference(local) {
  const direct = remotePlayersById.get(local.player_id);
  if (direct) return { player: direct, reason: "exact_player_id" };
  const localPlayer = localPlayersById.get(local.player_id);
  const localName = normalize(nameOfPlayer(localPlayer) || local.display_name);
  const byName = remotePlayers.filter((candidate) => normalize(nameOfPlayer(candidate)) === localName);
  return byName.length === 1 ? { player: byName[0], reason: "exact_normalized_name" } : null;
}

const rows = onlyLocal.map((local) => {
  const candidates = candidatesFor(local);
  const primary = candidates[0];
  const strongAlternative = candidates.slice(1).some((candidate) => candidate.exactSource || candidate.exactPlayer || candidate.exactName || candidate.exactPlayerName);
  const reference = !primary ? playerReference(local) : null;
  const unambiguousStableKey = primary && !strongAlternative && (primary.exactSource || primary.exactPlayer);
  const unambiguousNameAndContext = primary && !strongAlternative && primary.exactName && primary.exactPlayerName && primary.overlap > 0;
  const classification = unambiguousStableKey || unambiguousNameAndContext
    ? "coincidencia segura"
    : primary || reference ? "posible coincidencia que requiere revisión" : "sin correspondencia";
  const evidence = primary ? [
    primary.exactSource && "source_key exacta",
    primary.exactPlayer && "player_id exacto",
    primary.exactName && "nombre normalizado exacto",
    primary.exactPlayerName && "nombre de jugador exacto",
    primary.overlap > 0 && `${primary.overlap} club/temporada coincidente`,
  ].filter(Boolean).join("; ") : reference ? `jugador de catálogo: ${reference.reason}` : "sin evidencia remota";
  const target = primary?.remote;
  const targetContexts = target ? remoteContexts.get(target.id) ?? [] : [];
  return {
    classification,
    local_participant_id: local.id,
    local_display_name: local.display_name,
    local_player_id: local.player_id,
    local_source_key: local.source_key,
    local_context: contextText(localContexts.get(local.id) ?? []),
    candidate_type: target ? "catalog_participant" : reference ? "catalog_player_reference" : "",
    candidate_id: target?.id ?? reference?.player.id ?? "",
    candidate_display_name: target?.display_name ?? nameOfPlayer(reference?.player),
    candidate_player_id: target?.player_id ?? reference?.player.id ?? "",
    candidate_source_key: target?.source_key ?? "",
    candidate_context: contextText(targetContexts),
    candidate_count: candidates.length,
    alternative_candidate_ids: candidates.slice(1, 6).map((candidate) => candidate.remote.id).join(" | "),
    evidence,
    score: primary?.score ?? "",
    recommended_action: classification === "coincidencia segura"
      ? "Validar visualmente y reutilizar el participante de Supabase; no insertar uno nuevo."
      : classification.startsWith("posible")
        ? "Revisión humana obligatoria antes de enlazar o crear participante."
        : "Investigar fuente local; no crear ni modificar datos todavía.",
  };
});

const columns = Object.keys(rows[0] ?? { classification: "" });
const csv = [columns.join(","), ...rows.map((row) => columns.map((column) => toCsv(row[column])).join(","))].join("\n") + "\n";
const counts = Object.fromEntries(["coincidencia segura", "posible coincidencia que requiere revisión", "sin correspondencia"].map((label) => [label, rows.filter((row) => row.classification === label).length]));
const markdown = [
  "# Correspondencias candidatas de participantes",
  "",
  "Generado solo con lecturas locales y de Supabase. No se modificaron registros.",
  "",
  `- Coincidencia segura: ${counts["coincidencia segura"]}`,
  `- Posible coincidencia que requiere revisión: ${counts["posible coincidencia que requiere revisión"]}`,
  `- Sin correspondencia: ${counts["sin correspondencia"]}`,
  "",
  "Una coincidencia segura requiere una clave estable única (`source_key` o `player_id`) o nombre exacto más club/temporada. Las demás no deben aplicarse automáticamente.",
  "",
].join("\n");

await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, "participant-correspondence-candidates.csv"), csv, "utf8");
await writeFile(path.join(outputDirectory, "participant-correspondence-summary.md"), `${markdown}\n`, "utf8");
console.log(JSON.stringify({ total: rows.length, ...counts }));
