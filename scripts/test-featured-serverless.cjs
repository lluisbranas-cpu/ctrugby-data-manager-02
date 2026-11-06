const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
process.chdir(root);
const appRequire = Module.createRequire(path.join(root, 'package.json'));
appRequire('tsx/cjs');
const playerReferences = JSON.parse(require('node:fs').readFileSync(path.join(root, 'data/staging/players.json'), 'utf8'));
const db = { from: () => ({select: () => ({
  then: (resolve, reject) => Promise.resolve({data: playerReferences, error: null}).then(resolve, reject),
  eq: (_key, value) => ({maybeSingle: async () => ({data: playerReferences.find(player => player.id === value) ?? null, error: null})}),
})})};

// Exercise the real data pipeline without depending on an identity service.
// Authentication itself stays in place in the deployed route.
const load = Module._load;
Module._load = function (id, ...rest) {
  if (id === '@/lib/consultation-access') return { requireConsultation: async () => null };
  if (id === '@/lib/catalog') return {
    catalogConfigured: () => true,
    catalogAccess: async () => ({ db, admin: false }),
    localAdminAccess: () => false,
  };
  return load.call(this, id, ...rest);
};
const original = fs.readFile;
let active = 0, peak = 0, failures = 0, injectFailure = false;
fs.readFile = async function (...args) {
  active++; peak = Math.max(peak, active);
  try {
    if (active > 1024) { failures++; throw Object.assign(new Error('Too many open files'), { code: 'EMFILE' }); }
    if (injectFailure && String(args[0]).includes('milestones.json')) throw Object.assign(new Error('Injected storage failure'), {code: 'EIO'});
    await new Promise(resolve => setImmediate(resolve));
    return await original.apply(this, args);
  } finally { active--; }
};

(async () => {
  const { GET } = appRequire('./app/api/jugadores/route.ts');
  const { GET: getNews } = appRequire('./app/api/noticias/route.ts');
  const { GET: getImage } = appRequire('./app/api/noticias/[id]/imagen/route.ts');
  const request = () => GET({ nextUrl: new URL('http://localhost/api/jugadores?view=public&trajectory=summary') });
  const result = async () => {
    const response = await request();
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.ok(data.players.length);
    const featured = data.players.filter(p => p.selected_federation_ids?.length || p.milestone_count || p.professional_club_records?.length).length;
    assert.ok(featured > 0, 'Featured data must not silently disappear');
    assert.ok(data.seasons.length);
    return {players: data.players.length, featured, seasons: data.seasons.length};
  };
  const baseline = await result();
  let newsBytes = 0, customImages = [];
  const newsResult = async () => {
    const response = await getNews({nextUrl: new URL('http://localhost/api/noticias?view=published')});
    assert.equal(response.status, 200);
    const body = await response.text();
    newsBytes = Buffer.byteLength(body);
    assert.ok(newsBytes < 4_500_000, 'News response must fit the Vercel payload limit');
    const {news} = JSON.parse(body);
    assert.ok(news.length);
    assert.ok(news.every(item => !item.image_url?.startsWith('data:')), 'Images must load separately');
    customImages = news.filter(item => item.image_url?.startsWith('/api/noticias/'));
    assert.ok(customImages.length);
  };
  const concurrent = await Promise.all(Array.from({length: 3}, async () => {
    const [data] = await Promise.all([result(), newsResult()]); return data;
  }));
  concurrent.forEach(data => assert.deepEqual(data, baseline));
  assert.equal(failures, 0);
  const imageRecord = customImages[0];
  const image = await getImage({url: 'http://localhost' + imageRecord.image_url}, {params: Promise.resolve({id: imageRecord.id})});
  assert.equal(image.status, 200, 'Separately loaded images must remain available');
  assert.equal(image.headers.get('Content-Type'), 'image/webp');
  assert.ok((await image.arrayBuffer()).byteLength > 0);
  injectFailure = true;
  assert.equal((await request()).status, 503, 'Storage errors must not become successful empty lists');
  injectFailure = false;
  assert.deepEqual(await result(), baseline, 'Queued readers must recover after an error');
  console.log(JSON.stringify({ok: true, ...baseline, simultaneousPageLoads: 3, peakFileReads: peak, descriptorFailures: failures, newsBytes, customImages: customImages.length}));
})().catch(error => { console.error(error); process.exitCode = 1; });
