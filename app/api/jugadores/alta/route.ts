import { readStaffOptions } from "@/lib/player-career";
import { requireConsultation } from "@/lib/consultation-access";
import { NextRequest, NextResponse } from "next/server";
import { CATALOG_COOKIE, catalogAccess, catalogClient, catalogServiceClient, localAdminAccess } from "@/lib/catalog";
import { readProfessionalCategories } from "@/lib/professional-club-milestones";
import { emptyBilling } from "@/lib/player-billing";
import { GET as getPlayers } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });

export async function GET(request: NextRequest) {
  const consultationDenied = await requireConsultation(request);
  if (consultationDenied) return consultationDenied;

  try {
    const access = await catalogAccess(request);
    const { admin } = access;
    const sessionToken = request.cookies.get(CATALOG_COOKIE)?.value;
    const db = localAdminAccess(request)
      ? (process.env.SUPABASE_SERVICE_ROLE_KEY ? catalogServiceClient() : sessionToken ? catalogClient(sessionToken) : access.db)
      : access.db;
    if (!admin) return reply({ error: "Inicia sesión como administrador para crear jugadores." }, 403);
    const response = await getPlayers(new NextRequest(new URL("/api/jugadores", request.url), { headers: request.headers }));
    const catalog = await response.json();
    if (!response.ok || !catalog.configured) return reply({ error: catalog.error || "El catálogo no está conectado." }, 503);
    const categories = await readProfessionalCategories();
    const currentPlayers = await db.from("catalog_players").select("id,first_name,last_name").order("id");
    if (currentPlayers.error) return reply({ error: "No se ha podido comprobar el próximo ID disponible en la base de datos." }, 503);
    const directoryPlayers = (catalog.players ?? currentPlayers.data ?? []) as Array<{ id: string; first_name: string; last_name: string | null }>;
    const lastId = Math.max(0, ...directoryPlayers.map((player) => Number(player.id.match(/^(?:JUG|CTR)(\d{4})$/)?.[1] ?? 0)));
    if (lastId >= 9999) return reply({ error: "Se ha alcanzado el límite de IDs JUG de cuatro dígitos." }, 409);
    return reply({
      staff_options: await readStaffOptions(),
      suggested_id: `JUG${String(lastId + 1).padStart(4, "0")}`,
      players: directoryPlayers.map((player) => ({ id: player.id, first_name: player.first_name, last_name: player.last_name })),
      expires_at: "", profile_photo_url: null, cover_photo_url: null, primary_photo_season: null,
      player: { first_name: "", last_name: null, category: null, birth_year: null, dni: null, instagram: null, height_cm: null, weight_kg: null, allergies: null, dietary_conditions: null, medications: null },
      clubs: catalog.clubs ?? [],
      campus_types: categories.filter((category) => category.type === "CAMP"),
      professional_categories: categories.filter((category) => category.type !== "CAMP"),
      seasons: [], participations: [], selections: [], professional_club_records: [], contacts: null, billing: emptyBilling(), private_consents: { food: false, medical: false, technical: false }, saved_submission: null,
    });
  } catch {
    return reply({ error: "No se han podido cargar los datos del alta." }, 503);
  }
}
