// src/central.js
// Backend for cven.cc/central. Reads docs/status/BUILD_STATUS.md from each repo
// over the GitHub API (read-only, so it can never go stale) and stores per-project
// Notes in KV (the one writable part).
//
// Wired in src/index.js:
//   import { handleCentral } from './central.js';
//   if (url.pathname.startsWith('/api/central/')) return handleCentral(request, env, ctx);
//
// Bindings (wrangler.jsonc):
//   kv_namespaces: [{ binding: 'CENTRAL_NOTES', id: 'aa8655ca553f41579245ca50e92d4307' }]
// Secret:
//   GITHUB_TOKEN  (fine-grained PAT, read-only Contents on the repos below)

// ── Edit this list to control what shows up on the dashboard ────────────────
// id      : stable key (also the KV notes key) — don't change once notes exist
// label   : text on the switcher button
// repo    : GitHub owner/repo
// branch  : default 'main'
// path    : path to the status file in the repo
const PROJECTS = [
  { id: 'modvox',     label: 'MOD : VOX',     repo: 'visceralcc/mod-vox',           branch: 'main',   path: 'docs/status/BUILD_STATUS.md' },
  { id: 'modscout',   label: 'MOD : SCOUT',   repo: 'visceralcc/xoi-mobile',        branch: 'main',   path: 'docs/status/BUILD_STATUS.md' },
  { id: 'modfantasy', label: 'MOD : FANTASY', repo: 'visceralcc/mod-fantasy-nfl',   branch: 'main',   path: 'docs/status/BUILD_STATUS.md' },
  { id: 'moddesign',  label: 'MOD : DESIGN',  repo: 'visceralcc/mod-design-system', branch: 'main',   path: 'docs/status/BUILD_STATUS.md' },
  { id: 'modweb',     label: 'MOD : WEB',     repo: 'visceralcc/mod-website',       branch: 'main',   path: 'docs/status/BUILD_STATUS.md' },
  { id: 'nextgm',     label: 'NEXTGM',        repo: 'visceralcc/football-sim',      branch: 'master', path: 'docs/status/BUILD_STATUS.md' },
  { id: 'bespoken',   label: 'BESPOKEN',      repo: 'visceralcc/bespoken',          branch: 'main',   path: 'docs/status/BUILD_STATUS.md' },

  // Steelcraft isn't cloned locally — add when you have the slug:
  // { id: 'steelcraft', label: 'STEELCRAFT', repo: 'visceralcc/steelcraft', branch: 'main', path: 'docs/status/BUILD_STATUS.md' },
];

// Headings that feed each column (case-insensitive, matched after the #'s).
const SECTION_ALIASES = {
  nextSteps: ['next steps'],
  backlog:   ['backlog'],
};

const MAX_ITEM_LEN = 160;
const JSON_HEADERS = { 'Content-Type': 'application/json' };

export async function handleCentral(request, env, ctx) {
  const url = new URL(request.url);
  if (url.pathname === '/api/central/status') return handleStatus(request, env, ctx);
  if (url.pathname === '/api/central/notes')  return handleNotes(request, env);
  return json({ error: 'not found' }, 404);
}

// ── STATUS ──────────────────────────────────────────────────────────────────
async function handleStatus(request, env, ctx) {
  const projects = await Promise.all(PROJECTS.map((p) => loadProject(p, env)));
  return json({ generatedAt: new Date().toISOString(), projects }, 200, { 'Cache-Control': 'no-store' });
}

async function loadProject(p, env) {
  const out = { id: p.id, label: p.label, repo: p.repo, nextSteps: [], backlog: [], updated: null, error: null };
  try {
    const [raw, updated] = await Promise.all([
      ghFetchRaw(p, env),
      ghLastCommit(p, env).catch(() => null),
    ]);
    out.updated = updated;
    out.nextSteps = extractSection(raw, SECTION_ALIASES.nextSteps);
    out.backlog   = extractSection(raw, SECTION_ALIASES.backlog);
  } catch (e) {
    out.error = e.message || 'fetch failed';
  }
  return out;
}

async function ghFetchRaw(p, env) {
  const u = `https://api.github.com/repos/${p.repo}/contents/${p.path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(p.branch)}`;
  const res = await fetch(u, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.raw+json',
      'User-Agent': 'cven-central',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (res.status === 404) throw new Error('file or repo not found');
  if (res.status === 401 || res.status === 403) throw new Error('auth / permission (check GITHUB_TOKEN)');
  if (!res.ok) throw new Error('github ' + res.status);
  return res.text();
}

async function ghLastCommit(p, env) {
  const u = `https://api.github.com/repos/${p.repo}/commits?path=${encodeURIComponent(p.path)}&per_page=1&sha=${encodeURIComponent(p.branch)}`;
  const res = await fetch(u, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'cven-central',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) return null;
  const arr = await res.json();
  return arr?.[0]?.commit?.committer?.date ?? null;
}

// Pull items from the section whose heading matches `names`, stopping at the next
// heading of the same or higher level. Reads both markdown lists AND tables
// (the "Item"/"Task"/"Title" column), and reduces each entry to a glanceable
// headline: the leading **bold** lead-in if present, else the first sentence.
function extractSection(md, names) {
  const lines = md.split(/\r?\n/);
  const wanted = names.map((n) => n.toLowerCase());
  let capturing = false;
  let level = 0;
  const block = [];

  for (const line of lines) {
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length;
      const text = h[2].replace(/[:#*_`]/g, '').trim().toLowerCase();
      if (!capturing) {
        if (wanted.some((w) => text === w || text.startsWith(w))) { capturing = true; level = lvl; }
      } else if (lvl <= level) {
        break;
      }
      continue;
    }
    if (capturing) block.push(line);
  }

  const items = [];
  const tableRows = [];

  for (const line of block) {
    if (/^\s*\|/.test(line)) { tableRows.push(line); continue; }
    const li = line.match(/^\s*(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?(.*)$/);
    if (li && li[1].trim()) items.push(headline(li[1]));
  }
  for (const cell of tableItemColumn(tableRows)) items.push(headline(cell));

  // de-dupe + drop empties
  return items.filter((s, i) => s && items.indexOf(s) === i);
}

// From a set of markdown table lines, return the cells of the Item/Task/Title
// column (falling back to column 2 of a 3+ column table, else column 1).
function tableItemColumn(rows) {
  if (rows.length < 2) return [];
  const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const header = cells(rows[0]);
  const isSep = (r) => /^\s*\|?[\s:|-]+\|?\s*$/.test(r) && r.includes('-');

  let col = header.findIndex((c) => /^(item|task|title|thing)$/i.test(c));
  if (col < 0) col = header.length >= 3 ? 1 : 0;

  const out = [];
  for (let i = 1; i < rows.length; i++) {
    if (isSep(rows[i])) continue;
    const c = cells(rows[i]);
    if (c[col]) out.push(c[col]);
  }
  return out;
}

function headline(raw) {
  let s = raw.trim();
  const bold = s.match(/^\*\*(.+?)\*\*/);         // leading **bold** lead-in
  if (bold) s = bold[1];
  else { const dot = s.search(/\.\s/); if (dot > 12) s = s.slice(0, dot); } // else first sentence
  s = s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')       // links → text
    .replace(/[*_`]/g, '')                          // emphasis/code marks
    .replace(/\s+/g, ' ')
    .replace(/[.:;,\s]+$/, '')
    .trim();
  if (s.length > MAX_ITEM_LEN) s = s.slice(0, MAX_ITEM_LEN - 1).replace(/\s+\S*$/, '') + '…';
  return s;
}

// ── NOTES ─────────────────────────────────────────────────────────────────
async function handleNotes(request, env) {
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const project = url.searchParams.get('project');
    if (!project) return json({ error: 'missing project' }, 400);
    const notes = (await env.CENTRAL_NOTES.get(`notes:${project}`)) || '';
    return json({ project, notes });
  }

  if (request.method === 'PUT') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
    const { project, notes } = body || {};
    if (!project) return json({ error: 'missing project' }, 400);
    const text = String(notes ?? '').slice(0, 100000);
    await env.CENTRAL_NOTES.put(`notes:${project}`, text);
    return json({ ok: true, project });
  }

  return json({ error: 'method not allowed' }, 405);
}

function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { ...JSON_HEADERS, ...extra } });
}
