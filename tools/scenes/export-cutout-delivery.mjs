import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const destination = '/Volumes/T7/yahwehs-globe-scenes/character-cutouts-ready';
if (!fs.existsSync('/Volumes/T7')) throw new Error('T7 is not mounted');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const libraries = [
  { name: 'approved', source: path.join(root, 'public/assets/character-cutouts'), status: 'approved-by-character-manifest' },
  { name: 'historical-ark-for-review', source: path.join(root, 'public/assets/ark-cutouts'), status: 'historical-library-requires-current-individual-QA' }
];
const report = { generatedAtUtc: new Date().toISOString(), scope: 'All previously and newly accepted character cutouts, plus separately identified historical Ark cutouts. Candidate/rejected images are excluded.', deadlineUtc: '2026-10-13T13:10:00Z', libraries: [] };
for (const library of libraries) {
  const manifestPath = path.join(library.source, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const output = path.join(destination, library.name);
  const checked = manifest.assets.map(asset => {
    if (!asset.file || path.basename(asset.file) !== asset.file) throw new Error(`Unsafe filename for ${asset.id}`);
    const file = path.join(library.source, asset.file);
    const hash = sha(file);
    if (asset.fileSha256 && hash !== asset.fileSha256) throw new Error(`Hash mismatch: ${asset.id}`);
    const header = fs.readFileSync(file).subarray(0, 26);
    if (header.toString('ascii', 1, 4) !== 'PNG' || header[25] !== 6) throw new Error(`Expected RGBA PNG: ${asset.id}`);
    return { asset, file, hash };
  });
  fs.mkdirSync(output, { recursive: true });
  for (const { asset, file, hash } of checked) {
    const target = path.join(output, asset.file);
    if (fs.existsSync(target) && sha(target) !== hash) throw new Error(`Refusing to overwrite different bytes: ${target}`);
    if (!fs.existsSync(target)) fs.copyFileSync(file, target);
    if (sha(target) !== hash) throw new Error(`Copy verification failed: ${target}`);
  }
  fs.copyFileSync(manifestPath, path.join(output, 'manifest.json'));
  if (fs.existsSync(path.join(library.source, 'index.html'))) fs.copyFileSync(path.join(library.source, 'index.html'), path.join(output, 'index.html'));
  const assets = checked.map(({ asset, file, hash }) => ({ ...asset, originalApprovedPath: file, deliveryPath: path.join(output, asset.file), fileSha256: hash, deliveryStatus: library.status }));
  report.libraries.push({ folder: library.name, status: library.status, count: assets.length, assets });
}
fs.writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(path.join(destination, 'README.txt'), '透明素材交付\n\napproved/：当前正式审核清单中的所有PNG，可供图转3D输入。每项完整来源、提示词、哈希保存在manifest.json。\nhistorical-ark-for-review/：旧方舟库完整保留，需按当前单主体/透明度标准逐项复核后再用于3D。\n顶层manifest.json是最新交付范围；目录外的候选与失败图不属于合格交付。T7必须挂载，项目原路径由链接保留。\n');
fs.writeFileSync(path.join(destination, 'index.html'), '<!doctype html><meta charset="utf-8"><title>Cutout delivery</title><style>body{font:18px system-ui;background:#14202b;color:#f7efde;max-width:850px;margin:60px auto;padding:24px}a{color:#f3c66c}li{margin:24px 0}</style><h1>透明素材交付</h1><p>既有素材与本批新增合格素材在同一份正式清单中。每张保留来源、完整提示词与SHA。</p><ul>' + report.libraries.map(x => `<li><a href="${x.folder}/index.html">${x.folder}: ${x.count} PNG</a>${x.folder === 'approved' ? ' — 当前审核通过' : ' — 历史素材待复核'}</li>`).join('') + '</ul><p><a href="manifest.json">完整交付清单</a></p>');
console.log(JSON.stringify({ destination, libraries: report.libraries.map(({ folder, count, status }) => ({ folder, count, status })) }, null, 2));
