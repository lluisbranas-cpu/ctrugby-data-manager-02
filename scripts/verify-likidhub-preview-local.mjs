const base = process.env.LIKIDHUB_PREVIEW_URL ?? "http://localhost:3001";

async function json(path) {
  const response = await fetch(new URL(path, base), { cache: "no-store" });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

const [players, participations, clubs, photo, blocked] = await Promise.all([
  json("/api/jugadores"),
  json("/api/participaciones"),
  json("/api/clubs"),
  fetch(new URL("/api/jugadores/foto/JUG0016?season=2027", base), { redirect: "manual", cache: "no-store" }),
  Promise.all(["POST", "PUT", "PATCH", "DELETE"].map((method) => fetch(new URL("/api/jugadores", base), { method, headers: { "Content-Type": "application/json" }, body: "{}", cache: "no-store" }))),
]);

const result = {
  players: players.players?.length,
  participations: participations.participations?.length,
  participation_players: participations.summary?.players,
  clubs: clubs.clubs?.length,
  player_ids_are_ctr: players.players?.every((player) => /^CTR\d{4}$/.test(player.id)),
  photo_status: photo.status,
  photo_is_signed_operational_redirect: photo.status === 307 && new URL(photo.headers.get("location")).pathname.includes("/storage/v1/object/sign/catalog-operational-private/"),
  blocked_write_statuses: blocked.map((response) => response.status),
  writes_blocked: blocked.every((response) => response.status === 405),
};
const expected = result.players === 388 && result.participations === 507 && result.participation_players === 337 && result.clubs === 251 && result.player_ids_are_ctr && result.photo_is_signed_operational_redirect && result.writes_blocked;
console.log(JSON.stringify(result, null, 2));
if (!expected) process.exitCode = 1;
