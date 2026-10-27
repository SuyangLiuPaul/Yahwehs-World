#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const rawDir = path.resolve(root, '../assets-scenes/raw');
const outDir = path.join(root, 'public/assets/character-cutouts');
const manifestPath = path.join(outDir, 'manifest.json');
const command = process.argv[2] ?? 'scan';

function readManifest() {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function hashFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function sources() {
  return fs.readdirSync(rawDir)
    // macOS/SMB volumes may expose AppleDouble metadata siblings named
    // `._<image>.png`; they are not source illustrations and often all hash
    // identically. Keep the raw volume untouched, but exclude these sidecars
    // from the event inventory and progress counts.
    .filter(name => !name.startsWith('._') && /\.png$/i.test(name))
    .sort((a, b) => a.localeCompare(b, 'en'))
    .map(name => {
      const absolute = path.join(rawDir, name);
      return { name, eventId: name.replace(/\.png$/i, ''), sha256: hashFile(absolute) };
    });
}

function scan() {
  const manifest = readManifest();
  const reviewed = new Map(manifest.processedSources.map(s => [`${s.eventId}:${s.sha256}`, s]));
  const all = sources();
  const pending = all.filter(s => reviewed.get(`${s.eventId}:${s.sha256}`)?.status !== 'complete');
  const changed = manifest.processedSources.filter(old => {
    const current = all.find(s => s.eventId === old.eventId);
    return current && current.sha256 !== old.sha256;
  });
  console.log(`Raw PNGs: ${all.length}`);
  const complete = all.filter(s => reviewed.get(`${s.eventId}:${s.sha256}`)?.status === 'complete').length;
  const partial = all.filter(s => reviewed.get(`${s.eventId}:${s.sha256}`)?.status === 'partial').length;
  const fresh = all.filter(s => !reviewed.has(`${s.eventId}:${s.sha256}`)).length;
  console.log(`Source illustrations currently in raw/: ${all.length}`);
  console.log(`Fully reviewed sources (safe to skip): ${complete}`);
  console.log(`Partial sources to resume: ${partial}`);
  console.log(`New source versions to inspect: ${fresh}`);
  if (changed.length) console.log(`Changed since prior review: ${changed.map(s => s.eventId).join(', ')}`);
  for (const item of pending) {
    const status = reviewed.has(`${item.eventId}:${item.sha256}`) ? 'RESUME' : 'NEW';
    console.log(`${status}\t${item.eventId}\t${item.sha256}\t${path.join(rawDir, item.eventId + '.png')}`);
  }
}

function buildIndex() {
  const manifest = readManifest();
  const json = JSON.stringify(manifest).replaceAll('<', '\\u003c');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Yahweh's World · Character Cutouts</title>
<style>
:root{color-scheme:dark;--bg:#091522;--panel:#102337;--line:#294158;--ink:#edf2f4;--muted:#9cafbe;--gold:#d7ae4d;--mint:#9de0bd}*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at 50% -20%,#1b3b51,var(--bg) 65%);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}header{max-width:1440px;margin:auto;padding:30px 24px 20px;display:flex;justify-content:space-between;gap:20px;align-items:end}h1{font:600 clamp(25px,4vw,38px)/1.1 Georgia,serif;margin:0 0 8px}.sub{color:var(--muted);max-width:800px}.stats{color:var(--gold);white-space:nowrap}.tools{max-width:1440px;margin:0 auto;padding:0 24px 18px;display:flex;gap:10px;flex-wrap:wrap}input,select,button{background:#0f2234;color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:11px 14px;font:inherit}input{flex:1;min-width:230px}main{max-width:1440px;margin:auto;padding:0 24px 42px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px}.card{overflow:hidden;border:1px solid var(--line);border-radius:14px;background:var(--panel);box-shadow:0 8px 24px #0003}.image{height:270px;padding:14px;display:grid;place-items:center;background-color:#d7d7d7;background-image:linear-gradient(45deg,#bbb 25%,transparent 25%),linear-gradient(-45deg,#bbb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#bbb 75%),linear-gradient(-45deg,transparent 75%,#bbb 75%);background-size:20px 20px;background-position:0 0,0 10px,10px -10px,-10px 0}.image img{max-width:100%;max-height:100%;object-fit:contain;filter:drop-shadow(0 8px 6px #0003)}.meta{padding:13px 14px 15px}.name{font-weight:650}.kind{color:var(--mint);font-size:12px;text-transform:uppercase;letter-spacing:.09em}.src{font-size:12px;color:var(--muted);margin:7px 0 12px;overflow-wrap:anywhere}.row{display:flex;gap:8px}.row a,.row button{font-size:13px;padding:7px 10px;text-decoration:none;cursor:pointer}.row a{color:var(--ink);border:1px solid var(--line);border-radius:8px}.empty{padding:50px 18px;text-align:center;color:var(--muted);border:1px dashed var(--line);border-radius:14px}.none{display:none}dialog{width:min(850px,94vw);max-height:85vh;background:#0d1e2d;color:var(--ink);border:1px solid var(--line);border-radius:14px;padding:20px}dialog::backdrop{background:#02070ccc}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.55 ui-monospace,monospace;color:#d5e2eb}footer{color:var(--muted);font-size:13px;padding:24px 0;border-top:1px solid var(--line);margin-top:28px}@media(max-width:600px){header{align-items:start;flex-direction:column}.image{height:230px}}
</style></head><body><header><div><h1>Character & Animal Cutouts</h1><div class="sub">Reusable transparent subjects extracted from Bible event illustrations. The grid is a local review gallery; each card records its source and complete generation prompt.</div></div><div class="stats" id="stats"></div></header>
<section class="tools"><input id="search" type="search" placeholder="Search name, event, source…"><select id="kind"><option value="">All subjects</option><option value="person">People</option><option value="animal">Animals</option></select><select id="source"><option value="">All events</option></select></section><main><div id="grid" class="grid"></div><div id="empty" class="empty none">No cutouts yet. Run the image-editing workflow, add each completed source and its exact prompt to manifest.json, then rebuild this preview.</div><footer id="foot"></footer></main><dialog id="prompt"><button id="close" style="float:right">Close</button><h2 id="promptTitle">Prompt</h2><pre id="promptText"></pre></dialog>
<script>const manifest=${json};
const $=s=>document.querySelector(s), assets=manifest.assets||[], grid=$('#grid');
const completeSources=manifest.processedSources.filter(s=>s.status==='complete').length, partialSources=manifest.processedSources.filter(s=>s.status==='partial').length;$('#stats').textContent=assets.length+' assets · '+partialSources+' in progress · '+completeSources+' complete';
const events=[...new Set(assets.map(a=>a.sourceEvent||a.eventId||'' ).filter(Boolean))].sort();for(const e of events){const o=document.createElement('option');o.value=e;o.textContent=e;$('#source').append(o)}
function render(){const q=$('#search').value.toLowerCase(),k=$('#kind').value,s=$('#source').value;grid.innerHTML='';const shown=assets.filter(a=>(!k||(k==='person'?a.kind.startsWith('person'):a.kind===k))&&(!s||(a.sourceEvent||a.eventId)===s)&&(!q||[a.name,a.nameZh,a.kind,a.sourceEvent,a.source,a.id].join(' ').toLowerCase().includes(q)));$('#empty').classList.toggle('none',shown.length>0);for(const a of shown){const card=document.createElement('article');card.className='card';const image=document.createElement('div');image.className='image';const img=document.createElement('img');img.loading='lazy';img.src=a.file;img.alt=a.name||a.id;image.append(img);const meta=document.createElement('div');meta.className='meta';const safe=x=>String(x||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));meta.innerHTML='<div class="kind">'+safe(a.kind)+'</div><div class="name">'+safe(a.nameZh||a.name||a.id)+'</div><div class="src">'+safe(a.sourceEvent||a.source||'')+'</div>';const row=document.createElement('div');row.className='row';const dl=document.createElement('a');dl.href=a.file;dl.download='';dl.textContent='PNG';const p=document.createElement('button');p.textContent='Full prompt';p.onclick=()=>{$('#promptTitle').textContent=(a.name||a.id)+' · prompt';$('#promptText').textContent=a.prompt||'';$('#prompt').showModal()};row.append(dl,p);meta.append(row);card.append(image,meta);grid.append(card)}}
$('#search').oninput=render;$('#kind').onchange=render;$('#source').onchange=render;$('#close').onclick=()=>$('#prompt').close();$('#foot').textContent=manifest.scope+' · '+manifest.method+' · Model: '+manifest.model;render();</script></body></html>`;
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  console.log(`Built local preview with ${manifest.assets.length} cutouts.`);
}

function importArkCutouts() {
  const manifest = readManifest();
  const arkDir = path.join(root, 'public/assets/ark-cutouts');
  const arkManifest = JSON.parse(fs.readFileSync(path.join(arkDir, 'manifest.json'), 'utf8'));
  const kinds = {
    'noah-guiding': 'person',
    'noah-praying': 'person',
    'man-bearded': 'person',
    'woman-green': 'person',
    'woman-rust': 'person',
    goat: 'animal',
    deer: 'animal',
    rabbit: 'animal',
    'dove-olive': 'animal',
    zebra: 'animal',
    wolf: 'animal',
    'lion-cub': 'animal'
  };
  const namesZh = {
    'noah-guiding': '挪亚引导建造',
    'noah-praying': '挪亚举手祷告',
    'man-bearded': '胡须男子',
    'woman-green': '绿袍妇人',
    'woman-rust': '锈红袍妇人',
    goat: '山羊', deer: '鹿', rabbit: '兔子',
    'dove-olive': '衔橄榄枝的鸽子', zebra: '斑马', wolf: '狼', 'lion-cub': '幼狮'
  };
  let added = 0;
  for (const old of arkManifest.assets) {
    if (!kinds[old.id] || !old.source.startsWith(rawDir + path.sep)) continue;
    const eventId = path.basename(old.source, path.extname(old.source));
    const sourceHash = hashFile(old.source);
    const id = `ark-${old.id}`;
    if (manifest.assets.some(a => a.id === id)) continue;
    const file = `ark-${old.file}`;
    fs.copyFileSync(path.join(arkDir, old.file), path.join(outDir, file));
    manifest.assets.push({
      id,
      file,
      kind: kinds[old.id],
      name: old.id.replaceAll('-', ' '),
      nameZh: namesZh[old.id],
      sourceEvent: eventId,
      source: old.source,
      sourceSha256: sourceHash,
      prompt: [old.prompt, old.correction ? `Correction applied: ${old.correction}` : ''].filter(Boolean).join('\n\n'),
      notes: `Reused from the previously generated Ark cutout; original full prompt retained. ${old.notes ?? ''}`.trim()
    });
    added++;
    const existing = manifest.processedSources.findIndex(s => s.eventId === eventId && s.sha256 === sourceHash);
    const record = {
      eventId,
      source: old.source,
      sha256: sourceHash,
      status: 'partial',
      reviewedAt: new Date().toISOString().slice(0, 10),
      note: 'Existing Ark cutouts imported for reuse; full event-wide people/animal coverage is not yet verified.'
    };
    if (existing < 0) manifest.processedSources.push(record);
    else manifest.processedSources[existing] = { ...manifest.processedSources[existing], ...record };
  }
  manifest.updated = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Imported ${added} eligible people/animal cutouts from the earlier Ark library.`);
}

if (command === 'scan') scan();
else if (command === 'build-index') buildIndex();
else if (command === 'set-status') {
  const [, , , eventId, status, ...noteParts] = process.argv;
  if (!eventId || !['partial', 'complete'].includes(status)) {
    console.error('Usage: node tools/scenes/character-cutouts.mjs set-status <eventId> <partial|complete> "review note"');
    process.exitCode = 2;
  } else {
    const manifest = readManifest();
    const current = sources().find(s => s.eventId === eventId);
    if (!current) {
      console.error(`No raw PNG found for ${eventId}`);
      process.exitCode = 1;
    } else {
      const note = noteParts.join(' ').trim();
      const record = {
        eventId,
        source: path.join(rawDir, `${eventId}.png`),
        sha256: current.sha256,
        status,
        reviewedAt: new Date().toISOString().slice(0, 10),
        ...(note ? { note } : {})
      };
      const index = manifest.processedSources.findIndex(s => s.eventId === eventId && s.sha256 === current.sha256);
      if (index < 0) manifest.processedSources.push(record);
      else manifest.processedSources[index] = record;
      manifest.updated = record.reviewedAt;
      fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      console.log(`${eventId}: ${status} (${current.sha256})`);
    }
  }
}
else if (command === 'import-ark') importArkCutouts();
else if (command === 'help') console.log('Usage: node tools/scenes/character-cutouts.mjs [scan|build-index|import-ark|set-status <eventId> <partial|complete> "review note"]');
else { console.error(`Unknown command: ${command}`); process.exitCode = 2; }
