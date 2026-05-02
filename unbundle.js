#!/usr/bin/env node
/**
 * Unbundle the __bundler/manifest JSON from public/index.html.
 * Writes each asset to /public/assets/ and updates index.html.
 */

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

// ── 1. Read index.html ──────────────────────────────────────────────────────
const indexPath    = path.join(__dirname, 'public', 'index.html');
const indexContent = fs.readFileSync(indexPath, 'utf8');

// ── 2. Pull out the JSON from <script type="__bundler/manifest"> … </script>
const manifestMatch = indexContent.match(
  /<script\s+type="__bundler\/manifest"\s*>([\s\S]*?)<\/script>/i
);
if (!manifestMatch) {
  console.error('❌  Could not find the __bundler/manifest block.');
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(manifestMatch[1].trim());
} catch (e) {
  console.error('❌  Failed to parse manifest JSON:', e.message);
  process.exit(1);
}

// ── 3. Prepare output folder ────────────────────────────────────────────────
const outDir = path.join(__dirname, 'public', 'assets');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// ── 4. MIME → extension map ─────────────────────────────────────────────────
const mimeMap = {
  'image/png'    : '.png',
  'image/jpeg'   : '.jpg',
  'image/gif'    : '.gif',
  'image/svg+xml': '.svg',
  'image/webp'   : '.webp',
  'font/woff2'   : '.woff2',
  'font/woff'    : '.woff',
  'font/ttf'     : '.ttf',
  'font/otf'     : '.otf',
  'text/css'     : '.css',
  'application/javascript': '.js',
};

// ── 5. Extract every entry ───────────────────────────────────────────────────
const idToFile = {};   // id → relative path for potential future use

Object.entries(manifest).forEach(([id, entry]) => {
  const { mime, compressed, data } = entry;
  const ext     = mimeMap[mime] || '';
  const outFile = `${id}${ext}`;
  const outPath = path.join(outDir, outFile);

  let buffer = Buffer.from(data, 'base64');
  if (compressed) buffer = zlib.gunzipSync(buffer);

  fs.writeFileSync(outPath, buffer);
  idToFile[id] = `assets/${outFile}`;
  console.log(`✅  assets/${outFile}  (${mime})`);
});

// ── 6. Replace the huge inline block with a tiny comment ─────────────────────
const cleanedHtml = indexContent.replace(
  /<script\s+type="__bundler\/manifest"\s*>[\s\S]*?<\/script>/i,
  `<!--
  Bundler manifest – assets have been extracted to /public/assets/.
  The runtime bundler block has been removed; assets are now served
  as static files.  See /public/assets/ for the extracted files.
-->`
);

fs.writeFileSync(indexPath, cleanedHtml, 'utf8');
console.log('\n🎉  index.html cleaned – manifest block replaced with a comment.');
console.log(`📁  ${Object.keys(manifest).length} asset(s) written to public/assets/`);
