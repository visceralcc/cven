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
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    const githubUrl = `https://raw.githubusercontent.com/visceralcc/${repo}/main/${file}`;
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
