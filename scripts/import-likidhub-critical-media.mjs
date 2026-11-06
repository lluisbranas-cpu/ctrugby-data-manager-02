import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { likidHubEnv } from "./likidhub-env.mjs";
const walk=async d=>(await Promise.all((await readdir(d,{withFileTypes:true}).catch(()=>[])).map(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]))).flat();
const portraits=JSON.parse(await readFile("data/staging/player-photos/manifest.json","utf8"));
const portraitItems=portraits.filter(x=>x.player_id!=="JUG0320").map(x=>({kind:"portrait",file:x.prepared_file,key:`player-portraits/CTR${x.player_id.slice(3)}.png`}));
const mapFiles=async(root,kind,key)=>(await walk(root)).map(file=>({kind,file,key:file=>key(file)}));
const seasonRoot="data/staging/player-season-photos";
const allSeasonFiles=await walk(seasonRoot);
const seasonImageExtensions=new Set([".png",".jpg",".jpeg",".webp"]);
const seasonCandidates=allSeasonFiles
  .filter(file=>seasonImageExtensions.has(path.extname(file).toLowerCase()))
  .map(file=>{
    const parts=path.relative(seasonRoot,file).split(path.sep);
    const playerId=parts.find(part=>/^JUG\d{4}$/.test(part));
    const yearMatch=path.basename(file).match(/^(20\d{2})(?:[-_.]|$)/);
    return {file,playerId,seasonYear:yearMatch?Number(yearMatch[1]):playerId?2026:null,hasExplicitYear:Boolean(yearMatch),assigned2026:!yearMatch&&Boolean(playerId),prepared:!parts.includes("originales")};
  });
const seasonCandidatesWithPlayer=seasonCandidates.filter(row=>row.playerId);
const seasonByLogicalKey=new Map();
for(const candidate of seasonCandidatesWithPlayer){
  const logicalKey=`${candidate.playerId}/${candidate.seasonYear}`;
  const existing=seasonByLogicalKey.get(logicalKey);
  if(!existing||Number(candidate.prepared)>Number(existing.prepared))seasonByLogicalKey.set(logicalKey,candidate);
}
const seasonFiles=[...seasonByLogicalKey.values()].map(row=>({kind:"season-photo",file:row.file,key:`player-season-photos/CTR${row.playerId.slice(3)}/${row.seasonYear}.png`,playerId:`CTR${row.playerId.slice(3)}`,seasonYear:row.seasonYear}));
const shields=await mapFiles("data/staging/club-shields/originales","club-shield",file=>`club-shields/${path.basename(file)}`);
const covers=await mapFiles("data/staging/club-covers/originales","club-cover",file=>`club-covers/${path.basename(file)}`);
const items=[...portraitItems,...seasonFiles,...shields,...covers].map(x=>({...x,key:typeof x.key==="function"?x.key(x.file):x.key}));
const duplicates=items.length-new Set(items.map(x=>x.key)).size;
const bytes=await Promise.all(items.map(async x=>({key:x.key,kind:x.kind,bytes:(await readFile(x.file)).length,sha256:createHash("sha256").update(await readFile(x.file)).digest("hex")})));
const mediaVariant=item=>item.kind==="season-photo"?`season-${item.seasonYear}`:item.kind==="portrait"?"portrait":item.kind==="club-shield"?"shield":"cover";
const summary={mode:process.argv.includes("--apply")?"apply":"dry-run",writes:0,counts:Object.fromEntries(["portrait","season-photo","club-shield","club-cover"].map(k=>[k,bytes.filter(x=>x.kind===k).length])),uploaded:Object.fromEntries(["portrait","season-photo","club-shield","club-cover"].map(k=>[k,0])),season_photo_associations:0,total:bytes.length,duplicates,excluded:["JUG0320.png / Mario Copetti"],season_photo_classification:{image_candidates:seasonCandidates.length,with_explicit_year:seasonCandidates.filter(row=>row.playerId&&row.hasExplicitYear).length,assigned_2026:seasonCandidates.filter(row=>row.assigned2026).length,without_identified_player:seasonCandidates.filter(row=>!row.playerId).map(row=>path.relative(seasonRoot,row.file)),superseded_preparation_duplicates:seasonCandidatesWithPlayer.length-seasonFiles.length},skipped_local_non_operational_season_files:allSeasonFiles.filter(file=>!seasonImageExtensions.has(path.extname(file).toLowerCase())).length,storage_bucket:"catalog-operational-private",planned_rpcs:["likidhub_upsert_season_photo","likidhub_upsert_operational_media"]};
if(!process.argv.includes("--apply")){console.log(JSON.stringify(summary,null,2));process.exit(0)}
if(!process.argv.includes("--confirm"))throw new Error("Requiere --apply --confirm.");
const env=await likidHubEnv(); const db=createClient(env.url,env.serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});
for(const item of items){const meta=bytes.find(x=>x.key===item.key);const uploaded=await db.storage.from("catalog-operational-private").upload(item.key,await readFile(item.file),{upsert:true,contentType:item.file.endsWith(".png")?"image/png":item.file.endsWith(".webp")?"image/webp":"image/jpeg"});if(uploaded.error)throw new Error(`${item.key}: ${uploaded.error.message}`);const id=item.kind==="season-photo"?item.playerId:item.kind==="portrait"?`CTR${path.basename(item.file).slice(3,7)}`:path.basename(item.file).split(".")[0];const r=await db.rpc("likidhub_upsert_operational_media",{p_row:{entity_type:item.kind,entity_id:id,variant:mediaVariant(item),bucket_id:"catalog-operational-private",object_key:item.key,content_type:item.file.endsWith(".png")?"image/png":item.file.endsWith(".webp")?"image/webp":"image/jpeg",byte_size:meta.bytes,source_sha256:meta.sha256}});if(r.error)throw new Error(`${item.key}: ${r.error.message}`);if(item.kind==="season-photo"){const p=await db.rpc("likidhub_upsert_season_photo",{p_row:{player_id:id,season_year:item.seasonYear,storage_key:item.key,is_primary:false}});if(p.error)throw new Error(`${item.key}: ${p.error.message}`);summary.season_photo_associations++}summary.uploaded[item.kind]++;summary.writes++} console.log(JSON.stringify(summary,null,2));
