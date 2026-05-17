# Command Center — Product Requirements Document

**Multi-Project Status Dashboard**

Version 0.1 | May 2026 | Charlie Denison | Civil Engine

**CONFIDENTIAL**

---

## Version History
| Version | Date | Changes |
|---------|------|---------|
| 0.1 | May 2026 | Initial draft. Full PRD for Command Center v2 rewrite. |

---

## 1. Overview

Command Center is an internal web dashboard that shows the current status and next steps for every active Civil Engine / XO project. It lives at `cven.cc/central/` and replaces the existing tools-directory page.

**Design principle: Single-glance clarity.** Every project's status should be obvious within seconds of opening the page. The dashboard answers two questions — "What's the state of this project?" and "What do I need to do next?" — without requiring the user to open a repo, read a markdown file, or remember where they left off.

**Who uses it:** Charlie — sole user. Accessed from MacBook Pro, Mac Mini, or mobile. No authentication beyond the GitHub token proxy (server-side only).

**Scope boundary — what this is NOT:**
- Not a project management tool (no task assignment, no timelines, no sprint planning)
- Not a code editor or file browser
- Not a replacement for Claude Code sessions or spec writing
- Not a sync status dashboard (that stays at `/central/sync/`)
- Does not write to repos — read-only consumption of markdown files

---

## 2. The Problem

Projects are spread across multiple repos with documentation at different maturity levels. Status information lives in markdown files (`BUILD_STATUS.md`, `REFINEMENT_BACKLOG.md`) buried inside each repo's folder structure. To understand "what's next" across the portfolio, Charlie currently has to:

1. Remember which repos have status files
2. Open each repo individually (or SSH into a machine that has it cloned)
3. Read raw markdown to extract the current state
4. Mentally hold the status of 7 projects simultaneously

The existing Command Center page at `cven.cc/central/` is a static tools directory — it lists links to internal tools but says nothing about project status. The local `nextgm-backlog.html` on the MacBook Pro parses `REFINEMENT_BACKLOG.md` into a browseable view, but it's local-only and only covers one project.

---

## 3. Users & Access

**Primary user:** Charlie Denison (sole user)
**Access points:** Any browser — MacBook Pro, Mac Mini, phone
**Authentication:** None at the page level. The Cloudflare Worker uses a server-side GitHub personal access token to fetch files from private repos. The token is stored as a Cloudflare secret and never touches the browser.

---

## 4. Design Principles

1. **Machine-agnostic.** Works identically from any device with a browser. No local file dependencies, no localhost servers, no machine-specific paths.
2. **Pull on demand, not poll.** Data refreshes when the user clicks Refresh — no background polling, no cron jobs, no wasted API calls. GitHub raw content is cheap but not free; respect rate limits.
3. **Convention over configuration.** Every project follows the same file structure. The dashboard knows where to look because the contract is standardized. One mapping config, not per-project custom logic.
4. **Read-only.** The dashboard consumes markdown files — it never writes, commits, or modifies anything in any repo.

---

## 5. Feature Inventory

### 5.1 Project Directory (Left Navigation)

A persistent sidebar listing all active projects. Each entry shows:
- Project name
- Status indicator dot (green = BUILD_STATUS exists and has content, gray = no status file found)

Selecting a project loads its status content in the main panel. One project is selected at a time.

**Projects (v1):**

| Display Name | Repo | Description |
|---|---|---|
| NextGM | `football-sim` | Football GM simulation |
| XOI | `xoi-mobile` | NFL analytics platform |
| StoryEngine | `storyengine` | Narrative engine |
| XOPlay | `xoplay-ffl` | Fantasy football league |
| Velocity | `velocity-002` | Idea refinement tool |
| Elemental Web | `elemental-web` | Design tool |
| CVEN | `cven` | Internal tools & worker |

### 5.2 Level A — Status & Next Steps (Main Panel, Top)

Parsed from each project's `docs/status/BUILD_STATUS.md`. Displays:

- **Status table:** The feature/system completion table (✅ Complete, 🔲 Not started, 🟡 In progress). Rendered as a styled HTML table, not raw markdown.
- **Current state summary:** The "Current State" section header text (e.g., "last updated: 2026-04-27").
- **Most recent sprint:** The most recent sprint section (the first `## Sprint` or `## [Label] — Sprint` heading and its content). This answers "what was the last thing that happened?"

If no `BUILD_STATUS.md` is found, the panel shows a clear empty state: "No BUILD_STATUS.md found in this repo. Create one at `docs/status/BUILD_STATUS.md` to see status here."

### 5.3 Level B — Granular Backlog (Main Panel, Below Status)

Parsed from each project's `docs/status/BACKLOG.md`. Displays:

- **Section groups:** Each `## Section` heading becomes a collapsible group
- **Sub-groups (optional):** `### Sub-heading` lines become nested groups within a section. Projects that don't need sub-grouping just use flat task lists under `##`.
- **Task items:** `- ✅` = completed, `- 🔲` = open. Rendered as a styled checklist.
- **Tags:** Optional `[tag]` suffixes (e.g., `[bug]`, `[engine]`, `[figma]`) are displayed inline but not parsed for logic.
- **Completion count:** Per section, show "X of Y complete"

**Format contract (all projects must follow):**

```markdown
# [Project] — Backlog

One-line description of what this backlog tracks.

---

## [Feature Area]

### [Optional Sub-Category]
- ✅ Completed task description [optional-tag]
- 🔲 Open task description [optional-tag]
```

If no `BACKLOG.md` is found, show: "No BACKLOG.md found. Create one at `docs/status/BACKLOG.md` to see the backlog here."

### 5.4 Data Fetching via GitHub Proxy

The Cloudflare Worker at `cven.cc` gets a new API route: `/api/project-status`.

**Request:** `GET /api/project-status?repo={repoName}&file={filePath}`

**Behavior:**
1. Receives the repo name and relative file path
2. Constructs the GitHub raw content URL: `https://raw.githubusercontent.com/visceralcc/{repo}/main/{filePath}`
3. Fetches using the stored GitHub token (`Authorization: token {GITHUB_TOKEN}`)
4. Returns the raw markdown content to the browser
5. Browser-side JavaScript parses the markdown into HTML

**Why a proxy?** GitHub personal access tokens can't be exposed in browser-side code. The Worker holds the secret server-side and acts as a pass-through.

**Rate limiting:** GitHub allows 5,000 authenticated requests/hour. With 7 projects × 2 files × manual refresh only, this is nowhere near a concern.

### 5.5 Refresh Mechanism

A single "Refresh" button in the header area. Clicking it re-fetches the currently selected project's files from GitHub. No auto-refresh, no timers.

A "Refresh All" button in the header fetches status for every project and updates all sidebar indicators in one pass.

### 5.6 Standardized File Locations

**This is a prerequisite, not a dashboard feature.** Every project must adopt a standard docs location for the Command Center to find files:

```
{repo}/
  docs/
    status/
      BUILD_STATUS.md      ← Level A source
      BACKLOG.md            ← Level B source
```

**Migration needed for existing projects:**

| Project | Current Location | Migration |
|---|---|---|
| NextGM (football-sim) | `documents/BUILD_STATUS.md`, `documents/REFINEMENT_BACKLOG.md` | Move to `docs/status/`, rename backlog |
| StoryEngine | `docs/status/BUILD_STATUS.md` | ✅ Already correct |
| Elemental Web | `documents/BUILD_STATUS.md` | Move to `docs/status/` |
| XOI | No BUILD_STATUS | Create `docs/status/BUILD_STATUS.md` |
| XOPlay | No BUILD_STATUS | Create `docs/status/BUILD_STATUS.md` |
| Velocity | `docs/status/BUILD_STATUS.md` | ✅ Already correct |
| CVEN | No BUILD_STATUS | Create `docs/status/BUILD_STATUS.md` |

The dashboard config maps display names to repos but assumes the file path is always `docs/status/BUILD_STATUS.md` and `docs/status/BACKLOG.md`. Convention over configuration.

---

## 6. UI & Visual Design

**Reference:** Soft blue-white aesthetic from the attached reference image.

- **Background:** Very faint cool blue-gray (not pure white, not obviously blue — in between)
- **Content panels:** Pure white with subtle border radius, no shadows, no elevation
- **Typography:** Barlow / Barlow Condensed. Consistent with existing cven.cc design tokens.
- **Layout:** Left sidebar (project directory) + main content area (status + backlog)
- **No icons.** Text-only navigation and labels.
- **Responsive:** Sidebar collapses on narrow viewports; main content goes full-width.

**Specific UI elements:**
- Status indicator dots: small circles, green (#4CAF50 or similar) / gray (#ccc)
- Section headers in the backlog: Barlow Condensed, uppercase, muted color
- Completion badges: "12 of 18" style, small, inline with section headers
- Refresh button: minimal, top-right of main panel, no heavy styling

---

## 7. Technical Architecture

**Stack:**
- **Hosting:** Cloudflare Pages (static HTML/CSS/JS in `cven/public/central/`)
- **API proxy:** Cloudflare Worker (existing `cven-cc` worker, new `/api/project-status` route)
- **Data source:** GitHub raw content API (private repos, authenticated via PAT)
- **Markdown parsing:** Browser-side JavaScript (lightweight parser — no heavy library needed, the markdown structure is predictable)
- **State:** None persisted. Everything is fetched fresh on each page load or refresh.

**No build step.** The dashboard is a single HTML file with inline CSS and JavaScript, served as a static asset. Same pattern as the current `central/index.html`.

---

## 8. Project Config

The dashboard needs to know which projects exist and which repos they map to. This is a simple JavaScript object embedded in the HTML:

```javascript
const PROJECTS = [
  { name: 'NextGM',        repo: 'football-sim',   desc: 'Football GM simulation' },
  { name: 'XOI',           repo: 'xoi-mobile',     desc: 'NFL analytics platform' },
  { name: 'StoryEngine',   repo: 'storyengine',    desc: 'Narrative engine' },
  { name: 'XOPlay',        repo: 'xoplay-ffl',     desc: 'Fantasy football league' },
  { name: 'Velocity',      repo: 'velocity-002',   desc: 'Idea refinement tool' },
  { name: 'Elemental Web', repo: 'elemental-web',  desc: 'Design tool' },
  { name: 'CVEN',          repo: 'cven',           desc: 'Internal tools & worker' },
];
```

Adding or removing a project is a one-line change.

---

## 9. Edge Cases & Rules

- **File not found (404):** Show the empty-state message per panel. Don't error the whole page.
- **GitHub rate limit (403):** Show a "Rate limited — try again in a minute" message. Unlikely with manual refresh.
- **Network offline:** Show last-fetched content if available in the current session. No persistent cache.
- **Malformed markdown:** The parser should be tolerant. If a section can't be parsed, show the raw markdown as a fallback rather than breaking.
- **Large files:** BUILD_STATUS and BACKLOG files are typically under 500 lines. No pagination needed for v1.
- **Branch assumption:** Always fetches from `main` branch. No branch selector in v1.

---

### 5.7 Per-Project Tools (Sidebar Sub-Nav)

Each project can have associated internal tools — links that appear as a secondary list beneath the project name when selected. These are simple outbound links, not embedded views.

**Example:**
- NextGM → Avatar Forge (`/nextgm/avatar-forge`), Avatar Forge Guide (`/nextgm/avatar-forge-guide`)
- CVEN → (none currently)

Tools are defined in the project config object:

```javascript
{ name: 'NextGM', repo: 'football-sim', desc: 'Football GM simulation',
  tools: [
    { name: 'Avatar Forge', url: '/nextgm/avatar-forge' },
    { name: 'Avatar Forge Guide', url: '/nextgm/avatar-forge-guide' },
  ]
}
```

Projects with no tools show no sub-nav. Adding a tool is a one-line config change.

### 5.8 Per-Project Sync Status

The existing `/central/sync/` page shows an overview of Git sync status across both machines. In the new Command Center, each project shows its own sync status inline — pulled from the existing `/api/sync-status` endpoint.

When a project is selected, the dashboard fetches sync data and displays a compact status line for that repo:
- Which machines have the repo
- Whether each clone is clean, dirty, ahead, or behind
- Last commit info

This replaces the need to visit `/central/sync/` separately. The sync overview page can remain as a standalone fallback but is no longer the primary way to check sync.

---

## 10. What's Explicitly Out of Scope (v1)

- Authentication / multi-user access
- Writing back to repos (editing status files from the dashboard)
- Sprint history or changelog views
- Integration with GitHub Issues or PRs
- Sync status (stays at `/central/sync/`)
- Avatar Forge and other tools (stay at their existing paths)
- Auto-refresh or webhook-triggered updates
- Mobile-native app
- Search across projects
- Notifications or alerts

---

## 11. Build Sequence (Preview)

### Phase 0 — Prerequisite: Standardize File Locations
Move/create `docs/status/BUILD_STATUS.md` and `docs/status/BACKLOG.md` in every project repo.

### Phase 1 — API Proxy Route
Add `/api/project-status` route to the existing Cloudflare Worker. Store GitHub PAT as a Cloudflare secret. Test with a curl request.

### Phase 2 — Dashboard HTML/CSS
Build the static page: sidebar, main panel, visual design matching the reference. No data fetching yet — use placeholder content to nail the layout.

### Phase 3 — Data Fetching & Markdown Parsing
Wire the Refresh button to fetch via the proxy. Parse BUILD_STATUS.md into the Level A view. Parse BACKLOG.md into the Level B view.

### Phase 4 — Polish & Deploy
Responsive behavior, empty states, error handling, loading states. Deploy via `wrangler deploy`.

---

## 12. Open Questions

1. ~~**Velocity project status**~~ — Resolved. Repo is `velocity-002`, already has `docs/status/BUILD_STATUS.md`.
2. ~~**BACKLOG.md format standardization**~~ — Resolved. All projects follow the same format (see §5.3).
3. ~~**Existing tools links**~~ — Resolved. Tools become per-project links in the sidebar sub-nav. Sync status becomes per-project (see §5.7, §5.8).
4. ~~**Refresh All vs. Refresh One**~~ — Resolved. Both: per-project Refresh + a Refresh All button.

---

## 13. Files Affected (Summary)

| File | Change |
|---|---|
| `cven/src/index.js` | Add `/api/project-status` route |
| `cven/public/central/index.html` | Full rewrite — new dashboard UI |
| `cven/wrangler.jsonc` | May need new secret binding for GitHub token |
| Every project repo: `docs/status/BUILD_STATUS.md` | Create or move |
| Every project repo: `docs/status/BACKLOG.md` | Create or move |
