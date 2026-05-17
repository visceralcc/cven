# Command Center — Structure Map

**File tree, feature boundaries, and writing order for the Command Center v2 rewrite.**

Version 0.1 | May 2026

---

## Project Location

Repo: `visceralcc/cven`
Path: `cven/documents/`
Deployed to: `cven.cc/central/`

---

## File Tree

```
cven/
  documents/
    Spec_CommandCenter_PRD.md            ← Level 1 — the full picture
    Structure_Map.md                     ← this file
    dashboard/
      Spec_Dashboard.md                  ← Level 2 — Tech Spec for the full dashboard
      Screen_Dashboard.md                ← Level 3 — the single-page HTML/CSS/JS build
    worker/
      Spec_ProjectStatusRoute.md         ← Level 2 — Tech Spec for the Worker proxy route
      Logic_GitHubProxy.md               ← Level 3 — the /api/project-status handler
      Logic_SyncPerProject.md            ← Level 3 — filtering /api/sync-status per repo
```

---

## Feature Boundaries

This project has two natural features:

### 1. Dashboard (frontend)
The single HTML page at `public/central/index.html`. Owns all UI: sidebar, main panel, markdown parsing, refresh logic, loading/error states. Consumes the Worker API — never touches GitHub directly.

### 2. Worker Route (backend)
The new `/api/project-status` route added to the existing Cloudflare Worker at `src/index.js`. Owns the GitHub proxy logic: receives a repo + file path, fetches from GitHub's raw content API using the stored PAT, returns markdown to the browser. Also owns filtering the existing `/api/sync-status` response per project.

**Why two features, not one?** They deploy independently (the Worker vs. static assets), they have different failure modes (API auth vs. UI rendering), and they could be built and tested in isolation. The Worker route can be tested with curl before the dashboard exists.

---

## Cross-Cutting Concerns

**Standardized file locations (Phase 0):** Before either feature is built, every project repo needs `docs/status/BUILD_STATUS.md` and `docs/status/BACKLOG.md` in the correct location. This is a prerequisite, not a feature of this project. Tracked separately.

**Project config:** The list of projects, repos, and tools lives as a JavaScript object in the dashboard HTML. It's consumed by the frontend only — the Worker doesn't need it (it receives repo names as query params).

---

## Writing Order

1. **Spec_ProjectStatusRoute.md** (Worker) — write first. The API contract defines what the dashboard can consume. If this is wrong, the dashboard is wrong.

2. **Spec_Dashboard.md** (Dashboard) — write second. Depends on knowing the API shape from #1.

3. **Level 3 docs** — write at build time, one feature at a time. Worker first, dashboard second.

---

## Relationship to Build Sequence (from PRD §11)

| PRD Phase | Structure Map Feature | Docs |
|---|---|---|
| Phase 0 — Standardize file locations | Cross-cutting prerequisite | (no spec — manual file moves) |
| Phase 1 — API proxy route | Worker Route | Spec_ProjectStatusRoute → Logic_GitHubProxy |
| Phase 2 — Dashboard HTML/CSS | Dashboard | Spec_Dashboard → Screen_Dashboard |
| Phase 3 — Data fetching & parsing | Dashboard | Screen_Dashboard (wiring section) |
| Phase 4 — Polish & deploy | Both | (no new spec — refinement of existing) |

---

## What's NOT a Separate Feature

- **Per-project tools (§5.7):** Config-driven links in the sidebar. Part of the Dashboard feature, not its own feature.
- **Per-project sync (§5.8):** Consumes the existing `/api/sync-status` endpoint with a repo filter. Part of the Dashboard feature (display) with a small Worker addition (filtering logic).
- **Refresh All (§5.5):** UI-only — loops the same fetch logic. Part of the Dashboard feature.
- **Markdown parsing:** Browser-side JavaScript inside the dashboard. Not complex enough to warrant its own spec — covered in Screen_Dashboard.
