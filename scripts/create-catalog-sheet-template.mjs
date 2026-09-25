import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(currentDirectory, "..");
const stagingDirectory = path.join(projectDirectory, "data", "staging");
const outputDirectory = path.join(projectDirectory, "outputs", "catalogo-sheet-template");
const outputPath = path.join(outputDirectory, "catalogo-ctrugby.xlsx");

const [clubs, federations] = await Promise.all([
  fs.readFile(path.join(stagingDirectory, "clubs.json"), "utf8").then(JSON.parse),
  fs.readFile(path.join(stagingDirectory, "federations.json"), "utf8").then(JSON.parse),
]);

const publishedClubIds = new Set(["AND0002", "ARG0001"]);
const workbook = Workbook.create();
const guide = workbook.worksheets.add("Guía");
const clubSheet = workbook.worksheets.add("Clubs");
const federationSheet = workbook.worksheets.add("Federaciones");
const privateSheet = workbook.worksheets.add("Datos privados");

const colors = {
  black: "#111111",
  red: "#DF1520",
  gray: "#F3F4F6",
  line: "#D1D5DB",
  white: "#FFFFFF",
  amber: "#FEF3C7",
};
const font = { name: "Arial", size: 10, color: "#111111" };

function title(sheet, text, subtitle) {
  sheet.showGridLines = false;
  sheet.getRange("A2:H2").merge();
  sheet.getRange("A2").values = [[text]];
  sheet.getRange("A2").format = {
    font: { name: "Arial", size: 16, bold: true, color: colors.black },
  };
  sheet.getRange("A3:H3").merge();
  sheet.getRange("A3").values = [[subtitle]];
  sheet.getRange("A3").format = {
    font: { name: "Arial", size: 10, italic: true, color: "#4B5563" },
  };
}

function styleTable(sheet, rangeAddress, headerAddress) {
  const range = sheet.getRange(rangeAddress);
  range.format.font = font;
  range.format.verticalAlignment = "center";
  range.format.borders = { preset: "outside", style: "thin", color: colors.line };
  sheet.getRange(headerAddress).format = {
    fill: colors.black,
    font: { name: "Arial", size: 10, bold: true, color: colors.white },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
  };
}

title(guide, "Plantilla de catálogo CTRugby", "Edición en Excel o Google Sheets. La hoja no publica datos por sí sola.");
guide.getRange("A5:B13").values = [
  ["Paso", "Qué hacer"],
  ["1", "Trabaja en las pestañas Clubs y Federaciones. No modifiques los IDs de filas existentes."],
  ["2", "Para añadir una entidad usa un ID nuevo válido y deja Acción como nuevo."],
  ["3", "Usa Sí o No en Activo y Publicar. Publicar solo se aplicará tras una validación administrativa."],
  ["4", "Mantén las URL con https:// y las coordenadas dentro de sus límites geográficos."],
  ["5", "Los datos de la pestaña Datos privados no se muestran en la web pública. Restringe el acceso a esta hoja."],
  ["6", "La próxima importación validará toda la hoja antes de guardar cambios en Supabase."],
  ["Datos actuales", `${clubs.length} clubs y ${federations.length} federaciones preparados para revisión.`],
  ["Publicación actual", "AND0002 y ARG0001 están publicados. Las federaciones siguen pendientes de revisión."],
];
styleTable(guide, "A5:B13", "A5:B5");
guide.getRange("A6:A13").format.horizontalAlignment = "center";
guide.getRange("A6:A13").format.fill = colors.gray;
guide.getRange("A1:B20").format.font = font;
guide.getRange("A:A").format.columnWidth = 20;
guide.getRange("B:B").format.columnWidth = 95;
guide.getRange("B6:B13").format.wrapText = true;
guide.getRange("A5:B13").format.autofitRows();

const clubHeaders = [
  "Acción", "ID", "Nombre", "Activo", "Fundación", "Desaparición", "Ciudad", "Provincia", "Región", "País",
  "Latitud", "Longitud", "URL de mapa", "Web", "Instagram", "Publicar",
];
const clubRows = clubs.map((club) => [
  "actualizar", club.id, club.name, club.active ? "Sí" : "No", club.founded_text, club.disappeared_text, club.city, club.province,
  club.region, club.country, club.latitude, club.longitude, club.maps_url, club.website, club.instagram,
  publishedClubIds.has(club.id) ? "Sí" : "No",
]);
clubSheet.getRange(`A1:P${clubRows.length + 1}`).values = [clubHeaders, ...clubRows];
styleTable(clubSheet, `A1:P${clubRows.length + 1}`, "A1:P1");
clubSheet.tables.add(`A1:P${clubRows.length + 1}`, true, "ClubsCatalogo");
clubSheet.freezePanes.freezeRows(1);
clubSheet.getRange(`A2:A${clubRows.length + 1}`).dataValidation = { rule: { type: "list", values: ["actualizar", "nuevo"] } };
clubSheet.getRange(`D2:D${clubRows.length + 1}`).dataValidation = { rule: { type: "list", values: ["Sí", "No"] } };
clubSheet.getRange(`P2:P${clubRows.length + 1}`).dataValidation = { rule: { type: "list", values: ["Sí", "No"] } };
clubSheet.getRange(`A2:A${clubRows.length + 1}`).format.fill = colors.amber;
clubSheet.getRange(`D2:D${clubRows.length + 1}`).format.fill = colors.amber;
clubSheet.getRange(`P2:P${clubRows.length + 1}`).format.fill = colors.amber;
clubSheet.getRange(`K2:L${clubRows.length + 1}`).format.numberFormat = "0.000000";
for (const [column, width] of [["A:A", 15], ["B:B", 14], ["C:C", 34], ["D:D", 12], ["E:F", 15], ["G:J", 18], ["K:L", 14], ["M:N", 35], ["O:O", 24], ["P:P", 13]]) {
  clubSheet.getRange(column).format.columnWidth = width;
}

const federationHeaders = ["Acción", "ID", "Nombre", "Ámbito", "Territorio", "País", "Activo", "Web", "Publicar"];
const federationRows = federations.map((federation) => [
  "actualizar", federation.id, federation.name, federation.scope, federation.territory, federation.country,
  federation.active ? "Sí" : "No", federation.website, "No",
]);
federationSheet.getRange(`A1:I${federationRows.length + 1}`).values = [federationHeaders, ...federationRows];
styleTable(federationSheet, `A1:I${federationRows.length + 1}`, "A1:I1");
federationSheet.tables.add(`A1:I${federationRows.length + 1}`, true, "FederacionesCatalogo");
federationSheet.freezePanes.freezeRows(1);
federationSheet.getRange(`A2:A${federationRows.length + 1}`).dataValidation = { rule: { type: "list", values: ["actualizar", "nuevo"] } };
federationSheet.getRange(`G2:G${federationRows.length + 1}`).dataValidation = { rule: { type: "list", values: ["Sí", "No"] } };
federationSheet.getRange(`I2:I${federationRows.length + 1}`).dataValidation = { rule: { type: "list", values: ["Sí", "No"] } };
federationSheet.getRange(`A2:A${federationRows.length + 1}`).format.fill = colors.amber;
federationSheet.getRange(`G2:G${federationRows.length + 1}`).format.fill = colors.amber;
federationSheet.getRange(`I2:I${federationRows.length + 1}`).format.fill = colors.amber;
for (const [column, width] of [["A:A", 15], ["B:B", 14], ["C:C", 38], ["D:D", 18], ["E:F", 20], ["G:G", 12], ["H:H", 38], ["I:I", 13]]) {
  federationSheet.getRange(column).format.columnWidth = width;
}

const privateHeaders = ["Tipo", "ID", "Nota interna", "Correo", "Clubs heredados"];
const privateRows = [
  ...clubs.filter((club) => club.note).map((club) => ["club", club.id, club.note, null, null]),
  ...federations.filter((federation) => federation.email || federation.legacy_club_count != null).map((federation) => [
    "federación", federation.id, null, federation.email, federation.legacy_club_count,
  ]),
];
privateSheet.getRange(`A1:E${privateRows.length + 1}`).values = [privateHeaders, ...privateRows];
styleTable(privateSheet, `A1:E${privateRows.length + 1}`, "A1:E1");
privateSheet.tables.add(`A1:E${privateRows.length + 1}`, true, "DatosPrivadosCatalogo");
privateSheet.freezePanes.freezeRows(1);
privateSheet.getRange("A:A").format.columnWidth = 16;
privateSheet.getRange("B:B").format.columnWidth = 14;
privateSheet.getRange("C:C").format.columnWidth = 70;
privateSheet.getRange("D:D").format.columnWidth = 36;
privateSheet.getRange("E:E").format.columnWidth = 18;
privateSheet.getRange(`C2:C${privateRows.length + 1}`).format.wrapText = true;
privateSheet.getRange(`A1:E${privateRows.length + 1}`).format.autofitRows();

workbook.recalculate();
const checks = [
  await workbook.inspect({ kind: "table", range: "Clubs!A1:P6", include: "values", tableMaxRows: 6, tableMaxCols: 16 }),
  await workbook.inspect({ kind: "table", range: "Federaciones!A1:I6", include: "values", tableMaxRows: 6, tableMaxCols: 9 }),
  await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!", options: { useRegex: true, maxResults: 100 }, summary: "errores de fórmula" }),
];
if (checks.some((check) => check.ndjson.includes("#REF!") || check.ndjson.includes("#DIV/0!") || check.ndjson.includes("#VALUE!"))) {
  throw new Error("La plantilla contiene errores de fórmula.");
}

await fs.mkdir(outputDirectory, { recursive: true });
for (const sheetName of ["Guía", "Clubs", "Federaciones", "Datos privados"]) {
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(path.join(outputDirectory, `${sheetName.replaceAll(" ", "-")}.png`), new Uint8Array(await preview.arrayBuffer()));
}
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(JSON.stringify({ outputPath, clubs: clubRows.length, federations: federationRows.length, privateRows: privateRows.length }, null, 2));
