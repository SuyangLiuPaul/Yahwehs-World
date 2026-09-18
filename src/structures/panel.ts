import * as THREE from 'three';
import './panel.css';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CUBITS, STRUCTURES, measuresHref, metres, type Structure } from './specs.ts';
import { buildStructure, footprint, humanFigure } from './build.ts';
import type { BranchForm } from './menorah.ts';
import { hant, onLocale, t } from '../locale.ts';

// The measurement cards, as a panel any page can open.
//
// This was /structures.html: a feed of cards over one WebGL context, each card
// a thing Scripture measures. The owner's decision was that the page goes and
// the cards move into the walk you are standing in — the ark of the covenant's
// dimensions belong in the most holy place, not on a separate tab. So this is
// that page with its viewport taken away: same cards, same builders, same
// cubit argument, four callers (three walks and the Plan page) instead of one.
//
// It is ONE module rather than three copies because the three walks would
// otherwise agree only until somebody edited one of them. specs.ts says which
// cards each caller gets; nothing here knows the names of any of them.

/** What a caller has to hand over: the cards, the dialog to fill, and the
 *  buttons that open it. */
export interface MeasuresOptions {
  cards: Structure[];
  dialog: HTMLDialogElement;
  /** Anything that opens the panel. Missing elements are skipped, so a page
   *  that has no gate does not have to pretend it does. */
  openers: (Element | null)[];
  /** Run just before the panel opens — the walks pause their tour, because a
   *  camera still flying behind a modal is a tour the reader is missing. */
  beforeOpen?: () => void;
}

/** Remembered across the three walks: it is the same question on all of them,
 *  and a reader who decided the cubit is 51.8 cm did not decide it per page. */
const CUBIT_KEY = 'ydh.cubit';
function rememberedCubit(): number {
  try {
    const i = Number(localStorage.getItem(CUBIT_KEY));
    return Number.isInteger(i) && i >= 0 && i < CUBITS.length ? i : 0;
  } catch { return 0; }
}
function rememberCubit(i: number) {
  try { localStorage.setItem(CUBIT_KEY, String(i)); } catch { /* private window */ }
}

const fmt = (m: number) =>
  m >= 1000 ? `${(m / 1000).toLocaleString('zh-CN', { maximumFractionDigits: 0 })} 公里`
            : `${m.toLocaleString('zh-CN', { maximumFractionDigits: m < 10 ? 2 : 1 })} 米`;

export function installMeasures(o: MeasuresOptions) {
  const { cards, dialog } = o;
  if (!dialog || !cards.length) return;

  dialog.innerHTML = `<div class="mp-shell">
    <header class="mp-head">
      <h2 class="mp-title"></h2>
      <p class="mp-lede"></p>
      <form method="dialog"><button class="dialog-close"></button></form>
    </header>
    <div class="mp-cubit">
      <label for="mp-c-range"><span class="mp-c-label"></span> <b id="mp-c-val"></b></label>
      <input id="mp-c-range" type="range" min="0" max="${CUBITS.length - 1}" step="1" value="0">
      <p id="mp-c-note"></p>
    </div>
    <div class="mp-body">
      <div class="mp-stage"><canvas></canvas></div>
      <div class="mp-feed"></div>
    </div>
  </div>`;

  const body = dialog.querySelector('.mp-body') as HTMLElement;
  const feed = dialog.querySelector('.mp-feed') as HTMLElement;
  const canvas = dialog.querySelector('.mp-stage canvas') as HTMLCanvasElement;
  const range = dialog.querySelector('#mp-c-range') as HTMLInputElement;
  const cubitVal = dialog.querySelector('#mp-c-val') as HTMLElement;
  const cubitNote = dialog.querySelector('#mp-c-note') as HTMLElement;
  range.value = String(rememberedCubit());
  // A slider that governs nothing on screen is a false offer. New Jerusalem is
  // measured in stadia (Rev 21:16), so on a panel holding only cards like that
  // the cubit has no card to resize and the control is not shown.
  if (cards.every((s) => s.unit)) (dialog.querySelector('.mp-cubit') as HTMLElement).hidden = true;

  // ── the scene ───────────────────────────────────────────────────────────
  // Built on first open, not on load. A walk page already holds a WebGL
  // context with a post-processing chain on it; a second one for a panel most
  // readers never open is a context and a PMREM pass spent on nothing.
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let stage: THREE.Group;
  const bounds = new THREE.Box3();
  const boundsCentre = new THREE.Vector3();
  const boundsSize = new THREE.Vector3();
  const clock = new THREE.Clock();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Everything is built in real metres and then normalised into a fixed view
  // box, so a 1.1 m chest and a 2,220 km cube both frame correctly and neither
  // runs into float precision.
  const VIEW = 9;

  function buildScene() {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Metal is defined by what it reflects. Without an environment the gold of
    // the lampstand renders as flat brown, so the scene generates one
    // procedurally — no HDRI file, nothing to license, nothing to download.
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    camera = new THREE.PerspectiveCamera(38, 1, 0.05, 500);
    scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const key = new THREE.DirectionalLight(0xfff0d0, 2.1);
    key.position.set(6, 9, 7);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x7fa8cc, 0.85);
    rim.position.set(-7, 3, -5);
    scene.add(rim);

    stage = new THREE.Group();
    scene.add(stage);
  }

  let current = -1;
  const variantChoice = new Map<string, string>();

  function show(index: number, cubitM: number) {
    const s = cards[index];
    if (!s) return;
    if (!renderer) buildScene();
    stage.clear();

    const span = footprint(s, cubitM);
    const k = VIEW / span;

    const model = buildStructure(s, cubitM, (variantChoice.get(s.id) ?? 'arch') as BranchForm);
    model.scale.setScalar(k);
    stage.add(model);

    // The figure is always present, even where it becomes invisible — a person
    // vanishing next to the object is the honest reading of that object's size.
    // The figure stands BESIDE the object on the same ground line, not in front
    // of it — put it nearer the camera and perspective alone makes a 1.7 m
    // person tower over a 1.5 m lampstand, which is exactly the wrong reading.
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

  // Framing is state, not a side effect of the render loop. Computing it inside
  // the loop meant anything running without rAF — an offscreen snapshot, a
  // dialog opened in a background tab — saw the camera at its construction
  // default, sitting inside the model.
  //
  // Wide panels put the cards on the right and give the model the rest;
  // narrow ones stack the model above them. Either way the camera stands back
  // far enough that VIEW plus the sideways offset stay in the cone.
  function frameCamera(aspectW = canvas.clientWidth, aspectH = canvas.clientHeight) {
    if (bounds.isEmpty()) return;
    const aspect = Math.max(0.3, (aspectW || 1) / (aspectH || 1));
    const vFov = (camera.fov * Math.PI) / 180;
    const fitH = (boundsSize.y * 0.5) / Math.tan(vFov / 2);
    const fitW = (boundsSize.x * 0.5) / (Math.tan(vFov / 2) * aspect * 0.86);
    const dist = Math.max(fitH, fitW) * 1.12 + boundsSize.z * 0.5;

    camera.position.set(boundsCentre.x, boundsCentre.y + dist * 0.22, dist);
    camera.lookAt(boundsCentre.x, boundsCentre.y, 0);
  }

  function fit() {
    if (!renderer) return;
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    frameCamera(w, h);
  }

  let looping = false;
  function loop() {
    if (!looping || !renderer) return;
    const t2 = clock.getElapsedTime();
    if (!reduced) stage.rotation.y = t2 * 0.16;
    frameCamera();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  // ── the cards ───────────────────────────────────────────────────────────
  function cardHtml(s: Structure, cubitM: number) {
    const dimRows = s.dims.map((d) => `<tr>
      <th>${d.zh}</th>
      <td class="n">${d.cubits.toLocaleString()} ${s.unit ? s.unit.zh : '肘'}</td>
      <td class="m">${fmt(metres(d.cubits, s, cubitM))}</td>
      <td class="r">${d.ref}</td></tr>`).join('');

    // The card exists to answer one question — how big is this actually — so
    // that answer leads, at a size nothing else on the card competes with. The
    // cubit figure sits under it because the conversion is the interesting
    // part: one is what the text says, the other is what it means.
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
        ${s.variants.options.map((oo) => `<button type="button" class="vbtn${oo.id === chosen ? ' on' : ''}" data-v="${oo.id}">
          <b>${oo.zh}</b><span>${oo.note}</span></button>`).join('')}
      </div>` : '';

    // The way back to the globe, by the verse this card already cites. The
    // globe owns the 1,443 events and resolves the citation to one of them
    // (see src/bridges.ts and the hash handler in src/main.ts) — the panel
    // stays a panel about measurements and downloads no event data to link.
    const backLink = `<a class="s-back" href="/#ref=${encodeURIComponent(s.ref)}">在圣经世界看这段经文 ↗</a>`;

    return `<section class="mp-card" data-i="${cards.indexOf(s)}" data-id="${s.id}"><div class="inner">
      <p class="eyebrow">照着经文的尺寸</p>
      <h1>${s.zh}</h1>
      <p class="en">${s.en}</p>
      ${backLink}
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
    const cubitM = CUBITS[Number(range.value)]!.m;
    // The card bodies are written in Chinese whatever the interface language,
    // so the whole card is converted here rather than string by string. hant()
    // looks up each run of Chinese in the markup, leaving the tags alone.
    feed.innerHTML = hant(cards.map((s) => cardHtml(s, cubitM)).join(''));
    observeCards();
  }

  // The active card drives the scene. An observer beats a scroll handler here:
  // it fires only on the crossings that matter and costs nothing between them.
  // It watches the panel's own scroll box, not the viewport — inside a dialog
  // the viewport never scrolls, so the default root saw every card at once and
  // the model stayed on whichever one resolved last.
  let observer: IntersectionObserver | null = null;
  function observeCards() {
    observer?.disconnect();
    observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const i = Number((e.target as HTMLElement).dataset.i);
        if (i !== current) show(i, CUBITS[Number(range.value)]!.m);
      }
    }, { root: body, threshold: 0.5 });
    feed.querySelectorAll('.mp-card').forEach((el) => observer!.observe(el));
  }

  function applyCubit() {
    const c = CUBITS[Number(range.value)]!;
    cubitVal.textContent = t(`${(c.m * 100).toFixed(1)} cm · ${c.en}`,
      hant(`${(c.m * 100).toFixed(1)} 厘米 · ${c.zh}`));
    cubitNote.textContent = hant(c.note);
    const keep = current;
    renderFeed();
    if (keep >= 0) show(keep, c.m);
  }
  range.addEventListener('input', () => { rememberCubit(Number(range.value)); applyCubit(); });

  // Switching reconstruction rebuilds the model in place — the counts and the
  // verses do not change, only the shape the text left open.
  feed.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.vbtn') as HTMLElement | null;
    if (!btn) return;
    const holder = btn.closest('.variant') as HTMLElement;
    variantChoice.set(holder.dataset.id!, btn.dataset.v!);
    holder.querySelectorAll('.vbtn').forEach((b) => b.classList.toggle('on', b === btn));
    const i = cards.findIndex((s) => s.id === holder.dataset.id);
    if (i >= 0) show(i, CUBITS[Number(range.value)]!.m);
  });

  // ── the chrome, which IS bilingual ──────────────────────────────────────
  // Translating eight passages, their punch lines and their unstated notes is
  // authoring rather than wiring, and a half-translated card would be worse
  // than an honest monolingual one. So the panel says in English that the
  // cards are in Chinese, rather than letting a reader discover it.
  function applyLocale() {
    (dialog.querySelector('.mp-title') as HTMLElement).textContent =
      t('Built to the measurements', hant('照着经文的尺寸'));
    (dialog.querySelector('.mp-lede') as HTMLElement).textContent = t(
      'Every number here is one the text states, with the verse that states it. The card bodies are in Chinese.',
      hant('这里的每一个数字都是经文明记的，并且注明出处。'));
    (dialog.querySelector('.dialog-close') as HTMLElement).textContent = t('Close', hant('关闭'));
    (dialog.querySelector('.mp-c-label') as HTMLElement).textContent = t('One cubit =', hant('一肘 ='));
    applyCubit();
  }

  // ── opening ─────────────────────────────────────────────────────────────
  function scrollTo(id: string) {
    const card = feed.querySelector(`.mp-card[data-id="${CSS.escape(id)}"]`) as HTMLElement | null;
    if (!card) return;
    // The stage is sticky at the top of the same scroll box, so scrolling the
    // card to `start` puts it under the model rather than behind it.
    body.scrollTop = card.offsetTop - feed.offsetTop;
    const i = cards.findIndex((s) => s.id === id);
    if (i >= 0) show(i, CUBITS[Number(range.value)]!.m);
  }

  function open(id?: string) {
    o.beforeOpen?.();
    if (!dialog.open) dialog.showModal();
    if (current < 0) show(0, CUBITS[Number(range.value)]!.m);
    // A dialog has no layout until it is open, so the canvas has no size to
    // fit to until after showModal(). Fitting before it renders the first
    // frame at 1×1 and the reader sees an empty box for a beat.
    fit();
    if (id) scrollTo(id);
    if (!looping) { looping = true; requestAnimationFrame(loop); }
  }
  dialog.addEventListener('close', () => { looping = false; });

  for (const el of o.openers) el?.addEventListener('click', () => open());
  new ResizeObserver(fit).observe(dialog);

  // `#measures=noah` opens on that card; a bare `#measures` opens at the top.
  //
  // A bare structure id is also honoured, because that is what /structures.html
  // took and what the redirect from it still delivers — and if the id belongs
  // to another page, the reader is sent there rather than shown nothing. That
  // is the whole reason the old deep links still work.
  function fromHash() {
    const h = location.hash.slice(1);
    if (!h) return;
    const m = /^measures(?:=(.*))?$/.exec(h);
    const id = m ? decodeURIComponent(m[1] ?? '') : (STRUCTURES.some((s) => s.id === h) ? h : null);
    if (id === null) return;
    if (id && !cards.some((s) => s.id === id)) { location.replace(measuresHref(id)); return; }
    open(id || undefined);
  }
  addEventListener('hashchange', fromHash);

  onLocale(applyLocale);
  applyLocale();
  fromHash();
  return { open };
}
