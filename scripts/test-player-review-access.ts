import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { NextRequest } from 'next/server';
import { GET, POST } from '../app/api/revision-jugador/[token]/route';
import { GET as shortGET } from '../app/r/[code]/route';
import { playerReviewMediaAccess, REVIEW_MEDIA_COOKIE } from '../lib/player-review-media-access';
import { proxy } from '../proxy';

// Isolated local fixtures: no real player data, network requests or saved submissions.
test('A bearer review link reads and saves only its player without a login', async () => {
 const previous=process.cwd(); const root=await mkdtemp(path.join(os.tmpdir(),'ctrugby-review-test-'));
 const staging=path.join(root,'data','staging');await mkdir(path.join(staging,'player-edit-tokens'),{recursive:true});
 const token='a'.repeat(48);const id='JUG0001';const code='testcode1';
 const record={token,player_id:id,status:'active',created_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString()};
 await writeFile(path.join(staging,'player-edit-tokens',token+'.json'),JSON.stringify(record));
 await writeFile(path.join(staging,'player-review-short-links.json'),JSON.stringify([{...record,code}]));
 await writeFile(path.join(staging,'players.json'),JSON.stringify([{id,first_name:'Prueba',last_name:'Local',category:null,birth_year:null}]));
 const req=(url:string,init?:ConstructorParameters<typeof NextRequest>[1])=>new NextRequest('http://localhost:3012'+url,{...init,headers:{host:'localhost:3012',origin:'http://localhost:3012',...init?.headers}});
 const context=(value:string)=>({params:Promise.resolve({token:value})});
 process.chdir(root);
 try {
  const short=await shortGET(req('/r/'+code),{params:Promise.resolve({code})}); assert.equal(short.status,307);assert.ok(short.headers.get('location')?.endsWith('/revision-jugador/'+token));
  const response=await GET(req('/api/revision-jugador/'+token),context(token));assert.equal(response.status,200);assert.equal((await response.json()).player.id,id);assert.match(response.headers.get('set-cookie')!,/HttpOnly/);
  assert.equal((await GET(req('/api/revision-jugador/'+'b'.repeat(48)),context('b'.repeat(48)))).status,404);
  const form=new FormData();form.set('data',JSON.stringify({observations:'Prueba aislada'}));assert.equal((await POST(req('/api/revision-jugador/'+token,{method:'POST',body:form}),context(token))).status,200);
  assert.equal((await POST(req('/api/revision-jugador/'+token,{method:'POST',headers:{origin:'https://other.example'}}),context(token))).status,403);
  assert.equal((await POST(req('/api/revision-jugador/crear',{method:'POST'}),context('crear'))).status,401);
  const media=req('/api/jugadores/foto/'+id,{headers:{cookie:REVIEW_MEDIA_COOKIE+'='+token}});assert.equal(await playerReviewMediaAccess(media,id),true);assert.equal(await playerReviewMediaAccess(media,'JUG0002'),false);
  assert.equal((await proxy(req('/revision-jugador/'+token))).status,200);assert.equal((await proxy(req('/jugadores'))).status,307);
  await writeFile(path.join(staging,'player-edit-tokens',token+'.json'),JSON.stringify({...record,status:'closed'}));assert.equal((await GET(req('/api/revision-jugador/'+token),context(token))).status,404);assert.equal(await playerReviewMediaAccess(media,id),false);
 } finally { process.chdir(previous); }
});
