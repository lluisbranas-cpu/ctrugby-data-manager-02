import fs from "node:fs";
import XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/).filter(Boolean).map(line => { const index = line.indexOf("="); return index > 0 ? [line.slice(0, index), line.slice(index + 1)] : []; }).filter(Boolean));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const rows = XLSX.utils.sheet_to_json(XLSX.readFile("C:\\Users\\Usuario\\Desktop\\federaciones_mundiales_rugby.xlsx").Sheets["Federaciones World Rugby"], { defval: "" });
const confederations = { "Rugby Europe": "rugby-europe", "Asia Rugby": "asia-rugby", "Rugby Africa": "rugby-afrique", "Rugby Americas North": "rugby-americas-north", "Oceania Rugby": "oceania-rugby", "Sudamérica Rugby": "sudamerica-rugby" };
const empty = value => value === "—" || !value ? null : value;
const { data: existing, error: readError } = await db.from("catalog_federations").select("id,country,territory");
if (readError) throw readError;
const byCountry = new Map((existing ?? []).flatMap(item => [[item.country, item], [item.territory, item]]));
const payload = rows.map((row, index) => {
  const country = row["País / Territorio"];
  const known = byCountry.get(country);
  return { id: known?.id ?? `FN${String(index + 201).padStart(3, "0")}`, name: row["Federación Nacional"], scope: "Nacional", territory: country, country, active: true, published: true, website: empty(row["Web Oficial"]) ? `https://${row["Web Oficial"]}` : null, masculine_nickname: empty(row["Apodo Masculino"]), feminine_nickname: empty(row["Apodo Femenino"]), regional_association_ids: confederations[row["Confederación"]] ? [confederations[row["Confederación"]]] : [], regional_membership_status: row["Estatus World Rugby"] === "Pleno" ? "Pleno derecho" : row["Estatus World Rugby"] === "Asociado" ? "Asociado" : null };
});
const { error } = await db.from("catalog_federations").upsert(payload, { onConflict: "id" });
if (error) throw error;
console.log(JSON.stringify({ imported: payload.length }));
