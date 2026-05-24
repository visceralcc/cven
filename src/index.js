export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/fal') {
      return handleFalProxy(request, env);
    }

    if (url.pathname === '/api/sync-report') {
      return handleSyncReport(request, env);
    }

    if (url.pathname === '/api/sync-status') {
      return handleSyncStatus(request, env);
    }

    if (url.pathname === '/api/project-status') {
      return handleProjectStatus(request, env);
    }

    if (url.pathname === '/api/project-update') {
      return handleProjectUpdate(request, env);
    }

    if (url.pathname === '/api/project-file') {
      return handleProjectFile(request, env);
    }

    if (url.pathname === '/api/contact') {
      return handleContact(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};

// ─── Contact Form Handler ────────────────────────────────────────────

async function handleContact(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
  }

  try {
    const { name, email, message } = await request.json();

    if (!name || !email || !message) {
      return Response.json({ error: 'All fields are required' }, { status: 400, headers: CORS });
    }

    // Send email via Cloudflare Email Service
    await env.EMAIL.send({
      from: 'noreply@cven.cc',
      to: 'info@cven.cc',
      subject: `Contact Form: ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
      html: `<h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
        <hr>
        <p>${message.replace(/\n/g, '<br>')}</p>`,
    });

    return Response.json({ ok: true }, { headers: CORS });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: CORS });
  }
}

// ─── Sync Status API ─────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function handleSyncReport(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
  }

  // Authenticate
  const auth = request.headers.get('Authorization');
  if (!env.SYNC_KEY || auth !== `Bearer ${env.SYNC_KEY}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
  }

  try {
    const body = await request.json();
    const { machine, timestamp, repos } = body;

    if (!machine || !repos) {
      return Response.json({ error: 'Missing machine or repos' }, { status: 400, headers: CORS });
    }

    // Store in KV — 1 hour TTL (if machine doesn't report, it goes stale)
    await env.SYNC_STATUS.put(
      `machine:${machine}`,
      JSON.stringify({ machine, timestamp, repos }),
      { expirationTtl: 3600 }
    );

    return Response.json({ ok: true, machine, repoCount: repos.length }, { headers: CORS });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: CORS });
  }
}

async function handleSyncStatus(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  const knownMachines = ['macbook-pro', 'mac-mini'];
  const machines = {};

  for (const name of knownMachines) {
    const data = await env.SYNC_STATUS.get(`machine:${name}`);
    if (data) {
      machines[name] = JSON.parse(data);
    } else {
      machines[name] = { machine: name, timestamp: null, repos: [], offline: true };
    }
  }

  // Merge repos across machines into a unified view
  const repoMap = {};
  for (const [machineName, machineData] of Object.entries(machines)) {
    for (const repo of machineData.repos || []) {
      if (!repoMap[repo.name]) {
        repoMap[repo.name] = { name: repo.name, branch: repo.branch, machines: {} };
      }
      repoMap[repo.name].machines[machineName] = {
        status: repo.status,
        dirty: repo.dirty,
        ahead: repo.ahead,
        behind: repo.behind,
        stashes: repo.stashes,
        lastCommit: repo.lastCommit,
      };
    }
  }

  const response = {
    machines: Object.fromEntries(
      Object.entries(machines).map(([k, v]) => [
        k,
        { timestamp: v.timestamp, repoCount: v.repos?.length || 0, offline: v.offline || false },
      ])
    ),
    repos: Object.values(repoMap),
    checkedAt: new Date().toISOString(),
  };

  return Response.json(response, {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ─── fal.ai Proxy (existing) ─────────────────────────────────────────

async function handleFalProxy(request, env) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, {
      status: 405, headers: corsHeaders,
    });
  }

  const FAL_KEY = env.FAL_KEY;
  if (!FAL_KEY) {
    return Response.json({ error: 'FAL_KEY not configured' }, {
      status: 500, headers: corsHeaders,
    });
  }

  try {
    const body = await request.json();
    const { model, prompt, image_size, num_inference_steps,
            guidance_scale, image_url, image_urls } = body;

    const falBody = { prompt };

    if (image_url) {
      falBody.image_url = image_url;
    }
    if (image_urls && image_urls.length > 0) {
      falBody.image_urls = image_urls;
    }

    if (!image_url && !image_urls) {
      falBody.image_size = image_size || 'square_hd';
      falBody.num_images = 1;
      falBody.output_format = 'png';
    }

    falBody.enable_safety_checker = false;
    if (num_inference_steps) falBody.num_inference_steps = num_inference_steps;
    if (guidance_scale) falBody.guidance_scale = guidance_scale;

    const res = await fetch(`https://fal.run/${model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(falBody),
    });

    const data = await res.json();
    if (!res.ok) {
      return Response.json({ error: data }, { status: res.status, headers: corsHeaders });
    }

    return Response.json(data, { headers: corsHeaders });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
}

// ─── Project Status Proxy ────────────────────────────────────────────

const ALLOWED_REPOS = [
  'football-sim',
  'xoi-mobile',
  'storyengine',
  'xoplay-ffl',
  'velocity-002',
  'elemental-web',
  'cven',
];

async function handleProjectStatus(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  if (request.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405, headers: CORS });
  }

  const url = new URL(request.url);
  const repo = url.searchParams.get('repo');
  const file = url.searchParams.get('file');

  if (!repo) {
    return Response.json({ ok: false, error: 'Missing required parameter: repo' }, { status: 400, headers: CORS });
  }
  if (!file) {
    return Response.json({ ok: false, error: 'Missing required parameter: file' }, { status: 400, headers: CORS });
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(repo)) {
    return Response.json({ ok: false, error: 'Invalid repo format' }, { status: 400, headers: CORS });
  }

  if (file.startsWith('/') || file.includes('..') || !file.endsWith('.md')) {
    return Response.json({ ok: false, error: 'Invalid file path' }, { status: 400, headers: CORS });
  }

  if (!ALLOWED_REPOS.includes(repo)) {
    return Response.json({ ok: false, error: 'Unknown repo' }, { status: 400, headers: CORS });
  }

  if (!env.GITHUB_TOKEN) {
    return Response.json({ ok: false, error: 'GitHub token not configured' }, { status: 401, headers: CORS });
  }

  try {
    const branch = url.searchParams.get('branch') || 'main';
    const githubUrl = `https://raw.githubusercontent.com/visceralcc/${repo}/${branch}/${file}`;
    const res = await fetch(githubUrl, {
      headers: {
        'Authorization': `token ${env.GITHUB_TOKEN}`,
        'User-Agent': 'cven-worker',
      },
    });

    if (res.status === 404) {
      return Response.json({ ok: false, error: 'File not found', repo, file }, { status: 404, headers: CORS });
    }
    if (res.status === 403) {
      return Response.json({ ok: false, error: 'GitHub rate limit exceeded. Try again later.' }, { status: 403, headers: CORS });
    }
    if (!res.ok) {
      return Response.json({ ok: false, error: `GitHub returned status ${res.status}` }, { status: 500, headers: CORS });
    }

    const content = await res.text();
    return Response.json({
      ok: true,
      repo,
      file,
      content,
      fetchedAt: new Date().toISOString(),
    }, { headers: CORS });
  } catch (err) {
    return Response.json({ ok: false, error: `Fetch failed: ${err.message}` }, { status: 500, headers: CORS });
  }
}

// ─── Project Update (markdown append) ────────────────────────────────

function base64EncodeUtf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64DecodeUtf8(b64) {
  const bin = atob(String(b64).replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// Returns the new content string with `itemLine` appended into the right place.
function appendBacklogItem(content, section, subsection, itemLine) {
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);

  const isH2 = (l) => /^##\s+(.+?)\s*$/.test(l) && !/^###/.test(l);
  const isH3 = (l) => /^###\s+(.+?)\s*$/.test(l);
  const h2Title = (l) => l.match(/^##\s+(.+?)\s*$/)?.[1].trim();
  const h3Title = (l) => l.match(/^###\s+(.+?)\s*$/)?.[1].trim();
  const isBulletItem = (l) => /^\s*-\s+/.test(l);

  const targetSection = section.trim();
  const targetSub = subsection ? subsection.trim() : '';
  const sectionCi = targetSection.toLowerCase();
  const subCi = targetSub.toLowerCase();

  // Find the section.
  let sectionStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isH2(lines[i]) && h2Title(lines[i]).toLowerCase() === sectionCi) {
      sectionStart = i;
      break;
    }
  }

  // Section doesn't exist — append a new section at the end.
  if (sectionStart === -1) {
    const out = [...lines];
    // Trim trailing blank lines so we don't pile them up.
    while (out.length && out[out.length - 1].trim() === '') out.pop();
    out.push('');
    out.push(`## ${targetSection}`);
    out.push('');
    if (targetSub) {
      out.push(`### ${targetSub}`);
      out.push('');
    }
    out.push(itemLine);
    out.push('');
    return out.join(eol);
  }

  // Determine the range [scanStart, scanEnd) within the section (or subsection).
  let scanStart = sectionStart + 1;
  let scanEnd = lines.length;
  for (let i = sectionStart + 1; i < lines.length; i++) {
    if (isH2(lines[i])) { scanEnd = i; break; }
  }

  if (targetSub) {
    let subStart = -1;
    for (let i = scanStart; i < scanEnd; i++) {
      if (isH3(lines[i]) && h3Title(lines[i]).toLowerCase() === subCi) {
        subStart = i;
        break;
      }
    }
    if (subStart === -1) {
      // Subsection doesn't exist within the section — append at end of section.
      const subEnd = scanEnd;
      const out = lines.slice(0, subEnd);
      while (out.length > scanStart && out[out.length - 1].trim() === '') out.pop();
      out.push('');
      out.push(`### ${targetSub}`);
      out.push('');
      out.push(itemLine);
      out.push('');
      return out.concat(lines.slice(subEnd)).join(eol);
    }
    scanStart = subStart + 1;
    let subEnd = scanEnd;
    for (let i = subStart + 1; i < scanEnd; i++) {
      if (isH3(lines[i]) || isH2(lines[i])) { subEnd = i; break; }
    }
    scanEnd = subEnd;
  }

  // Find the last bullet item in [scanStart, scanEnd).
  let lastItem = -1;
  for (let i = scanStart; i < scanEnd; i++) {
    if (isBulletItem(lines[i])) lastItem = i;
  }

  const insertAt = lastItem !== -1 ? lastItem + 1 : scanEnd;
  const out = [...lines.slice(0, insertAt), itemLine, ...lines.slice(insertAt)];
  return out.join(eol);
}

async function handleProjectUpdate(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  if (request.method !== 'POST') {
    return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405, headers: CORS });
  }

  if (!env.GITHUB_TOKEN) {
    return Response.json({ ok: false, error: 'GitHub token not configured' }, { status: 401, headers: CORS });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400, headers: CORS });
  }

  const { repo, file, branch, section, subsection, item, commitMessage } = body || {};

  if (!repo) return Response.json({ ok: false, error: 'Missing required field: repo' }, { status: 400, headers: CORS });
  if (!file) return Response.json({ ok: false, error: 'Missing required field: file' }, { status: 400, headers: CORS });
  if (!section) return Response.json({ ok: false, error: 'Missing required field: section' }, { status: 400, headers: CORS });
  if (!item) return Response.json({ ok: false, error: 'Missing required field: item' }, { status: 400, headers: CORS });

  if (!/^[a-zA-Z0-9._-]+$/.test(repo)) {
    return Response.json({ ok: false, error: 'Invalid repo format' }, { status: 400, headers: CORS });
  }
  if (!ALLOWED_REPOS.includes(repo)) {
    return Response.json({ ok: false, error: 'Unknown repo' }, { status: 400, headers: CORS });
  }
  if (file.startsWith('/') || file.includes('..') || !file.endsWith('.md')) {
    return Response.json({ ok: false, error: 'Invalid file path' }, { status: 400, headers: CORS });
  }

  const targetBranch = branch || 'main';
  const itemLine = String(item).replace(/\r?\n.*$/s, '').trim();
  if (!itemLine) {
    return Response.json({ ok: false, error: 'Item line is empty' }, { status: 400, headers: CORS });
  }

  const ghBase = `https://api.github.com/repos/visceralcc/${repo}/contents/${file}`;
  const ghHeaders = {
    'Authorization': `token ${env.GITHUB_TOKEN}`,
    'User-Agent': 'cven-worker',
    'Accept': 'application/vnd.github+json',
  };

  try {
    // 1. Read current file (need content + sha).
    const getRes = await fetch(`${ghBase}?ref=${encodeURIComponent(targetBranch)}`, { headers: ghHeaders });
    if (!getRes.ok) {
      const text = await getRes.text();
      console.error('[project-update] GET failed', getRes.status, text);
      return Response.json({ ok: false, error: `GitHub GET ${getRes.status}` }, { status: 502, headers: CORS });
    }
    const fileData = await getRes.json();
    if (!fileData.sha || typeof fileData.content !== 'string') {
      console.error('[project-update] unexpected GET shape', fileData);
      return Response.json({ ok: false, error: 'Unexpected file metadata from GitHub' }, { status: 502, headers: CORS });
    }

    const original = base64DecodeUtf8(fileData.content);
    const updated = appendBacklogItem(original, section, subsection || '', itemLine);

    if (updated === original) {
      return Response.json({ ok: false, error: 'No change applied' }, { status: 500, headers: CORS });
    }

    // 2. PUT new content.
    const message = commitMessage || `backlog: add item to ${section}`;
    const putRes = await fetch(ghBase, {
      method: 'PUT',
      headers: { ...ghHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        content: base64EncodeUtf8(updated),
        sha: fileData.sha,
        branch: targetBranch,
      }),
    });

    if (!putRes.ok) {
      const text = await putRes.text();
      console.error('[project-update] PUT failed', putRes.status, text);
      return Response.json({ ok: false, error: `GitHub PUT ${putRes.status}` }, { status: 502, headers: CORS });
    }

    const putData = await putRes.json();
    return Response.json({
      ok: true,
      repo,
      file,
      branch: targetBranch,
      commit: putData.commit?.sha || null,
    }, { headers: CORS });
  } catch (err) {
    console.error('[project-update] error', err);
    return Response.json({ ok: false, error: err.message }, { status: 500, headers: CORS });
  }
}

// ─── Project File (full file write) ──────────────────────────────────

async function handleProjectFile(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  if (request.method !== 'PUT') {
    return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405, headers: CORS });
  }

  if (!env.GITHUB_TOKEN) {
    return Response.json({ ok: false, error: 'GitHub token not configured' }, { status: 401, headers: CORS });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400, headers: CORS });
  }

  const { repo, file, branch, content, commitMessage } = body || {};

  if (!repo) return Response.json({ ok: false, error: 'Missing required field: repo' }, { status: 400, headers: CORS });
  if (!file) return Response.json({ ok: false, error: 'Missing required field: file' }, { status: 400, headers: CORS });
  if (typeof content !== 'string') {
    return Response.json({ ok: false, error: 'Missing required field: content' }, { status: 400, headers: CORS });
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(repo)) {
    return Response.json({ ok: false, error: 'Invalid repo format' }, { status: 400, headers: CORS });
  }
  if (!ALLOWED_REPOS.includes(repo)) {
    return Response.json({ ok: false, error: 'Unknown repo' }, { status: 400, headers: CORS });
  }
  if (file.startsWith('/') || file.includes('..') || !file.endsWith('.md')) {
    return Response.json({ ok: false, error: 'Invalid file path' }, { status: 400, headers: CORS });
  }

  const targetBranch = branch || 'main';
  const ghBase = `https://api.github.com/repos/visceralcc/${repo}/contents/${file}`;
  const ghHeaders = {
    'Authorization': `token ${env.GITHUB_TOKEN}`,
    'User-Agent': 'cven-worker',
    'Accept': 'application/vnd.github+json',
  };

  try {
    // 1. Read current file to get its sha.
    const getRes = await fetch(`${ghBase}?ref=${encodeURIComponent(targetBranch)}`, { headers: ghHeaders });
    if (!getRes.ok) {
      const text = await getRes.text();
      console.error('[project-file] GET failed', getRes.status, text);
      return Response.json({ ok: false, error: `GitHub GET ${getRes.status}` }, { status: 502, headers: CORS });
    }
    const fileData = await getRes.json();
    if (!fileData.sha) {
      console.error('[project-file] missing sha', fileData);
      return Response.json({ ok: false, error: 'Unexpected file metadata from GitHub' }, { status: 502, headers: CORS });
    }

    // 2. PUT the new content with the sha.
    const message = commitMessage || `update ${file}`;
    const putRes = await fetch(ghBase, {
      method: 'PUT',
      headers: { ...ghHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        content: base64EncodeUtf8(content),
        sha: fileData.sha,
        branch: targetBranch,
      }),
    });

    if (!putRes.ok) {
      const text = await putRes.text();
      console.error('[project-file] PUT failed', putRes.status, text);
      return Response.json({ ok: false, error: `GitHub PUT ${putRes.status}` }, { status: 502, headers: CORS });
    }

    const putData = await putRes.json();
    return Response.json({
      ok: true,
      repo,
      file,
      branch: targetBranch,
      sha: putData.content?.sha || null,
      commit: putData.commit?.sha || null,
    }, { headers: CORS });
  } catch (err) {
    console.error('[project-file] error', err);
    return Response.json({ ok: false, error: err.message }, { status: 500, headers: CORS });
  }
}
