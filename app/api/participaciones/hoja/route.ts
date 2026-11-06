import { readCampusMetricsJson } from "@/lib/campus-participations";
import { requireConsultation } from "@/lib/consultation-access";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { catalogAccess, catalogConfigured } from "@/lib/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Player = { id: string; first_name: string; last_name: string | null; category: string | null; birth_year: number | null };
type Metric = { player_id: string; participation_count: number; participation_years: string[]; participation_campus?: Record<string, string>; participation_campuses?: Record<string, string>; participation_registration_numbers?: Record<string, string>; participation_pending_year?: boolean };
type Season = { player_id: string; season_year: number; registration_number?: string | null; club_id: string | null; legacy_club_name: string | null; position_text: string | null };
type Club = { id: string; name: string; city?: string | null; province?: string | null; region?: string | null; country?: string | null };

const fullName = (player?: Player) => [player?.first_name, player?.last_name].filter(Boolean).join(" ") || "Jugador";
const metricCampus = (metric: Metric | undefined, year: string) => (metric?.participation_campus ?? metric?.participation_campuses)?.[year] ?? null;
const metricRegistration = (metric: Metric | undefined, year: string) => metric?.participation_registration_numbers?.[year] ?? null;

function sheet(rows: (string | number | null)[][], name: string, widths: number[]) {
  const output = XLSX.utils.aoa_to_sheet(rows);
  output["!cols"] = widths.map((wch) => ({ wch }));
  output["!freeze"] = { xSplit: 0, ySplit: 1 };
  return { name, output };
}

export async function GET(request: NextRequest) {
  const consultationDenied = await requireConsultation(request);
  if (consultationDenied) return consultationDenied;

  if (!catalogConfigured()) return NextResponse.json({ error: "El catalogo todavia no esta conectado." }, { status: 503 });
  try {
    const { admin } = await catalogAccess(request);
    if (!admin) return NextResponse.json({ error: "Acceso de administrador requerido." }, { status: 403 });

    const root = path.join(process.cwd(), "data", "staging");
    const [playersRaw, metricsRaw, seasonsRaw, clubsRaw] = await Promise.all([
      readFile(path.join(root, "players.json"), "utf8"),
      readCampusMetricsJson(),
      readFile(path.join(root, "player-seasons.json"), "utf8"),
      readFile(path.join(root, "clubs.json"), "utf8"),
    ]);
    const players = new Map((JSON.parse(playersRaw) as Player[]).map((player) => [player.id, player]));
    const metrics = JSON.parse(metricsRaw) as Metric[];
    const seasons = JSON.parse(seasonsRaw) as Season[];
    const clubs = new Map((JSON.parse(clubsRaw) as Club[]).map((club) => [club.id, club]));
    const seasonsByPlayer = new Map<string, Season[]>();
    for (const season of seasons) seasonsByPlayer.set(season.player_id, [...(seasonsByPlayer.get(season.player_id) ?? []), season]);

    const participationRows = metrics.map((metric) => {
      const player = players.get(metric.player_id);
      const latestSeason = [...(seasonsByPlayer.get(metric.player_id) ?? [])].sort((a, b) => b.season_year - a.season_year)[0] ?? null;
      const club = latestSeason?.club_id ? clubs.get(latestSeason.club_id) : null;
      const registrations = [...(seasonsByPlayer.get(metric.player_id) ?? [])]
        .filter((season) => metric.participation_years.includes(String(season.season_year)) && season.registration_number)
        .sort((a, b) => a.season_year - b.season_year)
        .map((season) => `${season.season_year}: ${season.registration_number}`)
        .join(" | ");
      const participationRegistrations = Object.entries(metric.participation_registration_numbers ?? {})
        .filter(([key]) => metric.participation_years.includes(key.split(":").at(-1) || key))
        .sort(([left], [right]) => Number(left) - Number(right))
        .map(([year, registration]) => `${year}: ${registration}`)
        .join(" | ");
      return [
        metric.player_id,
        fullName(player),
        player?.category ?? null,
        player?.birth_year ?? null,
        metric.participation_count,
        [...metric.participation_years].sort().join(", "),
        metric.participation_pending_year || metric.participation_count > metric.participation_years.length ? "Pendiente identificar año" : null,
        participationRegistrations || null,
        registrations || null,
        Object.entries(metric.participation_campus ?? metric.participation_campuses ?? {}).map(([year, campus]) => `${year}: ${campus}`).join(" | "),
        latestSeason?.club_id ?? null,
        club?.name ?? latestSeason?.legacy_club_name ?? null,
        latestSeason?.season_year ?? null,
        latestSeason?.registration_number ?? null,
        latestSeason?.position_text ?? null,
      ];
    }).sort((a, b) => Number(b[4]) - Number(a[4]) || String(a[1]).localeCompare(String(b[1]), "es"));

    const years = [...new Set(metrics.flatMap((metric) => metric.participation_years))].sort((a, b) => Number(b) - Number(a));
    const yearRows = years.map((year) => [
      year,
      metrics.filter((metric) => metric.participation_years.includes(year)).length,
    ]);

    const workbook = XLSX.utils.book_new();
    const participationHeader = ["ID jugador", "Jugador", "Categoria", "Ano nacimiento", "Participaciones", "Anos", "Pendiente identificar ano", "Registro campus", "Numeros inscripcion", "Campus", "ID club actual", "Club actual", "Temporada actual", "Numero inscripcion actual", "Posicion"];
    const participationWidths = [14, 30, 18, 16, 16, 22, 28, 22, 28, 60, 16, 34, 18, 24, 22];
    for (const { name, output } of [
      sheet([
        participationHeader,
        ...participationRows,
      ], "Todos los anos", participationWidths),
      ...years.map((year) => {
        const rows = participationRows.filter((row) => String(row[5]).split(", ").includes(year)).map((row) => {
          const season = seasonsByPlayer.get(String(row[0]))?.find((item) => String(item.season_year) === year) ?? null;
          const club = season?.club_id ? clubs.get(season.club_id) : null;
          return [
            row[0], row[1], row[2], row[3],
            metricRegistration(metrics.find((metric) => metric.player_id === row[0]), year),
            season?.registration_number ?? null,
            metricCampus(metrics.find((metric) => metric.player_id === row[0]), year),
            season?.club_id ?? null,
            club?.name ?? season?.legacy_club_name ?? null,
            season?.position_text ?? null,
          ];
        });
        return sheet([
          ["ID jugador", "Jugador", "Categoria", "Ano nacimiento", "Registro campus", "Numero inscripcion", "Campus", "ID club", "Club", "Posicion"],
          ...rows,
        ], year, [14, 30, 18, 16, 18, 22, 28, 16, 34, 22]);
      }),
      sheet([
        ["Ano", "Jugadores"],
        ...yearRows,
      ], "Ediciones", [12, 14]),
    ]) XLSX.utils.book_append_sheet(workbook, output, name);

    const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="ctrugby-participaciones.xlsx"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "No se ha podido preparar la hoja de participaciones." }, { status: 500 });
  }
}
