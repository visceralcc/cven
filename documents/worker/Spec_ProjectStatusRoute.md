# Command Center — Project Status Route Specification

**API Design & Worker Integration**

Version 0.1 | May 2026 | Charlie Denison | Civil Engine

**CONFIDENTIAL**

---

## Version History
| Version | Date | Changes |
|---------|------|---------|
| 0.1 | May 2026 | Initial draft. API route design for GitHub proxy + sync filtering. |

---

## 1. Overview

This spec defines the `/api/project-status` route added to the existing Cloudflare Worker at `cven-cc`. The route acts as a server-side proxy that fetches markdown files from private GitHub repos and returns them to the Command Center dashboard.

**Design principle: Thin pass-through.** The Worker does as little as possible — it authenticates with GitHub, fetches a file, and returns the content. No parsing, no transformation, no caching. All intelligence lives in the dashboard (the consumer). This keeps the Worker simple, testable, and unlikely to need changes when the dashboard evolves.

**Who calls it:** The Command Center dashboard at `cven.cc/central/` — browser-side JavaScript making `fetch()` calls. No other consumers.

**Scope boundary — what this route does NOT do:**
- Does not parse markdown — returns raw content
- Does not cache responses — every request hits GitHub fresh
- Does not write to repos — read-only
- Does not validate that the returned content is valid markdown
- Does not know about the project list — it receives repo and file path as params and fetches whatever is requested

---

## 2. API Contract

### 2.1 Endpoint

```
GET /api/project-status?repo={repo}&file={file}
```

### 2.2 Query Parameters

| Parameter | Required | Description | Example |
|-----------|----------|-------------|---------|
| `repo` | Yes | GitHub repo name (under the `visceralcc` org) | `football-sim` |
| `file` | Yes | Relative file path within the repo | `docs/status/BUILD_STATUS.md` |

### 2.3 Success Response (200)

```json
{
  "ok": true,
  "repo": "football-sim",
  "file": "docs/status/BUILD_STATUS.md",
  "content": "# NextGM — Build Status\n\n**Feature map and...",
  "fetchedAt": "2026-05-17T15:30:00.000Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `ok` | boolean | Always `true` on success |
| `repo` | string | Echo of the requested repo |
| `file` | string | Echo of the requested file path |
| `content` | string | Raw markdown file content as a string |
| `fetchedAt` | string | ISO 8601 timestamp of when the fetch occurred |

### 2.4 Error Responses

| HTTP Status | Condition | Response Body |
|-------------|-----------|---------------|
| 400 | Missing `repo` or `file` param | `{ "ok": false, "error": "Missing required parameter: repo" }` |
| 404 | File not found in GitHub repo | `{ "ok": false, "error": "File not found", "repo": "...", "file": "..." }` |
| 401 | GitHub token not configured | `{ "ok": false, "error": "GitHub token not configured" }` |
| 403 | GitHub rate limit exceeded | `{ "ok": false, "error": "GitHub rate limit exceeded. Try again later." }` |
| 500 | Unexpected fetch error | `{ "ok": false, "error": "Fetch failed: {message}" }` |
| 405 | Non-GET method | `{ "error": "Method not allowed" }` |

All error responses include CORS headers (same as existing routes).

### 2.5 CORS

Uses the existing `CORS` constant already defined in `index.js`:

```javascript
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
```

OPTIONS preflight is handled at the top of the handler.

---

## 3. Implementation Logic

### 3.1 Request Flow

```
Browser                    Worker                         GitHub
  |                          |                              |
  |  GET /api/project-status |                              |
  |  ?repo=X&file=Y         |                              |
  |------------------------->|                              |
  |                          |  Validate params             |
  |                          |  Build GitHub raw URL        |
  |                          |  GET raw.githubusercontent   |
  |                          |  Authorization: token {PAT}  |
  |                          |----------------------------->|
  |                          |                              |
  |                          |  200 + file content          |
  |                          |<-----------------------------|
  |                          |                              |
  |  200 JSON response       |                              |
  |<-------------------------|                              |
```

### 3.2 GitHub URL Construction

```javascript
const githubUrl = `https://raw.githubusercontent.com/visceralcc/${repo}/main/${file}`;
```

**Hardcoded values:**
- GitHub org: `visceralcc` — hardcoded, not configurable. This Worker only serves Civil Engine repos.
- Branch: `main` — hardcoded for v1. No branch parameter.

### 3.3 Authentication

The GitHub Personal Access Token is stored as a Cloudflare secret bound to the environment variable `GITHUB_TOKEN`.

```javascript
const token = env.GITHUB_TOKEN;
```

The token needs only the `repo` scope (read access to private repos). It is never sent to the browser — the Worker holds it server-side and uses it in the outbound fetch to GitHub.

**If `GITHUB_TOKEN` is not set:** Return 401 immediately. Don't attempt the fetch.

### 3.4 Input Validation

**Repo name:** Must be a non-empty string. Must match the pattern `/^[a-zA-Z0-9._-]+$/` (alphanumeric, dots, hyphens, underscores). This prevents path traversal or injection via the repo param.

**File path:** Must be a non-empty string. Must not start with `/` or contain `..`. Must end with `.md`. This scopes the route to markdown files only and prevents directory traversal.

**Why validate?** Even though this is a single-user internal tool, the endpoint is publicly accessible (no auth at the page level). Input validation prevents it from being used as an open proxy to arbitrary GitHub content.

### 3.5 Security Allowlist

As an additional safeguard, the route validates the `repo` parameter against a hardcoded allowlist of known repos:

```javascript
const ALLOWED_REPOS = [
  'football-sim',
  'xoi-mobile',
  'storyengine',
  'xoplay-ffl',
  'velocity-002',
  'elemental-web',
  'cven',
];
```

If the requested repo is not in this list, return 400 with `"error": "Unknown repo"`. This prevents the endpoint from being used to probe other repos under the `visceralcc` org.

**Maintaining the list:** When a new project is added, add it to both the dashboard config AND this allowlist. Two places to update — accepted trade-off for security.

---

## 4. Environment Bindings

### 4.1 New Secret

| Binding | Type | Value |
|---------|------|-------|
| `GITHUB_TOKEN` | Secret | GitHub Personal Access Token with `repo` scope |

**How to set it:**

```bash
wrangler secret put GITHUB_TOKEN
```

Then paste the token when prompted. It will be encrypted and available as `env.GITHUB_TOKEN` at runtime.

### 4.2 Existing Bindings (Unchanged)

| Binding | Type | Purpose |
|---------|------|---------|
| `ASSETS` | Assets | Static file serving (`public/`) |
| `SYNC_STATUS` | KV Namespace | Sync status storage |
| `FAL_KEY` | Secret | fal.ai API key |
| `SYNC_KEY` | Secret | Sync report auth key |
| `EMAIL` | Email | Contact form email sending |

No changes to `wrangler.jsonc` are needed for the secret — Cloudflare secrets are set via CLI and don't appear in the config file.

---

## 5. Integration with Existing Worker

### 5.1 Router Addition

Add the new route to the existing `fetch` handler in `src/index.js`, following the established pattern:

```javascript
if (url.pathname === '/api/project-status') {
  return handleProjectStatus(request, env);
}
```

Place it after the existing `/api/sync-status` route and before the `env.ASSETS.fetch(request)` fallback.

### 5.2 Handler Function

New function `handleProjectStatus(request, env)` added to `src/index.js`, following the same conventions as `handleSyncStatus` and `handleFalProxy`:

- CORS preflight at the top
- Method check (GET only)
- Input validation
- Allowlist check
- Fetch from GitHub
- Response mapping
- Error handling with try/catch

### 5.3 No New Files

The handler is added directly to `src/index.js`. The Worker is a single-file architecture — no reason to change that for one new route.

---

## 6. Edge Cases & Rules

- **Empty file:** If GitHub returns a 200 with an empty body, return `{ ok: true, content: "" }`. The dashboard handles the empty state.
- **Binary file requested:** The `.md` extension check in validation prevents this. If somehow a binary file is returned, the content string will be garbage — acceptable since the dashboard only requests known markdown paths.
- **GitHub 5xx:** Pass through as a 500 with `"error": "GitHub returned status {code}"`.
- **Concurrent requests:** No shared state, no race conditions. Each request is independent.
- **Large files:** GitHub raw content API has no documented size limit for typical text files. BUILD_STATUS and BACKLOG files are well under 1MB. No special handling needed.
- **Token rotation:** If the GitHub token is rotated, run `wrangler secret put GITHUB_TOKEN` again. No code change needed.

---

## 7. Relationship to Other Systems

| System / File | Effect / Dependency | Section Reference |
|---|---|---|
| `src/index.js` (existing Worker) | New route added to fetch handler | §5.1 |
| `wrangler.jsonc` | No changes needed (secret set via CLI) | §4.1 |
| GitHub API (`raw.githubusercontent.com`) | Outbound dependency — file content source | §3.2 |
| `/api/sync-status` (existing route) | No changes — dashboard consumes it separately | — |
| Dashboard (`public/central/index.html`) | Primary consumer of this route | PRD §5.4 |

**No direct interaction:**
- `/api/fal` — unrelated (avatar generation)
- `/api/sync-report` — unrelated (machine sync reporting)
- `/api/contact` — unrelated (contact form)
- KV namespace `SYNC_STATUS` — not used by this route

---

## 8. Data Model / Interfaces (Preview)

No persistent data. No database. No KV usage. The route is stateless — request in, response out.

**Request shape:**
```
GET /api/project-status?repo=string&file=string
```

**Response shape:**
```typescript
// Success
{ ok: true, repo: string, file: string, content: string, fetchedAt: string }

// Error
{ ok: false, error: string, repo?: string, file?: string }
```

---

## 9. Build Sequence (Preview)

### Phase 1 — Add handler to Worker (no deploy yet)
1. Add `ALLOWED_REPOS` constant
2. Add `handleProjectStatus` function with validation, GitHub fetch, response mapping
3. Add route to the fetch handler

### Phase 2 — Set GitHub token
1. Generate a GitHub Personal Access Token (classic) with `repo` scope
2. Run `wrangler secret put GITHUB_TOKEN`

### Phase 3 — Deploy & test
1. `wrangler deploy`
2. Test with curl:
   ```bash
   curl "https://cven.cc/api/project-status?repo=storyengine&file=docs/status/BUILD_STATUS.md"
   ```
3. Verify success response with StoryEngine (already has the right file path)
4. Test error cases: missing params, unknown repo, nonexistent file

---

## 10. Files Affected (Summary)

| File | Change |
|---|---|
| `cven/src/index.js` | Add `handleProjectStatus` function + route in fetch handler |

---

## Claude Code Handoff Prompt

```claude-code-handoff
Project: CVEN (cven) | Repo: visceralcc/cven | Branch: main

Spec file: documents/worker/Spec_ProjectStatusRoute.md
→ This file already exists in the repo.

Follow the Build Sequence in §9, phase by phase.

Key constraints:
- Follow the existing code conventions in src/index.js exactly (CORS pattern, Response.json, error handling style)
- ALLOWED_REPOS allowlist is mandatory — do not skip it (§3.5)
- Input validation must reject paths with ".." and non-.md extensions (§3.4)
- Do NOT add caching, parsing, or any transformation — raw pass-through only (§1)
- The handler goes in src/index.js directly — no new files

Start with: Phase 1 — Add the handleProjectStatus function to src/index.js following the pattern of handleSyncStatus and handleFalProxy.

Work phase by phase. After completing each phase, stop and check in before moving on.
Commit after each phase with a message like "feat(worker): Phase 1 — project-status proxy route".
```
