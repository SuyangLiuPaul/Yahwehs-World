// Authored scene manifests in data/scenes/ → one slim file the browser fetches.
//
// The authored file keeps the whole provenance: the exact style clause, the
// per-scene prompt, the model, the passage the scene was written from, and the
// statement that these are an artist's impression rather than a reconstruction.
// None of that belongs in the payload; what ships is the filename and the
// caption. Keeping them apart is what lets the prompts be edited and the set
// regenerated without touching the site.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const out = {};
let total = 0;
for (const f of readdirSync('data/scenes').filter((n) => n.endsWith('.json'))) {
  const doc = JSON.parse(readFileSync(`data/scenes/${f}`, 'utf8'));
  // This folder also holds provenance for assets that are not a journey's
  // plates — the ship model's record lives here too, and has no scenes.
  if (!doc._meta?.journey || !Array.isArray(doc.scenes)) continue;
  const id = doc._meta.journey;
  const slim = (s) => ({ file: s.file, en: s.captionEn, zh: s.captionZh, ...(s.ref ? { ref: s.ref } : {}) });
  out[id] = { stops: Object.fromEntries(doc.scenes.map((s) => [s.n, slim(s)])) };
  // An epilogue is not a stop: it belongs to a passage beyond the route, shows
  // only once the reader has finished, and always prints its own reference.
  if (doc.epilogue) out[id].epilogue = slim(doc.epilogue);
  total += doc.scenes.length + (doc.epilogue ? 1 : 0);
  console.log(`${id.padEnd(14)} ${doc.scenes.length} scenes${doc.epilogue ? ' + epilogue' : ''}`);
}
writeFileSync('public/data/scenes.json', JSON.stringify({
  meta: {
    note: 'Artist’s impressions, not archaeological reconstructions. Provenance and prompts in data/scenes/.',
    credit: { en: 'Artist’s impression', zh: '画家的想象' },
  },
  journeys: out,
}));
console.log(`\npublic/data/scenes.json — ${total} scenes`);
