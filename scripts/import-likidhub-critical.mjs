import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { likidHubEnv } from "./likidhub-env.mjs";
const apply=process.argv.includes("--apply"); const confirmed=new Map([["JUG0270","CTR0270"],["JUG0275","CTR0275"]]);
const players=JSON.parse(await readFile("data/staging/players.json","utf8")); const seasons=JSON.parse(await readFile("data/staging/player-seasons.json","utf8"));
const mapped=players.filter(p=>p.id!=="JUG0381").map(p=>({...p,ctr_id:confirmed.get(p.id)??`CTR${p.id.slice(3)}`})); const ids=new Set(mapped.map(p=>p.id)); const rows=seasons.filter(s=>ids.has(s.player_id));
const summary={mode:apply?"apply":"dry-run",players:mapped.length,seasons:rows.length,excluded_players:["JUG0381"],excluded_files:["JUG0320.png"],duplicates:{players:mapped.length-new Set(mapped.map(p=>p.ctr_id)).size,seasons:rows.length-new Set(rows.map(s=>`${s.player_id}/${s.season_year}`)).size},outside_scope:0};
if(!apply){console.log(JSON.stringify(summary,null,2));process.exit(0)} if(!process.argv.includes("--confirm"))throw new Error("Requiere --apply --confirm."); const env=await likidHubEnv(); const db=createClient(env.url,env.serviceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});
for(const p of mapped){const r=await db.rpc("likidhub_upsert_player",{p_player:{id:p.ctr_id,first_name:p.first_name,last_name:p.last_name},p_profile:{category:p.category,birth_year:p.birth_year}});if(r.error)throw new Error(r.error.message)}
for(const s of rows){const r=await db.rpc("likidhub_upsert_player_season",{p_row:{...s,player_id:confirmed.get(s.player_id)??`CTR${s.player_id.slice(3)}`}});if(r.error)throw new Error(r.error.message)} console.log(JSON.stringify(summary,null,2));
