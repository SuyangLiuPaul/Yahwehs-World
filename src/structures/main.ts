import * as THREE from 'three';
import './style.css';
import { CUBITS, STRUCTURES, metres, type Structure } from './specs.ts';
import { buildStructure, footprint, humanFigure } from './build.ts';

// One WebGL context behind a scroll-snapped feed. Each card owns a structure;
// scrolling swaps what the single scene holds, which keeps one context no
// matter how many cards the feed grows to.

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const viewport = () => ({ w: Math.max(1, innerWidth), h: Math.max(1, innerHeight) });

const scene = new THREE.Scene();
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

let current = -1;

function show(index: number, cubitM: number) {
  const s = STRUCTURES[index];
  if (!s) return;
  stage.clear();

  const span = footprint(s, cubitM);
  const k = VIEW / span;

  const model = buildStructure(s, cubitM);
  model.scale.setScalar(k);
  stage.add(model);

  // The figure is always present, even where it becomes invisible — a person
  // vanishing next to the object is the honest reading of that object's size.
  const person = humanFigure();
  person.scale.setScalar(k);
  const halfLength = metres(s.dims.find((d) => d.key === 'length')?.cubits ?? 0, s, cubitM) / 2;
  person.position.set((halfLength + 1.2 / k) * k, 0, (span * 0.55) * k);
  stage.add(person);

  const grid = new THREE.GridHelper(VIEW * 2.4, 24, 0x24354a, 0x16222f);
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.35;
  stage.add(grid);

  current = index;
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

  const own = Math.max(...s.dims.map((d) => metres(d.cubits, s, cubitM)));
  const rows = [{ zh: s.zh, m: own, self: true }, ...s.compare.map((c) => ({ ...c, self: false }))]
    .sort((a, b) => b.m - a.m);
  const max = rows[0]!.m;
  const compare = rows.map((r) => `<div class="row${r.self ? ' self' : ''}">
      <span class="label">${r.zh}<span class="track"><i style="width:${(r.m / max * 100).toFixed(1)}%"></i></span></span>
      <span class="v">${fmt(r.m)}</span></div>`).join('');

  return `<section class="card" data-i="${STRUCTURES.indexOf(s)}"><div class="inner">
    <p class="eyebrow">照着经文的尺寸</p>
    <h1>${s.zh}</h1>
    <p class="en">${s.en}</p>
    <blockquote>${s.textZh}<cite>${s.refZh}　·　${s.ref}</cite></blockquote>
    <table><tbody>${dimRows}</tbody></table>
    <p class="punch">${s.punchZh.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>
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
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  if (!reduced) stage.rotation.y = t * 0.16;

  // Wide screens put the panel on the left, so the model is pushed right into
  // the free half; narrow screens stack it above the sheet instead.
  // Framed so the whole structure clears the panel and still fits the frame:
  // the object spans VIEW units, so the camera has to stand back far enough
  // that VIEW plus the sideways offset both stay inside the view cone.
  const wide = innerWidth >= 900;
  const dist = VIEW * (wide ? 1.75 : 1.95);
  const lookX = wide ? VIEW * 0.22 : 0;
  camera.position.set(lookX - VIEW * (wide ? 0.10 : 0), VIEW * (wide ? 0.5 : 0.62), dist);
  camera.lookAt(lookX, VIEW * (wide ? 0.1 : 0.3), 0);
  renderer.render(scene, camera);
});

fit();
applyCubit();
show(0, CUBITS[0]!.m);

if (import.meta.env.DEV) {
  (globalThis as unknown as Record<string, unknown>).__structures = {
    scene, camera, stage, STRUCTURES, CUBITS, show,
    get current() { return current; },
  };
}
