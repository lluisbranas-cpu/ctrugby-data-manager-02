import PDFDocument from "pdfkit";

type FieldSet = Record<string, unknown>;

const labels: Record<string, string> = {
  first_name: "Nombre", last_name: "Apellidos", category: "Género", birth_year: "Año de nacimiento", dni: "DNI / NIE", instagram: "Instagram", position_text: "Posición", height_cm: "Altura (cm)", weight_kg: "Peso (kg)", allergies: "Necesidades alimenticias", medications: "Necesidades médicas", player_email: "Correo del jugador", player_phone_e164: "Teléfono del jugador", tutor1_name: "Tutor/a 1", tutor1_email: "Correo tutor/a 1", tutor1_phone_e164: "Teléfono tutor/a 1", tutor2_name: "Tutor/a 2", tutor2_email: "Correo tutor/a 2", tutor2_phone_e164: "Teléfono tutor/a 2", basic_publication: "Publicación básica", sensitive_internal_use: "Uso interno de datos sensibles", adult_self_declared: "Declaración de mayoría de edad", season_year: "Temporada", playing_category: "Categoría", competition_category: "Categoría profesional", club_name: "Club", season_label: "Temporada", federation_id: "Federación", scope: "Selección", club_text: "Detalle", notes: "Notas", year: "Año", campus: "Campus",
};
const title = (value: string) => labels[value] ?? value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const value = (item: unknown) => item === null || item === undefined || item === "" ? "Sin indicar" : typeof item === "boolean" ? (item ? "Sí" : "No") : String(item);

export async function createPlayerReviewPdf(playerId: string, submittedAt: string, payload: FieldSet) {
  const document = new PDFDocument({ margin: 48, size: "A4", info: { Title: `Revisión ${playerId}`, Author: "Rugby" } });
  const chunks: Buffer[] = [];
  document.on("data", (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<Buffer>((resolve, reject) => { document.on("end", () => resolve(Buffer.concat(chunks))); document.on("error", reject); });
  const heading = (text: string) => { document.moveDown(0.8).fillColor("#b42335").font("Helvetica-Bold").fontSize(12).text(text).fillColor("#1f2937"); };
  const fields = (data: FieldSet) => Object.entries(data).forEach(([key, item]) => {
    if (item && typeof item === "object") return;
    document.font("Helvetica-Bold").fontSize(9).text(title(key), { continued: true });
    document.font("Helvetica").text(`  ${value(item)}`);
  });
  const records = (name: string, items: unknown) => {
    heading(name);
    if (!Array.isArray(items) || !items.length) return document.font("Helvetica").fontSize(9).text("Sin registros enviados.");
    items.forEach((item, index) => { document.font("Helvetica-Bold").fontSize(9).text(`${index + 1}.`); if (item && typeof item === "object") fields(item as FieldSet); });
  };
  document.font("Helvetica-Bold").fontSize(20).fillColor("#111827").text("RUGBY - HUB");
  document.font("Helvetica-Bold").fontSize(14).text("COPIA DE SEGURIDAD DE LA REVISIÓN");
  document.font("Helvetica").fontSize(9).fillColor("#4b5563").text(`Ficha: ${playerId} · Registrada: ${new Date(submittedAt).toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}`);
  document.moveDown(0.7).fillColor("#1f2937").fontSize(9).text("Este PDF recoge los datos enviados mediante el enlace privado. Los datos marcados como privados no se publican.");
  heading("Datos del jugador"); fields((payload.player as FieldSet) ?? {});
  heading("Contacto privado"); fields((payload.contacts as FieldSet) ?? {});
  heading("Autorizaciones"); fields((payload.authorizations as FieldSet) ?? {});
  records("Temporadas", payload.seasons); records("Participaciones", payload.participations); records("Convocatorias", payload.selections); records("Clubes profesionales", payload.professional_club_records);
  heading("Observaciones"); document.font("Helvetica").fontSize(9).text(value(payload.observations));
  document.end();
  return completed;
}
