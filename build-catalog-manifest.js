// Run before deploy: node build-catalog-manifest.js && npx wrangler deploy
/**
 * Avatar Forge — Catalog Manifest Builder
 * Scans public/nextgm/catalog/{ethnicity}/ for .png files and writes
 * public/nextgm/catalog-manifest.json so the Cloudflare Worker deployment
 * can serve catalog breakdown data statically (Workers can't list dirs at runtime).
 *
 * Output matches avatar-server.js getCatalogBreakdown() exactly.
 */

const fs = require('fs');
const path = require('path');

const PUBLIC_ROOT = path.join(__dirname, 'public');
const CATALOG_ROOT = path.join(PUBLIC_ROOT, 'nextgm', 'catalog');
const MANIFEST_PATH = path.join(PUBLIC_ROOT, 'nextgm', 'catalog-manifest.json');
const ETHNICITY_FOLDERS = ['black', 'white', 'hispanic', 'polynesian', 'asian', 'mixed'];

const CATEGORIES = ['hairstyle', 'facialHair', 'bodyType', 'accessories'];
const ALL_VALUES = {
  hairstyle: ['buzzcut','shortcrop','wavy','dreadsshort','dreadslong','longhair','parted','cornrows','afro','bald','manbun','fade','spiky','blondecrop'],
  facialHair: ['clean','stubble','fullbeard','goatee','mustache','saltpepper'],
  bodyType: ['lean','athletic','stocky','heavyset','beefy','round'],
  accessories: ['none','studs','hoops','diamonds','singlehoop'],
};

function getCatalogBreakdown() {
  const result = {};
  for (const eth of ETHNICITY_FOLDERS) {
    const dir = path.join(CATALOG_ROOT, eth);
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.png')) : [];
    const breakdown = {};
    for (const cat of CATEGORIES) {
      breakdown[cat] = {};
      for (const val of ALL_VALUES[cat]) breakdown[cat][val] = 0;
    }
    for (const file of files) {
      // filename: ethnicity_hairstyle_facialHair_bodyType_accessories_0001.png
      const parts = file.replace('.png', '').split('_');
      if (parts.length >= 6) {
        const [, hairstyle, facialHair, bodyType, accessories] = parts;
        if (breakdown.hairstyle[hairstyle] !== undefined) breakdown.hairstyle[hairstyle]++;
        if (breakdown.facialHair[facialHair] !== undefined) breakdown.facialHair[facialHair]++;
        if (breakdown.bodyType[bodyType] !== undefined) breakdown.bodyType[bodyType]++;
        if (breakdown.accessories[accessories] !== undefined) breakdown.accessories[accessories]++;
      }
    }
    result[eth] = { total: files.length, breakdown };
  }
  return result;
}

const manifest = getCatalogBreakdown();
fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

let grandTotal = 0;
console.log('\n🏈 Catalog Manifest Built');
console.log('   Output: ' + path.relative(__dirname, MANIFEST_PATH));
for (const eth of ETHNICITY_FOLDERS) {
  console.log('   ' + eth + ': ' + manifest[eth].total);
  grandTotal += manifest[eth].total;
}
console.log('   total: ' + grandTotal + '\n');
