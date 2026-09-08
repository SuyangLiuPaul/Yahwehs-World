import * as THREE from 'three';
import './style.css';
import { CUBITS, STRUCTURES, metres, type Structure } from './specs.ts';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildStructure, footprint, humanFigure } from './build.ts';
import type { BranchForm } from './menorah.ts';

// One WebGL context behind a scroll-snapped feed. Each card owns a structure;
// scrolling swaps what the single scene holds, which keeps one context no
// matter how many cards the feed grows to.

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
// Metal is defined by what it reflects. Without an environment the gold of the
// lampstand renders as flat brown, so the scene generates one procedurally —
// no HDRI file, nothing to license, nothing to download.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const viewport = () => ({ w: Math.max(1, innerWidth), h: Math.max(1, innerHeight) });

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(38, viewport().w / viewport().h, 0.05, 500);

scene.add(new THREE.AmbientLight(0xffffff, 1.15));
const key = new THREE.DirectionalLight(0xfff0d0, 2.1);
key.position.set(6, 9, 7);
scene.add(key);
const rim = new THREE.DirectionalLight(0x7fa8cc, 0.85);
rim.position.set(-7, 3, -5);
scene.add(rim);

// Everything is built in real metres and then normalised into a fixed view box,
// so a 1.1 m chest and a 2,220 km cube both frame correctly and neither runs
// into float precision.
const VIEW = 9;
const stage = new THREE.Group();
scene.add(stage);

/** Bounds of whatever is currently staged, refreshed on every build. Framing
 *  reads from this instead of assuming a shape, so a 134 m barge and a 1.5 m
 *  lampstand both sit correctly in frame. */
const bounds = new THREE.Box3();
const boundsCentre = new THREE.Vector3();
const boundsSize = new THREE.Vector3();

let current = -1;
const variantChoice = new Map<string, string>();

function show(index: number, cubitM: number) {
  const s = STRUCTURES[index];
  if (!s) return;
  stage.clear();

  const span = footprint(s, cubitM);
  const k = VIEW / span;

  const model = buildStructure(s, cubitM, (variantChoice.get(s.id) ?? 'arch') as BranchForm);
  model.scale.setScalar(k);
  stage.add(model);

  // The figure is always present, even where it becomes invisible — a person
  // vanishing next to the object is the honest reading of that object's size.
  // The figure stands BESIDE the object on the same ground line, not in front
  // of it — put it nearer the camera and perspective alone makes a 1.7 m person
  // tower over a 1.5 m lampstand, which is exactly the wrong reading.
  const modelBox = new THREE.Box3().setFromObject(model);
  const person = humanFigure();
  person.scale.setScalar(k);
  person.position.set(modelBox.max.x + 1.7 * k * 0.75, 0, 0);
  stage.add(person);

  const grid = new THREE.GridHelper(VIEW * 2.6, 26, 0x24354a, 0x16222f);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.3;
  stage.add(grid);

  bounds.setFromObject(model).expandByPoint(person.position);
  bounds.getCenter(boundsCentre);
  bounds.getSize(boundsSize);

  current = index;
  frameCamera();
}

// ── the feed ──────────────────────────────────────────────────────────────
const feed = document.getElementById('feed')!;
const cubitRange = document.getElementById('c-range') as HTMLInputElement;
const cubitVal = document.getElementById('c-val')!;
const cubitNote = document.getElementById('c-note')!;

const fmt = (m: number) =>
  m >= 1000 ? `${(m / 1000).toLocaleString('zh-CN', { maximumFractionDigits: 0 })} 公里`
            : `${m.toLocaleString('zh-CN', { maximumFractionDigits: m < 10 ? 2 : 1 })} 米`;

function cardHtml(s: Structure, cubitM: number) {
  const dimRows = s.dims.map((d) => `<tr>
    <th>${d.zh}</th>
    <td class="n">${d.cubits.toLocaleString()} ${s.unit ? s.unit.zh : '肘'}</td>
    <td class="m">${fmt(metres(d.cubits, s, cubitM))}</td>
    <td class="r">${d.ref}</td></tr>`).join('');

  // The card exists to answer one question — how big is this actually — so
  // that answer leads, at a size nothing else on the card competes with. The
  // cubit figure sits under it because the conversion is the interesting part:
  // one is what the text says, the other is what it means.
  const lead = s.dims.length
    ? (() => {
        const biggest = s.dims.reduce((a, b) => (b.cubits > a.cubits ? b : a));
        return `<div class="lead">
          <b>${fmt(metres(biggest.cubits, s, cubitM))}</b>
          <span>${biggest.zh} · ${biggest.cubits.toLocaleString()} ${s.unit ? s.unit.zh : '肘'}</span>
        </div>`;
      })()
    : `<div class="lead none"><b>经文未给尺寸</b><span>数量却记得极清楚</span></div>`;

  const own = Math.max(...s.dims.map((d) => metres(d.cubits, s, cubitM)));
  const rows = [{ zh: s.zh, m: own, self: true }, ...s.compare.map((c) => ({ ...c, self: false }))]
    .sort((a, b) => b.m - a.m);
  const max = rows[0]!.m;
  const compare = rows.map((r) => `<div class="row${r.self ? ' self' : ''}">
      <span class="label">${r.zh}<span class="track"><i style="width:${(r.m / max * 100).toFixed(1)}%"></i></span></span>
      <span class="v">${fmt(r.m)}</span></div>`).join('');

  const countRows = (s.counts ?? []).map((c) => `<tr>
    <th>${c.zh}</th><td class="n">${c.n}</td><td class="m">经文明记</td><td class="r">${c.ref}</td></tr>`).join('');

  const chosen = variantChoice.get(s.id) ?? s.variants?.options[0]?.id ?? '';
  const variant = s.variants ? `<div class="variant" data-id="${s.id}">
      <p class="vlabel">${s.variants.zh} —— 经文没有说，两种依据都在</p>
      ${s.variants.options.map((o) => `<button type="button" class="vbtn${o.id === chosen ? ' on' : ''}" data-v="${o.id}">
        <b>${o.zh}</b><span>${o.note}</span></button>`).join('')}
    </div>` : '';

  return `<section class="card" data-i="${STRUCTURES.indexOf(s)}"><div class="inner">
    <p class="eyebrow">照着经文的尺寸</p>
    <h1>${s.zh}</h1>
    <p class="en">${s.en}</p>
    ${lead}
    <blockquote>${s.textZh}<cite>${s.refZh}　·　${s.ref}</cite></blockquote>
    <table><tbody>${dimRows}${countRows}</tbody></table>
    ${variant}
    <p class="punch">${s.punchZh.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>
    <h3 class="sec">放在旁边有多大</h3>
    <div class="compare">${compare}</div>
    <details class="unstated"><summary>经文没有给的部分（${s.unstated.length}）</summary>
      <ul>${s.unstated.map((u) => `<li>${u}</li>`).join('')}</ul></details>
  </div></section>`;
}

function renderFeed() {
  const cubitM = CUBITS[Number(cubitRange.value)]!.m;
  feed.innerHTML = STRUCTURES.map((s) => cardHtml(s, cubitM)).join('');
  observeCards();
}

// The active card drives the scene. An observer beats a scroll handler here:
// it fires only on the crossings that matter and costs nothing between them.
let observer: IntersectionObserver | null = null;
function observeCards() {
  observer?.disconnect();
  observer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const i = Number((e.target as HTMLElement).dataset.i);
      if (i !== current) show(i, CUBITS[Number(cubitRange.value)]!.m);
    }
  }, { threshold: 0.5 });
  feed.querySelectorAll('.card').forEach((el) => observer!.observe(el));
}

function applyCubit() {
  const c = CUBITS[Number(cubitRange.value)]!;
  cubitVal.textContent = `${(c.m * 100).toFixed(1)} 厘米 · ${c.zh}`;
  cubitNote.textContent = c.note;
  const keep = current;
  renderFeed();
  if (keep >= 0) show(keep, c.m);
}
cubitRange.addEventListener('input', applyCubit);

// Switching reconstruction rebuilds the model in place — the counts and the
// verses do not change, only the shape the text left open.
feed.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('.vbtn') as HTMLElement | null;
  if (!btn) return;
  const holder = btn.closest('.variant') as HTMLElement;
  variantChoice.set(holder.dataset.id!, btn.dataset.v!);
  holder.querySelectorAll('.vbtn').forEach((b) => b.classList.toggle('on', b === btn));
  const i = STRUCTURES.findIndex((s) => s.id === holder.dataset.id);
  if (i >= 0) show(i, CUBITS[Number(cubitRange.value)]!.m);
});

// ── loop ──────────────────────────────────────────────────────────────────
function fit() {
  const { w, h } = viewport();
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
addEventListener('resize', fit);
new ResizeObserver(fit).observe(document.body);

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clock = new THREE.Clock();
// Framing is state, not a side effect of the render loop. Computing it inside
// the loop meant anything running without rAF — an offscreen snapshot, a page
// that loads in a background tab — saw the camera at its construction default,
// sitting inside the model.
//
// Wide screens put the panel on the left and push the model into the free
// half; narrow screens stack it above the sheet instead. Either way the camera
// stands back far enough that VIEW plus the sideways offset stay in the cone.
function frameCamera(aspectW = innerWidth, aspectH = innerHeight) {
  if (bounds.isEmpty()) return;
  const wide = aspectW >= 900;
  const aspect = Math.max(0.3, (aspectW || 1) / (aspectH || 1));

  // Distance that fits the bounds both ways, then a margin. On wide screens the
  // panel eats the left half, so the model is offset right and framed as if the
  // viewport were narrower than it is.
  const usable = wide ? 0.52 : 0.92;
  const vFov = (camera.fov * Math.PI) / 180;
  const fitH = (boundsSize.y * 0.5) / Math.tan(vFov / 2);
  const fitW = (boundsSize.x * 0.5) / (Math.tan(vFov / 2) * aspect * usable);
  const dist = Math.max(fitH, fitW) * 1.12 + boundsSize.z * 0.5;

  const lookX = boundsCentre.x + (wide ? boundsSize.x * 0.35 : 0);

  // On a narrow screen the card is a sheet across the lower half, and a model
  // framed to the centre of the canvas renders behind it — which is why the
  // phone showed an empty black band above a card and no structure at all.
  // Aiming below the object lifts it into the free space over the sheet.
  const visibleH = 2 * dist * Math.tan(vFov / 2);
  const lookY = boundsCentre.y - (wide ? 0 : visibleH * 0.22);

  camera.position.set(lookX - boundsSize.x * (wide ? 0.12 : 0), lookY + dist * 0.22, dist);
  camera.lookAt(lookX, lookY, 0);
}

renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  if (!reduced) stage.rotation.y = t * 0.16;
  frameCamera();
  renderer.render(scene, camera);
});

fit();
frameCamera();
applyCubit();
show(0, CUBITS[0]!.m);

if (import.meta.env.DEV) {
  (globalThis as unknown as Record<string, unknown>).__structures = {
    scene, camera, stage, renderer, STRUCTURES, CUBITS, show,
    get current() { return current; },
    /** Forces one frame and returns it, so the render can be inspected even
     *  where the page is not being painted (a hidden pane parks rAF). */
    snapshot(w = 1400, h = 900) {
      const prev = { w: renderer.domElement.width, h: renderer.domElement.height };
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      frameCamera(w, h);
      renderer.render(scene, camera);
      const url = renderer.domElement.toDataURL('image/png');
      renderer.setSize(prev.w, prev.h, false);
      return url;
    },
  };
}
