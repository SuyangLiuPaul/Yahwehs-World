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
 * and almost none of them are looked at in a given visit.
 */
type Scene = { file: string; en: string; zh: string };
type Payload = {
  meta: { credit: { en: string; zh: string } };
  journeys: Record<string, Record<string, Scene>>;
};

export class Scenes {
  private data: Payload | null = null;
  private key = '';
  private readonly fig: HTMLElement;
  private readonly img: HTMLImageElement;
  private readonly cap: HTMLElement;
  private readonly credit: HTMLElement;

  constructor(root: HTMLElement) {
    this.fig = root;
    this.img = root.querySelector('img')!;
    this.cap = root.querySelector('.r-scene-caption')!;
    this.credit = root.querySelector('.r-scene-credit')!;
    // A plate that 404s or is still in flight must not leave a torn card.
    this.img.addEventListener('load', () => { this.fig.dataset.state = 'ready'; });
    this.img.addEventListener('error', () => { this.hide(); });
  }

  async load() {
    try {
      this.data = await (await fetch('/data/scenes.json')).json();
    } catch { this.data = null; }
  }

  hide() { this.fig.hidden = true; this.key = ''; this.img.removeAttribute('src'); }

  /** `ordinal` is the stop number the reader is on, not the marker index:
   *  merged markers cover several stops and each still has its own plate. */
  show(journeyId: string, ordinal: number, locale: 'en' | 'zh') {
    const scene = this.data?.journeys[journeyId]?.[String(ordinal)];
    if (!scene) { this.hide(); return; }
    const key = `${journeyId}:${ordinal}`;
    this.fig.hidden = false;
    this.cap.textContent = scene[locale];
    this.credit.textContent = this.data!.meta.credit[locale];
    if (key === this.key) return;          // language switch only — no refetch
    this.key = key;
    this.fig.dataset.state = 'loading';
    this.img.alt = scene[locale];
    this.img.src = `/${scene.file}`;
  }
}
