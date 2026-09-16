/** Painted scenes for a journey's stops, shown above the player.
 *
 * These are an artist's impression, not a reconstruction, and the figure says
 * so on its face. That is not a disclaimer bolted on afterwards: this atlas
 * earns attention by being straight about what is known and what is not, and a
 * painting of a harbour nobody has excavated is exactly the kind of thing a
 * reader would otherwise take for evidence. The credit line is part of the
 * component, not an option a later change can drop.
 *
 * Only the stop on screen is fetched. Sixteen plates are about 1.1 MB together
 * and almost none of them are looked at in a given visit — and a moving scene
 * is ten times the weight of a still one, so fetching on arrival rather than up
 * front is what makes them affordable at all.
 *
 * A scene is a still or a clip depending on its file extension. A clip is muted
 * and loops: it is a plate that moves, not a film with a soundtrack, and it
 * must never start talking over a reader.
 */
import { hant } from './locale.ts';
type Scene = { file: string; en: string; zh: string; ref?: string };
/** `stops` is keyed by stop number. `epilogue` is shown once the reader reaches
 *  the last stop and belongs to a passage the route deliberately does not
 *  cover: Elijah's route stops where Elisha is called, and the chariot of fire
 *  is the chapter after it, at a crossing this atlas will not pin because the
 *  gazetteer holds two Gilgals and two Bethels and 2 Kings 2:1 does not say
 *  which. An epilogue carries its own reference so it cannot be mistaken for a
 *  stop on the line. */
type Payload = {
  meta: { credit: { en: string; zh: string } };
  journeys: Record<string, { stops: Record<string, Scene>; epilogue?: Scene }>;
};

export class Scenes {
  private data: Payload | null = null;
  private key = '';
  private readonly fig: HTMLElement;
  private readonly img: HTMLImageElement;
  private readonly vid: HTMLVideoElement;
  private readonly cap: HTMLElement;
  private readonly credit: HTMLElement;
  private readonly more: HTMLButtonElement;
  /** Set while the reader has chosen to look past the end of the route. */
  private inEpilogue = false;
  private locale: 'en' | 'zh' = 'en';

  constructor(root: HTMLElement) {
    this.fig = root;
    this.img = root.querySelector('img')!;
    this.vid = root.querySelector('video')!;
    this.cap = root.querySelector('.r-scene-caption')!;
    this.credit = root.querySelector('.r-scene-credit')!;
    this.more = root.querySelector('.r-scene-more')!;
    // An epilogue used to appear only where a stop had no plate of its own,
    // which meant painting the last stop silently hid it. It has its own way in
    // now, so the two can never compete for one slot again.
    this.more.addEventListener('click', () => {
      this.inEpilogue = !this.inEpilogue;
      this.key = '';
      this.render();
    });
    // A plate that 404s or is still in flight must not leave a torn card.
    this.img.addEventListener('load', () => { this.fig.dataset.state = 'ready'; });
    this.img.addEventListener('error', () => { this.hide(); });
    this.vid.addEventListener('loadeddata', () => { this.fig.dataset.state = 'ready'; });
    this.vid.addEventListener('error', () => { this.hide(); });
  }

  async load() {
    try {
      this.data = await (await fetch('/data/scenes.json')).json();
    } catch { this.data = null; }
  }

  hide() {
    this.fig.hidden = true;
    this.more.hidden = true;
    this.key = '';
    this.img.removeAttribute('src');
    // A paused clip still holds its decoder; a removed source does not. The
    // tabernacle gate taught this one the hard way.
    this.vid.pause();
    this.vid.removeAttribute('src');
    this.vid.load();
  }

  /** The reader's own choice about whether a picture is worth the map it
   *  covers, kept because it is a preference rather than a per-stop decision.
   *  `wanted` gates `show`, so a collapsed picture also stops being fetched. */
  private wanted = (() => {
    try { return localStorage.getItem('ydh.scene') !== 'off'; } catch { return true; }
  })();
  get showing() { return this.wanted; }
  setWanted(value: boolean) {
    this.wanted = value;
    try { localStorage.setItem('ydh.scene', value ? 'on' : 'off'); } catch { /* private window */ }
    if (!value) this.hide();
  }

  /** `ordinal` is the stop number the reader is on, not the marker index:
   *  merged markers cover several stops and each still has its own plate. */
  private last: { journeyId: string; ordinal: number; atEnd: boolean } | null = null;

  show(journeyId: string, ordinal: number, locale: 'en' | 'zh', atEnd = false) {
    if (!this.last || this.last.journeyId !== journeyId || this.last.ordinal !== ordinal) this.inEpilogue = false;
    this.last = { journeyId, ordinal, atEnd };
    this.locale = locale;
    this.render();
  }

  private render() {
    if (!this.last) { this.hide(); return; }
    const { journeyId, ordinal, atEnd } = this.last;
    const locale = this.locale;
    const j = this.wanted ? this.data?.journeys[journeyId] : undefined;
    const epilogue = atEnd ? j?.epilogue : undefined;
    const scene = this.inEpilogue && epilogue ? epilogue : (j?.stops?.[String(ordinal)] ?? epilogue);
    if (!scene) { this.hide(); return; }
    // Offered only where there is something else to go to.
    const canGo = Boolean(epilogue) && scene !== epilogue;
    this.more.hidden = !(canGo || this.inEpilogue);
    this.more.textContent = this.inEpilogue
      ? (locale === 'zh' ? hant('← 回到本站') : '\u2190 Back to the stop')
      : (locale === 'zh' ? hant('行程之后 →') : 'After the journey \u2192');
    const key = `${journeyId}:${scene.file}`;
    this.fig.hidden = false;
    this.cap.textContent = scene.ref ? `${scene[locale]}　${scene.ref}` : scene[locale];
    this.credit.textContent = this.data!.meta.credit[locale];
    if (key === this.key) return;          // language switch only — no refetch
    this.key = key;
    this.fig.dataset.state = 'loading';
    const moving = /\.(mp4|webm)$/.test(scene.file);
    this.fig.dataset.kind = moving ? 'video' : 'image';
    if (moving) {
      this.img.removeAttribute('src');
      this.vid.src = `/${scene.file}`;
      this.vid.setAttribute('aria-label', scene[locale]);
      void this.vid.play().catch(() => {/* refused; the first frame stands */});
    } else {
      this.vid.pause(); this.vid.removeAttribute('src'); this.vid.load();
      this.img.alt = scene[locale];
      this.img.src = `/${scene.file}`;
    }
  }
}
