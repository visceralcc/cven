# Command Center — Dashboard Specification

**UX Specification & Frontend Architecture**

Version 0.1 | May 2026 | Charlie Denison | Civil Engine

**CONFIDENTIAL**

---

## Version History
| Version | Date | Changes |
|---------|------|---------|
| 0.1 | May 2026 | Initial draft. Full dashboard UX, layout, parsing, and interaction spec. |

---

## 1. Overview

This spec defines the Command Center dashboard — a single HTML page at `cven.cc/central/` that surfaces project status and backlog information for every active Civil Engine / XO project. It replaces the existing tools-directory page.

**Design principle: Answer two questions fast.** The dashboard exists to answer "What's the state of this project?" and "What do I need to do next?" within seconds of opening. Everything in the UI serves those two questions. Anything that doesn't is decoration.

**Who uses it:** Charlie — sole user. Accessed from MacBook Pro, Mac Mini, or mobile browser.

**Scope boundary — what the dashboard does NOT do:**
- Does not fetch directly from GitHub — all data comes through the Worker proxy at `/api/project-status` (see `Spec_ProjectStatusRoute.md`)
- Does not write to any repo — read-only display
- Does not persist state — everything is fetched fresh per session
- Does not parse arbitrary markdown — only the two known file formats (BUILD_STATUS.md and BACKLOG.md)

---

## 2. Layout

### 2.1 Page Structure

The page is a two-column layout: a fixed-width sidebar on the left and a scrollable main content area on the right.

```
┌──────────────────────────────────────────────────┐
│  COMMAND CENTER                       [Refresh ↻]│
├─────────────┬────────────────────────────────────┤
│             │                                    │
│  Sidebar    │  Main Panel                        │
│             │                                    │
│  NextGM  ●  │  ┌──────────────────────────────┐  │
│    tools... │  │  Level A: Status & Next Steps │  │
│  XOI     ○  │  │  (from BUILD_STATUS.md)       │  │
│  Story.. ●  │  └──────────────────────────────┘  │
│  XOPlay  ○  │                                    │
│  Veloc.. ●  │  ┌──────────────────────────────┐  │
│  Elem.. ○  │  │  Sync Status (per project)    │  │
│  CVEN   ○  │  └──────────────────────────────┘  │
│             │                                    │
│             │  ┌──────────────────────────────┐  │
│             │  │  Level B: Backlog             │  │
│             │  │  (from BACKLOG.md)            │  │
│             │  └──────────────────────────────┘  │
│             │                                    │
├─────────────┴────────────────────────────────────┤
│  Civil Engine LLC              cven.cc/central   │
└──────────────────────────────────────────────────┘
```

### 2.2 Sidebar

**Width:** 220px fixed.
**Contents:**
- Page title "Command Center" at the top (not inside the sidebar — see §2.3)
- Project list — one entry per project, vertically stacked
- Each entry shows: project name (left-aligned) + status dot (right-aligned)
- The selected project has a white background panel (same as content panels) with slightly bolder text
- Unselected projects have transparent backgrounds

**Project entries expand when selected** to reveal:
- Project description (one line, muted text)
- Tool links (if any — see §4.5)

**Default selection:** The first project in the list (NextGM) is selected on page load.

### 2.3 Header Bar

A thin bar spanning the full page width above the sidebar + main panel area.

**Left side:** "Command Center" title + "internal" tag badge (same pattern as existing Central page)
**Right side:** "Refresh All" button

### 2.4 Main Panel

**Fills remaining width** to the right of the sidebar. Vertically scrollable. Contains three content sections in order:

1. **Level A — Status & Next Steps** (white panel)
2. **Sync Status** (white panel)
3. **Level B — Backlog** (white panel)

Each section is a distinct white panel with consistent padding, border radius, and spacing.

### 2.5 Footer

Full width, below both columns. Matches existing Central page footer: "Civil Engine LLC" on the left, "cven.cc/central" on the right. Barlow Condensed, uppercase, muted.

---

## 3. Visual Design

### 3.1 Color Tokens

Updated from the existing Central page to match the reference image (softer, cooler blue-white):

```css
:root {
  --bg: #eef1f5;              /* faint cool blue-gray page background */
  --surface: #ffffff;          /* white content panels */
  --surface-hover: #f6f8fa;    /* subtle hover on interactive elements */
  --border: #dde1e8;           /* panel borders — softer than current */
  --border-subtle: #e8ecf0;    /* inner dividers */
  --text: #1a1b22;             /* primary text */
  --text-mid: #4a4b58;         /* secondary text */
  --text-muted: #8a8b98;       /* tertiary / labels */
  --accent-green: #4caf50;     /* status dot — has data */
  --accent-yellow: #f5a623;    /* status dot — in progress (future) */
  --dot-inactive: #ccd0d8;     /* status dot — no data */
  --radius: 12px;              /* panel border radius */
  --radius-sm: 8px;            /* inner element radius */
}
```

**Key change from existing page:** `--bg` shifts from `#f0f1f3` (neutral gray) to `#eef1f5` (faint blue-gray). Panels stay pure white. No shadows anywhere — borders only.

### 3.2 Typography

```css
--sans: 'Barlow', system-ui, sans-serif;
--condensed: 'Barlow Condensed', 'Barlow', system-ui, sans-serif;
```

| Element | Font | Size | Weight | Color | Case |
|---------|------|------|--------|-------|------|
| Page title | Barlow | 22px | 700 | --text | Normal |
| Tag badge | Barlow Condensed | 10px | 500 | --text-muted | Uppercase |
| Sidebar project name | Barlow | 14px | 500 (selected: 600) | --text | Normal |
| Sidebar project desc | Barlow | 12px | 400 | --text-muted | Normal |
| Sidebar tool link | Barlow | 12px | 400 | --text-mid | Normal |
| Panel section header | Barlow Condensed | 13px | 600 | --text-muted | Uppercase |
| Status table header | Barlow Condensed | 12px | 600 | --text-muted | Uppercase |
| Status table cell | Barlow | 14px | 400 | --text | Normal |
| Sprint heading | Barlow | 16px | 600 | --text | Normal |
| Sprint body | Barlow | 14px | 400 | --text-mid | Normal |
| Backlog section header | Barlow Condensed | 13px | 600 | --text-muted | Uppercase |
| Backlog sub-header | Barlow | 13px | 500 | --text-mid | Normal |
| Backlog task item | Barlow | 14px | 400 | --text | Normal |
| Backlog tag | Barlow Condensed | 11px | 500 | --text-muted | Normal |
| Completion count | Barlow Condensed | 12px | 500 | --text-muted | Normal |
| Sync status label | Barlow | 13px | 400 | --text-muted | Normal |
| Sync status value | Barlow | 13px | 500 | --text-mid | Normal |
| Footer | Barlow Condensed | 10px | 500 | --text-muted | Uppercase |

### 3.3 Spacing

| Element | Value |
|---------|-------|
| Page padding (outer) | 32px top, 24px sides, 80px bottom |
| Sidebar ↔ main panel gap | 24px |
| Panel inner padding | 24px |
| Panel ↔ panel vertical gap | 16px |
| Section header ↔ content | 12px |
| Table row height | 36px |
| Backlog item vertical gap | 6px |
| Sidebar item vertical gap | 2px |

### 3.4 Panel Styling

All content panels share:
```css
.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 24px;
}
```

No shadows. No elevation. No hover effects on panels (they're containers, not interactive elements).

---

## 4. Feature Sections

### 4.1 Level A — Status & Next Steps

**Source file:** `docs/status/BUILD_STATUS.md` (fetched via `/api/project-status`)

**Panel header:** "STATUS" — Barlow Condensed, uppercase, muted, 13px

**Content sections parsed from the markdown:**

**a) Last updated line.** Extract the parenthetical from the `## Current State` heading or the first line that contains "last updated" or "Last updated". Display as a subtle date line below the panel header.

Example source: `## Current State (last updated: 2026-04-27)`
Rendered: "Last updated Apr 27, 2026" in muted text.

**b) Status table.** The first markdown table in the file. Rendered as a styled HTML table:
- Column headers: System | Status — Barlow Condensed, uppercase, 12px, muted
- Rows: 36px height, alternating subtle background (white / --surface-hover)
- Status cell rendering:
  - `✅ Complete` → green-tinted text
  - `🔲 Not started` → muted text
  - `🟡 In progress` or any other value → default text
- No horizontal scroll — table fills panel width, System column takes remaining space, Status column auto-sizes

**c) Most recent sprint.** The first `##` heading after the status table that looks like a sprint entry (contains "Sprint" or a date pattern like `XX.XX.XX`). Display:
- Sprint heading in 16px/600 weight
- Sprint body paragraphs in 14px/400, --text-mid
- Bullet items rendered as styled list items
- Checkmarks (✅) in sprint body retain their emoji

**If BUILD_STATUS.md is not found (404):** Show an empty state panel with muted text: "No BUILD_STATUS.md found. Create one at `docs/status/BUILD_STATUS.md` to surface status here." Use a monospace font for the path.

### 4.2 Sync Status (Per Project)

**Source:** The existing `/api/sync-status` endpoint (no proxy needed — it's already on cven.cc).

**Panel header:** "SYNC" — same style as other panel headers.

**Behavior:** On project selection (or refresh), fetch `/api/sync-status` once, then filter the `repos` array for the entry whose `name` matches the project's `repo` value from the config.

**Display:** A compact two-column row per machine:

```
MacBook Pro    ● Clean
Mac Mini       ● 2 behind
```

Each row shows:
- Machine name (left) — Barlow, 13px, --text-muted
- Status badge (right) — dot + label, using the same color/badge conventions as the existing sync page:
  - Clean → dark dot, "Clean"
  - Behind → muted dot, "X behind"
  - Dirty → lighter dot, "X dirty"
  - Not cloned → faint dot, "Not cloned"

**If the repo is not found in sync data:** Show "No sync data for this repo" in muted text.

**If `/api/sync-status` fails:** Show "Sync status unavailable" — don't break the rest of the page.

### 4.3 Level B — Backlog

**Source file:** `docs/status/BACKLOG.md` (fetched via `/api/project-status`)

**Panel header:** "BACKLOG" — same style as other panel headers.

**Content sections parsed from the markdown:**

**a) Section groups.** Each `## Heading` in the markdown becomes a collapsible section:
- Header row: section name (left) + completion count "X of Y" (right)
- Click to expand/collapse. First section starts expanded, rest collapsed.
- Chevron indicator (simple CSS triangle, no icon library) rotates on toggle.

**b) Sub-groups (optional).** `### Sub-heading` lines become nested labels within an expanded section. Styled as Barlow 13px/500, --text-mid, with 8px left indent relative to the section items.

**c) Task items.** Each `- ✅` or `- 🔲` line:
- Completed items: green checkmark + text with ~~strikethrough~~ and --text-muted color
- Open items: hollow checkbox outline + text in --text color
- The checkbox is display-only (not interactive — the dashboard is read-only)
- Tags in `[brackets]` at the end of a line are rendered as small inline badges: Barlow Condensed 11px, muted background pill, --text-muted text

**d) Completion count per section.** Count all `- ✅` and `- 🔲` lines within each `##` section (including lines under `###` sub-headings). Display as "X of Y" next to the section name.

**If BACKLOG.md is not found (404):** Show empty state: "No BACKLOG.md found. Create one at `docs/status/BACKLOG.md` to surface the backlog here."

### 4.4 Refresh Mechanism

**"Refresh All" button** in the header bar (top-right):
- Fetches BUILD_STATUS.md for every project in parallel
- Updates sidebar status dots for all projects (green if 200, gray if 404 or error)
- Then re-fetches the currently selected project's full content (both files + sync)
- Shows a subtle spin animation on the button icon while requests are in flight
- Button text: "Refresh All" — Barlow 14px/500

**Per-project refresh** happens automatically when a sidebar project is clicked (if data hasn't been fetched yet this session). Once fetched, clicking the same project again shows cached data. Only "Refresh All" re-fetches everything.

**Loading states:**
- While fetching, each panel shows a subtle pulsing placeholder (a single muted line of text: "Loading..."). No skeleton screens, no spinners.
- If a fetch fails, show the error state for that panel only — don't blank the other panels.

### 4.5 Per-Project Tools (Sidebar Sub-Nav)

When a project is selected in the sidebar, tool links (if any) appear below the project description as a simple indented list of text links.

**Styling:**
- 16px left indent from the project name
- Barlow 12px/400, --text-mid color
- Underline on hover
- Each link opens in a new tab (`target="_blank"`)

**Config:**
```javascript
tools: [
  { name: 'Avatar Forge', url: '/nextgm/avatar-forge' },
]
```

Projects with no `tools` array (or an empty one) show no sub-nav.

---

## 5. Project Config

The full config object embedded in the HTML:

```javascript
const PROJECTS = [
  {
    name: 'NextGM',
    repo: 'football-sim',
    desc: 'Football GM simulation',
    tools: [
      { name: 'Avatar Forge', url: '/nextgm/avatar-forge' },
      { name: 'Avatar Forge Guide', url: '/nextgm/avatar-forge-guide' },
    ],
  },
  {
    name: 'XOI',
    repo: 'xoi-mobile',
    desc: 'NFL analytics platform',
    tools: [],
  },
  {
    name: 'StoryEngine',
    repo: 'storyengine',
    desc: 'Narrative engine',
    tools: [],
  },
  {
    name: 'XOPlay',
    repo: 'xoplay-ffl',
    desc: 'Fantasy football league',
    tools: [],
  },
  {
    name: 'Velocity',
    repo: 'velocity-002',
    desc: 'Idea refinement tool',
    tools: [],
  },
  {
    name: 'Elemental Web',
    repo: 'elemental-web',
    desc: 'Design tool',
    tools: [],
  },
  {
    name: 'CVEN',
    repo: 'cven',
    desc: 'Internal tools & worker',
    tools: [],
  },
];
```

Adding a project = one new object. Adding a tool = one new entry in the `tools` array.

---

## 6. Markdown Parsing

### 6.1 Approach

No external library. The markdown formats are predictable and constrained — a lightweight custom parser written in vanilla JavaScript is simpler and smaller than importing a markdown library.

### 6.2 BUILD_STATUS.md Parser

The parser extracts three things from the raw markdown string:

**a) Last updated date.** Regex: look for `(last updated: YYYY-MM-DD)` or `**Last updated:** YYYY-MM-DD` in the first 20 lines. Extract the date string.

```javascript
const updatedMatch = content.match(/last updated[:\s]*(\d{4}-\d{2}-\d{2})/i);
```

**b) Status table.** Find the first markdown table (lines starting with `|`). Parse into an array of `{ system: string, status: string }` objects. Skip the header separator row (the one with `|---|`).

```javascript
// Detect table rows: lines that start and end with |
// Skip row 1 (header) and row 2 (separator)
// Split each row on | and trim cells
```

**c) Most recent sprint.** Find the first `## ` heading that comes after the status table. Capture everything from that heading to the next `## ` heading (or end of file). This becomes the "sprint" content block — rendered as heading + body HTML.

### 6.3 BACKLOG.md Parser

The parser converts the raw markdown into a structured data shape:

```typescript
type BacklogData = {
  sections: Array<{
    title: string;                // from ## heading
    subgroups: Array<{
      title: string | null;      // from ### heading (null = no subgroup)
      items: Array<{
        done: boolean;           // ✅ = true, 🔲 = false
        text: string;            // the task text (without the checkbox emoji)
        tags: string[];          // extracted [tag] values
      }>;
    }>;
    doneCount: number;           // total ✅ in this section
    totalCount: number;          // total items in this section
  }>;
};
```

**Parsing rules:**
1. Split content by lines
2. Skip everything before the first `## ` heading
3. Each `## ` line starts a new section
4. Each `### ` line starts a new subgroup within the current section
5. Each `- ✅` line is a done item; each `- 🔲` line is an open item
6. Tags are extracted via regex: `/\[([^\]]+)\]/g`
7. Lines that aren't headings or task items (blank lines, `---` dividers, intro text) are skipped

### 6.4 Rendering

Both parsers produce data structures (not HTML strings). A separate render function maps the data to DOM elements using `document.createElement`. This separates parsing from display and makes the rendering testable.

---

## 7. Responsive Behavior

### 7.1 Breakpoints

| Width | Layout |
|-------|--------|
| > 768px | Sidebar (220px) + main panel (remaining) |
| ≤ 768px | Sidebar collapses to a horizontal project selector (scrollable row of project names). Main panel goes full-width below it. |

### 7.2 Mobile (≤ 768px)

- Sidebar becomes a horizontally scrollable row of project name pills at the top of the page
- Selected project has a white background pill, others are transparent
- Tool links move into the main panel area (below Level A, above Sync)
- Status table may need horizontal scroll if columns are wide (wrap in `overflow-x: auto` container)
- All panels go full-width with reduced padding (16px instead of 24px)

---

## 8. Data Fetching Sequence

### 8.1 Page Load

1. Render the sidebar with all projects from config (status dots all gray initially)
2. Select the first project (NextGM)
3. Fetch BUILD_STATUS.md for the selected project → render Level A
4. Fetch BACKLOG.md for the selected project → render Level B
5. Fetch `/api/sync-status` → filter for selected project's repo → render Sync panel

Steps 3, 4, and 5 fire in parallel. Each panel renders independently as its data arrives.

### 8.2 Project Selection (Sidebar Click)

1. Update sidebar selection state (highlight new project, collapse old)
2. Check if data has been fetched for this project this session
   - If yes: render from cache (instant)
   - If no: fetch all three data sources in parallel, show loading states

### 8.3 Refresh All (Button Click)

1. Show spin animation on button
2. For every project in parallel: fetch BUILD_STATUS.md
3. Update sidebar status dots based on results (green = 200, gray = 404/error)
4. Re-fetch all data for the currently selected project (overwrite cache)
5. Render updated content for the selected project
6. Stop spin animation

### 8.4 Caching

In-memory only (a JavaScript object). No localStorage, no sessionStorage. Cache structure:

```javascript
const cache = {
  'football-sim': {
    buildStatus: { content: '...', fetchedAt: '...' },
    backlog: { content: '...', fetchedAt: '...' },
  },
  // ...
};
```

Cache is populated on first fetch and overwritten on Refresh All. Cleared on page reload.

Sync data is cached once per session (single fetch from `/api/sync-status` returns all repos). Re-fetched on Refresh All.

---

## 9. Error States

| Scenario | Behavior |
|---|---|
| BUILD_STATUS.md → 404 | Level A panel shows empty state message. Sidebar dot goes gray. |
| BACKLOG.md → 404 | Level B panel shows empty state message. Does not affect sidebar dot. |
| BUILD_STATUS.md → 500 or network error | Level A panel shows "Failed to load status. Try refreshing." |
| BACKLOG.md → 500 or network error | Level B panel shows "Failed to load backlog. Try refreshing." |
| `/api/sync-status` → any error | Sync panel shows "Sync status unavailable." Other panels unaffected. |
| All fetches fail (offline) | All panels show error messages. Sidebar dots stay gray. |
| Malformed markdown (parse fails) | Show raw markdown as a `<pre>` fallback. Don't blank the panel. |

---

## 10. Edge Cases & Rules

- **First load with no internet:** All panels show error states. Page is still navigable (sidebar works, layout renders).
- **Project with no tools:** No sub-nav appears. The project entry is just name + dot.
- **Very long status table (40+ rows):** Table scrolls within the panel. No max-height — let it take the space it needs.
- **Very long backlog (100+ items):** Collapsible sections prevent wall-of-text. Only the first section is expanded by default.
- **Sprint section with complex markdown (nested lists, code blocks):** Render as raw pre-formatted text. Don't attempt to parse every markdown feature — just the known patterns.
- **Tab/window visibility:** No background behavior. No timers. If the user leaves and comes back, data is stale but still displayed. They click Refresh All to update.
- **Multiple rapid project clicks:** Cancel any in-flight fetches for the previous project (use AbortController). Render only the most recently selected project.

---

## 11. Relationship to Other Systems

| System / File | Effect / Dependency | Section Reference |
|---|---|---|
| `/api/project-status` (Worker route) | Primary data source for BUILD_STATUS and BACKLOG | §8, Spec_ProjectStatusRoute.md |
| `/api/sync-status` (existing Worker route) | Sync data source — consumed as-is, filtered per repo | §4.2 |
| `public/central/index.html` (existing) | Fully replaced by this dashboard | — |
| `public/central/sync/index.html` (existing) | Remains as standalone fallback — not removed | — |
| Existing Central page CSS tokens | Evolved — new values in §3.1, same variable names | §3.1 |

**No direct interaction:**
- `/api/fal` — unrelated
- `/api/sync-report` — unrelated (machine-to-worker reporting)
- `/api/contact` — unrelated
- Any project's source code — the dashboard only reads status/backlog markdown

---

## 12. Build Sequence (Preview)

### Phase 1 — Layout Shell (HTML + CSS, no data)
1. Build the two-column layout: sidebar + main panel
2. Style the header bar, footer, panel containers
3. Populate the sidebar with project names from config
4. Use placeholder text in the main panels ("Status will appear here...")
5. Apply the updated color tokens from §3.1
6. Verify responsive breakpoint behavior at 768px

### Phase 2 — Sidebar Interaction
1. Click handler on sidebar items → update selected state
2. Expand/collapse project description and tools
3. Wire up status dot rendering (gray for all initially)

### Phase 3 — Data Fetching + Level A
1. Wire Refresh All button to fetch BUILD_STATUS.md for all projects
2. Update sidebar dots based on responses
3. Build BUILD_STATUS.md parser (§6.2)
4. Render Level A panel for selected project (status table + last updated + sprint)
5. Handle 404 and error states

### Phase 4 — Level B (Backlog)
1. Fetch BACKLOG.md on project selection
2. Build BACKLOG.md parser (§6.3)
3. Render collapsible sections with completion counts
4. Render task items with checkmarks, strikethrough, tag badges
5. Handle 404 and error states

### Phase 5 — Sync Status
1. Fetch `/api/sync-status` on page load
2. Filter for selected project's repo
3. Render compact sync row per machine
4. Re-fetch on Refresh All

### Phase 6 — Polish
1. Loading states (pulsing placeholder text)
2. AbortController for rapid project switching
3. In-memory cache for already-fetched projects
4. Mobile responsive behavior (horizontal project pills)
5. Malformed markdown fallback (raw `<pre>` display)

---

## 13. Files Affected (Summary)

| File | Change |
|---|---|
| `cven/public/central/index.html` | Full rewrite — new dashboard page |

---

## Claude Code Handoff Prompt

```claude-code-handoff
Project: CVEN (cven) | Repo: visceralcc/cven | Branch: main

Spec file: documents/dashboard/Spec_Dashboard.md
→ This file already exists in the repo.

Follow the Build Sequence in §12, phase by phase.

Key constraints:
- Single HTML file with inline CSS and JavaScript — no build step, no npm, no bundler
- Follow the color tokens in §3.1 exactly — the blue-gray background (#eef1f5) is intentional
- Typography follows the table in §3.2 — Barlow + Barlow Condensed from Google Fonts
- No external markdown library — use the custom parsers defined in §6.2 and §6.3
- No shadows anywhere — borders only (§3.4)
- No icons — text only for sidebar, chevrons are CSS-only
- Data comes from /api/project-status (Worker proxy) — never fetch from GitHub directly
- The page is READ-ONLY — no interactive checkboxes, no editing
- Sidebar status dots: green (#4caf50) if BUILD_STATUS.md returned 200, gray (#ccd0d8) if 404/error
- Match existing code conventions from cven/public/central/sync/index.html (same CSS variable pattern, same font loading, same footer)

Prerequisite: The /api/project-status Worker route must be deployed first (see documents/worker/Spec_ProjectStatusRoute.md).

Start with: Phase 1 — Build the two-column layout shell with sidebar, header, main panel, and footer. Use placeholder content. Apply the color tokens from §3.1 and verify the responsive breakpoint at 768px.

Work phase by phase. After completing each phase, stop and check in before moving on.
Commit after each phase with a message like "feat(dashboard): Phase 1 — layout shell".
```
