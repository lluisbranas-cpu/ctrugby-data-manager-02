const fs=require('node:fs');
const path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const root=process.cwd(), base=path.join(root,'data/staging'), directory=path.join(base,'player-news');
const load=name=>JSON.parse(fs.readFileSync(path.join(base,name),'utf8'));
const metrics=load('player-participation-metrics.json'), players=load('players.json'), seasons=load('player-seasons.json'), clubs=load('clubs.json'), categories=load('professional-categories.json');
const current=fs.readdirSync(directory).filter(name=>name.endsWith('.json')).map(name=>JSON.parse(fs.readFileSync(path.join(directory,name),'utf8')));
const stamp=new Date().toISOString();
const uuid=key=>{const h=createHash('sha256').update('campus-import-v1:'+key).digest('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-5'+h.slice(13,16)+'-a'+h.slice(17,20)+'-'+h.slice(20,32);};
const plan=[];
for(const metric of metrics){
 const years=[...new Set(metric.participation_years)], missing=metric.participation_count-years.length;
 if(missing<0 || years.length!==metric.participation_years.length) throw new Error('Métrica inconsistente '+metric.player_id);
 const player=players.find(p=>p.id===metric.player_id); if(!player)throw new Error('Jugador desconocido '+metric.player_id);
 const name=[player.first_name,player.last_name].filter(Boolean).join(' ');
 const campusMap=metric.participation_campus||metric.participation_campuses||{};
 const rows=years.map(year=>({year,campus:campusMap[year]||'CAM001',count:1}));
 if(missing || metric.participation_pending_year) rows.push({year:null,campus:'CAM001',count:missing});
 for(const row of rows){
  const campus=categories.find(item=>item.id===row.campus&&item.type==='CAMP');if(!campus)throw new Error('Campus desconocido '+row.campus);
  const season=row.year?seasons.find(item=>item.player_id===metric.player_id&&item.season_year===Number(row.year)):null;
  const club=clubs.find(item=>item.id===season?.club_id);
  const id=uuid(metric.player_id+':'+row.campus+':'+(row.year||'pending'));
  const exists=current.find(item=>item.id===id || item.type==='participacion'&&item.player_id===metric.player_id&&item.participation?.kind==='campus'&&item.participation.campus_id===row.campus&&(item.participation.year||null)===row.year);
  if(exists || fs.existsSync(path.join(base,'player-news-deleted',id+'.json'))) continue;
  plan.push({id,type:'participacion',player_id:metric.player_id,date_or_season:row.year||'',title:campus.label+' · '+(row.year||'Año pendiente'),url:'',published:true,image_updated_at:null,updated_at:stamp,
   participation:{kind:'campus',campus_id:row.campus,year:row.year,count:row.count,pending_year:!row.year,email_enabled:metric.participation_email_enabled!==false,registration_number:row.year?(metric.participation_registration_numbers?.[row.campus+':'+row.year]||metric.participation_registration_numbers?.[row.year]||''):'',category:season?.playing_category||'',club_id:season?.club_id||null,club_name:club?.name||season?.legacy_club_name||'',club_category:season?.competition_category||'',player_name:name,notes:null,migration_sources:[{kind:'campus-metric',record:metric}]}});
 }
}
if(plan.length && !process.argv.includes('--dry-run')){
 const backup=path.join(root,'copias-actualizaciones','campus-unificado-'+stamp.replace(/[:.]/g,'-'));fs.mkdirSync(backup,{recursive:true});fs.copyFileSync(path.join(base,'player-participation-metrics.json'),path.join(backup,'player-participation-metrics.json'));
 fs.writeFileSync(path.join(backup,'manifest.json'),JSON.stringify({created_at:stamp,records:plan.map(item=>item.id),source_players:metrics.length,source_total:metrics.reduce((n,m)=>n+m.participation_count,0)},null,2));
 for(const record of plan){const target=path.join(directory,record.id+'.json'), temp=target+'.'+randomUUID()+'.tmp';fs.writeFileSync(temp,JSON.stringify(record,null,2)+'\n');fs.renameSync(temp,target);}
}
console.log(JSON.stringify({imported_records:plan.length,imported_participations:plan.reduce((n,r)=>n+r.participation.count,0),source_players:metrics.length,source_total:metrics.reduce((n,m)=>n+m.participation_count,0)}));
