"use client";
/* eslint-disable @next/next/no-img-element */

import { Clock3, MapPin, X } from "lucide-react";
import Link from "@/app/components/sport-link";
import { SearchablePicker } from "@/app/components/club-picker";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Club = { id: string; name: string; active: boolean; city: string };
type Draft = { day: string; venue: "local" | "visitante"; home: string; away: string; homeLabel: string; awayLabel: string; callTime: string; field: string; category: string; phase: string };
const blank: Draft = { day: "", venue: "local", home: "", away: "", homeLabel: "", awayLabel: "", callTime: "", field: "", category: "S16-B", phase: "" };
const cabreraExample: Draft = { day: "2026-10-17", venue: "visitante", home: "ESP0040", away: "ESP0022", homeLabel: "GEIEG", awayLabel: "CABRERA", callTime: "13:00", field: "Camp Rugbi Cabrera de Mar", category: "S16-B", phase: "Fase previa F" };
const draftFromSearch = (search: URLSearchParams): Draft => search.get("convocatoria") ? { ...blank, venue: search.get("venue") === "visitante" ? "visitante" : "local", day: search.get("day") ?? "", callTime: search.get("callTime") ?? "", home: search.get("home") ?? "", away: search.get("away") ?? "", homeLabel: search.get("homeLabel") ?? "", awayLabel: search.get("awayLabel") ?? "", field: search.get("field") ?? "", category: search.get("category") ?? "", phase: search.get("phase") ?? "" } : search.get("ejemplo") === "cabrera" ? cabreraExample : blank;
const posterBackground = "/club-backgrounds/rugby-cabrera-castillo.png";
const organizer = "RUGBY LAIETANS";
const organizerClubs = "Rugby Alella, Rugby Badalona, Rugby Cabrera";
const locationIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d10a0a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
const shield = (id: string) => `/api/clubs/escudo/${encodeURIComponent(id)}`;
const showTeamName = (club: Club | undefined, name: string) => club?.id !== "ESP0022" && club?.name.toLocaleLowerCase("es") !== "rugby cabrera" && name.trim().toLocaleLowerCase("es") !== "cabrera";
const locationText = (field: string) => !field.trim() ? "Campo pendiente" : /^camp de rugby\b/i.test(field.trim()) ? field.trim() : `Camp de Rugby ${field.trim()}`;
const esc = (value: string) => value.replace(/[&<>\"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]!));
const dateText = (value: string) => { if (!value) return "ELIGE EL DÍA"; const date = new Date(`${value}T12:00:00`); return `${["DIUMENGE", "DILLUNS", "DIMARTS", "DIMECRES", "DIJOUS", "DIVENDRES", "DISSABTE"][date.getDay()]} ${date.getDate()} ${["GEN", "FEB", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OCT", "NOV", "DES"][date.getMonth()]} ${date.getFullYear()}`; };

// The escudos are served from an API route.  Embed them temporarily in the
// poster DOM so the image exporter receives the exact same pixels as preview.
const imageAsDataUrl = async (source: string) => {
  const response = await fetch(source, { cache: "no-store" });
  if (!response.ok) throw new Error("No se ha podido cargar un escudo.");
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("No se ha podido preparar un escudo."));
    reader.readAsDataURL(blob);
  });
};

const loadCanvasImage = async (source: string) => {
  const image = new Image();
  image.src = await imageAsDataUrl(source);
  await image.decode();
  return image;
};

const rounded = (context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
  context.beginPath(); context.roundRect(x, y, width, height, radius); context.closePath();
};
const fitImage = (context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) => {
  const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight); const drawWidth = image.naturalWidth * ratio; const drawHeight = image.naturalHeight * ratio;
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
};
const coverImage = (context: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number, positionX = .5) => {
  const ratio = Math.max(width / image.naturalWidth, height / image.naturalHeight); const drawWidth = image.naturalWidth * ratio; const drawHeight = image.naturalHeight * ratio;
  context.drawImage(image, (width - drawWidth) * positionX, (height - drawHeight) / 2, drawWidth, drawHeight);
};
const drawLines = (context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
  const words = text.split(/\s+/); const lines: string[] = []; let line = "";
  words.forEach(word => { const candidate = line ? `${line} ${word}` : word; if (line && context.measureText(candidate).width > maxWidth) { lines.push(line); line = word; } else line = candidate; });
  if (line) lines.push(line); lines.forEach((item, index) => context.fillText(item, x, y + index * lineHeight));
};
const canvasPoster = async (draft: Draft, home: Club, away: Club, homeName: string, awayName: string) => {
  const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1350;
  const context = canvas.getContext("2d"); if (!context) throw new Error("No se ha podido crear la imagen.");
  const [background, homeShield, awayShield] = await Promise.all([loadCanvasImage(posterBackground), loadCanvasImage(shield(home.id)), loadCanvasImage(shield(away.id))]);
  coverImage(context, background, 1080, 1350, .76); context.fillStyle = "rgba(7,29,46,.12)"; context.fillRect(0, 0, 1080, 1350);
  context.fillStyle = "rgba(7,29,46,.85)"; context.fillRect(0, 0, 1080, 180);
  context.fillStyle = "#fff"; context.textAlign = "center"; context.font = "900 28px Arial"; context.fillText(organizer, 540, 77); context.font = "600 20px Arial"; context.fillText(organizerClubs, 540, 118);
  const pill = (text: string, y: number, font: string, paddingX: number, height: number, radius: number) => { context.font = font; const width = context.measureText(text).width + paddingX * 2; rounded(context, 540 - width / 2, y, width, height, radius); context.fillStyle = "rgba(244,38,45,.78)"; context.fill(); context.fillStyle = "#fff"; context.textAlign = "center"; context.fillText(text, 540, y + height * .72); };
  if (draft.category) pill(draft.category.toUpperCase(), 245, "900 52px Arial", 56, 74, 16); pill(dateText(draft.day), 333, "900 42px Arial", 54, 72, 36);
  rounded(context, 100, 470, 880, 710, 36); context.fillStyle = "rgba(255,250,242,.68)"; context.fill();
  fitImage(context, homeShield, 235, 598, 260, 242); fitImage(context, awayShield, 585, 598, 260, 242);
  context.fillStyle = "#d10a0a"; context.font = "900 48px Arial"; context.fillText("VS", 540, 742);
  context.fillStyle = "#171717"; context.font = "700 34px Arial";
  if (showTeamName(home, homeName)) drawLines(context, homeName, 365, 880, 260, 40); if (showTeamName(away, awayName)) drawLines(context, awayName, 715, 880, 260, 40);
  context.strokeStyle = "#f0d8d0"; context.lineWidth = 2; context.beginPath(); context.moveTo(170, 992); context.lineTo(910, 992); context.stroke();
  context.fillStyle = "#d10a0a"; context.strokeStyle = "#d10a0a"; context.lineWidth = 5; context.font = "900 40px Arial";
  const timeText = `Convocatoria · ${draft.callTime || "--:--"} h`; const timeWidth = context.measureText(timeText).width; const timeStart = (1080 - timeWidth - 56) / 2;
  context.beginPath(); context.arc(timeStart + 20, 1039, 18, 0, Math.PI * 2); context.stroke(); context.beginPath(); context.moveTo(timeStart + 20, 1027); context.lineTo(timeStart + 20, 1039); context.lineTo(timeStart + 30, 1044); context.stroke(); context.textAlign = "left"; context.fillText(timeText, timeStart + 56, 1054);
  context.font = "700 34px Arial"; const fieldText = locationText(draft.field); const fieldWidth = context.measureText(fieldText).width; const fieldStart = (1080 - fieldWidth - 52) / 2;
  context.beginPath(); context.arc(fieldStart + 18, 1102, 15, Math.PI, 0); context.lineTo(fieldStart + 33, 1104); context.quadraticCurveTo(fieldStart + 18, 1130, fieldStart + 18, 1130); context.quadraticCurveTo(fieldStart + 3, 1104, fieldStart + 3, 1104); context.closePath(); context.stroke(); context.beginPath(); context.arc(fieldStart + 18, 1102, 4, 0, Math.PI * 2); context.stroke(); context.fillText(fieldText, fieldStart + 52, 1118); context.textAlign = "center";
  if (draft.phase.trim()) { rounded(context, 100, 1230, 880, 80, 18); context.fillStyle = "rgba(7,29,46,.85)"; context.fill(); context.fillStyle = "#fff"; context.font = "900 36px Arial"; context.fillText(draft.phase, 540, 1284); }
  return canvas.toDataURL("image/jpeg", .94);
};

function posterHtml(draft: Draft, home: Club, away: Club, origin: string) {
  const homeName = draft.homeLabel || home.name; const awayName = draft.awayLabel || away.name; const venue = locationText(draft.field);
  return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Convocatoria</title><style>*{box-sizing:border-box}body{margin:0;background:#eee;font-family:Arial,sans-serif}.p{position:relative;overflow:hidden;width:1080px;min-height:1920px;margin:auto;color:#fff;background:linear-gradient(#071d2e40,#071d2e15),url('${esc(origin + posterBackground)}') 76% center/cover}header{position:relative;padding:48px;background:#071d2ed9;text-align:center;font-size:48px;font-weight:900;letter-spacing:2px}.category{position:relative;margin:90px auto 0;text-align:center;color:#ffe2e2;font-size:64px;font-weight:900;letter-spacing:3px;background:#f4262d;width:max-content;max-width:90%;padding:16px 40px;border-radius:20px}.card{position:relative;width:820px;margin:38px auto;padding:70px 60px;border-radius:36px;background:#fffdf0d9;color:#20252a;text-align:center}.clubs{display:grid;grid-template-columns:1fr;gap:35px;align-items:center}.club img{display:block;width:300px;height:300px;object-fit:contain;margin:0 auto 20px}.club b{display:block;font-size:38px;line-height:1.1}.vs{font-size:35px;font-weight:900;color:#ed1e2d}.phase{width:820px;margin:24px auto;padding:22px;text-align:center;border-radius:18px;background:#071d2e;color:#fff;font-size:36px;font-weight:900}.phase small{display:block;margin-bottom:10px;font-size:18px;letter-spacing:3px;color:#cbd8df}.meta{margin-top:46px;border-top:2px solid #e8d8d0;padding-top:35px;color:#d10a0a;font-size:32px;font-weight:800}.meta p{margin:17px}.location{display:flex;justify-content:center;align-items:center;gap:12px}.location svg{flex-shrink:0}.p{height:1350px;min-height:1350px}header{height:180px;padding:18px;font-size:42px}header>div:first-child{font-size:28px!important}header>div:nth-child(2){margin:8px 0 16px!important}.category{margin:20px auto 0;font-size:52px;padding:5px 40px}.card{position:absolute;top:290px;left:130px;height:920px;margin:0;padding:35px 60px}.clubs{gap:18px}.club img{width:220px;height:220px;margin-bottom:12px}.club b{font-size:36px}.meta{margin-top:25px;padding-top:20px}.meta p{margin:18px 0}.phase{position:absolute;left:130px;bottom:40px;margin:0;padding:18px}</style><article class="p"><header><div style="font-size:32px">${organizer}</div><div style="font-size:20px;font-weight:600;letter-spacing:0;margin:12px 0 28px">${organizerClubs}</div>${esc(dateText(draft.day))}</header>${draft.category ? `<p class="category">${esc(draft.category)}</p>` : ""}<section class="card"><div class="clubs"><div class="club"><img src="${esc(origin + shield(home.id))}"><b>${esc(homeName)}</b></div><div class="vs">VS</div><div class="club"><img src="${esc(origin + shield(away.id))}"><b>${esc(awayName)}</b></div></div><div class="meta"><p>⌚ Convocatoria · ${esc(draft.callTime)} h</p><p class="location">${locationIcon}<span>${esc(venue)}</span></p></div></section>${draft.phase?.trim() ? `<section class="phase">${esc(draft.phase)}</section>` : ""}</article>`;
}

function CallupGeneratorContent() {
  const search = useSearchParams(); const router = useRouter();
  const fromTable = Boolean(search.get("convocatoria"));
  const [preview, setPreview] = useState<{ url: string; filename: string; html?: string } | null>(null); const [jpgUrl, setJpgUrl] = useState<string | null>(null); const [jpgBlob, setJpgBlob] = useState<Blob | null>(null);
  const [preparing, setPreparing] = useState(false);
  const previewDialog = useRef<HTMLDialogElement>(null); const posterRef = useRef<HTMLDivElement>(null);
  const autoExported = useRef(false); const jpgPreparationStarted = useRef(false);
  useEffect(() => {
    if (preview) previewDialog.current?.showModal();
    else previewDialog.current?.close();
  }, [preview]);
  useEffect(() => () => { if (preview?.html) URL.revokeObjectURL(preview.url); }, [preview]);
  const confirmDownload = () => {
    if (!preview) return;
    const link = document.createElement("a"); link.href = preview.url; link.download = preview.filename; link.click();
    setNotice("Convocatoria descargada.");
  };

  const [clubs, setClubs] = useState<Club[]>([]); const [draft, setDraft] = useState(() => draftFromSearch(search)); const [notice, setNotice] = useState(""); const [loading, setLoading] = useState(true); const [callupLoading, setCallupLoading] = useState(fromTable);
  useEffect(() => { const c = new AbortController(); fetch("/api/clubs", { cache: "no-store", signal: c.signal }).then(async r => { const body = await r.json(); if (!r.ok) throw new Error(body.error ?? "No se han podido cargar los clubs."); return body; }).then(body => { setClubs((body.clubs as Club[]).filter(club => club.active)); setLoading(false); }).catch(error => { if (!c.signal.aborted) { setNotice(error instanceof Error ? error.message : "No se han podido cargar los clubs publicados."); setLoading(false); } }); return () => c.abort(); }, []);
  useEffect(() => {
    const id = search.get("convocatoria");
    if (!id) return;
    const controller = new AbortController();
    fetch("/api/convocatorias", { cache: "no-store", signal: controller.signal })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "No se ha podido cargar la convocatoria."); return body.rows as Array<Draft & { id: string }>; })
      .then(rows => { const saved = rows.find(row => row.id === id); if (saved) setDraft({ ...blank, ...saved }); else setNotice("La convocatoria ya no existe."); })
      .catch(error => { if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "No se ha podido cargar la convocatoria."); })
      .finally(() => { if (!controller.signal.aborted) setCallupLoading(false); });
    return () => controller.abort();
  }, [search]);
  useEffect(() => { if (!fromTable) router.replace("/convocatorias/lista"); }, [fromTable, router]);
  const clubById = useMemo(() => new Map(clubs.map(club => [club.id, club])), [clubs]); const rawHome = clubById.get(draft.home); const rawAway = clubById.get(draft.away); const reverseForVisitor = draft.venue === "visitante" && rawHome?.id === "ESP0022"; const home = reverseForVisitor ? rawAway : rawHome; const away = reverseForVisitor ? rawHome : rawAway;
  const rawHomeName = draft.homeLabel || rawHome?.name || "Equipo"; const rawAwayName = draft.awayLabel || rawAway?.name || "Equipo"; const homeName = reverseForVisitor ? rawAwayName : rawHomeName; const awayName = reverseForVisitor ? rawHomeName : rawAwayName;
  const set = (key: keyof Draft, value: string) => setDraft(old => ({ ...old, [key]: value, ...(key === "home" ? { homeLabel: "" } : key === "away" ? { awayLabel: "" } : {}) }));
  const complete = () => { if (!draft.day || !home || !away || !draft.callTime || !draft.field) { setNotice("Completa día, equipo local, equipo visitante, hora de convocatoria y campo."); return false; } return true; };
  const downloadHtml = () => {
    if (!complete() || !home || !away) return;
    const html = posterHtml(draft, home, away, location.origin);
    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    setPreview({ url, html, filename: `convocatoria-${draft.day}.html` }); setNotice("");
  };
  const downloadJpg = async (direct = false) => {
    if (!complete() || !posterRef.current || !home || !away) return;
    setPreparing(true);
    try {
      setNotice("Preparando JPG vertical 1080 × 1350…");
      const dataUrl = await canvasPoster(draft, home, away, homeName, awayName);
      const blob = await (await fetch(dataUrl)).blob();
      const objectUrl = URL.createObjectURL(blob);      const filename = `convocatoria-${draft.day}.jpg`;
      if (direct) { setJpgBlob(blob); setJpgUrl(previous => { if (previous) URL.revokeObjectURL(previous); return objectUrl; }); setNotice(""); }
      else { setPreview({ url: objectUrl, filename }); setNotice(""); }    } catch (error) { setNotice(error instanceof Error ? error.message : "No se ha podido preparar el JPG."); } finally { setPreparing(false); }
  };  const savePreparedJpg = async () => {
    if (!jpgBlob) return;
    const filename = `convocatoria-${draft.day}.jpg`;
    try {
      const picker = (window as unknown as { showSaveFilePicker?: (options: unknown) => Promise<{ createWritable: () => Promise<{ write: (file: Blob) => Promise<void>; close: () => Promise<void> }> }> }).showSaveFilePicker;
      if (picker) {
        const handle = await picker({ suggestedName: filename, types: [{ description: "Imagen JPG", accept: { "image/jpeg": [".jpg"] } }] });
        const writable = await handle.createWritable(); await writable.write(jpgBlob); await writable.close(); setNotice("JPG guardado."); return;
      }
      const link = document.createElement("a"); link.href = jpgUrl ?? URL.createObjectURL(jpgBlob); link.download = filename; document.body.appendChild(link); link.click(); link.remove(); setNotice("JPG descargado.");
    } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setNotice("No se ha podido guardar el JPG."); }
  };  useEffect(() => {
    if (fromTable && !loading && !callupLoading && home && away && !jpgUrl && !preparing && !jpgPreparationStarted.current) { jpgPreparationStarted.current = true; void downloadJpg(true); }
  // El archivo se prepara antes del clic para que el navegador permita descargarlo de forma nativa.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromTable, loading, callupLoading, home, away, jpgUrl, preparing]);
  useEffect(() => {
    if (search.get("export") === "jpg" && !loading && home && away && !autoExported.current) { autoExported.current = true; void downloadJpg(true); }
  // The URL is read once to trigger a single automatic JPG preview from the table.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, loading, home, away]);
  if (!fromTable) return null;
  return <main className="min-h-screen bg-neutral-100 text-neutral-900" style={{ paddingTop: 72 }}><header className="catalog-topbar" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 80 }}><Link href="/convocatorias/lista" className="catalog-brand" aria-label="LIKID Convocatorias"><span>LIKID</span></Link></header><div className="mx-auto max-w-7xl p-5 sm:p-8"><header className="mb-6"><p className="text-xs font-black tracking-widest text-red-700">APP CONVOCATORIAS</p><h1 className="text-2xl font-black">Generador de convocatorias</h1><p className="mt-1 text-sm text-neutral-600">{fromTable ? "Datos cargados desde la tabla de convocatorias." : "Elige los equipos publicados y genera el cartel para redes sociales."}</p></header><div className={`grid gap-6 ${fromTable ? "" : "xl:grid-cols-[390px_minmax(0,1fr)]"}`}>{!fromTable && <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="font-black">Datos de la convocatoria</h2><Link href="/convocatorias/generador?ejemplo=cabrera" className="mt-3 block rounded-lg bg-slate-900 px-3 py-2 text-center text-sm font-bold text-white">Ver propuesta: GEIEG · Cabrera</Link><div className="mt-5 grid gap-4"><Field label="Día"><input type="date" value={draft.day} onChange={e => set("day", e.target.value)} /></Field><SearchablePicker options={clubs.map(club => ({ id: club.id, name: club.name + (club.city ? ` · ${club.city}` : "") }))} value={draft.home} onChange={id => set("home", id)} label="Equipo local" placeholder={loading ? "Cargando clubs…" : "Buscar por nombre, ciudad o código…"} emptyLabel="Selecciona el equipo local" inputClass="w-full rounded-lg border bg-white p-3 text-sm font-normal text-neutral-900" /><Field label="Nombre personalizado (opcional)"><input value={draft.homeLabel} placeholder={home?.name ?? "Nombre del equipo"} onChange={e => set("homeLabel", e.target.value)} /></Field><SearchablePicker options={clubs.map(club => ({ id: club.id, name: club.name + (club.city ? ` · ${club.city}` : "") }))} value={draft.away} onChange={id => set("away", id)} label="Equipo visitante" placeholder={loading ? "Cargando clubs…" : "Buscar por nombre, ciudad o código…"} emptyLabel="Selecciona el equipo visitante" inputClass="w-full rounded-lg border bg-white p-3 text-sm font-normal text-neutral-900" /><Field label="Nombre personalizado (opcional)"><input value={draft.awayLabel} placeholder={away?.name ?? "Nombre del equipo"} onChange={e => set("awayLabel", e.target.value)} /></Field><Field label="Hora de convocatoria"><input type="time" value={draft.callTime} onChange={e => set("callTime", e.target.value)} /></Field><Field label="Campo"><input value={draft.field} placeholder="Campo de rugby…" onChange={e => set("field", e.target.value)} /></Field><Field label="Fase (opcional)"><input value={draft.phase ?? ""} placeholder="Fase previa · Jornada 3…" onChange={e => set("phase", e.target.value)} /></Field><Field label="Categoría (opcional)"><input value={draft.category} placeholder="S16-B" onChange={e => set("category", e.target.value)} /></Field></div>{notice && <p role="status" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{notice}</p>}<button type="button" disabled={preparing} onClick={() => void downloadJpg()} className="mt-5 w-full rounded-lg bg-red-700 px-4 py-3 font-black text-white hover:bg-red-800">{preparing ? "Preparando vista previa…" : "Ver JPG antes de descargar"}</button><button type="button" onClick={downloadHtml} className="mt-3 w-full rounded-lg border border-red-200 px-4 py-3 font-bold text-red-700">Ver HTML antes de descargar</button><Link href="/clubs" className="mt-4 block text-center text-sm font-bold text-red-700 underline">Revisar clubs y escudos</Link></section>}<section className="overflow-auto rounded-2xl border bg-neutral-200 p-4 shadow-sm"><Poster draft={draft} home={home} away={away} homeName={homeName} awayName={awayName} posterRef={posterRef} />{fromTable && <div className="mx-auto mt-4 max-w-[460px]"><div className="flex justify-center gap-3"><Link href="/convocatorias/lista" className="inline-flex h-11 w-11 items-center justify-center rounded-lg border bg-white font-bold" aria-label="Volver a editar convocatoria" title="Volver a editar"><X size={20} /></Link><button type="button" disabled={preparing} onClick={() => { if (jpgBlob) void savePreparedJpg(); else { jpgPreparationStarted.current = true; void downloadJpg(true); } }} className="rounded-lg bg-red-700 px-5 py-3 font-black text-white disabled:opacity-60">{jpgBlob ? "Descargar JPG" : preparing ? "Preparando JPG…" : "Preparar JPG"}</button></div>{notice && <p role="status" className="mt-3 rounded-lg bg-white p-3 text-center text-sm text-red-800">{notice}</p>}</div>}</section></div></div><dialog ref={previewDialog} onClose={() => setPreview(null)} aria-labelledby="preview-title" className="fixed inset-0 m-auto max-h-[95dvh] w-[min(96vw,760px)] overflow-auto rounded-2xl border-0 bg-neutral-100 p-4 text-neutral-900 shadow-2xl backdrop:bg-black/70"><div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-3 shadow-sm"><h2 id="preview-title" className="font-black">Vista previa de la descarga</h2><button type="button" autoFocus onClick={() => setPreview(null)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border font-bold" aria-label="Cerrar vista previa y volver a editar" title="Volver a editar"><X size={20} /></button><button type="button" onClick={confirmDownload} className="rounded-lg bg-red-700 px-4 py-2 font-bold text-white">Confirmar descarga</button></div>{preview && (preview.html ? <iframe title="Vista previa del HTML" sandbox="" srcDoc={preview.html} className="mt-4 h-[65dvh] w-full border-0 bg-white" /> : <img src={preview.url} alt="Cartel final de la convocatoria que se descargará" className="mx-auto mt-4 h-auto w-full max-w-[460px]" />)}</dialog></main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1 text-sm font-bold">{label}<span className="[&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:p-3 [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:bg-white [&_select]:p-3">{children}</span></label>; }
function Team({ club, name }: { club?: Club; name: string }) { return <div className="flex h-full w-full flex-col items-center"><div className="flex h-[242px] w-[242px] shrink-0 items-center justify-center">{club ? <img src={shield(club.id)} alt={`Escudo de ${club.name}`} className="max-h-full max-w-full object-contain" /> : <span>♢</span>}</div>{showTeamName(club, name) && <b className="mt-[10px] max-w-full break-words text-[34px] leading-tight">{name}</b>}</div>; }
function Poster({ draft, home, away, homeName, awayName, posterRef }: { draft: Draft; home?: Club; away?: Club; homeName: string; awayName: string; posterRef: React.RefObject<HTMLDivElement | null> }) {
  const venue = locationText(draft.field);
  return <div ref={posterRef} className="relative mx-auto h-[575px] w-[460px] overflow-hidden rounded-2xl text-white shadow-2xl">
    <div style={{ width: 1080, height: 1350, transform: "scale(0.425925926)", transformOrigin: "top left", backgroundImage: `linear-gradient(#071d2e40,#071d2e15), url("${posterBackground}")`, backgroundSize: "cover", backgroundPosition: "76% center" }} className="relative overflow-hidden">
      <header className="absolute inset-x-0 top-0 flex h-[180px] flex-col items-center justify-center bg-[#071d2ed9] text-center"><p className="text-[28px] font-black">{organizer}</p><p className="mt-[11px] text-[20px] font-semibold">{organizerClubs}</p></header>
      {draft.category && <div className="absolute inset-x-0 top-[245px] text-center"><p className="inline-block rounded-[16px] bg-[#f4262dc7] px-[56px] py-[5px] text-[52px] font-black leading-[64px]">{draft.category.toUpperCase()}</p></div>}
      <div className="absolute inset-x-0 top-[333px] text-center"><p className="inline-block rounded-full bg-[#f4262dc7] px-[54px] py-[13px] text-[42px] font-black leading-[46px]">{dateText(draft.day)}</p></div>
      <div className="absolute left-[100px] top-[470px] h-[710px] w-[880px] rounded-[36px] bg-[#fffaf2ad] text-center text-neutral-900">
        <div className="absolute left-[135px] top-[128px] h-[322px] w-[260px]"><Team club={home} name={homeName} /></div>
        <b className="absolute inset-x-0 top-[236px] text-center text-[48px] font-black text-red-600">VS</b>
        <div className="absolute right-[135px] top-[128px] h-[322px] w-[260px]"><Team club={away} name={awayName} /></div>
        <div className="absolute bottom-[43px] left-[70px] w-[740px] border-t-2 border-red-100 pt-[30px] text-[#d10a0a]"><p className="flex items-center justify-center gap-3 text-[40px] font-black"><Clock3 aria-hidden="true" className="h-[44px] w-[44px] shrink-0 stroke-[2.5]" /><span>Convocatoria · {draft.callTime || "--:--"} h</span></p><p className="mt-[24px] flex items-center justify-center gap-2 text-[34px] font-bold"><MapPin aria-hidden="true" className="h-[40px] w-[40px] shrink-0" /><span>{venue}</span></p></div>
      </div>
      {draft.phase?.trim() && <section className="absolute bottom-[40px] left-[100px] w-[880px] rounded-[18px] bg-[#071d2ed9] py-[18px] text-center text-[36px] font-black leading-[44px]">{draft.phase}</section>}
    </div>
  </div>;
}


export default function CallupGeneratorPage() {
  return <Suspense fallback={<main className="min-h-screen bg-neutral-100" />}><CallupGeneratorContent /></Suspense>;
}
