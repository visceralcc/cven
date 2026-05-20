# CVEN

Internal tools, website, and Cloudflare Worker for Civil Engine (cven.cc). Single-repo setup — one Worker serves the marketing site, Command Center dashboard, and all API routes.

## Quick Reference

| Info | Value |
|------|-------|
| Stack | Cloudflare Workers / static HTML / vanilla JS |
| Repo | cven |
| Branch | main |
| Deploy | `npx wrangler deploy` |
| Domain | cven.cc |

## Architecture

Everything runs through a single Cloudflare Worker (`cven-cc`). The Worker handles API routes in `src/index.js` and serves static files from `public/` via Cloudflare's asset binding.

### Worker Routes (`src/index.js`)

| Route | Purpose |
|-------|---------|
| `/api/project-status` | Proxy to GitHub API — fetches markdown files from private repos for the Command Center |
| `/api/sync-status` | Returns sync status data from KV storage |
| `/api/sync-report` | Receives sync reports and writes to KV |
| `/api/contact` | Contact form handler — sends email via Cloudflare Email Service |
| `/api/fal` | Proxy to fal.ai API (used by Avatar Forge) |
| Everything else | Falls through to static assets in `public/` |

### Static Pages (`public/`)

| Path | File | What It Is |
|------|------|------------|
| `/` | `public/index.html` | Civil Engine marketing site (Home, Work, About, Contact) |
| `/central/` | `public/central/index.html` | Command Center — multi-project status dashboard |
| `/central/sync/` | `public/central/sync/index.html` | Sync status page |
| `/elemental/` | `public/elemental/index.html` | Elemental web tool |
| `/nextgm/avatar-forge` | `public/nextgm/avatar-forge.html` | NextGM Avatar Forge tool |
| `/nextgm/avatar-forge-guide` | `public/nextgm/avatar-forge-guide.html` | Avatar Forge usage guide |

## Command Center

The dashboard at `cven.cc/central/` surfaces project status and backlog for all active Civil Engine / XO projects. It's a single static HTML page with no build step.

### How It Works

- Browser fetches markdown from private GitHub repos via the `/api/project-status` proxy route
- Worker authenticates with a stored `GITHUB_TOKEN` (set via `wrangler secret put GITHUB_TOKEN`)
- Worker validates repo names against a hardcoded `ALLOWED_REPOS` allowlist in `src/index.js`
- Only `.md` file paths are permitted — token is never exposed to the client

### Data Convention

Every project is expected to have:
- `docs/status/BUILD_STATUS.md` — parsed into the Status panel
- `docs/status/BACKLOG.md` — parsed into the Backlog panel

Sync data comes from the existing `/api/sync-status` endpoint.

### Project Config (in `public/central/index.html`)

Projects are defined in a `PROJECTS` JavaScript object embedded in the HTML:

```javascript
const PROJECTS = [
  { name: 'NextGM', repo: 'football-sim', desc: 'Football GM simulation', branch: 'master',
    tools: [
      { name: 'Avatar Forge', url: '/nextgm/avatar-forge' },
      { name: 'Avatar Forge Guide', url: '/nextgm/avatar-forge-guide' },
    ],
  },
  { name: 'XOI', repo: 'xoi-mobile', desc: 'NFL analytics platform', tools: [] },
  { name: 'StoryEngine', repo: 'storyengine', desc: 'Narrative engine', tools: [] },
  { name: 'XOPlay', repo: 'xoplay-ffl', desc: 'Fantasy football league', tools: [] },
  { name: 'Velocity', repo: 'velocity-002', desc: 'Idea refinement tool', tools: [] },
  { name: 'Elemental Web', repo: 'elemental-web', desc: 'Design tool', tools: [] },
  { name: 'CVEN', repo: 'cven', desc: 'Internal tools & worker', tools: [] },
];
```

Adding a project = one entry here + add the repo to `ALLOWED_REPOS` in `src/index.js`.

### Key Behaviors

- **Pull on demand** — data refreshes only on user click, no background polling
- **Convention over config** — all projects use the same markdown file paths
- **Read-only** — dashboard never writes to repos
- **Branch flexibility** — defaults to `main`, configurable per project (football-sim uses `master`)

## Marketing Site (`public/index.html`)

Single-page app with hash-based navigation (#home, #work, #about, #contact). Four screens rendered as show/hide divs. Contact form submits to `/api/contact`.

### Visual Design

- White background, minimal borders, no shadows
- Typography: Barlow (body) / Barlow Condensed (display headings)
- CSS variables defined in `:root` for colors and fonts
- Responsive breakpoints at 768px and 480px

## Environment & Secrets

| Secret | Purpose | Set via |
|--------|---------|---------|
| `GITHUB_TOKEN` | GitHub PAT with `repo` scope | `wrangler secret put GITHUB_TOKEN` |

| KV Namespace | Purpose |
|--------------|---------|
| `SYNC_STATUS` | Stores sync status data |

## File Map

```
cven/
├── CLAUDE.md                          ← This file
├── src/
│   └── index.js                       ← Worker — all API routes
├── public/
│   ├── index.html                     ← Marketing site
│   ├── civil-engine-logo.png
│   ├── work/                          ← Work page images
│   ├── central/
│   │   ├── index.html                 ← Command Center dashboard
│   │   └── sync/
│   │       └── index.html             ← Sync status page
│   ├── elemental/
│   │   └── index.html                 ← Elemental web tool
│   └── nextgm/
│       ├── avatar-forge.html          ← Avatar Forge tool
│       ├── avatar-forge-guide.html    ← Avatar Forge guide
│       ├── catalog/                   ← Avatar catalog assets
│       ├── catalog-manifest.json
│       └── refs/                      ← Reference images
├── wrangler.jsonc                     ← Worker config
├── package.json
├── avatar-server.js                   ← Local dev server for avatar tools
├── build-catalog-manifest.js          ← Script to rebuild catalog manifest
└── sync-refs.js                       ← Script to sync reference images
```

## Conventions

- **No build step.** All pages are single HTML files with inline CSS and JS.
- **Deploy:** `npx wrangler deploy` pushes both the Worker and all static assets.
- **Adding a page:** Create an HTML file in `public/` at the desired path. It's automatically served.
- **Adding an API route:** Add a pathname check in `src/index.js` before the final `env.ASSETS.fetch(request)` fallthrough.

## What NOT to Do

- Do not add a build step or bundler — everything is vanilla HTML/CSS/JS by design
- Do not expose `GITHUB_TOKEN` or any secrets to client-side code
- Do not modify `wrangler.jsonc` without confirming first
- Do not install npm dependencies unless the task specifically requires it
