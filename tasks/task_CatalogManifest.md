# Task: Catalog Manifest for Online Catalog Tab

## Goal
Make the Avatar Forge Catalog tab work on cven.cc (not just localhost) by generating a static JSON manifest at deploy time.

## Context
- Avatar Forge runs at `cven.cc/nextgm/avatar-forge` (Cloudflare Worker) and `localhost:3456` (local Node server)
- The Catalog tab currently calls `localhost:3456/catalog` which only works locally
- Cloudflare Workers can't list directories at runtime, so we need a static manifest
- The local server's `/catalog` endpoint should remain as-is (it still works for localhost)

## Files to create/modify

### 1. CREATE `build-catalog-manifest.js` (project root: `~/dev/cven/`)

A simple Node script that:
- Scans `public/nextgm/catalog/{black,white,hispanic,polynesian,asian,mixed}/` for `.png` files
- Parses each filename using the established convention: `{ethnicity}_{hairstyle}_{facialHair}_{bodyType}_{accessories}_{number}.png`
- Builds the same data structure the local server's `getCatalogBreakdown()` returns
- Writes it to `public/nextgm/catalog-manifest.json`
- Logs a summary to stdout

Use the same `ALL_VALUES` lists as `avatar-server.js`:
```
hairstyle: buzzcut, shortcrop, wavy, dreadsshort, dreadslong, longhair, parted, cornrows, afro, bald, manbun, fade, spiky, blondecrop
facialHair: clean, stubble, fullbeard, goatee, mustache, saltpepper
bodyType: lean, athletic, stocky, heavyset, beefy, round
accessories: none, studs, hoops, diamonds, singlehoop
```

Output format (matches `/catalog` endpoint exactly):
```json
{
  "black": {
    "total": 312,
    "breakdown": {
      "hairstyle": { "buzzcut": 20, "fade": 45, "cornrows": 2, ... },
      "facialHair": { "clean": 50, "stubble": 40, ... },
      "bodyType": { "lean": 30, "athletic": 80, ... },
      "accessories": { "none": 100, "studs": 20, ... }
    }
  },
  "white": { ... },
  ...
}
```

Add a comment at the top of the file: `// Run before deploy: node build-catalog-manifest.js && npx wrangler deploy`

### 2. MODIFY `public/nextgm/avatar-forge.html`

In the `loadCatalog()` function, replace the current implementation with this logic:

```js
async function loadCatalog() {
  const view = document.getElementById('catalogView');
  view.innerHTML = '<div class="catalog-loading">Loading catalog data…</div>';
  let data = null;
  // Try local server first (works on localhost with live data)
  if (state.catalogConnected) {
    try {
      const res = await fetch(CATALOG_SERVER + '/catalog', { signal: AbortSignal.timeout(3000) });
      data = await res.json();
    } catch {}
  }
  // Fall back to static manifest (works on cven.cc)
  if (!data) {
    try {
      const res = await fetch('/nextgm/catalog-manifest.json', { signal: AbortSignal.timeout(5000) });
      if (res.ok) data = await res.json();
    } catch {}
  }
  if (!data) {
    view.innerHTML = `<div class="catalog-offline">
      <div class="icon">📁</div>
      <h2>Catalog Unavailable</h2>
      <p>No catalog data found. Run the manifest build or start the avatar server.</p>
    </div>`;
    return;
  }
  catalogData = data;
  renderCatalog();
}
```

Key change: remove the early `if (!state.catalogConnected)` bail-out that currently prevents loading when the server is offline. The function should always attempt both sources.

### 3. No other files change
- `avatar-server.js` stays as-is
- `src/index.js` (Cloudflare Worker) stays as-is — the manifest is served as a static asset automatically
- `renderCatalog()` stays as-is

## Deploy workflow after this task
```bash
cd ~/dev/cven
node build-catalog-manifest.js && npx wrangler deploy
```

## Verification
1. Run `node build-catalog-manifest.js` — confirm `public/nextgm/catalog-manifest.json` is created with correct structure
2. Deploy: `npx wrangler deploy`
3. Open `cven.cc/nextgm/avatar-forge` → Catalog tab → should show full breakdown
4. Open `localhost:3456/nextgm/avatar-forge` → Catalog tab → should still work via local server (live data)
