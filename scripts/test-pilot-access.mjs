import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
const base = process.env.PILOT_BASE_URL || "http://localhost:3001";
let response = await fetch(base + "/api/prueba");
let body = await response.json();
assert.equal(response.status, 200);
assert.equal(body.configured, true);
assert.equal(body.admin, false);
assert.equal("notes" in body, false);
response = await fetch(base + "/api/prueba", { method: "POST",
  headers: { origin: base, "content-type": "application/json" },
  body: JSON.stringify({ action: "save" }) });
assert.equal(response.status, 403);
response = await fetch(base + "/api/prueba", { method: "POST",
  headers: { origin: "https://untrusted.example", "content-type": "application/json" }, body: "{}" });
assert.equal(response.status, 403);
response = await fetch(base + "/api/prueba/foto", { method: "POST", headers: { origin: base } });
assert.equal(response.status, 403);
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY);
assert.ok((await db.from("pilot_assessments").select("*")).error);
assert.ok((await db.rpc("pilot_save", {
  p_name: "No autorizado", p_club: "No autorizado",
  p_season: "2026/2027", p_notes: "x", p_version: 0,
})).error);
assert.equal((await db.rpc("pilot_is_admin")).data, false);
console.log("OK: conexión, privacidad, escritura anónima, fotos y origen externo.");

