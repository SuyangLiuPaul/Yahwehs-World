import { locale as currentLocale, hant } from './locale.ts';
import type { TrackEvent } from './events-track.ts';

const SCENES_HOST = 'https://yahwehs-scenes.netlify.app';

export function eventThumbUrl(ev: { id: string; img?: 'm' | 'r' } | string, mode?: 'm' | 'r'): string {
  const id = typeof ev === 'string' ? ev : ev.id;
  const m = typeof ev === 'string' ? (mode ?? 'm') : (ev.img ?? 'm');
  return m === 'r'
    ? `${SCENES_HOST}/thumbs/${id}.jpg`
    : `${SCENES_HOST}/merged-thumbs/${id}.jpg`;
}

export function eventFullUrl(ev: { id: string; img?: 'm' | 'r' } | string, mode?: 'm' | 'r'): string {
  const id = typeof ev === 'string' ? ev : ev.id;
  const m = typeof ev === 'string' ? (mode ?? 'm') : (ev.img ?? 'm');
  return m === 'r'
    ? `${SCENES_HOST}/full/${id}.jpg`
    : `${SCENES_HOST}/merged-full/${id}.jpg`;
}

export function eventRawThumbUrl(ev: { id: string } | string): string {
  const id = typeof ev === 'string' ? ev : ev.id;
  return `${SCENES_HOST}/thumbs/${id}.jpg`;
}

export function eventRawFullUrl(ev: { id: string } | string): string {
  const id = typeof ev === 'string' ? ev : ev.id;
  return `${SCENES_HOST}/full/${id}.jpg`;
}

export interface LightboxOptions {
  events: readonly TrackEvent[];
  index: number;
  onSelectOnGlobe?: (ev: TrackEvent) => void;
  isScenesPage?: boolean;
  showLocateOnGlobe?: boolean;
}

let dialogEl: HTMLDialogElement | null = null;
let currentOpts: LightboxOptions | null = null;
let forceRaw = false;

function ensureDialog(): HTMLDialogElement {
  if (dialogEl) return dialogEl;

  const style = document.createElement('style');
  style.textContent = `
    .yw-lightbox {
      width: min(1160px, 95vw);
      max-height: 92vh;
      margin: auto;
      padding: 0;
      border: 1px solid var(--border-strong, rgba(232, 197, 90, 0.38));
      border-radius: 14px;
      background: rgba(14, 17, 24, 0.97);
      color: var(--ink, #ece6d8);
      box-shadow: 0 28px 80px rgba(0, 0, 0, 0.82);
      overflow: hidden;
    }
    .yw-lightbox[open] {
      display: flex;
      flex-direction: column;
    }
    .yw-lightbox::backdrop {
      background: rgba(5, 7, 11, 0.84);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }
    .yw-lb-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 18px;
      border-bottom: 1px solid var(--border-subtle, rgba(232, 197, 90, 0.14));
      background: rgba(20, 24, 33, 0.9);
    }
    .yw-lb-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--gold, #e8c55a);
      letter-spacing: 0.04em;
    }
    .yw-lb-actions-top {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .yw-lb-btn {
      font: inherit;
      font-size: 12px;
      color: var(--ink, #ece6d8);
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border, rgba(232, 197, 90, 0.24));
      border-radius: 8px;
      padding: 6px 12px;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: border-color 140ms, background 140ms, color 140ms;
    }
    .yw-lb-btn:hover {
      border-color: var(--gold, #e8c55a);
      color: var(--gold-bright, #f4dc8c);
      background: rgba(232, 197, 90, 0.12);
    }
    .yw-lb-btn-gold {
      background: rgba(232, 197, 90, 0.16);
      border-color: var(--gold, #e8c55a);
      color: var(--gold-bright, #f4dc8c);
      font-weight: 600;
    }
    .yw-lb-stage {
      position: relative;
      background: #07090d;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 280px;
      max-height: 62vh;
      overflow: hidden;
    }
    .yw-lb-stage img {
      width: 100%;
      max-height: 62vh;
      object-fit: contain;
      display: block;
    }
    .yw-lb-nav {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 1px solid rgba(232, 197, 90, 0.35);
      background: rgba(11, 14, 20, 0.82);
      color: var(--gold-bright, #f4dc8c);
      font-size: 22px;
      line-height: 1;
      display: grid;
      place-items: center;
      cursor: pointer;
      transition: background 140ms, border-color 140ms, transform 140ms;
    }
    .yw-lb-nav:hover:not(:disabled) {
      background: rgba(232, 197, 90, 0.22);
      border-color: var(--gold, #e8c55a);
    }
    .yw-lb-nav:disabled {
      opacity: 0.28;
      cursor: default;
    }
    .yw-lb-prev { left: 14px; }
    .yw-lb-next { right: 14px; }
    .yw-lb-body {
      padding: 16px 20px 18px;
      display: grid;
      gap: 10px;
      overflow-y: auto;
      background: linear-gradient(180deg, rgba(19, 23, 32, 0.98), rgba(14, 17, 24, 0.99));
    }
    .yw-lb-head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px 16px;
    }
    .yw-lb-title {
      margin: 0;
      font-family: var(--font-display, Georgia, serif);
      font-size: clamp(18px, 2.2vw, 23px);
      color: var(--gold-bright, #f4dc8c);
    }
    .yw-lb-sub {
      color: var(--ink-2, #b9b19f);
      font-size: 14px;
    }
    .yw-lb-ref {
      font-family: var(--font-mono, monospace);
      font-size: 13px;
      color: var(--gold, #e8c55a);
      background: rgba(232, 197, 90, 0.1);
      padding: 3px 9px;
      border-radius: 999px;
      border: 1px solid rgba(232, 197, 90, 0.24);
    }
    .yw-lb-sum {
      margin: 0;
      font-size: 14px;
      line-height: 1.65;
      color: var(--ink, #ece6d8);
    }
    .yw-lb-sum-alt {
      margin: 0;
      font-size: 13px;
      line-height: 1.55;
      color: var(--ink-2, #b9b19f);
    }
    .yw-lb-foot {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding-top: 8px;
      border-top: 1px solid rgba(232, 197, 90, 0.12);
    }
    .yw-lb-links {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
  `;
  document.head.appendChild(style);

  const d = document.createElement('dialog');
  d.className = 'yw-lightbox';
  d.innerHTML = `
    <div class="yw-lb-top">
      <div class="yw-lb-badge" id="yw-lb-badge"></div>
      <div class="yw-lb-actions-top">
        <button type="button" class="yw-lb-btn" id="yw-lb-toggle-ver"></button>
        <button type="button" class="yw-lb-btn" id="yw-lb-close" aria-label="Close">✕</button>
      </div>
    </div>
    <div class="yw-lb-stage">
      <button type="button" class="yw-lb-nav yw-lb-prev" id="yw-lb-prev" aria-label="Previous event">‹</button>
      <img id="yw-lb-img" alt="" />
      <button type="button" class="yw-lb-nav yw-lb-next" id="yw-lb-next" aria-label="Next event">›</button>
    </div>
    <div class="yw-lb-body">
      <div class="yw-lb-head">
        <div>
          <h2 class="yw-lb-title" id="yw-lb-title"></h2>
          <div class="yw-lb-sub" id="yw-lb-sub"></div>
        </div>
        <span class="yw-lb-ref" id="yw-lb-ref"></span>
      </div>
      <p class="yw-lb-sum" id="yw-lb-sum"></p>
      <p class="yw-lb-sum-alt" id="yw-lb-sum-alt"></p>
      <div class="yw-lb-foot">
        <div class="yw-lb-links" id="yw-lb-links"></div>
        <span style="font-size:12px;color:var(--ink-3,#7d7667)" id="yw-lb-credit"></span>
      </div>
    </div>
  `;
  document.body.appendChild(d);

  d.querySelector('#yw-lb-close')!.addEventListener('click', () => d.close());
  d.addEventListener('click', (e) => {
    if (e.target === d) d.close();
  });
  d.querySelector('#yw-lb-prev')!.addEventListener('click', () => stepLightbox(-1));
  d.querySelector('#yw-lb-next')!.addEventListener('click', () => stepLightbox(1));
  d.querySelector('#yw-lb-toggle-ver')!.addEventListener('click', () => {
    forceRaw = !forceRaw;
    renderLightbox();
  });

  window.addEventListener('keydown', (e) => {
    if (!d.open) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); stepLightbox(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); stepLightbox(1); }
  });

  dialogEl = d;
  return d;
}

function stepLightbox(delta: number) {
  if (!currentOpts) return;
  const next = currentOpts.index + delta;
  if (next < 0 || next >= currentOpts.events.length) return;
  currentOpts.index = next;
  forceRaw = false;
  renderLightbox();
}

function renderLightbox() {
  if (!dialogEl || !currentOpts) return;
  const { events, index, onSelectOnGlobe, isScenesPage } = currentOpts;
  const ev = events[index];
  if (!ev) return;

  const zh = currentLocale() === 'zh';
  const hasMerged = (ev.img ?? 'm') === 'm';
  const showRaw = forceRaw || !hasMerged;

  const badge = dialogEl.querySelector<HTMLElement>('#yw-lb-badge')!;
  badge.textContent = zh
    ? hant(`第 ${index + 1} / ${events.length} 幅 · ${showRaw ? '原始纯画境版' : '中英双语去UI正式版'}`)
    : `Plate ${index + 1} of ${events.length} · ${showRaw ? 'Original Artwork' : 'Bilingual Edition'}`;

  const toggleBtn = dialogEl.querySelector<HTMLButtonElement>('#yw-lb-toggle-ver')!;
  toggleBtn.hidden = !hasMerged;
  toggleBtn.textContent = zh
    ? hant(forceRaw ? '切换双语版' : '查看纯画境原图')
    : (forceRaw ? 'Switch to Bilingual' : 'View Raw Artwork');

  const img = dialogEl.querySelector<HTMLImageElement>('#yw-lb-img')!;
  const targetSrc = showRaw ? eventRawFullUrl(ev.id) : eventFullUrl(ev);
  img.onerror = () => {
    const fb = eventRawFullUrl(ev.id);
    if (img.src !== fb) img.src = fb;
  };
  img.src = targetSrc;
  img.alt = zh ? hant(ev.zh) : ev.en;

  dialogEl.querySelector<HTMLButtonElement>('#yw-lb-prev')!.disabled = index <= 0;
  dialogEl.querySelector<HTMLButtonElement>('#yw-lb-next')!.disabled = index >= events.length - 1;

  dialogEl.querySelector<HTMLElement>('#yw-lb-title')!.textContent = zh ? hant(ev.zh) : ev.en;
  dialogEl.querySelector<HTMLElement>('#yw-lb-sub')!.textContent = zh ? ev.en : hant(ev.zh);
  dialogEl.querySelector<HTMLElement>('#yw-lb-ref')!.textContent = zh ? hant(ev.refZh) : ev.ref;

  const primarySum = zh ? hant(ev.sum) : (ev.sumEn || hant(ev.sum));
  const secondarySum = zh ? (ev.sumEn || '') : hant(ev.sum);
  dialogEl.querySelector<HTMLElement>('#yw-lb-sum')!.textContent = primarySum;
  const altEl = dialogEl.querySelector<HTMLElement>('#yw-lb-sum-alt')!;
  altEl.textContent = secondarySum;
  altEl.hidden = !secondarySum || secondarySum === primarySum;

  const links = dialogEl.querySelector<HTMLElement>('#yw-lb-links')!;
  links.innerHTML = '';

  if (onSelectOnGlobe) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'yw-lb-btn yw-lb-btn-gold';
    btn.textContent = zh ? hant('🌍 在地球仪上定位此事件') : '🌍 Locate on 3D Globe';
    btn.addEventListener('click', () => {
      dialogEl?.close();
      onSelectOnGlobe(ev);
    });
    links.appendChild(btn);
  } else if (currentOpts.showLocateOnGlobe !== false) {
    const a = document.createElement('a');
    a.className = 'yw-lb-btn yw-lb-btn-gold';
    a.href = `/#event=${encodeURIComponent(ev.id)}`;
    a.textContent = zh ? hant('🌍 在 3D 地球仪上查看此事件 ↗') : '🌍 View on 3D Globe ↗';
    links.appendChild(a);
  }

  const bb = document.createElement('a');
  bb.className = 'yw-lb-btn';
  bb.href = `/bible.html#event=${encodeURIComponent(ev.id)}`;
  bb.textContent = zh ? hant('📖 在画卷圣经中阅读经文') : '📖 Read in Illustrated Bible';
  links.appendChild(bb);

  if (!isScenesPage) {
    const sg = document.createElement('a');
    sg.className = 'yw-lb-btn';
    sg.href = `/scenes.html#event=${encodeURIComponent(ev.id)}`;
    sg.textContent = zh ? hant('🖼️ 在圣经画卷全集中打开') : '🖼️ Open in Scenes Gallery';
    links.appendChild(sg);
  }

  const dl = document.createElement('a');
  dl.className = 'yw-lb-btn';
  dl.href = targetSrc;
  dl.target = '_blank';
  dl.rel = 'noopener';
  dl.textContent = zh ? hant('🔍 查看原尺寸大图 ↗') : '🔍 Full Resolution ↗';
  links.appendChild(dl);

  dialogEl.querySelector<HTMLElement>('#yw-lb-credit')!.textContent = zh
    ? hant('画家的想象 · 按圣经经文顺序呈现')
    : 'Artist’s impression · Ordered by canonical scripture';
}

export function openEventLightbox(
  first: LightboxOptions | TrackEvent,
  extra?: { list?: readonly TrackEvent[]; showLocateOnGlobe?: boolean; onSelectOnGlobe?: (ev: TrackEvent) => void },
) {
  const d = ensureDialog();
  if ('events' in first) {
    currentOpts = { ...first };
  } else {
    const list = extra?.list && extra.list.length > 0 ? extra.list : [first];
    const idx = Math.max(0, list.findIndex((e) => e.id === first.id));
    currentOpts = {
      events: list,
      index: idx,
      showLocateOnGlobe: extra?.showLocateOnGlobe,
      onSelectOnGlobe: extra?.onSelectOnGlobe,
    };
  }
  forceRaw = false;
  renderLightbox();
  if (!d.open) d.showModal();
}
