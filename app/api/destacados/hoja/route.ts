import { currentClubSeason } from "@/lib/current-club";
import { readCampusMetricsJson } from "@/lib/campus-participations";
import { requireConsultation } from "@/lib/consultation-access";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import sharp from "sharp";
import { rugbyPositionLabel } from "@/app/lib/rugby-positions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Profile = { category: string | null; birth_year: number | null };
type ProfessionalClubRecord = { id?: string; club_name: string; club_id: string | null; category: string; category_id?: string | null; season_label: string | null };
type Player = { id: string; first_name: string; last_name: string | null; profile?: Profile | null; participation_count?: number; milestone_count?: number; selected_federation_ids?: string[]; selected_federation_counts?: Record<string, number>; professional_clubs?: string[]; professional_club_records?: ProfessionalClubRecord[] };
type PlayerSeason = { player_id: string; season_year: number; club_id: string | null; legacy_club_name: string | null; position_text: string | null };
type ClubRef = { id: string; name: string; country: string | null };
type FederationRef = { id: string; name: string; scope: string; territory: string | null };
type ParticipationMetric = { player_id?: string | null; participation_years?: string[] };
type State = { configured: boolean; players: Player[]; seasons?: PlayerSeason[]; clubs?: ClubRef[] };

type ExportRow = {
  player: Player;
  currentClubName: string;
  currentPosition: string | null;
  seasons: PlayerSeason[];
  nationalFederations: string[];
  regionalFederations: string[];
  professionalRecords: ProfessionalClubRecord[];
  score: number;
};

const fullName = (player: Player) => [player.first_name, player.last_name].filter(Boolean).join(" ");
const compactSeasonLabel = (value?: string | null) => value?.replace(/(\d{4})\/(\d{2,4})/g, (_, start: string, end: string) => `${start.slice(-2)}/${end.slice(-2)}`) ?? "";
const federationCount = (player: Player, id: string) => player.selected_federation_counts?.[id] ?? 0;
const federationStopWords = new Set(["de", "del", "la", "el", "las", "los", "les", "of", "and", "the"]);
const federationAcronym = (name: string) => {
  const words = name.replace(/[()]/g, " ").split(/[\s\-.]+/).filter((word) => word && !federationStopWords.has(word.toLocaleLowerCase("es-ES")));
  const acronym = words.map((word) => word[0]?.toLocaleUpperCase("es-ES") ?? "").join("");
  return acronym.length >= 2 && acronym.length <= 5 ? acronym : name;
};
const federationLabel = (id: string, federations: Map<string, FederationRef>) => id === "FN003" ? "FER" : federationAcronym(federations.get(id)?.name ?? id);
const federationSummary = (player: Player, ids: string[], federations: Map<string, FederationRef>) => ids.map((id) => `${federationLabel(id, federations)} (${federationCount(player, id)})`).join(", ");

async function participationYearsByPlayer() {
  try {
    const raw = await readCampusMetricsJson();
    const rows = JSON.parse(raw) as ParticipationMetric[];
    return new Map(rows.map((row) => [row.player_id ?? "", [...(row.participation_years ?? [])].sort((a, b) => Number(b) - Number(a)).map((year) => year.slice(-2)).join(", ")]));
  } catch {
    return new Map<string, string>();
  }
}

function selectedRows(state: State) {
  const seasonsByPlayer = new Map<string, PlayerSeason[]>();
  const clubsById = new Map((state.clubs ?? []).map((club) => [club.id, club]));
  for (const season of state.seasons ?? []) seasonsByPlayer.set(season.player_id, [...(seasonsByPlayer.get(season.player_id) ?? []), season]);
  return state.players.filter((player) => (player.selected_federation_ids?.length ?? 0) > 0 || (player.milestone_count ?? 0) > 0 || (player.professional_club_records?.length ?? 0) > 0).map((player): ExportRow => {
    const seasons = [...(seasonsByPlayer.get(player.id) ?? [])].sort((a, b) => b.season_year - a.season_year);
    const currentSeason = currentClubSeason(seasons);
    const currentClub = currentSeason?.club_id ? clubsById.get(currentSeason.club_id) ?? null : null;
    const currentClubName = currentClub?.name ?? currentSeason?.legacy_club_name ?? "Club pendiente";
    const currentPosition = rugbyPositionLabel(currentSeason?.position_text ?? null);
    const nationalFederations = (player.selected_federation_ids ?? []).filter((id) => id.startsWith("FN"));
    const regionalFederations = (player.selected_federation_ids ?? []).filter((id) => id.startsWith("FT"));
    const professionalRecords = player.professional_club_records ?? [];
    const score = nationalFederations.reduce((total, id) => total + federationCount(player, id), 0) + regionalFederations.reduce((total, id) => total + federationCount(player, id), 0) + professionalRecords.length;
    return { player, currentClubName, currentPosition, seasons, nationalFederations, regionalFederations, professionalRecords, score };
  }).sort((a, b) => b.score - a.score || fullName(a.player).localeCompare(fullName(b.player), "es"));
}

async function photoBuffer(request: NextRequest, playerId: string) {
  try {
    const response = await fetch(new URL(`/api/jugadores/foto/${playerId}`, request.url), { cache: "no-store", headers: { cookie: request.headers.get("cookie") ?? "" }, signal: AbortSignal.timeout(3500) });
    if (!response.ok) return null;
    const input = Buffer.from(await response.arrayBuffer());
    return await sharp(input).resize(88, 88, { fit: "cover" }).png().toBuffer();
  } catch {
    return null;
  }
}

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEF001B" } };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = { top: { style: "thin", color: { argb: "FFD9DDE3" } }, left: { style: "thin", color: { argb: "FFD9DDE3" } }, bottom: { style: "thin", color: { argb: "FFD9DDE3" } }, right: { style: "thin", color: { argb: "FFD9DDE3" } } };
  });
}

function styleBody(row: ExcelJS.Row, fill?: string) {
  row.eachCell((cell) => {
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = { top: { style: "thin", color: { argb: "FFE5E7EB" } }, left: { style: "thin", color: { argb: "FFE5E7EB" } }, bottom: { style: "thin", color: { argb: "FFE5E7EB" } }, right: { style: "thin", color: { argb: "FFE5E7EB" } } };
    if (fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
  });
}

export async function GET(request: NextRequest) {
  const consultationDenied = await requireConsultation(request);
  if (consultationDenied) return consultationDenied;

  const [response, federationResponse] = await Promise.all([
    fetch(new URL("/api/jugadores?view=public", request.url), { cache: "no-store", headers: { cookie: request.headers.get("cookie") ?? "" } }),
    fetch(new URL("/api/federaciones", request.url), { cache: "no-store", headers: { cookie: request.headers.get("cookie") ?? "" } }).catch(() => null),
  ]);
  if (!response.ok) return NextResponse.json({ error: "No se ha podido preparar el Excel de destacados." }, { status: 503 });
  const state = await response.json() as State;
  const federationState = federationResponse?.ok ? await federationResponse.json() as { federations?: FederationRef[] } : { federations: [] };
  const federations = new Map((federationState.federations ?? []).map((federation) => [federation.id, federation]));
  if (!state.configured) return NextResponse.json({ error: "El catálogo todavía no está conectado." }, { status: 503 });

  const rows = selectedRows(state);
  const participationYears = await participationYearsByPlayer();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rugby Data Manager";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Destacados", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "Ranking", key: "rank", width: 10 },
    { header: "Foto", key: "photo", width: 18 },
    { header: "Jugador", key: "player", width: 24 },
    { header: "Posición", key: "position", width: 36 },
    { header: "Participaciones", key: "participations", width: 18 },
    { header: "Años participación", key: "participationYears", width: 22 },
    { header: "Fed. nacionales", key: "national", width: 24 },
    { header: "Fed. regionales", key: "regional", width: 24 },
    { header: "Original Ranking", key: "origRank", width: 1, hidden: true },
    { header: "Original Foto", key: "origPhoto", width: 1, hidden: true },
    { header: "Original Jugador", key: "origPlayer", width: 1, hidden: true },
    { header: "Original Posición", key: "origPosition", width: 1, hidden: true },
    { header: "Original Participaciones", key: "origParticipations", width: 1, hidden: true },
    { header: "Original Años participación", key: "origParticipationYears", width: 1, hidden: true },
    { header: "Original Fed. nacionales", key: "origNational", width: 1, hidden: true },
    { header: "Original Fed. regionales", key: "origRegional", width: 1, hidden: true },
  ];
  ["I", "J", "K", "L", "M", "N", "O", "P"].forEach((column) => { sheet.getColumn(column).hidden = true; });
  styleHeader(sheet.getRow(1));

  const seasonSortValue = (value: string | null | undefined) => {
    const match = value?.match(/(\d{4})|^(\d{2})\//);
    if (!match) return 0;
    return match[1] ? Number(match[1]) : 2000 + Number(match[2]);
  };

  for (const [index, row] of rows.entries()) {
    const personalValues = {
      rank: index + 1,
      photo: "",
      player: fullName(row.player),
      position: row.currentPosition ?? "",
      participations: row.player.participation_count ?? 0,
      participationYears: participationYears.get(row.player.id) ?? "",
      national: federationSummary(row.player, row.nationalFederations, federations),
      regional: federationSummary(row.player, row.regionalFederations, federations),
    };
    const personalRow = sheet.addRow({
      ...personalValues,
      origRank: personalValues.rank,
      origPhoto: personalValues.photo,
      origPlayer: personalValues.player,
      origPosition: personalValues.position,
      origParticipations: personalValues.participations,
      origParticipationYears: personalValues.participationYears,
      origNational: personalValues.national,
      origRegional: personalValues.regional,
    });
    personalRow.height = 74;
    styleBody(personalRow, "FFFF5F5F");
    personalRow.getCell("rank").font = { bold: true };
    personalRow.getCell("player").font = { bold: true, size: 13 };
    personalRow.getCell("participations").font = { bold: true };
    personalRow.getCell("participationYears").font = { bold: true };
    personalRow.getCell("national").font = { bold: true };
    personalRow.getCell("regional").font = { bold: true };

    const photo = await photoBuffer(request, row.player.id);
    if (photo) {
      const imageId = workbook.addImage({ base64: photo.toString("base64"), extension: "png" });
      sheet.addImage(imageId, { tl: { col: 1.24, row: personalRow.number - 0.82 }, ext: { width: 62, height: 62 } });
    }

    const clubRows = [...row.professionalRecords].sort((a, b) => seasonSortValue(b.season_label) - seasonSortValue(a.season_label) || (a.club_name || "").localeCompare(b.club_name || "", "es"));
    for (const record of clubRows) {
      const clubValues = {
        rank: "",
        photo: compactSeasonLabel(record.season_label),
        player: record.category || "",
        position: record.club_name || "",
        participations: "",
        participationYears: "",
        national: "",
        regional: "",
      };
      const clubRow = sheet.addRow({
        ...clubValues,
        origRank: clubValues.rank,
        origPhoto: clubValues.photo,
        origPlayer: clubValues.player,
        origPosition: clubValues.position,
        origParticipations: clubValues.participations,
        origParticipationYears: clubValues.participationYears,
        origNational: clubValues.national,
        origRegional: clubValues.regional,
      });
      clubRow.height = 24;
      styleBody(clubRow);
    }

    const spacer = sheet.addRow({});
    spacer.height = 8;
  }

  sheet.autoFilter = { from: "A1", to: "H1" };
  const lastRow = sheet.rowCount;
  const comparisons = [["A", "I"], ["B", "J"], ["C", "K"], ["D", "L"], ["E", "M"], ["F", "N"], ["G", "O"], ["H", "P"]] as const;
  comparisons.forEach(([visible, original], index) => {
    sheet.addConditionalFormatting({
      ref: `${visible}2:${visible}${lastRow}`,
      rules: [{ priority: index + 1, type: "expression", formulae: [`${visible}2<>${original}2`], style: { font: { color: { argb: "FF0057B8" } } } }],
    });
  });
  const bytes = await workbook.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="ctrugby-destacados.xlsx"',
      "Cache-Control": "private, no-store",
    },
  });
}
