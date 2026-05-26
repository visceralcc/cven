# CVEN — Build Status

**Feature map and completion tracker. Surfaced in Command Center.**

Last updated: 2026-05-26

| System | Status |
|---|---|
| Marketing site at cven.cc (logo landing page) | ✅ Complete |
| Command Center dashboard at cven.cc/central/ | ✅ Complete |
| Sync status dashboard at cven.cc/central/sync/ | ✅ Complete |
| Project Status API route (`/api/project-status`) | ✅ Complete |
| Sync Report API (`/api/sync-report`) | ✅ Complete |
| Sync Status API (`/api/sync-status`) | ✅ Complete |
| Contact form API (`/api/contact` via Cloudflare Email Service) | ✅ Complete |
| fal.ai proxy (`/api/fal`) | ✅ Complete |
| Avatar Forge tool (`/nextgm/avatar-forge`) | ✅ Complete |
| Avatar Forge — Save & Sort spec | ✅ Complete (`SPEC_AvatarForge_SaveSort.md`) |
| NextGM avatar catalog manifest (`build-catalog-manifest.js`) | ✅ Complete |
| Avatar reference sync (`sync-refs.js`) | ✅ Complete |
| Local avatar generation server (`avatar-server.js`) | ✅ Complete |
| Elemental landing page (`/elemental/`) | ✅ Complete |
| NextGM Avatar Forge guide page | ✅ Complete |
| Cloudflare Worker (`src/index.js`) — main routing + handlers | ✅ Complete |
| Wrangler config + custom domain (cven.cc) | ✅ Complete |
| Skill — command-center-status (parser format docs) | ✅ Complete |
| Spec — Command Center PRD (v0.1) | ✅ Complete |
| Spec — Dashboard (`documents/dashboard/Spec_Dashboard.md`) | ✅ Complete |
| Spec — Project Status Route (`documents/worker/Spec_ProjectStatusRoute.md`) | ✅ Complete |
| Structure Map | ✅ Complete |
| Catalog manifest task (`tasks/task_CatalogManifest.md`) | ✅ Complete |
| Dashboard authentication beyond GitHub token proxy | 🔲 Not started (out of scope per PRD §1) |
| Additional internal tools beyond Avatar Forge | 🔲 Not started |

## Sprint 05.26.26 — Dashboard status files + project formatting

Created `docs/status/BUILD_STATUS.md` and `BACKLOG.md` for this repo so CVEN itself shows up in the Command Center dashboard. Reformatted status files across the other six tracked repos in the same pass.

- Added CVEN's own status files (this repo was previously missing them)
- Updated the seven-project audit per `skills/command-center-status/SKILL.md`
- All seven projects (NextGM, XOI, StoryEngine, XOPlay, Velocity, Elemental Web, CVEN) now have parseable BUILD_STATUS.md + BACKLOG.md

## History

### Command Center

The dashboard at `cven.cc/central/` is a single-glance status view across all active Civil Engine / XO projects. The Cloudflare Worker proxies GitHub API requests so the client can read `BUILD_STATUS.md` / `BACKLOG.md` from each tracked repo without exposing the token.

- **PROJECTS array** at `public/central/index.html` defines the projects shown
- **ALLOWED_REPOS** at `src/index.js` whitelists which repos the `/api/project-status` route can fetch
- **Parser** in the dashboard JS extracts a 2-column systems table + a sprint heading from `BUILD_STATUS.md`, and collapsible `- ✅`/`- 🔲` sections from `BACKLOG.md`
- **Skill** at `skills/command-center-status/SKILL.md` documents the exact parser format so future Claude Code sessions can format new repos correctly without touching parser code

### Avatar Forge

Internal NextGM tool that generates and curates player avatars via fal.ai. Includes a save/sort flow defined in `SPEC_AvatarForge_SaveSort.md`, a catalog manifest builder (`build-catalog-manifest.js`), and a reference sync utility (`sync-refs.js`). The local `avatar-server.js` supports development workflows that hit fal.ai directly without going through the Worker proxy.

### Worker routes

- `/api/fal` — fal.ai proxy (Avatar Forge image generation; keeps the API key server-side)
- `/api/contact` — Contact form handler, sends mail via Cloudflare Email Service
- `/api/sync-report` — Sync status reporter
- `/api/sync-status` — Sync status reader
- `/api/project-status` — Reads `BUILD_STATUS.md` / `BACKLOG.md` from any repo in `ALLOWED_REPOS` via GitHub API
- All other paths — Static assets via `env.ASSETS.fetch(request)`

### Deploy

`npx wrangler deploy` from the repo root. First-time setup requires `npx wrangler secret put FAL_KEY` and connecting `cven.cc` in the Cloudflare dashboard (Workers & Pages → cven-cc → Settings → Domains & Routes).

### Tracked projects in the dashboard

| Project | Repo | Branch |
|---|---|---|
| NextGM | football-sim | master |
| XOI | xoi-mobile | main |
| StoryEngine | storyengine | main |
| XOPlay | xoplay-ffl | main |
| Velocity | velocity-002 | main |
| Elemental Web | elemental-web | main |
| CVEN | cven | main |
