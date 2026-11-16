import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readRegionalRugbyAssociations } from "@/lib/regional-rugby-association-data";

export const runtime = "nodejs";
const directory = path.join(process.cwd(), "public", "regional-rugby-shields");
const imagePath = (code: string) => path.join(directory, `${code}.png`);
async function validCode(code: string) { return (await readRegionalRugbyAssociations()).some((association) => association.code === code); }

export async function GET(_request: NextRequest, context: RouteContext<"/api/confederaciones-regionales/escudo/[code]">) {
  const { code } = await context.params;
  if (!await validCode(code)) return new NextResponse(null, { status: 404 });
  try { return new NextResponse(await readFile(imagePath(code)), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=60" } }); } catch { return new NextResponse(null, { status: 404 }); }
}
