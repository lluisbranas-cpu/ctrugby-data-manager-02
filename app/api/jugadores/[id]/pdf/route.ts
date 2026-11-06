import { currentClubSeason } from "@/lib/current-club";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import { catalogAccess, catalogConfigured, catalogServiceClient, sameOrigin } from "@/lib/catalog";
import { playerPdfFilename } from "@/lib/player-pdf-filename";
import { loadPlayerReviewData, readPlayerEditToken } from "@/lib/player-edit-review";
import { federationShieldUrls } from "@/app/lib/federation-shields";
import { rugbyPositionLabel } from "@/app/lib/rugby-positions";
import { readSeasonCategories } from "@/lib/player-season-categories";
import {
  applyManualSelectionCallups,
  readManualSelectionCallups,
  selectionFederationIds,
  type SelectionRecord,
} from "@/lib/manual-selection-callups";
import {
  readProfessionalClubMilestones,
  shapeProfessionalClubRecord,
  type ProfessionalClubMilestone,
} from "@/lib/professional-club-milestones";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const all = [
  "avanzar_espacio",
  "avanzar_contacto",
  "toma_decisiones",
  "placaje",
  "recuperacion",
  "continuidad",
  "potencia",
  "agilidad",
  "velocidad",
  "coordinacion",
  "determinacion",
  "inteligencia_tactica",
  "compromiso_colectivo",
  "iniciativa_individual",
  "capacidad_aprendizaje",
  "posicion_mele",
  "recepcion_balon",
  "saltador",
  "levantador",
  "pase_recepcion",
  "recepcion_aerea",
  "juego_pie",
  "evasion",
];
const groups: { title: string; keys: string[] }[] = [
  { title: "Perfil general", keys: all },
  { title: "Técnico-tácticos", keys: all.slice(0, 6) },
  { title: "Físicos", keys: all.slice(6, 10) },
  { title: "Mentales", keys: all.slice(10, 15) },
  { title: "Delanteros", keys: all.slice(15, 19) },
  { title: "Línea", keys: all.slice(19) },
];
const labels: Record<string, string> = {
  avanzar_espacio: "Avanzar",
  avanzar_contacto: "Contacto",
  toma_decisiones: "Decisiones",
  placaje: "Placaje",
  recuperacion: "Recuperación",
  continuidad: "Continuidad",
  potencia: "Potencia",
  agilidad: "Agilidad",
  velocidad: "Velocidad",
  coordinacion: "Coordinación",
  determinacion: "Determinación",
  inteligencia_tactica: "Inteligencia",
  compromiso_colectivo: "Compromiso",
  iniciativa_individual: "Iniciativa",
  capacidad_aprendizaje: "Aprendizaje",
  posicion_mele: "Melé",
  recepcion_balon: "Recepción",
  saltador: "Saltador",
  levantador: "Levantador",
  pase_recepcion: "Pase",
  recepcion_aerea: "Aérea",
  juego_pie: "Pie",
  evasion: "Evasión",
};
type Milestone = { participant_id:string; scope:string|null; category:string|null; season_label:string|null; club_text:string|null; position_text:string|null };
type Participant = { id:string; player_id:string|null };
type Assessment = { season: string; label: string; evaluated_on: string | null; club: string; position: string; metrics: Record<string, number | null>; notes: string };
type ReviewPdfData = {
  player: { first_name: string; last_name: string | null; dni?: string | null; instagram?: string | null; allergies?: string | null; dietary_conditions?: string | null; medications?: string | null };
  seasons: Array<{ season_year: number; club_id: string | null; legacy_club_name: string | null; position_text: string | null; height_cm: number | null; weight_kg: number | null }>;
  clubs: Array<{ id: string; name: string }>;
  contacts: { player_email: string | null; player_phone_e164: string | null; tutor1_name: string | null; tutor1_email: string | null; tutor1_phone_e164: string | null; tutor2_name: string | null; tutor2_email: string | null; tutor2_phone_e164: string | null } | null;
};
const asReviewPdfData = (value: unknown): ReviewPdfData | null => value as ReviewPdfData | null;
const decodePreview = (value: string | null): { player?: Record<string, unknown>; seasons?: Array<Record<string, unknown>> } | null => value ? JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { player?: Record<string, unknown>; seasons?: Array<Record<string, unknown>> } : null;
const selectionLabel = (id: string, scope: string | null | undefined) => scope && !/^F[NT]\d{3}$/.test(scope) ? scope : id === "FN003" ? "FER" : id === "FN004" ? "FFR" : id === "FT009" ? "FCR" : id === "FT010" ? "FRCV" : id === "FT015" ? "FRM" : id;
const latestYear = (label: string | null | undefined) => Math.max(0, ...(String(label ?? "").match(/20\d{2}/g) ?? []).map(Number));
const pdfText = (value: string | null | undefined) => String(value ?? "").replace(/&amp;/g, "y").replace(/\s&\s/g, " y ").trim();
const pt = (
  x: number,
  y: number,
  r: number,
  i: number,
  n: number,
  v: number,
) => {
  const a = -Math.PI / 2 + (i * Math.PI * 2) / n;
  return {
    x: x + (Math.cos(a) * r * v) / 10,
    y: y + (Math.sin(a) * r * v) / 10,
  };
};
const card = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  d: any,
  x: number,
  y: number,
  w: number,
  h: number,
  t: string,
) => {
  d.roundedRect(x, y, w, h, 10).fillAndStroke("#fff", "#dce2e6");
  d.font("Helvetica-Bold")
    .fontSize(9)
    .fillColor("#17212b")
    .text(t, x + 13, y + 13);
};
async function image(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  d: any,
  file: string,
  x: number,
  y: number,
  fit: [number, number],
  cover = false,
) {
  try {
    const source = await readFile(file),
      pipeline = sharp(source),
      buffer = file.endsWith(".webp")
        ? await pipeline.png().toBuffer()
        : source;
    d.image(
      buffer,
      x,
      y,
      cover ? { cover: fit, align: "center", valign: "top" } : { fit },
    );
  } catch {}
}
async function imageBuffer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  d: any,
  buffer: Buffer,
  x: number,
  y: number,
  fit: [number, number],
) {
  try {
    d.image(await sharp(buffer).png().toBuffer(), x, y, { fit });
  } catch {}
}
async function federationShieldBuffer(root: string, id: string) {
  try {
    return await readFile(path.join(root, "federation-shields", `${id}.png`));
  } catch {}
  try {
    return await readFile(path.join(root, "federation-shields", `${id}.webp`));
  } catch {}
  const fallback = federationShieldUrls[id];
  if (!fallback) return null;
  try {
    const response = await fetch(fallback, { cache: "no-store" });
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}
async function federationShield(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  d: any,
  root: string,
  id: string,
  x: number,
  y: number,
  fit: [number, number],
) {
  const buffer = await federationShieldBuffer(root, id);
  if (buffer) {
    await imageBuffer(d, buffer, x, y, fit);
    return;
  }
  d.roundedRect(x, y, fit[0], fit[1], Math.min(fit[0], fit[1]) / 2).fillAndStroke("#fff", "#dce2e6");
  d.font("Helvetica-Bold").fontSize(6).fillColor("#17212b").text(selectionLabel(id, null), x + 2, y + fit[1] / 2 - 3, { width: fit[0] - 4, align: "center" });
}
function radar(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  d: any,
  title: string,
  keys: string[],
  m: Record<string, number | null>,
  x: number,
  y: number,
  r: number,
) {
  d.font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#17212b")
    .text(title, x - r, y - r - 19, r * 2, { align: "center" });
  for (const ring of [2, 4, 6, 8, 10]) {
    const q = keys.map((_, i) => pt(x, y, r, i, keys.length, ring));
    d.moveTo(q[0].x, q[0].y);
    q.slice(1).forEach((a) => d.lineTo(a.x, a.y));
    d.closePath().lineWidth(0.35).strokeColor("#d6dadd").stroke();
  }
  keys.forEach((k, i) => {
    const e = pt(x, y, r, i, keys.length, 10),
      l = pt(x, y, r + 13, i, keys.length, 10);
    d.moveTo(x, y)
      .lineTo(e.x, e.y)
      .lineWidth(0.25)
      .strokeColor("#d6dadd")
      .stroke();
    d.font("Helvetica")
      .fontSize(4.6)
      .fillColor("#374151")
      .text(labels[k] ?? k, l.x - 18, l.y - 2, 36, { align: "center" });
  });
  const q = keys.map((k, i) =>
    pt(x, y, r, i, keys.length, Math.max(0, Math.min(10, m[k] ?? 0))),
  );
  d.moveTo(q[0].x, q[0].y);
  q.slice(1).forEach((a) => d.lineTo(a.x, a.y));
  d.closePath().lineWidth(1).strokeColor("#2875ff").stroke();
}
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = (await params).id.toUpperCase();
  if (!sameOrigin(req) || !/^JUG\d{4}$/.test(id) || !catalogConfigured())
    return NextResponse.json(
      { error: "Solicitud no válida." },
      { status: 400 },
    );
  const { db: accessDb, admin } = await catalogAccess(req);
  const reviewToken = req.headers.get("x-ctrugby-review-token");
  const review = reviewToken ? await readPlayerEditToken(reviewToken) : null;
  const reviewAccess = review?.player_id === id;
  if (!admin && !reviewAccess)
    return NextResponse.json(
      { error: "Acceso de administrador requerido." },
      { status: 403 },
    );
  const reviewData = reviewAccess && !admin ? await loadPlayerReviewData(id) : null;
  if (reviewAccess && !admin && !reviewData)
    return NextResponse.json({ error: "No se ha podido cargar la ficha privada." }, { status: 503 });
  let preview: { player?: Record<string, unknown>; seasons?: Array<Record<string, unknown>> } | null;
  try {
    preview = decodePreview(req.headers.get("x-ctrugby-review-preview"));
  } catch {
    return NextResponse.json({ error: "Los datos de vista previa no son válidos." }, { status: 400 });
  }
  const privateReview = asReviewPdfData(reviewData);
  const previewPlayer = privateReview && preview?.player ? { ...privateReview.player, ...preview.player } : privateReview?.player;
  const previewSeasons = privateReview && Array.isArray(preview?.seasons)
    ? preview.seasons.map((draft) => {
        const original = privateReview.seasons.find((season) => season.season_year === draft.season_year);
        return { ...original, ...draft, legacy_club_name: draft.club_name ?? original?.legacy_club_name ?? null };
      })
    : privateReview?.seasons;
  const privateAssessments = privateReview
    ? await catalogServiceClient().rpc("app_player_assessments_for_private_pdf", { p_player_id: id })
    : null;
  const [player, trajectory, assessments, clubs] = privateReview
    ? [
        { data: { first_name: previewPlayer?.first_name ?? privateReview.player.first_name, last_name: previewPlayer?.last_name ?? privateReview.player.last_name }, error: null },
        { data: previewSeasons ?? privateReview.seasons, error: null },
        { data: privateAssessments?.data ?? [], error: null },
        { data: privateReview.clubs, error: null },
      ]
    : await Promise.all([
        accessDb
          .from("catalog_players")
          .select("first_name,last_name")
          .eq("id", id)
          .maybeSingle(),
        accessDb.rpc("player_trajectory_public", { p_player_id: id }),
        accessDb.rpc("app_player_assessments", { p_player_id: id }),
        accessDb.from("catalog_clubs").select("id,name"),
      ]);
  if (
    player.error ||
    !player.data ||
    trajectory.error ||
    assessments.error ||
    clubs.error
  )
    return NextResponse.json(
      { error: "No se ha podido preparar el PDF." },
      { status: 503 },
    );
  const seasons = (trajectory.data ?? []) as {
      season_year: number;
      club_id: string | null;
      legacy_club_name: string | null;
      position_text: string | null;
      height_cm: number | null;
      weight_kg: number | null;
    }[],
    current = seasons[0],
    clubSeason = currentClubSeason(seasons),
    clubsById = new Map((clubs.data ?? []).map((c) => [c.id, c.name])),
    club =
      (clubSeason?.club_id ? clubsById.get(clubSeason.club_id) : null) ??
      clubSeason?.legacy_club_name ??
      "—",
    assessmentRecords = (assessments.data ?? []) as Assessment[],
    assessment = assessmentRecords.at(-1),
    d = new PDFDocument({ size: "A4", margin: 28 }),
    chunks: Buffer[] = [];
  d.on("data", (c: Buffer) => chunks.push(c));
  const complete = new Promise<Buffer>((resolve, reject) => {
      d.on("end", () => resolve(Buffer.concat(chunks)));
      d.on("error", reject);
    }),
    root = path.join(process.cwd(), "public"),
    name = [player.data.first_name, player.data.last_name]
      .filter(Boolean)
      .join(" ")
      .toUpperCase(),
    season = current
      ? `${String(current.season_year - 1).slice(-2)}/${String(current.season_year).slice(-2)}`
      : "—";
  const stagedPlayers = JSON.parse(
    await readFile(path.join(process.cwd(), "data", "staging", "players.json"), "utf8"),
  ) as { id: string; birth_year?: number | null }[];
  const birthYear = stagedPlayers.find((candidate) => candidate.id === id)?.birth_year ?? null;
  const photoYears = new Set(
    (
      await Promise.all(
        seasons.map(async (row) => {
          try {
            await access(path.join(process.cwd(), "data", "staging", "player-season-photos", id, `${row.season_year}.png`));
            return row.season_year;
          } catch {
            return null;
          }
        }),
      )
    ).filter((year): year is number => year !== null),
  );
  let primaryPhotoYear: number | null = null;
  try {
    primaryPhotoYear = Number(JSON.parse(await readFile(path.join(process.cwd(), "data", "staging", "player-season-photos", id, "primary.json"), "utf8")).season) || null;
  } catch {}
  let selections: SelectionRecord[] = [];
  let professionalClubs: ProfessionalClubMilestone[] = [];
  try {
    const base = path.join(process.cwd(), "data", "staging");
    const [milestonesRaw, participantsRaw, manualCallups] = await Promise.all([
      readFile(path.join(base, "milestones.json"), "utf8"),
      readFile(path.join(base, "milestone-participants.json"), "utf8"),
      readManualSelectionCallups(),
    ]);
    const participantIds = new Set((JSON.parse(participantsRaw) as Participant[]).filter((participant) => participant.player_id === id).map((participant) => participant.id));
    const baseRecords = (JSON.parse(milestonesRaw) as Milestone[]).filter((milestone) => participantIds.has(milestone.participant_id)).map((milestone): SelectionRecord | null => {
      const federation_id = milestone.scope ? selectionFederationIds[milestone.scope] : null;
      if (!federation_id) return null;
      return { id: `${id}-${milestone.participant_id}-${milestone.scope}-${milestone.season_label ?? ""}`, player_id: id, player_name: null, federation_id, scope: milestone.scope, category: milestone.category, format: null, season_label: milestone.season_label, club_text: milestone.club_text, position_text: milestone.position_text, source: "milestone", manual_override_id: null, notes: null };
    }).filter(Boolean) as SelectionRecord[];
    selections = applyManualSelectionCallups(baseRecords, manualCallups).filter((selection) => selection.player_id === id).sort((a, b) => latestYear(b.season_label) - latestYear(a.season_label));
  } catch {
    selections = [];
  }
  try {
    professionalClubs = (await readProfessionalClubMilestones())
      .filter((record) => record.player_id === id)
      .map((record) => shapeProfessionalClubRecord(record, clubs.data ?? []))
      .sort((left, right) => (right.season_label ?? "").localeCompare(left.season_label ?? "", "es") || left.category.localeCompare(right.category, "es"));
  } catch {
    professionalClubs = [];
  }
  d.registerFont("Anton", path.join(root, "fonts", "Anton-Regular.ttf"));
  d.roundedRect(28, 28, 539, 240, 16).fill("#f8fafb");
  card(d, 28, 284, 250, 135, "DATOS DEL JUGADOR");
  d.font("Helvetica")
    .fontSize(7)
    .fillColor("#4b5563")
    .text("Club actual", 42, 321)
    .text("Posición", 156, 321)
    .text("Altura", 42, 366)
    .text("Peso", 156, 366);
  d.font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#17212b")
    .text(club, 42, 334, { width: 105 })
    .text(rugbyPositionLabel(current?.position_text) ?? "—", 156, 334, { width: 105 })
    .text(current?.height_cm ? `${current.height_cm} cm` : "—", 42, 378)
    .text(current?.weight_kg ? `${current.weight_kg} kg` : "—", 156, 378);
  card(d, 292, 284, 130, 135, "PARTICIPACIÓN");
  await image(
    d,
    path.join(root, "ctrugby-player-logo.png"),
    307,
    321,
    [42, 42],
  );
  d.font("Helvetica-Bold")
    .fontSize(25)
    .fillColor("#e3131b")
    .text("1", 355, 328);
  d.font("Helvetica")
    .fontSize(8)
    .fillColor("#4b5563")
    .text("EDICIONES Y CAMPUS", 307, 390);
  d.font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#e3131b")
    .text("2026", 307, 402);
  card(d, 436, 284, 131, 135, "CONVOCATORIAS");
  if (selections.length) {
    const grouped = [...selections.reduce((groups, selection) => {
      const key = selection.federation_id;
      const current = groups.get(key) ?? { id: key, label: selectionLabel(key, selection.scope), count: 0 };
      current.count += 1;
      groups.set(key, current);
      return groups;
    }, new Map<string, { id: string; label: string; count: number }>()).values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
    for (const [index, group] of grouped.slice(0, 3).entries()) {
      const y = 326 + index * 28;
      await federationShield(d, root, group.id, 454, y, [22, 22]);
      d.font("Anton").fontSize(25).fillColor("#e3131b").text(String(group.count), 490, y - 2, { width: 48 });
    }
  } else {
    d.font("Helvetica")
      .fontSize(8)
      .fillColor("#4b5563")
      .text("Sin convocatorias\nregistradas", 450, 337);
  }
  card(d, 28, 435, 539, 350, "TRAYECTORIA");
  for (const [row, i] of seasons.slice(0, 14).map((v, i) => [v, i] as const)) {
    const column = i % 2,
      line = Math.floor(i / 2),
      x = column === 0 ? 42 : 305,
      y = 470 + line * 39,
      c =
        (row.club_id ? clubsById.get(row.club_id) : null) ??
        row.legacy_club_name ??
        "—";
    d.roundedRect(x, y, 248, 33, 7).fillAndStroke("#fff", "#dce2e6");
    d.font("Helvetica-Bold")
      .fontSize(8)
      .fillColor("#17212b")
      .text(
        `${String(row.season_year - 1).slice(-2)}/${String(row.season_year).slice(-2)}`,
        x + 10,
        y + 12,
      );
    d.font("Helvetica")
      .fontSize(6.5)
      .fillColor("#4b5563")
      .text(birthYear ? `S${row.season_year - birthYear}` : "", x + 10, y + 20);
    d.font("Helvetica-Bold")
      .fontSize(12)
      .fillColor(row.season_year === primaryPhotoYear ? "#e5a500" : "#b9c3cc")
      .text("★", x + 45, y + 9);
    if (photoYears.has(row.season_year)) await image(d, path.join(process.cwd(), "data", "staging", "player-season-photos", id, `${row.season_year}.png`), x + 65, y + 3, [27, 27]);
    await image(
      d,
      path.join(root, "club-shields", `${row.club_id ?? ""}.png`),
      x + 100,
      y + 5,
      [23, 23],
    );
    d.font("Helvetica-Bold")
      .fontSize(8)
      .text(pdfText(c), x + 130, y + 8, { width: 92, height: 11 });
    d.font("Helvetica")
      .fontSize(7)
      .fillColor("#4b5563")
      .text(rugbyPositionLabel(row.position_text) ?? "—", x + 130, y + 19, { width: 92, height: 9 });
  }
  d.save().rect(28, 28, 539, 240).clip().opacity(0.22);
  await image(
    d,
    path.join(root, "club-covers", `${current?.club_id ?? ""}.webp`),
    28,
    28,
    [539, 240],
    true,
  );
  d.restore();
  const fade = d.linearGradient(28, 28, 408, 28);
  fade
    .stop(0, "#ffffff", 0.86)
    .stop(0.57, "#ffffff", 0.63)
    .stop(1, "#ffffff", 0);
  d.save().rect(28, 28, 410, 240).fill(fade).restore();
  const words = name.split(" "),
    first = words.shift() ?? name,
    rest = words.join(" ");
  d.fillColor("#e3131b")
    .moveTo(48, 64)
    .lineTo(58, 48)
    .lineTo(62, 48)
    .lineTo(52, 64)
    .closePath()
    .fill();
  d.fillColor("#17212b")
    .font("Helvetica-Bold")
    .fontSize(8)
    .text("Rugby   |   FICHA DE JUGADOR", 67, 51);
  const previewAt = req.headers.get("x-ctrugby-review-preview-at");
  if (previewAt) d.font("Helvetica-Bold").fontSize(6.5).fillColor("#4b5563").text(`VISTA PREVIA · ${new Date(previewAt).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}`, 342, 52, { width: 190, align: "right" });
  d.font("Anton").fontSize(30).fillColor("#20252b").text(first, 48, 69, { width: 290 });
  d.font("Anton").fontSize(30).fillColor("#e70920").text(rest, 48, 101, { width: 330 });
  d.font("Helvetica-Bold")
    .fontSize(7)
    .fillColor("#17212b")
    .text("CATEGORÍA", 48, 150, { characterSpacing: 1.2 })
    .text("TEMPORADA", 142, 150, { characterSpacing: 1.2 });
  const playingCategories = await readSeasonCategories(id);
  d.font("Anton")
    .fontSize(21)
    .fillColor("#17212b")
    .text(playingCategories[String(current?.season_year)] || "—", 48, 160, { width: 84 })
    .text(season, 142, 160);
  d.font("Helvetica-Bold")
    .fontSize(9)
    .text(rugbyPositionLabel(current?.position_text) ?? "—", 142, 187);
  await image(
    d,
    path.join(root, "club-shields", `${current?.club_id ?? ""}.png`),
    150,
    210,
    [62, 62],
  );
  await image(
    d,
    path.join(root, "player-covers", `${id}.webp`),
    343,
    37,
    [205, 231],
    false,
  );
  if (professionalClubs.length || selections.length) {
    d.addPage();
    d.font("Helvetica-Bold").fontSize(18).fillColor("#17212b").text("DETALLE DEPORTIVO", 28, 30);
    d.font("Helvetica").fontSize(8).fillColor("#4b5563").text(name, 28, 54);
    const columnWidth = 252;
    const rowHeight = 38;
    let sectionY = 84;
    if (professionalClubs.length) {
      d.font("Helvetica-Bold").fontSize(10).fillColor("#17212b").text("CLUBES PROFESIONALES", 28, sectionY);
      sectionY += 20;
      for (const [index, record] of professionalClubs.slice(0, 10).entries()) {
        const column = index % 2;
        const row = Math.floor(index / 2);
        const x = column === 0 ? 28 : 296;
        const currentY = sectionY + row * rowHeight;
        d.roundedRect(x, currentY, columnWidth, 30, 7).fillAndStroke("#fff", "#dce2e6");
        if (record.club_id) await image(d, path.join(root, "club-shields", `${record.club_id}.png`), x + 10, currentY + 5, [20, 20]);
        d.font("Helvetica-Bold").fontSize(8).fillColor("#17212b").text(pdfText(record.club_name) || "Club profesional", x + 38, currentY + 6, { width: 132, height: 10 });
        d.font("Helvetica").fontSize(6.8).fillColor("#4b5563").text([pdfText(record.category), pdfText(record.season_label), pdfText(record.notes)].filter(Boolean).join(" · "), x + 38, currentY + 17, { width: 198, height: 10 });
      }
      sectionY += Math.ceil(Math.min(professionalClubs.length, 10) / 2) * rowHeight + 20;
    }
    const drawHeader = (y: number) => {
      d.font("Helvetica-Bold").fontSize(7).fillColor("#6b7280")
        .text("TEMP.", 42, y)
        .text("SEL.", 90, y)
        .text("DETALLE", 126, y)
        .text("TEMP.", 310, y)
        .text("SEL.", 358, y)
        .text("DETALLE", 394, y);
      d.moveTo(28, y + 13).lineTo(567, y + 13).lineWidth(0.6).strokeColor("#dce2e6").stroke();
    };
    if (selections.length) {
      d.font("Helvetica-Bold").fontSize(10).fillColor("#17212b").text("CONVOCATORIAS", 28, sectionY);
      const firstHeaderY = sectionY + 20;
      drawHeader(firstHeaderY);
      const firstStartY = firstHeaderY + 24;
      const firstRowsPerPage = Math.max(2, Math.floor((770 - firstStartY) / rowHeight) * 2);
      for (const [index, selection] of selections.entries()) {
        const pageIndex = index < firstRowsPerPage ? index : index - firstRowsPerPage;
        if (index === firstRowsPerPage || (index > firstRowsPerPage && pageIndex % 36 === 0)) {
          d.addPage();
          d.font("Helvetica-Bold").fontSize(18).fillColor("#17212b").text("CONVOCATORIAS", 28, 30);
          drawHeader(84);
        }
        const column = pageIndex % 2;
        const row = Math.floor((index < firstRowsPerPage ? pageIndex : pageIndex % 36) / 2);
        const x = column === 0 ? 28 : 296;
        const currentY = (index < firstRowsPerPage ? firstStartY : 108) + row * rowHeight;
        d.roundedRect(x, currentY, columnWidth, 30, 7).fillAndStroke("#fff", "#dce2e6");
        d.font("Helvetica-Bold").fontSize(8).fillColor("#17212b").text(selection.season_label ?? "—", x + 10, currentY + 10, { width: 44 });
        await federationShield(d, root, selection.federation_id, x + 62, currentY + 5, [20, 20]);
        const detail = [selectionLabel(selection.federation_id, selection.scope), pdfText(selection.category), pdfText(selection.format), pdfText(selection.notes || selection.club_text)].filter(Boolean).join(" · ");
        d.font("Helvetica").fontSize(7.2).fillColor("#17212b").text(detail || "Convocatoria", x + 92, currentY + 7, { width: 146, height: 18 });
      }
    }
  }
  if (assessment) {
    d.addPage();
    d.font("Helvetica-Bold")
      .fontSize(18)
      .fillColor("#17212b")
      .text("PERFIL Y GRÁFICAS", 28, 30);
    radar(
      d,
      groups[0].title,
      groups[0].keys,
      assessment.metrics,
      298,
      180,
      104,
    );
    const xy: [
      [number, number],
      [number, number],
      [number, number],
      [number, number],
      [number, number],
    ] = [
      [110, 445],
      [298, 445],
      [486, 445],
      [205, 655],
      [390, 655],
    ];
    groups
      .slice(1)
      .forEach((g, i) =>
        radar(d, g.title, g.keys, assessment.metrics, xy[i][0], xy[i][1], 55),
      );
  }
  for (const report of assessmentRecords) {
    const technicalMetrics = all
      .map((key) => [labels[key] ?? key, report.metrics[key]] as const)
      .filter(([, value]) => typeof value === "number" && Number.isFinite(value));
    const nutritionMetrics = [["Peso", report.metrics.peso, "kg"], ["Altura", report.metrics.altura, "cm"]]
      .filter(([, value]) => typeof value === "number" && Number.isFinite(value));
    if (!technicalMetrics.length && !nutritionMetrics.length && !report.notes.trim()) continue;
    d.addPage();
    d.font("Helvetica-Bold").fontSize(18).fillColor("#17212b").text("INFORME TÉCNICO Y NUTRICIONAL", 28, 30);
    d.font("Helvetica-Bold").fontSize(10).fillColor("#17212b").text(report.label || "Evaluación", 28, 59);
    d.font("Helvetica").fontSize(8).fillColor("#4b5563").text([report.season, report.evaluated_on, report.club, report.position].filter(Boolean).join(" · ") || "Sin fecha ni contexto registrados", 28, 75, { width: 539 });
    let reportY = 112;
    if (technicalMetrics.length) {
      d.font("Helvetica-Bold").fontSize(10).fillColor("#17212b").text("INFORME TÉCNICO", 28, reportY);
      reportY += 19;
      for (const [index, [label, value]] of technicalMetrics.entries()) {
        const column = index % 2;
        const row = Math.floor(index / 2);
        const x = column === 0 ? 28 : 300;
        const y = reportY + row * 23;
        d.roundedRect(x, y, 267, 18, 5).fillAndStroke("#fff", "#dce2e6");
        d.font("Helvetica").fontSize(7.5).fillColor("#4b5563").text(label, x + 9, y + 5, { width: 200 });
        d.font("Helvetica-Bold").fontSize(8).fillColor("#17212b").text(String(value), x + 225, y + 5, { width: 30, align: "right" });
      }
      reportY += Math.ceil(technicalMetrics.length / 2) * 23 + 20;
    }
    if (nutritionMetrics.length) {
      d.font("Helvetica-Bold").fontSize(10).fillColor("#17212b").text("INFORME NUTRICIONAL", 28, reportY);
      reportY += 19;
      for (const [index, [label, value, unit]] of nutritionMetrics.entries()) {
        const x = 28 + index * 272;
        d.roundedRect(x, reportY, 267, 29, 6).fillAndStroke("#fff", "#dce2e6");
        d.font("Helvetica").fontSize(8).fillColor("#4b5563").text(String(label), x + 10, reportY + 10);
        d.font("Helvetica-Bold").fontSize(11).fillColor("#17212b").text(`${value} ${unit}`, x + 110, reportY + 8, { width: 140, align: "right" });
      }
      reportY += 49;
    }
    if (report.notes.trim()) {
      if (reportY > 650) { d.addPage(); reportY = 42; }
      d.font("Helvetica-Bold").fontSize(10).fillColor("#17212b").text("OBSERVACIONES", 28, reportY);
      d.roundedRect(28, reportY + 19, 539, 110, 7).fillAndStroke("#fff", "#dce2e6");
      d.font("Helvetica").fontSize(8).fillColor("#4b5563").text(report.notes.trim(), 42, reportY + 32, { width: 510, height: 84 });
    }
  }
  if (privateReview) {
    const privatePlayer = previewPlayer ?? privateReview.player;
    const contact = privateReview.contacts;
    const privateValue = (input: unknown) => typeof input === "string" && input.trim() ? input.trim() : "Sin indicar";
    const privateRows: Array<[string, unknown]> = [
      ["DNI / NIE", privatePlayer.dni],
      ["Instagram", privatePlayer.instagram],
      ["Necesidades alimenticias", privatePlayer.allergies ?? privatePlayer.dietary_conditions],
      ["Necesidades médicas y medicamentos", privatePlayer.medications],
      ["Correo del jugador", contact?.player_email],
      ["Teléfono del jugador", contact?.player_phone_e164],
      ["Tutor/a 1", contact?.tutor1_name],
      ["Correo tutor/a 1", contact?.tutor1_email],
      ["Teléfono tutor/a 1", contact?.tutor1_phone_e164],
      ["Tutor/a 2", contact?.tutor2_name],
      ["Correo tutor/a 2", contact?.tutor2_email],
      ["Teléfono tutor/a 2", contact?.tutor2_phone_e164],
    ];
    d.addPage();
    d.roundedRect(28, 28, 539, 86, 12).fill("#fff1f2");
    d.font("Helvetica-Bold").fontSize(16).fillColor("#991b1b").text("DATOS PRIVADOS DE LA FICHA", 46, 47);
    d.font("Helvetica-Bold").fontSize(8).fillColor("#991b1b").text("DOCUMENTO PERSONAL · NO COMPARTIR", 46, 74);
    d.font("Helvetica").fontSize(8).fillColor("#4b5563").text("Solo puede ver esta página la persona que ha recibido el enlace personal. No reenvíes, publiques ni compartas este PDF.", 46, 88, { width: 500 });
    d.font("Helvetica-Bold").fontSize(11).fillColor("#17212b").text(name, 28, 142);
    let privateY = 174;
    for (const [label, entry] of privateRows) {
      if (privateY > 750) { d.addPage(); privateY = 44; }
      d.roundedRect(28, privateY, 539, 38, 7).fillAndStroke("#fff", "#dce2e6");
      d.font("Helvetica-Bold").fontSize(8).fillColor("#17212b").text(label, 42, privateY + 8, { width: 170 });
      d.font("Helvetica").fontSize(8).fillColor("#4b5563").text(privateValue(entry), 220, privateY + 8, { width: 330, height: 23 });
      privateY += 47;
    }
  }
  d.end();
  return new NextResponse(new Uint8Array(await complete), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${playerPdfFilename(id)}"`,
    },
  });
}
