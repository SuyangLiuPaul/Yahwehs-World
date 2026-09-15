// Lossy format optimization only. Originals and exact generation prompts are
// retained; this does not call an image service, restyle, or invent pixels.
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const provenance=JSON.parse(await readFile(new URL('../handoff/evidence/phase-3/materials/provenance.json',import.meta.url),'utf8'));
for(const asset of provenance.assets){
 execFileSync('cwebp',['-quiet','-q',String(asset.webpQuality),'-m','6',asset.original,'-o',asset.deployed],{cwd:root,stdio:'inherit'});
 console.log(`Optimized ${asset.kind}; source and composition unchanged`);
}
