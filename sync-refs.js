#!/usr/bin/env node
// sync-refs.js — Auto-scans refs/ folders and updates STYLE_REFS in avatar-forge.html
// Run from the cven project root: node sync-refs.js

const fs = require('fs');
const path = require('path');

const REFS_DIR = path.join(__dirname, 'public/nextgm/refs');
const HTML_FILE = path.join(__dirname, 'public/nextgm/avatar-forge.html');

// Must match the keys used in the HTML exactly
const ETHNICITY_FOLDER_MAP = {
  'Black':              'black',
  'White':              'white',
  'Hispanic Latino':    'hispanic',
  'Polynesian Samoan':  'polynesian',
  'Asian':              'asian',
  'mixed-race biracial':'mixed',
};

// Scan each folder for image files (ignore .DS_Store etc.)
function scanRefs() {
  const result = {};
  for (const [ethKey, folder] of Object.entries(ETHNICITY_FOLDER_MAP)) {
    const folderPath = path.join(REFS_DIR, folder);
    let files = [];
    if (fs.existsSync(folderPath)) {
      files = fs.readdirSync(folderPath)
        .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
        .sort()
        .map(f => `/nextgm/refs/${folder}/${f}`);
    }
    result[ethKey] = files;
  }
  return result;
}

// Build the STYLE_REFS block as a JS string
function buildStyleRefsBlock(refs) {
  const lines = ['  const STYLE_REFS = {'];
  for (const [eth, files] of Object.entries(refs)) {
    if (files.length === 0) {
      lines.push(`    '${eth}': [],`);
    } else {
      lines.push(`    '${eth}': [`);
      for (const f of files) {
        lines.push(`      '${f}',`);
      }
      lines.push(`    ],`);
    }
  }
  lines.push('  };');
  return lines.join('\n');
}

// Replace the STYLE_REFS block in the HTML file
function updateHtml(newBlock) {
  let html = fs.readFileSync(HTML_FILE, 'utf8');

  // Match from `const STYLE_REFS = {` to the closing `};`
  const pattern = /[ \t]*const STYLE_REFS = \{[\s\S]*?\n  \};/;
  if (!pattern.test(html)) {
    console.error('❌  Could not find STYLE_REFS block in avatar-forge.html');
    process.exit(1);
  }

  html = html.replace(pattern, newBlock);
  fs.writeFileSync(HTML_FILE, html, 'utf8');
}

// ── Main ──────────────────────────────────────────────────────────────
const refs = scanRefs();
const block = buildStyleRefsBlock(refs);
updateHtml(block);

console.log('✅  STYLE_REFS updated:\n');
for (const [eth, files] of Object.entries(refs)) {
  const count = files.length;
  const indicator = count === 0 ? '⚠️  no refs' : `${count} ref${count === 1 ? '' : 's'}`;
  console.log(`   ${eth.padEnd(22)} ${indicator}`);
  for (const f of files) {
    console.log(`      · ${f.split('/').pop()}`);
  }
}
console.log('\nNow run: npx wrangler deploy');
