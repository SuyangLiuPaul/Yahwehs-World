// Pictures. Every plate on the gallery surface is the text-free square, served from this site's own
// /pictures/ (scripts/build-pictures.mjs). No picture comes from another host, and none has words in its
// pixels: the title, the reference and the summary are HTML beside it.
import type { Scene } from './data.ts';
import { t } from '../locale.ts';

const HOST = (import.meta.env.VITE_SCENES_HOST as string | undefined) ?? '';
export const thumbUrl = (id: string) => `${HOST}/pictures/thumb/${id}.webp`;
export const fullUrl = (id: string) => `${HOST}/pictures/full/${id}.webp`;

/** "<8 chars>" = base64url of the top half's RGB then the bottom half's -> a vertical gradient. */
export function lqipGradient(code: string): string | null {
  if (code.length < 8) return null;
  try {
    const b = atob(code.replace(/-/g, '+').replace(/_/g, '/').padEnd(8, '='));
    const c = (i: number) => `rgb(${b.charCodeAt(i)},${b.charCodeAt(i + 1)},${b.charCodeAt(i + 2)})`;
    return `linear-gradient(180deg, ${c(0)}, ${c(3)})`;
  } catch { return null; }
}

export interface PlateOptions {
  kind: 'thumb' | 'full';
  /** the first screen's picture: loaded now, at high priority */ eager?: boolean;
  alt?: string;
}

/** A plate: the colour placeholder at once, the picture fading in over it. A scene whose picture is not served
 *  (held by the gate, or excluded by the owner) shows the plain plate and one line of words; it still has its page. */
export function plate(sc: Scene, o: PlateOptions): HTMLElement {
  const el = document.createElement('span');
  el.className = 'gx-plate';
  const grad = lqipGradient(sc.q);
  if (grad && sc.ok) el.style.background = grad;
  if (!sc.ok) {
    el.classList.add('is-pending');
    const p = document.createElement('span');
    p.className = 'gx-pending';
    p.textContent = t('This scene is still being drawn', '这一幕的画还在画', 'Эта сцена ещё рисуется');
    el.append(p);
    return el;
  }
  const img = document.createElement('img');
  img.alt = o.alt ?? '';
  img.decoding = 'async';
  if (o.eager) { img.loading = 'eager'; img.fetchPriority = 'high'; } else img.loading = 'lazy';
  img.addEventListener('load', () => el.classList.add('is-loaded'), { once: true });
  img.addEventListener('error', () => el.classList.add('is-failed'), { once: true });
  img.src = o.kind === 'thumb' ? thumbUrl(sc.id) : fullUrl(sc.id);
  if (img.complete && img.naturalWidth) el.classList.add('is-loaded');
  el.append(img);
  return el;
}
