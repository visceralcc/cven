/**
 * Avatar Forge — Local Catalog Server
 * Receives generated avatar images and saves them to organized local folders.
 * Also serves the Avatar Forge UI + static assets from /public so everything
 * runs on the same origin (no mixed-content issues).
 * 
 * Usage: node ~/dev/cven/avatar-server.js
 * Port: 3456
 * 
 * Open http://localhost:3456/nextgm/avatar-forge in your browser.
 * 
 * Keep TAG_SLUGS in sync with avatar-forge.html
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3456;
const PUBLIC_ROOT = path.join(__dirname, 'public');
const CATALOG_ROOT = path.join(PUBLIC_ROOT, 'nextgm', 'catalog');
const ETHNICITY_FOLDERS = ['black', 'white', 'hispanic', 'polynesian', 'asian', 'mixed'];

const MIME_TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2',
};

function ensureCatalogFolders() {
  if (!fs.existsSync(CATALOG_ROOT)) fs.mkdirSync(CATALOG_ROOT, { recursive: true });
  for (const f of ETHNICITY_FOLDERS) {
    const dir = path.join(CATALOG_ROOT, f);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

/** Find highest existing number in folder (not file count) to prevent collisions after deletions. */
function getNextNumber(folder) {
  const dir = path.join(CATALOG_ROOT, folder);
  if (!fs.existsSync(dir)) return 1;
  let max = 0;
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.png'))) {
    const m = file.match(/_(\d{4})\.png$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

function buildFilename(tags, number) {
  return [tags.ethnicity, tags.hairstyle, tags.facialHair, tags.bodyType, tags.accessories, String(number).padStart(4, '0')].join('_') + '.png';
}

function fetchImage(url) {
  return new Promise((resolve, reject) => {
    const getter = url.startsWith('https') ? https : http;
    getter.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) return fetchImage(res.headers.location).then(resolve).catch(reject);
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function saveImage(url, tags) {
  if (!ETHNICITY_FOLDERS.includes(tags.ethnicity)) return { saved: false, error: 'Unknown ethnicity: ' + tags.ethnicity };
  try {
    const buf = await fetchImage(url);
    const num = getNextNumber(tags.ethnicity);
    const filename = buildFilename(tags, num);
    fs.writeFileSync(path.join(CATALOG_ROOT, tags.ethnicity, filename), buf);
    const rel = 'catalog/' + tags.ethnicity + '/' + filename;
    console.log('  \u2713 ' + rel + ' (' + (buf.length / 1024).toFixed(0) + 'KB)');
    return { saved: true, path: rel };
  } catch (e) {
    console.log('  \u2717 ' + e.message);
    return { saved: false, error: e.message };
  }
}

function getStats() {
  const stats = {}; let total = 0;
  for (const f of ETHNICITY_FOLDERS) {
    const dir = path.join(CATALOG_ROOT, f);
    const c = fs.existsSync(dir) ? fs.readdirSync(dir).filter(x => x.endsWith('.png')).length : 0;
    stats[f] = c; total += c;
  }
  stats.total = total;
  return stats;
}

/** Full catalog breakdown: parse every filename and tally each attribute combination. */
function getCatalogBreakdown() {
  const CATEGORIES = ['hairstyle', 'facialHair', 'bodyType', 'accessories'];
  const ALL_VALUES = {
    hairstyle: ['buzzcut','shortcrop','wavy','dreadsshort','dreadslong','longhair','parted','cornrows','afro','bald','manbun','fade','spiky','blondecrop'],
    facialHair: ['clean','stubble','fullbeard','goatee','mustache','saltpepper'],
    bodyType: ['lean','athletic','stocky','heavyset','beefy','round'],
    accessories: ['none','studs','hoops','diamonds','singlehoop'],
  };
  const result = {};
  for (const eth of ETHNICITY_FOLDERS) {
    const dir = path.join(CATALOG_ROOT, eth);
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.png')) : [];
    const breakdown = {};
    for (const cat of CATEGORIES) {
      breakdown[cat] = {};
      for (const val of ALL_VALUES[cat]) breakdown[cat][val] = 0;
    }
    for (const file of files) {
      // filename: ethnicity_hairstyle_facialHair_bodyType_accessories_0001.png
      const parts = file.replace('.png', '').split('_');
      // parts: [ethnicity, hairstyle, facialHair, bodyType, accessories, number]
      if (parts.length >= 6) {
        const [, hairstyle, facialHair, bodyType, accessories] = parts;
        if (breakdown.hairstyle[hairstyle] !== undefined) breakdown.hairstyle[hairstyle]++;
        if (breakdown.facialHair[facialHair] !== undefined) breakdown.facialHair[facialHair]++;
        if (breakdown.bodyType[bodyType] !== undefined) breakdown.bodyType[bodyType]++;
        if (breakdown.accessories[accessories] !== undefined) breakdown.accessories[accessories]++;
      }
    }
    result[eth] = { total: files.length, breakdown };
  }
  return result;
}

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch (e) { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}

function sendJSON(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/** Serve a static file from the public directory. */
function serveStatic(res, urlPath) {
  // Map clean URLs: /nextgm/avatar-forge → /nextgm/avatar-forge.html
  let filePath = path.join(PUBLIC_ROOT, urlPath);
  
  // If path has no extension and doesn't exist, try .html
  if (!path.extname(filePath) && !fs.existsSync(filePath)) {
    filePath += '.html';
  }
  // If it's a directory, try index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    sendJSON(res, 404, { error: 'Not found' });
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
  res.end(content);
}

const server = http.createServer(async (req, res) => {
  setCORS(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = req.url.split('?')[0];

  // ── API routes ──
  if (req.method === 'GET' && url === '/health') { sendJSON(res, 200, { status: 'ok' }); return; }
  if (req.method === 'GET' && url === '/stats') { sendJSON(res, 200, getStats()); return; }
  if (req.method === 'GET' && url === '/catalog') { sendJSON(res, 200, getCatalogBreakdown()); return; }

  if (req.method === 'POST' && url === '/save') {
    try {
      const body = await readBody(req);
      if (!body.url || !body.tags) { sendJSON(res, 400, { error: 'Missing url or tags' }); return; }
      const r = await saveImage(body.url, body.tags);
      sendJSON(res, 200, r.saved ? { saved: 1, failed: 0, path: r.path } : { saved: 0, failed: 1, errors: [r.error] });
    } catch (e) { sendJSON(res, 400, { error: e.message }); }
    return;
  }

  if (req.method === 'POST' && url === '/save-batch') {
    try {
      const body = await readBody(req);
      if (!body.images || !Array.isArray(body.images)) { sendJSON(res, 400, { error: 'Missing images array' }); return; }
      console.log('\nSaving batch of ' + body.images.length + ' images...');
      let saved = 0, failed = 0; const errors = [], paths = [];
      for (const img of body.images) {
        if (!img.url || !img.tags) { failed++; errors.push('Missing url or tags'); continue; }
        const r = await saveImage(img.url, img.tags);
        if (r.saved) { saved++; paths.push(r.path); } else { failed++; errors.push(r.error); }
      }
      console.log('Batch complete: ' + saved + ' saved, ' + failed + ' failed');
      sendJSON(res, 200, { saved, failed, errors, paths });
    } catch (e) { sendJSON(res, 400, { error: e.message }); }
    return;
  }

  // ── Static file serving ──
  if (req.method === 'GET') {
    serveStatic(res, url);
    return;
  }

  sendJSON(res, 404, { error: 'Not found' });
});

ensureCatalogFolders();
server.listen(PORT, () => {
  const stats = getStats();
  console.log('\n\uD83C\uDFC8 Avatar Forge Catalog Server');
  console.log('   Port: ' + PORT);
  console.log('   Catalog: ' + CATALOG_ROOT);
  console.log('   UI: http://localhost:' + PORT + '/nextgm/avatar-forge');
  console.log('   API: /health, /save, /save-batch, /stats\n');
  for (const f of ETHNICITY_FOLDERS) console.log('   ' + f + ': ' + stats[f]);
  console.log('   total: ' + stats.total + '\n   Ready.\n');
});
