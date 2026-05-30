---
name: command-center-status
description: >
  Format BUILD_STATUS.md and BACKLOG.md files so they render correctly in the
  Command Center dashboard at cven.cc/central/. Use this skill whenever creating,
  updating, or fixing a project's status files, whenever the user mentions
  "Command Center", "cven.cc/central", "BUILD_STATUS", "BACKLOG", "status files",
  "dashboard files", or "project status". Also trigger when the user says
  "set up status for [project]", "fix the dashboard", "why isn't [project] showing
  in Command Center", "format the status files", or "add [project] to the dashboard".
  Even if the user only asks about one file (BUILD_STATUS or BACKLOG), use this skill —
  it knows the exact parser format the dashboard expects. This skill handles the FILE
  FORMAT — for project scaffolding (CLAUDE.md, CHANGELOG, DESIGN.md), defer to the
  project-setup skill.
---

# Command Center Status Files

Create and maintain BUILD_STATUS.md and BACKLOG.md files that render correctly in
the Command Center dashboard at `cven.cc/central/`.

**Who this is for:** A designer (not a developer) who manages multiple projects and
wants them all surfacing cleanly in one dashboard — without touching parser code.

**Why format matters:** The Command Center has a JavaScript parser that reads these
markdown files and turns them into styled panels. If the format doesn't match what
the parser expects, the dashboard either shows nothing, falls back to raw markdown,
or silently skips content. This skill documents the exact format the parser needs.

---

## Quick Reference

Both files must live at this exact path in every project repo:

```
project-root/
└── docs/
    └── status/
        ├── BUILD_STATUS.md    ← Status panel (systems table + sprint summary)
        └── BACKLOG.md         ← Backlog panel (collapsible sections with checkboxes)
```

The dashboard fetches these via `/api/project-status` which reads from GitHub.
Files must be committed and pushed — local-only files won't appear.

---

## BUILD_STATUS.md — Exact Format

The dashboard parser (`parseBuildStatus`) extracts three things from this file:

1. **Last updated date** — shown as a subtitle under the panel header
2. **Next Steps section** — rendered as the prominent "Next Steps" panel at the top
3. **Systems table** — rendered as a collapsible "Build Progress" table

All three are optional — the parser handles missing pieces gracefully — but include
all three for a complete status panel. NOTE: the parser no longer reads a "sprint
summary" — that older model was replaced by the Next Steps section. A `## Next Steps`
heading is now what drives the top panel.

### Template

```markdown
# [Project Name] — Build Status

**Feature map and completion tracker. Surfaced in Command Center.**

Last updated: YYYY-MM-DD

| System | Status |
|---|---|
| [System name] | ✅ Complete |
| [System name] | ✅ Complete (with notes) |
| [System name] | 🔲 Not started |
| [System name] | 🔲 In progress |
| [System name] | ⚠️ Blocked — [reason] |

## Next Steps

- First concrete next action
- Second next action
- These render as the Next Steps panel at the top of the dashboard
```

Convention (per NextGM, the gold standard) is to place `## Next Steps` near the top,
right under the date and above the systems table. Order doesn't actually matter to
the parser — it finds each piece independently — but this keeps the file scannable.

### Parser Rules (What the Dashboard Code Actually Does)

**Last Updated Date**
- The parser scans the entire file for the pattern: the words `last updated`
  (case-insensitive) followed by a date in `YYYY-MM-DD` format
- This can appear anywhere — in a heading, in bold text, inline, etc.
- Examples that work:
  - `Last updated: 2026-05-22`
  - `## Current State (last updated: 2026-05-22 — some notes here)`
  - `**Last updated:** 2026-05-22`
- Examples that do NOT work:
  - `Updated: 2026-05-22` (missing the word "last")
  - `Last updated: May 22, 2026` (wrong date format — must be YYYY-MM-DD)
  - `Last updated: 05/22/2026` (wrong date format)

**Systems Table**
- The parser looks for the first markdown table in the file (lines starting and
  ending with `|`)
- It skips the header row and the separator row (rows 0 and 1), then reads
  data rows starting at row 2
- From each data row, it takes **column 1** as the system name and **column 2**
  as the status text
- Extra columns (3, 4, etc.) are ignored — they won't break anything, but they
  won't display either
- Status text starting with `✅` renders in green
- Status text starting with `🔲` renders in muted gray
- Any other status text (like `⚠️` or plain text) renders in default color
- The table can have as many rows as needed

**IMPORTANT: Use a 2-column table.** The parser works with more columns but only
displays the first two. If your status file has a 4-column table like
`| Phase | Name | Status | Commit |`, the dashboard will show Phase as the
system name and Name as the status — which is wrong. Restructure to 2 columns.

**Next Steps Section**
- The parser scans for an H2 heading that is exactly `## Next Steps`
  (case-insensitive, nothing else on the line — not `## Next Steps (priority)`)
- Every `- ` or `* ` bullet line beneath it becomes a Next Steps item
- Collection stops at the next `## ` heading
- This renders as the "Next Steps" panel at the TOP of the dashboard — the most
  prominent thing you see when you select a project
- No `## Next Steps` heading at all → panel shows "No next steps defined."
  Heading present but no bullets → "Next steps section is empty."
- These bullets are plain `- ` bullets — no checkbox emoji needed (that's the
  backlog's format, not this one)

**What Gets Ignored**
- The `# ` top-level heading (H1) — not displayed
- Any `## ` heading other than `## Next Steps` (like `## Current State`,
  `## Legend`, `## Completed`, or any sprint-log heading) — NOT shown in the
  dashboard, but fine to keep in the file as history/context
- Prose paragraphs and narrative sprint logs — the dashboard only surfaces the
  date, the Next Steps bullets, and the systems table
- Horizontal rules (`---`)

### Status Emoji Reference

Use these consistently across all projects:

| Emoji | Meaning | Dashboard Styling |
|-------|---------|-------------------|
| ✅ | Complete / Done | Green text |
| 🔲 | Not started / In progress | Muted gray text |
| ⚠️ | Blocked / Needs attention | Default text (no special color) |

Keep status text short. Put details in parentheses after the status:
`✅ Complete (Phase 1–3, Sprint 04.27.26)` — not a full paragraph.

### Common Mistakes

**Wrong:** Multi-column table that puts status in column 3 or 4
```markdown
| Phase | Name | Status | Notes |
|-------|------|--------|-------|
| A | Data Model | ✅ Complete | v0.4 |
```
The dashboard shows "A" as system and "Data Model" as status. Fix by collapsing
to 2 columns:
```markdown
| System | Status |
|---|---|
| Phase A — Data Model | ✅ Complete (v0.4) |
```

**Wrong:** Using non-standard status emojis
```markdown
| System | Status |
|---|---|
| Auth | ⬜ Not started |
| API | 🟡 In progress |
```
These won't get the green/muted styling. Use ✅ and 🔲 instead.

**Wrong:** No `last updated` text with YYYY-MM-DD date
```markdown
**Updated:** May 22, 2026
```
Must be `last updated` (both words) followed by `YYYY-MM-DD`.

**Wrong:** Putting next steps under a non-matching heading
```markdown
## What's Next
- Ship the build
```
The Next Steps panel only reads a heading that is exactly `## Next Steps`. Use:
```markdown
## Next Steps
- Ship the production build to TestFlight
```

---

## BACKLOG.md — Exact Format

The dashboard parser (`parseBacklog`) turns this file into collapsible sections
with checkbox items and tag badges.

### Template

```markdown
# [Project Name] — Backlog

[Optional one-line description of what this file tracks.]

---

## [Section Name]

- 🔲 Task that needs to be done
- 🔲 Another task with a tag [ui]
- 🔲 Task with multiple tags [data] [P1]
- ✅ Task that's been completed
- ✅ Another completed task [fix]

### [Optional Subgroup Name]

- 🔲 Task within a named subgroup
- ✅ Completed task in the subgroup [infra]

## [Another Section]

- 🔲 First task in this section
- 🔲 Second task [blocked]
```

### Parser Rules (What the Dashboard Code Actually Does)

**Sections**
- Every `## ` heading creates a new collapsible section in the backlog panel
- The heading text becomes the section title (shown in uppercase in the dashboard)
- Each section shows a count like "3 of 7" (done / total)
- The first section starts expanded; all others start collapsed
- Click a section header to expand/collapse it

**Subgroups**
- `### ` headings within a section create named subgroups
- Subgroup items are indented slightly in the dashboard
- If items appear before any `### ` heading within a section, they go into an
  unnamed subgroup (no visual subgroup title)

**Checkbox Items**
- Items match either of two patterns:
  - Emoji: `- ✅ text` or `- 🔲 text` (dash, space, emoji, space, text)
  - Markdown checkbox: `- [x] text` or `- [ ] text`
- `✅` / `[x]` render checked with strikethrough; `🔲` / `[ ]` render unchecked
- Emoji form is the house style — prefer it for consistency across projects
- Items matching NEITHER pattern (plain `- text`, `* text`, or `**P0** text`
  priority lines) are silently ignored — they won't appear in the dashboard at all
- The dashboard's checkbox toggle + Save writes back by swapping the marker in
  place, so both forms round-trip safely

**Tags**
- Any text in `[square brackets]` within an item becomes a styled tag badge
- The bracket text is extracted and shown as a small pill next to the item text
- Multiple tags per item are supported: `- 🔲 Fix the layout [ui] [P1]`
- The tag text is removed from the displayed item text
- Common tags: `[ui]`, `[data]`, `[infra]`, `[fix]`, `[spec]`, `[blocked]`,
  `[carry]`, `[figma]`, `[bug]`

**What Gets Ignored**
- The `# ` top-level heading (H1)
- Any lines that aren't `## `, `### `, or `- ✅`/`- 🔲` items
- Plain text paragraphs, horizontal rules, bold text, links
- Items using unsupported formats: `- **P0** task`, `- task`, `* task` (note:
  `- [ ] task` / `- [x] task` markdown checkboxes ARE supported)

### Common Mistakes

**Note:** Markdown checkboxes work too
```markdown
- [ ] Incomplete task
- [x] Complete task
```
The live parser recognizes these as well as the emoji form. Emoji (`- 🔲` / `- ✅`)
is still the house style for visual consistency. What does NOT work is a priority
list with plain dashes (`- Re-run the script`, `**P0** Fix the crash`) — those are
ignored entirely. Rephrase as `- 🔲 Re-run the script [P0]`.

**Wrong:** Using priority labels instead of checkboxes
```markdown
- **P0** Fix the crash
- **P1** Add the button
```
These are ignored entirely. Rephrase as:
```markdown
- 🔲 Fix the crash [P0]
- 🔲 Add the button [P1]
```

**Wrong:** Using plain dashes without status emoji
```markdown
- Fix the layout
- Add error handling
```
These don't match the parser pattern. Always include ✅ or 🔲.

**Wrong:** Missing the space between emoji and text
```markdown
- ✅Fix the crash
- 🔲Add the button
```
Must have a space after the emoji: `- ✅ Fix the crash`.

**Wrong:** Git merge conflict markers left in the file
```markdown
<<<<<<< HEAD:documents/BACKLOG.md
- 🔲 Old version of task
========
- ✅ New version of task
>>>>>>> dev:docs/status/BACKLOG.md
```
These break parsing. Resolve conflicts before committing.

---

## Adding a Project to the Dashboard

Three things are needed to surface a project in Command Center:

1. **Create the files** at `docs/status/BUILD_STATUS.md` and `docs/status/BACKLOG.md`
   in the project repo, following the formats above

2. **Add the project to the PROJECTS array** in `public/central/index.html` in the
   cven repo:
   ```javascript
   { name: 'ProjectName', repo: 'repo-name', desc: 'Short description', tools: [] },
   ```
   Include `branch: 'master'` if the repo doesn't use `main` as its default branch.

3. **Add the repo to ALLOWED_REPOS** in `src/index.js` in the cven repo:
   ```javascript
   const ALLOWED_REPOS = ['football-sim', 'xoi-mobile', ..., 'repo-name'];
   ```

4. **Commit, push, and deploy.** The status files must be pushed to GitHub (the
   dashboard fetches via GitHub API, not local filesystem). The cven worker must
   be redeployed if you changed the PROJECTS array or ALLOWED_REPOS.

---

## Creating Status Files for a New Project

When setting up status files for a project that doesn't have them yet:

### Step 1 — Create the directory
```
docs/status/
```

### Step 2 — Create BUILD_STATUS.md

Start with what you know about the project. Even a minimal file is better than
no file — the dashboard will show whatever's parseable.

For a project that's just starting:
```markdown
# [Project Name] — Build Status

Last updated: [today's date YYYY-MM-DD]

| System | Status |
|---|---|
| Project Setup | ✅ Complete |
| [Next milestone] | 🔲 Not started |
```

For a project that's already in progress, audit the codebase and existing docs
to build a realistic systems table. Check for:
- Existing spec files (what's been planned?)
- Package.json scripts (what tooling exists?)
- Source directory structure (what's been built?)
- Any existing README, CLAUDE.md, or status docs

### Step 3 — Create BACKLOG.md

Start with known open items. Pull from:
- Existing TODO files, issue trackers, or backlog docs
- Known bugs or rough edges
- Planned features that haven't been started

If there's truly nothing to backlog yet, create a minimal file:
```markdown
# [Project Name] — Backlog

## Up Next

- 🔲 [First planned task]
```

### Step 4 — Commit and push

The dashboard reads from GitHub, not the local filesystem. Files must be pushed.

---

## Reformatting Existing Status Files

When a project already has BUILD_STATUS.md or BACKLOG.md but the dashboard isn't
rendering them correctly:

### Diagnose First

1. Open `cven.cc/central/` and select the project
2. If the Status panel shows "Could not parse — showing raw content", the
   BUILD_STATUS.md format doesn't match what the parser expects
3. If the Backlog panel shows nothing or "Backlog is empty", either BACKLOG.md
   is missing or its items don't use `- ✅`/`- 🔲` format

### Common Reformatting Tasks

**Multi-column table → 2-column table:**
Collapse extra columns into the System name or Status text. Keep it scannable.

**Non-standard emojis → standard emojis:**
Replace ⬜ with 🔲, replace 🟡/🟢/🔴 with appropriate ✅ or 🔲 + descriptive
text. The dashboard only color-codes ✅ (green) and 🔲 (muted).

**Narrative sprint logs → sprint heading format:**
Take the most recent update and format it as a `## Sprint [date]` section.
Move older narrative content below or into a separate history section (the parser
only reads the first matching sprint heading).

**Priority-based backlog → checkbox format:**
Convert `**P0** task` to `- 🔲 task [P0]`. The priority becomes a tag badge.

**Preserve existing content.** When reformatting, don't delete information —
restructure it. If a file has valuable history or context that doesn't fit the
dashboard format, keep it in the file below the dashboard-compatible sections.
The parser ignores anything it doesn't recognize, so extra content won't break
anything.

---

## Relationship to Other Skills

| Skill | Relationship |
|-------|-------------|
| `project-setup` | Creates the `docs/status/` directory and initial BUILD_STATUS.md as part of project scaffolding. This skill goes deeper on the exact format the dashboard parser requires. |
| `spec-writer` | Specs inform what goes in BUILD_STATUS.md (systems and their completion state). |
| `idea-to-code` | The idea-to-code process generates features that eventually populate the systems table. |

---

## Current Project Inventory

These seven projects are configured in the Command Center dashboard:

| Dashboard Name | Repo | Branch | Notes |
|---------------|------|--------|-------|
| NextGM | football-sim | master | Gold standard — has `## Next Steps`, 2-col table, YYYY-MM-DD date |
| XOI | xoi-mobile | main | Has `## Next Steps`; date needs YYYY-MM-DD; BACKLOG uses P0–P3 plain dashes (ignored) — convert to `- 🔲` |
| StoryEngine | storyengine | main | 2-col table + YYYY-MM-DD date OK; needs a `## Next Steps` section |
| XOPlay | xoplay-ffl | main | 2-col table + YYYY-MM-DD date OK; needs a `## Next Steps` section |
| Velocity | velocity-002 | main | 2-col table + YYYY-MM-DD date OK; needs a `## Next Steps` section |
| Elemental Web | elemental-web | main | 2-col table + YYYY-MM-DD date OK; needs a `## Next Steps` section |
| CVEN | cven | main | 2-col table + YYYY-MM-DD date OK; needs a `## Next Steps` section |

**Not yet tracked (candidates to add):** `nfl-stats-service` (status file currently
at repo root, not `docs/status/`), `apex-site`, `arcade`. To add any of these, follow
"Adding a Project to the Dashboard" above — create the files at the right path, add to
the PROJECTS array and ALLOWED_REPOS in the cven repo, then commit + redeploy.
