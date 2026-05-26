# CVEN — Backlog

Open work tracked for the dashboard. Source of truth for system completion is `BUILD_STATUS.md`.

---

## Up Next

- 🔲 Monitor parser behavior across the seven newly-formatted project status files; tweak the skill if any project surfaces formatting edge cases [docs]

## Command Center

- 🔲 Sync-status reporter polish (clean up any stale entries in the sync UI) [ui]
- 🔲 Consider adding an "All status files last updated within 30 days?" health indicator on the dashboard [ui]

## Avatar Forge

- 🔲 Continue catalog manifest refinements as new avatar batches land [data]
- 🔲 Document the local avatar-server workflow alongside the Worker-proxy path [docs]

## Tools / future

- 🔲 Additional internal tools beyond Avatar Forge — scope on demand [ui]

---

## Done

- ✅ Cloudflare Worker scaffold + static asset routing [infra]
- ✅ cven.cc custom domain wired to the Worker [infra]
- ✅ `/api/fal` proxy for fal.ai (Avatar Forge image generation) [data]
- ✅ `/api/contact` handler via Cloudflare Email Service [data]
- ✅ `/api/sync-report` + `/api/sync-status` endpoints [data]
- ✅ `/api/project-status` GitHub-API proxy for the Command Center dashboard [data]
- ✅ Marketing site at cven.cc (logo landing page) [ui]
- ✅ Command Center dashboard at cven.cc/central/ [ui]
- ✅ Sync status dashboard at cven.cc/central/sync/ [ui]
- ✅ Elemental landing page at `/elemental/` [ui]
- ✅ NextGM Avatar Forge tool at `/nextgm/avatar-forge` [ui] [data]
- ✅ Avatar Forge — Save & Sort spec [spec]
- ✅ Avatar catalog manifest builder (`build-catalog-manifest.js`) [data]
- ✅ Avatar reference sync (`sync-refs.js`) [data]
- ✅ Local avatar generation server (`avatar-server.js`) [data]
- ✅ NextGM Avatar Forge guide page [ui] [docs]
- ✅ Command Center PRD (v0.1) [spec]
- ✅ Dashboard spec (`documents/dashboard/Spec_Dashboard.md`) [spec]
- ✅ Project Status Route spec (`documents/worker/Spec_ProjectStatusRoute.md`) [spec]
- ✅ Structure Map [spec]
- ✅ Catalog manifest task (`tasks/task_CatalogManifest.md`) [spec]
- ✅ `command-center-status` skill — parser format reference for future status-file work [docs]
