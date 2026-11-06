import { CategoryIdError, updateCategoryId } from "@/lib/category-id-update";
import { NextRequest, NextResponse } from "next/server";
import { stat } from "node:fs/promises";
import path from "node:path";
import { requireConsultation } from "@/lib/consultation-access";
import { catalogAccess, catalogConfigured, sameOrigin } from "@/lib/catalog";
import { detectedCampusEditions, readCampusParticipationMetrics } from "@/lib/campus-participations";
import { professionalCategoryFromBody, readLocalClubs, readLocalPlayers, readProfessionalCategories, readProfessionalClubMilestones, saveProfessionalCategories, shapeProfessionalClubRecord } from "@/lib/professional-club-milestones";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (data: unknown, status = 200) => NextResponse.json(data, {status, headers: {"Cache-Control": "private, no-store", Vary: "Cookie"}});
export async function GET(request: NextRequest) {
  const denied = await requireConsultation(request); if (denied) return denied;
  try {
    const admin = catalogConfigured() ? (await catalogAccess(request)).admin : false;
    const [players, clubs, records, categories, campusMetrics] = await Promise.all([readLocalPlayers(), readLocalClubs(), readProfessionalClubMilestones(admin), readProfessionalCategories(), readCampusParticipationMetrics(admin)]);
    const names = new Map(players.map(player => [player.id, [player.first_name, player.last_name].filter(Boolean).join(" ")]));
    const campusEditions = detectedCampusEditions(campusMetrics, categories.filter((category) => category.type === "CAMP"));
    return reply({configured: catalogConfigured(), admin, canWrite: admin, records: records.map(record => ({...shapeProfessionalClubRecord(record,clubs),player_name: names.get(record.player_id) || record.player_name})), players: players.map(player=>({id:player.id,name:names.get(player.id)||player.id})), clubs, categories: await Promise.all(categories.map(async category => ({...category,shield_version: await stat(path.join(process.cwd(),"public/professional-category-shields",category.id+".png")).then(file=>file.mtimeMs).catch(()=>null)}))), campusEditions});
  } catch {return reply({error: "No se han podido cargar las participaciones."},503);}
}
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return reply({error: "Origen no permitido."},403);
  try {
    if (!catalogConfigured() || !(await catalogAccess(request)).admin) return reply({error: "Acceso de administrador requerido."},403);
    const body = await request.json();
    if (body.action === "upsert-category") {
      const category = professionalCategoryFromBody(body); if (!category) return reply({error: "Indica el nombre de la categoría."},400);
      const current = await readProfessionalCategories(),previous = current.find(item=>item.id===(body.previous_id || category.id));
      const updated = {...category,...(body.previous_id && typeof body.id === "string" ? {id:body.id.trim().toUpperCase()} : {}),siglas: body.siglas === undefined ? previous?.siglas ?? category.siglas ?? null : category.siglas ?? null};
      if (body.previous_id) {
        if (typeof body.previous_id !== "string") return reply({error:"ID original no válido."},400);
        if (typeof body.id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9-]{0,39}$/.test(body.id.trim())) return reply({error:"El ID debe contener entre 1 y 40 letras, números o guiones."},400);
        await updateCategoryId(body.previous_id, updated);
      } else {
        await saveProfessionalCategories([updated,...current.filter(item=>item.id!==updated.id)]);
      }
      return reply({ok:true,category:updated});
    }
    if (body.action === "delete-category") {
      if (typeof body.id !== "string" || !body.id) return reply({error:"Categoría no válida."},400);
      const categories=await readProfessionalCategories(),category=categories.find(item=>item.id===body.id);
      if ((await readProfessionalClubMilestones(true)).some(record=>record.category===category?.label)) return reply({error:"La categoría tiene participaciones asociadas."},409);
      await saveProfessionalCategories(categories.filter(item=>item.id!==body.id));return reply({ok:true});
    }
    return reply({error:"Las participaciones se gestionan en la tabla de noticias.",url:"/noticias?tipo=participacion"},410);
  } catch (error) {if (error instanceof CategoryIdError) return reply({error:error.message},error.status);return reply({error:"No se ha podido guardar la categoría."},400);}
}
