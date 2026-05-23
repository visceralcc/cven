# CVEN — Command Center V2 Specification

**Dashboard Improvements: Status Clarity, Interactive Backlog, Loading Fixes**

Version 0.1 | May 2026 | Charlie Denison | CVEN

**CONFIDENTIAL**

---

## Version History
| Version | Date | Changes |
|---------|------|---------|
| 0.1 | May 2026 | Initial draft. Three fixes: Status panel redesign, interactive Backlog, backlog loading for all projects. |

---

## 1. Overview

The Command Center dashboard (`cven.cc/central/`) currently has three problems that prevent it from fulfilling its purpose:

1. **The Status panel is unclear.** It shows a table with codes like "A.1", "B.2" under a "SYSTEM" column and raw spec filenames under "STATUS". This doesn't tell the user what they need to do next — it reads like internal scaffolding, not actionable information.

2. **The Backlog panel is not interactive.** The original local backlog HTML (`nextgm-backlog.html`) had clickable checkboxes, completion counts, and collapsible sections. The Command Center renders backlog items as static text — you can't check things off or collapse sections.

3. **Backlogs don't load for most projects.** Only NextGM's backlog loads (when the file exists). Other projects show "No BACKLOG.md found" even when files may exist, likely due to path or branch issues.

**Design principle:** The Command Center should answer two questions at a glance — *"What's the state of this project?"* and *"What do I need to do next?"* — without requiring the user to interpret codes, open repos, or read raw markdown. Progressive disclosure: the most important information (next steps) is at the top, detailed inventory (backlog) is below.

**Scope boundary — this spec does NOT cover:**
- Writing to repos (the dashboard remains read-only)
- Adding new projects to the config
- Changes to the Worker's `/api/project-status` route (it already works correctly)
- Changes to the Sync panel (it works as designed)
- Adding polling or background refresh (remains pull-on-demand)

---

## 2. Status Panel Redesign

### 2.1 The Problem

The current Status panel parses the completion table from BUILD_STATUS.md and displays it with two columns: SYSTEM (showing tier codes like "A.1", "A.2", "B.1") and STATUS (showing spec filenames like "Spec_V1Cleanup.md", "Spec_Rankings.md"). This is meaningless to a user who doesn't already know what those codes refer to.

### 2.2 The Solution — Next Steps + Summary

Replace the current Status panel layout with two sub-sections:

**Next Steps (top, prominent).** Parse a new `## Next Steps` section from BUILD_STATUS.md. This section contains 3–5 plain-language bullet points describing what needs to happen next on this project. Display them as a simple bulleted list with no interactivity — this is a read-only summary.

**Build Progress (below Next Steps, collapsed by default).** The existing completion table can remain, but with human-readable labels instead of tier codes. The "SYSTEM" column should display the actual system/feature name (e.g., "Data Migration", "Player Detail Screen"), not codes like "A.1" or "B.2". The "STATUS" column should show a short status word — not a raw filename.

### 2.3 BUILD_STATUS.md Convention

Each project's `docs/status/BUILD_STATUS.md` should include a `## Next Steps` section near the top. The dashboard parser looks for this heading and extracts the bullet list below it.

Example BUILD_STATUS.md structure:

```markdown
# NextGM — Build Status

## Next Steps
- Finish V1 cleanup migration (Spec_V1Cleanup.md)
- Start stats migration to new data model
- Wire up player detail screen with live data
- Fix avatar rendering on older iOS devices

## Completion

| System | Status |
|--------|--------|
| V1 Cleanup | In Progress |
| Stats Migration | Not Started |
| Apex Pipeline | Not Started |
| Player Detail | Not Started |
| Rankings | Not Started |
| Home Screen | Not Started |
```

**If `## Next Steps` is missing**, the dashboard shows a gentle prompt: "No next steps defined. Add a `## Next Steps` section to BUILD_STATUS.md to surface them here."

**If BUILD_STATUS.md doesn't exist at all**, the dashboard shows the existing message: "No BUILD_STATUS.md found. Create one at `docs/status/BUILD_STATUS.md` to surface status here."

### 2.4 Parsing Rules

1. Find the line starting with `## Next Steps` (case-insensitive match on "next steps").
2. Collect all lines below it until the next `##` heading or end of file.
3. Parse lines starting with `- ` or `* ` as bullet items.
4. Strip any markdown formatting (bold, links) — render as plain text.
5. Display as a simple `<ul>` list.

For the completion table:
1. Find the markdown table (lines starting with `|`).
2. Parse header row and data rows.
3. Render the table with the column headers from the markdown — whatever the author writes in the header row is what appears on screen. No hardcoded "SYSTEM" / "STATUS" labels.

---

## 3. Interactive Backlog

### 3.1 The Problem

The old local backlog HTML (`nextgm-backlog.html`) was interactive — checkboxes you could click, completion counts per section, collapsible sections. The Command Center's Backlog panel renders BACKLOG.md as flat static text with no interactivity.

### 3.2 The Solution — Interactive Rendering

The Backlog panel should parse BACKLOG.md and render it with the same interactivity as the old local file:

**Collapsible sections.** Each `## Section Heading` in the markdown becomes a collapsible group. Clicking the heading toggles visibility of the items inside. All sections start expanded on first load.

**Checkboxes.** Markdown checkbox items (`- [ ] Task name` and `- [x] Completed task`) render as HTML checkboxes. Checked items show as checked with strikethrough text styling.

**Completion counts.** Each section heading shows a count badge: "3 / 12" meaning 3 of 12 items complete. This is calculated from the checkbox states in that section.

**Tag badges.** If a backlog item contains text in square brackets at the end (e.g., `- [ ] Build the rankings screen [UI] [P1]`), those bracketed strings render as small colored tag pills next to the item text.

Tag color mapping (hardcoded):
| Tag | Color |
|-----|-------|
| P0 | Red (`#e74c3c`) |
| P1 | Orange (`#e67e22`) |
| P2 | Blue (`#3498db`) |
| P3 | Gray (`#95a5a6`) |
| UI | Teal (`#1abc9c`) |
| API | Purple (`#9b59b6`) |
| Data | Indigo (`#34495e`) |
| Bug | Red (`#e74c3c`) |
| Any other tag | Light gray (`#bdc3c7`) |

### 3.3 Read-Only Interactivity

The checkboxes and collapsible sections are **visual-only** — they affect the rendered display on screen but do not write anything back to the repo. The dashboard remains read-only. If you check a box, it stays checked until you refresh or navigate away. This is the same behavior the old local HTML file had.

When the user clicks "Refresh All" or re-selects a project from the sidebar, the backlog re-fetches from GitHub and resets to the state in the markdown file.

### 3.4 Backlog Parsing Rules

1. Split the markdown by `## ` headings. Each heading starts a new section.
2. Within each section, find lines matching `- [ ] ` (unchecked) or `- [x] ` (checked).
3. Extract tag badges: match the pattern `\[([^\]]+)\]` at the end of each item line, after the task description text. Only matches after the checkbox portion count as tags.
4. Count checked vs total items per section for the completion badge.
5. Ignore lines that aren't checkbox items (prose paragraphs, blank lines, sub-headings with `###`).

Example BACKLOG.md:

```markdown
# NextGM — Backlog

## Data Layer
- [x] Define player data schema [Data]
- [x] Implement roster storage [Data]
- [ ] Stats migration to new model [Data] [P1]
- [ ] Apex pipeline integration [API] [P1]

## UI Screens
- [ ] Player detail screen [UI] [P1]
- [ ] Rankings screen [UI] [P2]
- [ ] Home screen redesign [UI] [P2]
- [x] Settings screen [UI]
```

This would render as two collapsible sections — "Data Layer (2 / 4)" and "UI Screens (1 / 4)" — with interactive checkboxes and colored tag pills.

---

## 4. Backlog Loading Fixes

### 4.1 The Problem

Most projects show "No BACKLOG.md found" in the Backlog panel. This could be caused by:

1. **The file genuinely doesn't exist** in that repo — which is expected for some projects and the empty-state message is correct.
2. **Wrong branch** — the fetch defaults to `main` but the project config might specify a different branch (e.g., NextGM uses `master`). The backlog fetch must use the same `branch` value from the project config.
3. **Wrong path** — the fetch might be using a path that doesn't match the convention (`docs/status/BACKLOG.md`).
4. **Error swallowing** — the fetch might be silently failing (network error, 404 treated as empty) without surfacing the actual problem.

### 4.2 The Fix

1. **Use the project's branch.** When fetching BACKLOG.md, pass the project's `branch` field (from the `PROJECTS` config) to the `/api/project-status` endpoint. This is the same pattern used for BUILD_STATUS.md.

2. **Surface fetch errors.** If the fetch returns a non-200 response that isn't a 404, show an error message in the Backlog panel: "Error loading BACKLOG.md: [status code]". A 404 means the file doesn't exist — show the existing empty-state message.

3. **Verify the path.** The fetch URL must use exactly `docs/status/BACKLOG.md` as the file path. Audit the JavaScript to confirm this matches across all fetch calls.

4. **Debug logging.** Add `console.log` statements during the fetch flow for BACKLOG.md (repo name, branch, path, response status) so issues can be diagnosed from the browser dev tools. These can remain in production since the dashboard is internal-only.

---

## 5. Edge Cases & Rules

- **Empty `## Next Steps` section.** If the heading exists but has no bullet items below it, show: "Next steps section is empty — add bullet points below `## Next Steps` in BUILD_STATUS.md."
- **No `## ` sections in BACKLOG.md.** If the file exists but has no `##` headings, render all checkbox items as a single flat list with no section headers.
- **Nested checkboxes.** Items indented under other items (e.g., `  - [ ] Sub-task`) should be rendered as nested/indented items within their parent section. If parsing nested items is too complex for v1, flatten them — treat all `- [ ]` lines the same regardless of indentation.
- **Mixed content in sections.** Sections may contain prose paragraphs mixed with checkboxes. Only count and render the checkbox lines — ignore prose.
- **Very long backlogs.** No pagination needed. The panel already scrolls. If performance becomes an issue with very large files, that's a future concern.
- **Checkbox state on project switch.** When the user clicks a different project in the sidebar, discard any local checkbox state and re-render from the fetched markdown.

---

## 6. Relationship to Other Systems

| System / File | Effect / Dependency | Section Reference |
|---|---|---|
| `src/index.js` — `/api/project-status` route | No changes needed. Already fetches markdown files correctly. | §4.2 |
| `public/central/index.html` — dashboard JS | All changes happen here. Status parser, Backlog renderer, fetch logic. | §2, §3, §4 |
| Each project's `docs/status/BUILD_STATUS.md` | Must add `## Next Steps` section for the new Status panel to populate. | §2.3 |
| Each project's `docs/status/BACKLOG.md` | Must use `## ` headings and `- [ ]` / `- [x]` checkboxes for interactive rendering. | §3.4 |
| `public/central/sync/index.html` — Sync page | No changes. | — |
| `/api/sync-status` endpoint | No changes. Sync panel continues to use this. | — |

### No Direct Interaction

- Marketing site (`public/index.html`) — completely separate page, no shared code.
- Avatar Forge tools — no overlap.
- Elemental tool — no overlap.

---

## 7. Visual Design Notes

All changes follow the existing Command Center visual language:

- **Background:** `#eef1f5` (soft blue-gray)
- **Panels:** White background, `1px solid #e0e4e8` border, `12px` border-radius, no shadows
- **Typography:** Barlow (body), Barlow Condensed (panel headers like "STATUS", "BACKLOG")
- **Panel headers:** Uppercase, `letter-spacing: 0.08em`, color `#7a8a9e`

New visual elements:

- **Next Steps bullets:** Standard `<ul>` list, `14px` Barlow, color `#2c3e50`. No special styling — just clean readable text.
- **Collapsible section headers:** `15px` Barlow Condensed, uppercase, with a small `▸` / `▾` triangle indicator and the completion count badge to the right. Cursor: pointer.
- **Completion count badge:** Small pill shape, background `#eef1f5`, color `#7a8a9e`, font `12px` Barlow. Format: "3 / 12".
- **Checkboxes:** Native HTML checkboxes. Checked items get `text-decoration: line-through` and `color: #95a5a6`.
- **Tag pills:** Inline `<span>`, `font-size: 11px`, `padding: 2px 6px`, `border-radius: 4px`, white text on the mapped color background. Sits to the right of the task text.

---

## 8. Build Sequence (Preview)

### Phase 1 — Status Panel Redesign (dashboard JS only)

1. Modify the BUILD_STATUS.md parser in `public/central/index.html` to extract the `## Next Steps` section.
2. Render Next Steps as a bulleted list at the top of the Status panel.
3. Render the completion table below Next Steps with column headers pulled from the markdown (not hardcoded "SYSTEM" / "STATUS").
4. Make the completion table collapsible (collapsed by default), with a "Build Progress" label.
5. Handle the three empty states: no file, file exists but no Next Steps heading, heading exists but empty.

### Phase 2 — Interactive Backlog Renderer (dashboard JS only)

1. Replace the current static backlog renderer with the interactive version.
2. Implement section parsing: split by `## ` headings, extract checkbox items per section.
3. Render collapsible sections with `▸` / `▾` toggles.
4. Render checkboxes with click-to-toggle behavior (visual only, no write-back).
5. Calculate and display completion counts per section.
6. Parse and render tag badges with the color mapping.
7. Style checked items with strikethrough.

### Phase 3 — Backlog Loading Fixes (dashboard JS only)

1. Audit the BACKLOG.md fetch call to ensure it uses the project's `branch` config value.
2. Audit the file path to confirm it's exactly `docs/status/BACKLOG.md`.
3. Add error state rendering for non-404 failures.
4. Add `console.log` debug output for the fetch flow.
5. Test with at least two projects: one that has BACKLOG.md (NextGM) and one that doesn't.

---

## 9. Files Affected (Summary)

| File | Change |
|---|---|
| `public/central/index.html` | All three phases: Status parser rewrite, Backlog interactive renderer, fetch fixes. |

No other files are modified. The Worker route, project config, and all other pages remain untouched.

---

## 10. Markdown Convention Reference

For the dashboard to work correctly, each project's markdown files should follow these patterns:

**BUILD_STATUS.md:**
```markdown
# [Project] — Build Status

## Next Steps
- Plain-language description of the next action
- Another next action
- A third next action (3–5 items recommended)

## Completion

| System | Status |
|--------|--------|
| Feature Name | In Progress |
| Another Feature | Not Started |
```

**BACKLOG.md:**
```markdown
# [Project] — Backlog

## Section Name
- [ ] Unchecked task description [OptionalTag] [OptionalPriority]
- [x] Completed task description [OptionalTag]

## Another Section
- [ ] Another task [Tag]
```
