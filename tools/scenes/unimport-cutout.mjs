#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = path.join(root, 'public/assets/character-cutouts');
const manifestPath = path.join(outDir, 'manifest.json');
const [, , assetId, stagedPathArg] = process.argv;

if (!assetId || !stagedPathArg) {
  console.error('Usage: node tools/scenes/unimport-cutout.mjs <asset-id> <preserved-staging-file>');
  process.exit(2);
}

const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const index = manifest.assets.findIndex(asset => asset.id === assetId);
if (index < 0) throw new Error(`Asset not found in manifest: ${assetId}`);

const asset = manifest.assets[index];
const productionPath = path.resolve(outDir, asset.file);
const stagedPath = path.resolve(stagedPathArg);
if (path.dirname(productionPath) !== outDir || path.basename(productionPath) !== asset.file) {
  throw new Error(`Refusing to remove a path outside the library: ${productionPath}`);
}
if (!fs.existsSync(productionPath) || !fs.existsSync(stagedPath)) {
  throw new Error(`Production or preserved staging file is missing: ${productionPath} / ${stagedPath}`);
}
const productionHash = hash(productionPath);
const stagedHash = hash(stagedPath);
if (productionHash !== asset.fileSha256 || stagedHash !== asset.fileSha256 || productionHash !== stagedHash) {
  throw new Error('Refusing removal: production bytes, preserved staging bytes, and manifest SHA-256 must all match.');
}

manifest.assets.splice(index, 1);
manifest.updated = new Date().toISOString().slice(0, 10);
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
fs.unlinkSync(productionPath);
console.log(`Unimported ${assetId}; exact ${productionHash} bytes remain preserved at ${stagedPath}.`);
