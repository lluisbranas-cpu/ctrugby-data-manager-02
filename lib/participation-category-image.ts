import { stat } from "node:fs/promises";
import { readFile } from "./bounded-file-reads";
import path from "node:path";
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
export async function participationCategoryImage(label: string): Promise<{image_url: string | null; image_updated_at: string | null}> {
  const categories = JSON.parse(await readFile(path.join(process.cwd(),"data/staging/professional-categories.json"),"utf8")) as {id:string;label:string}[];
  const aliases: Record<string,string> = {iberdrola:"liga iberdrola"};
  const name = aliases[normalize(label)] || normalize(label);
  const category = categories.find(item=>normalize(item.label)===name);
  return participationImageById(category?.id || "");
}
export async function participationImageById(id: string): Promise<{image_url: string | null; image_updated_at: string | null}> {
  if (!/^[A-Z0-9][A-Z0-9-]{0,39}$/.test(id)) return {image_url:null,image_updated_at:null};
  try {const file=await stat(path.join(process.cwd(),"public/professional-category-shields",id+".png"));return {image_url:"/api/hitos/profesionales/categorias/"+encodeURIComponent(id)+"/escudo?v="+file.mtimeMs,image_updated_at:file.mtime.toISOString()};}
  catch(error) {if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;return {image_url:null,image_updated_at:null};}
}
