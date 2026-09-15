import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';

const site=process.env.TEST_URL??'https://yahwehsworld.netlify.app';
const directory=process.env.EVIDENCE_DIR??'handoff/evidence/phase-1/live';
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const assets=new Set(),pages=[];
for(const name of ['index.html','structures.html','tabernacle.html']){
  const expected=await readFile(`dist/${name}`,'utf8');
  const response=await fetch(new URL(name,site),{cache:'no-store'});
  assert.equal(response.status,200,`${name} did not load`);
  const html=await response.text();
  for(const [,path] of expected.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)){
    assert.ok(html.includes(path),`${name} still references an older build`);
    assets.add(path);
  }
  pages.push({name,status:response.status,buildReferencesMatch:true});
}
const verified=[];
// Include lazy scene modules, not only assets linked by the three HTML shells.
for(const name of await readdir('dist/assets'))if(/\.(js|css)$/.test(name))assets.add(`/assets/${name}`);
const materialPaths=(await readdir('dist/materials')).map(name=>`/materials/${name}`);
for(const path of [...assets,'/data/journeys.json','/data/terrain-color.webp','/models/laver.glb',...materialPaths]){
  const expected=await readFile(`dist${path}`);
  const response=await fetch(new URL(path,site),{cache:'no-store'});
  assert.equal(response.status,200,`${path} did not load`);
  const actual=Buffer.from(await response.arrayBuffer());
  assert.equal(hash(actual),hash(expected),`${path} does not match the tested build`);
  const cacheControl=response.headers.get('cache-control');
  if(path.endsWith('journeys.json'))assert.ok(cacheControl?.includes('must-revalidate'),'Stable data is still immutable');
  verified.push({path,sha256:hash(actual),bytes:actual.length,cacheControl});
}
const result={site,sourceCommit,checkedAt:new Date().toISOString(),pages,verified};
await mkdir(directory,{recursive:true});
await writeFile(`${directory}/release.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
