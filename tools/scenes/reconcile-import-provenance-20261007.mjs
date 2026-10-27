import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Restore exact recorded prompts and physically attached input paths for four
// imports. This does not regenerate or modify any PNG or source illustration.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const library = path.join(root, 'public/assets/character-cutouts');
const manifestPath = path.join(library, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const candidates = path.resolve(root, '../assets-scenes/candidates');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const refs = [
  '/Users/pliu0036/Downloads/D4F32633-B285-4678-8F4E-BFE1AC2DE21B.PNG',
  '/Users/pliu0036/Downloads/FA93B816-233F-4112-8C78-AE8ED3698F0D.PNG',
  '/Users/pliu0036/Downloads/67CEF480-E4CF-4221-9B04-D4F6A4CBD777.PNG'
];
const refHashes = [
  'fb8be08d090ca81c3f5f38e87b8276150160b1fd9c3571ee72281325616f167b',
  '6c724f96afdf4e812053184f487f0b7c23f580df06ab767107180529fa2e6912',
  'a57357511d8f73008882501dd10557715688442a865d4a91b1ae7540c92ee802'
];
refs.forEach((file, i) => { if (hash(file) !== refHashes[i]) throw new Error(`Reference changed: ${file}`); });
const rows = [
  ['2-corinthians-13-1-elder-speaker', 'character-cutouts-2-corinthians-13-1-20261006', '# Exact generation prompt — 2 Corinthians 13:1'],
  ['2-corinthians-10-1-blue-back-listener', 'character-cutouts-2-corinthians-10-1-20261006', '## Attempt 06 — blue back-view foreground listener (sequential)'],
  ['2-corinthians-10-1-paul-open-arms', 'character-cutouts-2-corinthians-10-1-20261006', '## Attempt 04 — sequential Paul generation (selected for staging)'],
  ['2-corinthians-10-1-olive-listener', 'character-cutouts-2-corinthians-10-1-20261006', '## Attempt 05 — olive-robed step listener (sequential)']
];
const updates = rows.map(([id, folder, heading]) => {
  const asset = manifest.assets.find(a => a.id === id);
  if (!asset) throw new Error(`Missing imported asset: ${id}`);
  if (hash(path.join(library, asset.file)) !== asset.fileSha256) throw new Error(`PNG changed: ${id}`);
  if (hash(asset.source) !== asset.sourceSha256) throw new Error(`Source changed: ${id}`);
  const doc = fs.readFileSync(path.join(candidates, folder, 'PROMPTS.md'), 'utf8');
  const lines = doc.split(/\r?\n/);
  const start = lines.indexOf(heading);
  if (start < 0) throw new Error(`Prompt heading absent: ${heading}`);
  const next = lines.findIndex((line, i) => i > start && /^#{1,4}\s+/.test(line));
  const section = lines.slice(start + 1, next < 0 ? lines.length : next).join('\n');
  const prompt = section.match(/```text\s*\n([\s\S]*?)\n```/)?.[1];
  if (!prompt) throw new Error(`Exact prompt absent: ${id}`);
  return { asset, prompt, inputs: [asset.source, ...refs] };
});
for (const { asset, prompt, inputs } of updates) {
  asset.prompt = prompt;
  asset.actualAttachedInputs = inputs;
}
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Reconciled exact prompts and attached inputs for ${updates.length} imported assets; PNGs unchanged.`);
