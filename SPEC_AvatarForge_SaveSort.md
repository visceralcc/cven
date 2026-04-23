# Avatar Forge — Save & Sort Upgrade

## Summary

Upgrade Avatar Forge so generated player avatars are automatically downloaded from fal.ai's CDN and saved into organized local catalog folders with smart filenames that encode all matrix attributes. Zero extra clicks beyond hitting "Generate."

---

## Architecture

Two pieces:

**1. Local Avatar Server** (`avatar-server.js`) — A lightweight Node.js HTTP server running on localhost. Receives image URLs + metadata via POST, fetches each image from fal.ai's CDN, writes it to the correct local folder with a smart filename.

**2. Avatar Forge Updates** (`avatar-forge.html`) — Modifications to track tag metadata per image, build smart filenames, and POST to the local server automatically during generation.

---

## Piece 1: Local Avatar Server

**File:** `~/dev/cven/avatar-server.js`

**Endpoints:**

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Returns `{ status: "ok" }`. Used by frontend to detect if server is running. |
| `POST` | `/save` | Saves a single image. Used during auto-save (one call per generated image). |
| `POST` | `/save-batch` | Saves multiple images in one request. Used by "Save All" button. |
| `GET` | `/stats` | Returns image counts per ethnicity folder. Enables real-time coverage tally in the UI. |

**Port:** `3456`

**`POST /save` request body:**
```json
{
  "url": "https://fal.media/files/...",
  "tags": {
    "ethnicity": "black",
    "hairstyle": "buzzcut",
    "facialHair": "stubble",
    "bodyType": "athletic",
    "accessories": "none"
  }
}
```

**`POST /save-batch` request body:**
```json
{
  "images": [
    { "url": "https://...", "tags": { ... } },
    { "url": "https://...", "tags": { ... } }
  ]
}
```

**Response (both endpoints):**
```json
{ "saved": 8, "failed": 2, "errors": ["..."], "path": "catalog/black/black_buzzcut_stubble_athletic_none_0042.png" }
```

**`GET /stats` response:**
```json
{
  "black": 312,
  "white": 287,
  "hispanic": 203,
  "polynesian": 98,
  "asian": 145,
  "mixed": 112,
  "total": 1157
}
```

### Folder structure (auto-created on first run):
```
~/dev/cven/public/nextgm/catalog/
  black/
  white/
  hispanic/
  polynesian/
  asian/
  mixed/
```

### Smart filename format:
```
{ethnicity}_{hairstyle}_{facialhair}_{bodytype}_{accessories}_{4-digit-number}.png
```
Example: `black_buzzcut_stubble_athletic_none_0042.png`

### Auto-increment logic:
The server scans existing files in the target ethnicity folder and finds the **highest existing number** (not a simple file count). This prevents collisions if files are ever manually deleted. Numbers are zero-padded to 4 digits.

### CORS:
Headers set to allow requests from `https://cven.cc` and `http://localhost:*`.

---

## Tag-to-Slug Mapping

This mapping is defined as a shared constant (`TAG_SLUGS`) that appears identically in both the server and the frontend. Each file includes a comment pointing to the other: `// Keep in sync with avatar-forge.html` / `// Keep in sync with avatar-server.js`.

| Category | Prompt Value | Filename Slug |
|---|---|---|
| **Ethnicity** | Black | `black` |
| | White | `white` |
| | Hispanic Latino | `hispanic` |
| | Polynesian Samoan | `polynesian` |
| | Asian | `asian` |
| | mixed-race biracial | `mixed` |
| **Hairstyle** | buzz cut hair | `buzzcut` |
| | short cropped hair | `shortcrop` |
| | medium-length wavy hair | `wavy` |
| | short dreadlocks | `dreadsshort` |
| | long dreadlocks | `dreadslong` |
| | long straight hair past shoulders | `longhair` |
| | side-parted hair | `parted` |
| | cornrow braids | `cornrows` |
| | large afro hairstyle | `afro` |
| | completely bald shaved head | `bald` |
| | man bun with undercut | `manbun` |
| | fade haircut | `fade` |
| | short spiky hair | `spiky` |
| | blonde crop hair | `blondecrop` |
| **Facial Hair** | clean-shaven no facial hair | `clean` |
| | light stubble beard | `stubble` |
| | thick full beard | `fullbeard` |
| | trimmed goatee | `goatee` |
| | thin mustache | `mustache` |
| | salt-and-pepper gray-flecked goatee | `saltpepper` |
| **Body Type** | lean wiry frame | `lean` |
| | athletic build | `athletic` |
| | stocky muscular build | `stocky` |
| | large heavy-set frame | `heavyset` |
| | massive beefy frame | `beefy` |
| | round heavyset body | `round` |
| **Accessories** | no earrings or accessories | `none` |
| | small black stud earrings | `studs` |
| | small gold hoop earrings | `hoops` |
| | diamond stud earrings | `diamonds` |
| | one small hoop earring | `singlehoop` |

---

## Piece 2: Avatar Forge Updates

**File:** `~/dev/cven/public/nextgm/avatar-forge.html`

### Changes:

**1. `buildPrompt` returns tag metadata**

In addition to `{ prompt, ethnicity }`, it now also returns:
```js
{
  prompt: "...",
  ethnicity: "Black",
  tags: {
    ethnicity: "black",
    hairstyle: "buzzcut",
    facialHair: "stubble",
    bodyType: "athletic",
    accessories: "none"
  }
}
```
The `tags` object uses the short slug values from `TAG_SLUGS`, not the raw prompt text.

**2. Tag metadata stored per image**

Each entry in `state.generated` gains a `tags` object:
```js
{ url, prompt, index, tags: { ethnicity, hairstyle, facialHair, bodyType, accessories } }
```

**3. Auto-save on by default**

A new checkbox in Generation Settings: **"Auto-save to catalog"** (default: on). When enabled, each image is POSTed to `localhost:3456/save` immediately upon successful generation — one image at a time, as they stream in. No separate save step needed.

**4. "Save All" fallback button**

Appears in the main content area near the image grid. Only visible when:
- Auto-save is OFF, and
- Generation is complete, and
- There are unsaved images

Sends all images to `/save-batch` in one POST. Shows brief confirmation with save count.

**5. Connection status indicator**

On page load (and every 10 seconds), Avatar Forge pings `localhost:3456/health`.
- **Server running:** Green dot + "catalog connected" text next to auto-save toggle. Toggle is enabled.
- **Server not running:** Gray dot + "catalog offline" text. Toggle is disabled with hint: "Start avatar-server to enable."

**6. Coverage tally in header**

When connected, the header shows a compact tally from `/stats`:
```
B:312 · W:287 · H:203 · P:98 · A:145 · M:112 = 1,157
```
Updates after each successful save and on page load.

**7. Modal download uses smart filename**

The preview modal's Download button uses the smart filename format (from the image's stored tags) instead of the generic `nextgm_avatar_0001.png`.

**8. Remove old "Download All as ZIP" button**

Delete the `btnDownload` button from the sidebar entirely.

**9. Log entries for saves**

The generation log shows save confirmations:
```
[12:34:56] ✓ Saved → catalog/black/black_buzzcut_stubble_athletic_none_0042.png
[12:34:57] ✗ Save failed: Connection refused (server not running?)
```

---

## User Flow

### First-time setup (once):
1. Run `node ~/dev/cven/avatar-server.js` in Terminal
2. Confirm green "catalog connected" indicator in Avatar Forge header

### Every generation session (zero extra clicks):
1. Open Avatar Forge at `cven.cc/nextgm/avatar-forge`
2. Confirm green indicator (server is running)
3. Configure matrix tags, hit **Generate**
4. Images appear in grid AND automatically save to catalog folders as they generate
5. Coverage tally updates in real time
6. Done — files are already organized in `catalog/{ethnicity}/` with smart filenames

### If auto-save is off (one extra click):
1. Generate batch, review images in grid
2. Click **"Save All"**
3. Images save to catalog folders in one shot

---

## Files to create/modify

| File | Action |
|---|---|
| `~/dev/cven/avatar-server.js` | **Create** — Local Node.js server |
| `~/dev/cven/public/nextgm/avatar-forge.html` | **Modify** — All frontend changes |
| `~/dev/cven/SPEC_AvatarForge_SaveSort.md` | **Create** — This spec |

---

## What's NOT in this phase

- **Catalog browser tab** — A second view for browsing/auditing saved images by attribute, with coverage counts and gap analysis. Next phase.
- **Selective save / reject** — Ability to deselect individual images before saving (mark bad generations). Could add later with checkboxes on each grid cell.
- **Auto-start server as daemon** — Can configure `launchd` after confirming the basic flow works.
- **Cloud storage** — Everything is local for now. Could move to R2 later if needed.

---

## Risk / edge cases

| Risk | Mitigation |
|---|---|
| **fal.ai CDN URLs expire** | Auto-save fetches immediately upon generation. Manual "Save All" could hit expired URLs after ~1 hour — but typical session flow is fast enough. |
| **Filename collisions** | Auto-incrementing number per ethnicity folder, based on highest existing number (not file count), prevents this even with identical tag combos or deleted files. |
| **Server not running** | Health check + disabled toggle prevents user from expecting auto-save. Manual browser download still works as fallback. |
| **CORS** | Server sets `Access-Control-Allow-Origin` for `https://cven.cc` and `localhost`. |
| **Tag mapping drift** | Shared `TAG_SLUGS` constant with cross-reference comments in both files. |
