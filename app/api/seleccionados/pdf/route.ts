import { currentClubSeason } from "@/lib/current-club";
import { requireConsultation } from "@/lib/consultation-access";
import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import { clubShieldUrl } from "@/app/lib/club-shields";
import { federationShieldUrl } from "@/app/lib/federation-shields";
import { rugbyPositionLabel } from "@/app/lib/rugby-positions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Profile = { category: string | null; birth_year: number | null };
type ProfessionalClubRecord = { id?: string; club_name: string; club_id: string | null; category: string; category_id?: string | null; season_label: string | null };
type Player = {
  id: string;
  first_name: string;
  last_name: string | null;
  profile?: Profile | null;
  participation_count?: number;
  milestone_count?: number;
  selected_federation_ids?: string[];
  selected_federation_counts?: Record<string, number>;
  professional_clubs?: string[];
  professional_club_records?: ProfessionalClubRecord[];
};
type PlayerSeason = { player_id: string; season_year: number; club_id: string | null; legacy_club_name: string | null; position_text: string | null };
type ClubRef = { id: string; name: string; country: string | null };
type State = { configured: boolean; players: Player[]; seasons?: PlayerSeason[]; clubs?: ClubRef[]; photos?: Record<string, string> };
type PdfRow = {
  player: Player;
  currentClub: ClubRef | null;
  currentClubName: string;
  currentPosition: string | null;
  seasons: PlayerSeason[];
  nationalFederations: string[];
  regionalFederations: string[];
  professionalRecords: ProfessionalClubRecord[];
  score: number;
};

const fullName = (player: Player) => [player.first_name, player.last_name].filter(Boolean).join(" ");
const genderLabel = (category?: string | null) => category === "F" ? "Femenino" : category === "M" ? "Masculino" : null;
const seasonLabel = (year: number) => `${String(year).slice(-2)}/${String(year + 1).slice(-2)}`;
const compactSeasonLabel = (value?: string | null) => value?.replace(/(\d{4})\/(\d{2,4})/g, (_, start: string, end: string) => `${start.slice(-2)}/${end.slice(-2)}`) ?? null;
const federationCount = (player: Player, id: string) => player.selected_federation_counts?.[id] ?? 0;
const categoryShieldUrl = (id?: string | null) => id ? `/api/hitos/profesionales/categorias/${encodeURIComponent(id)}/escudo` : null;

function selectedRows(state: State) {
  const seasonsByPlayer = new Map<string, PlayerSeason[]>();
  for (const season of state.seasons ?? []) seasonsByPlayer.set(season.player_id, [...(seasonsByPlayer.get(season.player_id) ?? []), season]);
  const clubsById = new Map((state.clubs ?? []).map((club) => [club.id, club]));
  return state.players.filter((player) => (player.selected_federation_ids?.length ?? 0) > 0 || (player.milestone_count ?? 0) > 0 || (player.professional_club_records?.length ?? 0) > 0).map((player): PdfRow => {
    const seasons = [...(seasonsByPlayer.get(player.id) ?? [])].sort((a, b) => b.season_year - a.season_year);
    const currentSeason = currentClubSeason(seasons);
    const currentClub = currentSeason?.club_id ? clubsById.get(currentSeason.club_id) ?? null : null;
    const currentClubName = currentClub?.name ?? currentSeason?.legacy_club_name ?? "Club pendiente";
    const currentPosition = rugbyPositionLabel(currentSeason?.position_text ?? null);
    const nationalFederations = (player.selected_federation_ids ?? []).filter((id) => id.startsWith("FN"));
    const regionalFederations = (player.selected_federation_ids ?? []).filter((id) => id.startsWith("FT"));
    const professionalRecords = player.professional_club_records ?? [];
    const score = nationalFederations.reduce((total, id) => total + federationCount(player, id), 0) + regionalFederations.reduce((total, id) => total + federationCount(player, id), 0) + professionalRecords.length;
    return { player, currentClub, currentClubName, currentPosition, seasons, nationalFederations, regionalFederations, professionalRecords, score };
  }).sort((a, b) => b.score - a.score || fullName(a.player).localeCompare(fullName(b.player), "es"));
}

function ellipsis(value: string, limit: number) {
  return value.length > limit ? `${value.slice(0, Math.max(0, limit - 1))}…` : value;
}

async function getImage(src: string | null | undefined, request: NextRequest, cache: Map<string, Buffer>) {
  if (!src) return null;
  const url = src.startsWith("http") ? src : new URL(src, request.url).toString();
  if (cache.has(url)) return cache.get(url)!;
  try {
    const response = await fetch(url, { cache: "no-store", headers: { cookie: request.headers.get("cookie") ?? "" }, signal: AbortSignal.timeout(4500) });
    if (!response.ok) return null;
    const input = Buffer.from(await response.arrayBuffer());
    const output = await sharp(input).resize(180, 180, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
    cache.set(url, output);
    return output;
  } catch {
    return null;
  }
}

function drawCover(doc: PDFKit.PDFDocument, rows: PdfRow[], ctrLogo: Buffer | null) {
  doc.rect(0, 0, doc.page.width, doc.page.height).fill("#f4f5f5");

  const coverX = 36;
  const coverY = 24;
  const coverW = doc.page.width - 72;
  const coverH = 156;
  doc.save();
  doc.roundedRect(coverX, coverY, coverW, coverH, 10).clip();
  doc.rect(coverX, coverY, coverW, coverH).fill("#fafbfb");
  doc.save();
  doc.opacity(0.3);
  const stripeRight = coverX + coverW + 10;
  const stripeTop = coverY - 24;
  const stripeBottom = coverY + coverH + 28;
  doc.polygon([stripeRight - 190, stripeTop], [stripeRight - 135, stripeTop], [stripeRight - 244, stripeBottom], [stripeRight - 302, stripeBottom]).fill("#78838c");
  doc.polygon([stripeRight - 116, stripeTop], [stripeRight - 62, stripeTop], [stripeRight - 171, stripeBottom], [stripeRight - 229, stripeBottom]).fill("#a1a9af");
  doc.polygon([stripeRight - 42, stripeTop], [stripeRight + 12, stripeTop], [stripeRight - 98, stripeBottom], [stripeRight - 154, stripeBottom]).fill("#dfe3e8");
  doc.restore();
  if (ctrLogo) doc.image(ctrLogo, coverX + coverW - 134, coverY + 39, { fit: [92, 92], align: "center", valign: "center" });
  doc.restore();
  doc.roundedRect(coverX, coverY, coverW, coverH, 10).lineWidth(0.7).strokeColor("#e4e7e9").stroke();

  const textX = coverX + 32;
  const textY = coverY + 30;
  doc.save();
  doc.polygon([textX, textY + 1], [textX + 8, textY + 1], [textX + 1, textY + 15], [textX - 7, textY + 15]).fill("#ef001b");
  doc.fillColor("#18202a").font("Helvetica-Bold").fontSize(7.2).text("Rugby - Jugadores destacados", textX + 18, textY + 3, { characterSpacing: 1.7 });
  doc.fillColor("#292d30").font("CTR Cover").fontSize(35).text("DESTACADOS", textX, textY + 30, { lineGap: -4 });
  doc.fillColor("#ef001b").font("CTR Cover").fontSize(35).text("RUGBY", textX, textY + 69, { lineGap: -4 });
  doc.restore();

  const total = rows.length;
  const clubs = rows.filter((row) => row.professionalRecords.length > 0).length;
  const national = rows.filter((row) => row.nationalFederations.length > 0).length;
  const regional = rows.filter((row) => row.regionalFederations.length > 0).length;
  const stats = [["Total", total], ["Clubs Pro.", clubs], ["Fed. Nac.", national], ["Fed. Reg.", regional]] as const;
  const statsY = coverY + coverH + 14;
  stats.forEach(([label, value], index) => {
    const statGap = 14;
    const statW = (doc.page.width - 72 - statGap * 3) / 4;
    const x = 36 + index * (statW + statGap);
    doc.roundedRect(x, statsY, statW, 38, 7).fillAndStroke("#ffffff", "#e5e7eb");
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(15).text(String(value), x + 10, statsY + 9);
    doc.fillColor("#6b7280").fontSize(6.8).text(label.toUpperCase(), x + 10, statsY + 25, { width: statW - 20, characterSpacing: 0.5 });
  });
  const noteY = statsY + 52;
  doc.roundedRect(36, noteY, doc.page.width - 72, 26, 7).fillAndStroke("#ffffff", "#e5e7eb");
  doc.fillColor("#4b5563").font("Helvetica-Bold").fontSize(7.8).text("Jugadores que han sido convocados al menos una vez por una federación o que tienen registro en clubs profesionales.", 48, noteY + 9, { width: doc.page.width - 96 });
}

function drawFooter(doc: PDFKit.PDFDocument, pageNumber: number) {
  doc.fillColor("#9ca3af").font("Helvetica").fontSize(7).text(`Rugby Data Manager · Página ${pageNumber}`, 36, doc.page.height - 26, { width: doc.page.width - 72, align: "right" });
}

function drawRoundImage(doc: PDFKit.PDFDocument, image: Buffer | null, x: number, y: number, size: number, fallback: string, fontSize = 20) {
  doc.save();
  doc.circle(x + size / 2, y + size / 2, size / 2).fill("#f3f4f6");
  doc.circle(x + size / 2, y + size / 2, size / 2).clip();
  if (image) doc.image(image, x, y, { cover: [size, size], align: "center", valign: "center" });
  doc.restore();
  if (!image) doc.fillColor("#9ca3af").font("Helvetica-Bold").fontSize(fontSize).text(fallback, x, y + size / 2 - fontSize / 2, { width: size, align: "center" });
}

async function drawShield(doc: PDFKit.PDFDocument, image: Buffer | null, x: number, y: number, size: number, fallback = "?") {
  doc.save();
  doc.circle(x + size / 2, y + size / 2, size / 2).fill("#ffffff");
  doc.circle(x + size / 2, y + size / 2, size / 2).lineWidth(0.6).strokeColor("#e5e7eb").stroke();
  if (image) doc.image(image, x + 2, y + 2, { fit: [size - 4, size - 4], align: "center", valign: "center" });
  else doc.fillColor("#9ca3af").font("Helvetica-Bold").fontSize(8).text(fallback, x, y + size / 2 - 4, { width: size, align: "center" });
  doc.restore();
}

async function drawFederationBadge(doc: PDFKit.PDFDocument, request: NextRequest, cache: Map<string, Buffer>, id: string, count: number, x: number, y: number) {
  doc.roundedRect(x, y, 52, 21, 10.5).fillAndStroke("#ffffff", "#d1d5db");
  await drawShield(doc, await getImage(federationShieldUrl(id), request, cache), x + 5, y + 2, 16, "");
  doc.circle(x + 39, y + 10.5, 8).fill("#e3131b");
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7.2).text(String(count), x + 31, y + 7.5, { width: 16, align: "center" });
}

async function drawProfessionalBadge(doc: PDFKit.PDFDocument, request: NextRequest, cache: Map<string, Buffer>, record: ProfessionalClubRecord, x: number, y: number) {
  const badgeW = 80;
  const badgeH = 34;
  doc.roundedRect(x, y, badgeW, badgeH, 7).fillAndStroke("#ffffff", "#d1d5db");
  const categoryImage = await getImage(categoryShieldUrl(record.category_id), request, cache);
  const clubImage = await getImage(record.club_id ? clubShieldUrl(record.club_id) : null, request, cache);
  await drawShield(doc, categoryImage, x + 18, y + 3, 15, "?");
  if (clubImage) await drawShield(doc, clubImage, x + 43, y + 3, 15, "");
  const name = ellipsis(record.club_name || "Club no indicado", 16);
  const detail = ellipsis([record.category, compactSeasonLabel(record.season_label)].filter(Boolean).join(" · "), 18);
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(5.6).text(name, x + 5, y + 21, { width: badgeW - 10, align: "center", height: 6 });
  doc.fillColor("#6b7280").font("Helvetica-Bold").fontSize(5).text(detail, x + 5, y + 28, { width: badgeW - 10, align: "center", height: 6 });
}

function cardHeight(row: PdfRow) {
  const federationCount = row.nationalFederations.length + row.regionalFederations.length;
  const professionalCount = row.professionalRecords.length;
  const rightContentHeight = 58 + federationCount * 24 + (professionalCount ? 13 + professionalCount * 38 : 0) + 18;
  return Math.max(210, rightContentHeight);
}

async function drawCard(doc: PDFKit.PDFDocument, request: NextRequest, cache: Map<string, Buffer>, row: PdfRow, x: number, y: number, w: number, h: number, ctrLogo: Buffer | null) {
  doc.roundedRect(x, y, w, h, 8).fillAndStroke("#ffffff", "#e5e7eb");
  const playerPhoto = await getImage(`/api/jugadores/foto/${row.player.id}`, request, cache);
  const sideX = x + w - 88;
  const leftX = x + 18;
  const leftW = sideX - leftX - 12;
  const photoSize = 70;
  drawRoundImage(doc, playerPhoto, leftX + (leftW - photoSize) / 2, y + 12, photoSize, row.player.first_name.slice(0, 1), 26);
  const firstName = row.player.first_name.toUpperCase();
  const lastName = (row.player.last_name ?? "").toUpperCase();
  doc.fillColor("#292d30").font("CTR Cover").fontSize(15.6).text(ellipsis(firstName, 13), leftX, y + 86, { width: leftW, height: 17 });
  if (lastName) doc.fillColor("#ef001b").font("CTR Cover").fontSize(15.6).text(ellipsis(lastName, 13), leftX, y + 103, { width: leftW, height: 17 });
  const meta = [genderLabel(row.player.profile?.category), row.player.profile?.birth_year ? `Nac. ${row.player.profile.birth_year}` : null, row.currentPosition].filter(Boolean).join(" · ");
  if (meta) doc.fillColor("#4b5563").font("Helvetica-Bold").fontSize(5.8).text(ellipsis(meta, 28), leftX, y + 122, { width: leftW, height: 8 });
  const clubImage = await getImage(row.currentClub?.id ? clubShieldUrl(row.currentClub.id) : null, request, cache);
  const clubY = y + 136;
  if (clubImage) await drawShield(doc, clubImage, leftX, clubY, 25, "");
  doc.fillColor("#111827").font("Helvetica-Bold").fontSize(7.8).text(ellipsis(row.currentClubName, clubImage ? 17 : 23), leftX + (clubImage ? 31 : 0), clubY + 4, { width: clubImage ? leftW - 31 : leftW, height: 10 });
  const clubYears = row.seasons.slice(0, 5).map((season) => seasonLabel(season.season_year)).join(", ") || "Sin temporadas";
  doc.fillColor("#6b7280").font("Helvetica-Bold").fontSize(5.4).text(ellipsis(clubYears, clubImage ? 18 : 24), leftX + (clubImage ? 31 : 0), clubY + 16, { width: clubImage ? leftW - 31 : leftW, height: 7 });
  doc.moveTo(sideX - 8, y + 12).lineTo(sideX - 8, y + h - 12).lineWidth(0.6).strokeColor("#f3f4f6").stroke();
  doc.fillColor("#6b7280").font("Helvetica-Bold").fontSize(5.7).text("PARTICIPACIONES", sideX, y + 12, { width: 76, align: "center", characterSpacing: 0.25 });
  doc.roundedRect(sideX + 14, y + 23, 46, 23, 11.5).fillAndStroke("#ffffff", "#d1d5db");
  if (ctrLogo) doc.image(ctrLogo, sideX + 18, y + 25, { fit: [18, 18] });
  doc.circle(sideX + 49, y + 34.5, 8.5).fill("#e3131b");
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7.5).text(String(row.player.participation_count ?? 0), sideX + 40.5, y + 31.6, { width: 17, align: "center" });
  doc.fillColor("#6b7280").font("Helvetica-Bold").fontSize(5.7).text("CONVOCATORIAS", sideX, y + 52, { width: 76, align: "center", characterSpacing: 0.25 });
  let fy = y + 60;
  for (const id of [...row.nationalFederations, ...row.regionalFederations]) {
    await drawFederationBadge(doc, request, cache, id, federationCount(row.player, id), sideX + 10, fy);
    fy += 24;
  }
  if (row.professionalRecords.length) {
    const proTitleY = fy + 7;
    doc.fillColor("#6b7280").font("Helvetica-Bold").fontSize(5.7).text("CLUBS PRO.", sideX, proTitleY, { width: 76, align: "center", characterSpacing: 0.25 });
    let proY = proTitleY + 12;
    for (const record of row.professionalRecords) {
      await drawProfessionalBadge(doc, request, cache, record, sideX - 2, proY);
      proY += 38;
    }
  }
}

export async function GET(request: NextRequest) {
  const consultationDenied = await requireConsultation(request);
  if (consultationDenied) return consultationDenied;

  const response = await fetch(new URL("/api/jugadores?view=public", request.url), {
    cache: "no-store",
    headers: { cookie: request.headers.get("cookie") ?? "" },
  });
  if (!response.ok) return NextResponse.json({ error: "No se ha podido preparar el PDF de destacados." }, { status: 503 });
  const state = await response.json() as State;
  if (!state.configured) return NextResponse.json({ error: "El catálogo todavía no está conectado." }, { status: 503 });
  const rows = selectedRows(state);
  const cache = new Map<string, Buffer>();
  const ctrLogo = await getImage("/ctrugby-player-logo.png", request, cache);
  const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
  doc.registerFont("CTR Cover", path.join(process.cwd(), "public", "fonts", "Anton-Regular.ttf"));
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const complete = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  let pageNumber = 1;
  drawCover(doc, rows, ctrLogo);
  let y = 286;
  const gap = 8;
  const cardW = (doc.page.width - 72 - gap) / 2;
  for (let index = 0; index < rows.length; index += 2) {
    const pair = rows.slice(index, index + 2);
    const rowH = Math.max(...pair.map(cardHeight));
    if (y + rowH > doc.page.height - 38) {
      drawFooter(doc, pageNumber++);
      doc.addPage();
      y = 36;
    }
    await drawCard(doc, request, cache, pair[0], 36, y, cardW, rowH, ctrLogo);
    if (pair[1]) await drawCard(doc, request, cache, pair[1], 36 + cardW + gap, y, cardW, rowH, ctrLogo);
    y += rowH + gap;
  }
  drawFooter(doc, pageNumber);
  doc.end();
  return new NextResponse(new Uint8Array(await complete), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="ctrugby-destacados.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}














