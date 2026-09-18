import './tokens.css';
import './nav.css';
import './figures.css';
import { CATALOGUE, KINDS, BUILT, type Item } from './catalogue.ts';
import { applyStatic, bindSwitch, hant, onLocale, t } from './locale.ts';
import { installSiteMenu, loadingStep, loadingSteps, pageReady } from './site-shell.ts';

// THE DOOR INTO EVERYTHING THAT HAS BEEN BUILT.
//
// Fifteen models were in the repository and four of them had never appeared on
// a screen. A reader could only meet the priest by walking into a room he does
// not yet stand in. This page is the register made visible: every model, at the
// height it is actually scaled to, with the verse it stands on and the part of
// it that is a display choice rather than the text's.
//
// The grid is PICTURES and the viewer is ONE live context. Fifteen canvases
// would exhaust the browser's WebGL contexts and download fifteen megabytes to
// show fifteen thumbnails.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const m = (n: number) => `${n.toFixed(2).replace(/\.?0+$/, '')} m`;

function cards(kind: Item['kind']) {
  return CATALOGUE.filter((i) => i.kind === kind).map((i) => `
    <button type="button" class="g-card" data-id="${i.id}">
      <img src="/figures/${i.id}.jpg" alt="" width="600" height="760" loading="lazy" decoding="async">
      <span class="g-h">${m(i.height)}</span>
      <span class="g-name">${t(i.en, hant(i.zh))}</span>
      ${i.ref ? `<span class="g-ref">${t(i.ref, i.refZh ?? i.ref)}</span>` : ''}
      <span class="g-where">${t(i.whereEn, hant(i.whereZh))}</span>
    </button>`).join('');
}

function render() {
  $('g-title').textContent = t('People and creatures', hant('人物与活物'));
  $('g-lede').innerHTML = t(
    `Every model this app has built, at the size it is actually scaled to. Nothing here is a picture of somebody: the forms are generic, they identify no individual, and where the text does not name a kind the species is a display choice and the card says so. <b>${CATALOGUE.length} models today.</b>`,
    hant(`这个应用已经做出来的全部模型，按它们真实被缩放到的大小显示。这里没有一个是某个人的画像：形象都是通用的，不指任何个人；经文没有点名的种类，是展示选择，卡片上会写明。<b>目前 ${CATALOGUE.length} 个模型。</b>`));

  $('g-kinds').innerHTML = KINDS.map((k) => `
    <section class="g-kind">
      <h2>${t(k.en, hant(k.zh))} <i>${CATALOGUE.filter((i) => i.kind === k.key).length}</i></h2>
      <p class="g-what">${t(k.whatEn, hant(k.whatZh))}</p>
      <div class="g-grid">${cards(k.key)}</div>
    </section>`).join('');

  $('g-built-title').textContent = t('Written as geometry, not generated', hant('照尺寸写出来的，不是生成的'));
  $('g-built-what').textContent = t(
    'The buildings are not on the list above and never will be. Scripture measures them — three hundred cubits, sixty cubits, ten cubits from brim to brim — and a measurement is something you write, not something you ask a model for. These are built from the numbers, and you walk into them.',
    hant('上面的名单里没有建筑，以后也不会有。经文把它们量过了——三百肘、六十肘、从这边到那边十肘——凡有尺寸的就该照着写出来，而不是向模型要一个。下面这几样是照数目建起来的，可以走进去。'));
  $('g-built-list').innerHTML = BUILT.map((b) => `
    <a class="g-built-card" href="${b.href}">
      <span class="g-name">${t(b.en, hant(b.zh))}</span>
      <span class="g-ref">${t(b.refEn, hant(b.refZh))}</span>
      <span class="g-go">${t('Walk in →', hant('走进去 →'))}</span>
    </a>`).join('');

  $('g-note').textContent = t(
    'Models are generated and then measured — the generator returns a mesh at whatever size it likes, and every one of them is scaled to a stated height and stood on the ground before it is allowed into a scene. Heights live in src/walk/figures.ts; provenance, including the jobs that were thrown away, in handoff/MANIFEST-assets.md.',
    hant('模型是生成出来的，生成之后再量：生成器返回的网格大小是随意的，每一个都要按册上写明的高度缩放、并且站到地面上，才准进场景。高度记在 src/walk/figures.ts；来源——包括废掉的那几次——记在 handoff/MANIFEST-assets.md。'));
  applyStatic();
}

// ── the one live viewer ──────────────────────────────────────────────────

const view = $<HTMLDialogElement>('g-view');
let spin: number | null = null;
let three: typeof import('./figures-view.ts') | null = null;

async function open(item: Item) {
  $('gv-name').textContent = t(item.en, hant(item.zh));
  $('gv-where').textContent = t(item.whereEn, hant(item.whereZh));
  $('gv-note').textContent = t(item.noteEn, hant(item.noteZh));
  const facts: [string, string][] = [[t('Stands', hant('立起来')), m(item.height)]];
  if (item.withers) facts.push([t('At the shoulder', hant('肩高')), m(item.withers)]);
  if (item.ref) facts.push([t('Verse', hant('经文')), t(item.ref, item.refZh ?? item.ref)]);
  $('gv-facts').innerHTML = facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  $('gv-loading').textContent = t('Loading the model…', hant('模型加载中…'));
  $('gv-loading').hidden = false;
  view.showModal();
  // The viewer's three.js is loaded only when a reader opens one, so the page
  // itself costs no WebGL and no 600 kB of library to browse the grid.
  three ??= await import('./figures-view.ts');
  spin = await three.show($<HTMLCanvasElement>('gv-canvas'), `/models/${item.id}.glb`, item.height);
  $('gv-loading').hidden = true;
}

function close() {
  if (spin !== null && three) three.stop(spin);
  spin = null;
  view.close();
}

document.addEventListener('click', (e) => {
  const card = (e.target as HTMLElement).closest('.g-card') as HTMLElement | null;
  if (card) {
    const item = CATALOGUE.find((i) => i.id === card.dataset.id);
    if (item) void open(item);
  }
  if ((e.target as HTMLElement).id === 'gv-close') close();
});
view.addEventListener('close', close);
view.addEventListener('click', (e) => { if (e.target === view) close(); });

// ── standing up ──────────────────────────────────────────────────────────

loadingSteps(2);
render();
loadingStep();
bindSwitch(document.querySelector('.lang-switch') as HTMLElement);
onLocale(() => { render(); });
installSiteMenu();
loadingStep();
// Wait for the pictures that are already on screen, so the page is not handed
// over as a grid of empty boxes — which is the fault this loading screen was
// built to stop in the first place.
void Promise.all([document.fonts.ready, ...Array.from(document.images)
  .filter((i) => !i.complete)
  .slice(0, 8)
  .map((i) => new Promise((r) => { i.addEventListener('load', r); i.addEventListener('error', r); }))])
  .then(() => pageReady());
setTimeout(pageReady, 4000);
