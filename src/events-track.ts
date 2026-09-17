// The events layer (handoff/07 C1, ASTRA-PROMPTS P4).
//
// All 1,443 events as bands on a second track under the verse slider, on
// either of two scales — the canon's verse index, or years — with the reader
// choosing which one drives.
//
// THE BAND'S WIDTH IS ITS UNCERTAINTY. That is the whole point of drawing
// bands rather than ticks: an event dated 966 BC and an event that could be
// anywhere in a two-century window should not look alike. It also decides the
// axis. 549 of the dated events fall in years 0–100, which is 2.4% of a linear
// −4114→95 axis, so the New Testament is a crowded sliver. A log or piecewise
// axis would spread it out — and would make a 25-year band in the NT look
// wider than a 200-year band in the monarchy, which is exactly the lie the
// band shape exists to avoid. The axis stays linear and the crowding stays
// visible: it is a true fact about when the canon's events happen.
//
// Drawn to a canvas. 1,443 positioned elements is a lot of layout for
// something that repaints on every scrub, and the hit test is one binary
// search either way.
//
// This module renders; it does not author. Nothing here re-dates, re-words or
// re-statuses an event — see the note at the top of build-events-payload.mjs.
import { locale as currentLocale, onLocale, t, hant } from './locale.ts';

export interface TrackEvent {
  id: string; zh: string; en: string;
  b: number; s: number; e: number;
  ref: string; refZh: string;
  sum: string; basis: string;
  c: 'anchored' | 'inferred' | 'disputed' | 'none';
  p: string[];
  y0?: number; y1?: number;
  spine?: 1;
}

interface Payload { meta: { count: number; cleared: string | null }; events: TrackEvent[] }

/** What the track needs from the page it lives in. */
export interface TrackHost {
  /** Verse-index space the slider already uses: canonical key -> slider index. */
  indexOfKey(key: number): number;
  /** How many verse steps the slider has. */
  verseSteps(): number;
  /** Put the camera on these place ids, and say whether anything was framed. */
  framePlaces(ids: string[]): boolean;
  /** Move the verse cursor (year mode maps onto it — see yearToIndex). */
  setVerseCursor(index: number): void;
  /** Show an opened event in the readout. */
  showEvent(ev: TrackEvent | null): void;
  /** The reader switched which scale drives the slider. The host owns the
   *  slider, so it re-ranges it and tells the track where the cursor now is. */
  axisChanged(byYear: boolean): void;
}

const PALETTE = {
  spine:    '#e8c55a',
  inferred: '#9a8f7a',
  disputed: '#c98a5a',
  none:     '#6f7d8c',
  cursor:   '#e8c55a',
  selected: '#f3e9cf',
};

export class EventsTrack {
  private events: TrackEvent[] = [];
  private dated: TrackEvent[] = [];
  private readonly root = document.getElementById('t-events') as HTMLElement;
  private readonly canvas = document.getElementById('t-events-canvas') as HTMLCanvasElement;
  private readonly axisBtn = document.getElementById('t-axis') as HTMLButtonElement;
  private readonly note = document.getElementById('t-events-note') as HTMLElement;
  private ctx: CanvasRenderingContext2D | null = null;
  /** Where each event was last drawn, for hit testing. */
  private boxes: { ev: TrackEvent; x0: number; x1: number; lane: number }[] = [];
  private byYear = false;
  private selected: TrackEvent | null = null;
  private cursor = 0;
  private yearMin = 0;
  private yearMax = 0;
  private lanes = 1;

  constructor(private readonly host: TrackHost) {}

  get count() { return this.events.length; }
  get isByYear() { return this.byYear; }
  /** How many bands the last draw actually laid out. Reported rather than
   *  assumed: "1,443 events are in the file" and "1,443 bands are on the
   *  track" are different claims, and only the second one is the feature. */
  get drawnCount() { return this.boxes.length; }
  /** The loaded events, for anything that needs to list rather than draw
   *  them — see src/events-menu.ts. */
  get all(): readonly TrackEvent[] { return this.events; }
  get datedCount() { return this.dated.length; }

  async load(url: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`events.json → ${res.status}`);
    const data = await res.json() as Payload;
    this.events = data.events;
    this.dated = this.events.filter((e) => e.y0 !== undefined && e.y1 !== undefined);
    this.yearMin = Math.min(...this.dated.map((e) => e.y0!));
    this.yearMax = Math.max(...this.dated.map((e) => e.y1!));

    this.root.hidden = false;
    this.ctx = this.canvas.getContext('2d');
    this.wire();
    this.relabel();
    this.resize();
  }

  private wire() {
    this.axisBtn.addEventListener('click', () => {
      this.byYear = !this.byYear;
      this.axisBtn.setAttribute('aria-pressed', String(this.byYear));
      this.relabel();
      // The slider is the host's; it has to be re-ranged into the new scale
      // before the cursor drawn here means anything.
      this.host.axisChanged(this.byYear);
      this.draw();
    });
    this.canvas.addEventListener('click', (ev) => {
      const hit = this.hit(ev);
      this.open(hit);
    });
    // A band is a small target; saying what is under the pointer costs nothing.
    this.canvas.addEventListener('pointermove', (ev) => {
      const hit = this.hit(ev);
      this.canvas.style.cursor = hit ? 'pointer' : '';
      this.canvas.title = hit ? this.title(hit) : '';
    });
    addEventListener('resize', () => this.resize());
    onLocale(() => { this.relabel(); this.draw(); });
  }

  private relabel() {
    const l = currentLocale();
    this.axisBtn.textContent = this.byYear
      ? t('Verses', '按经文')
      : t('Years', '按年代');
    // What the reader is looking at, counted — including what the year axis
    // cannot show, which is the honest half of this number.
    const undated = this.events.length - this.dated.length;
    this.note.textContent = this.byYear
      ? t(`${this.dated.length} of ${this.events.length} events are dated`,
          `${this.events.length} 条中 ${this.dated.length} 条有年代`)
      : t(`${this.events.length} events`, `${this.events.length} 条事件`);
    if (this.byYear && undated) {
      this.note.textContent += t(` · ${undated} undated, shown on the verse axis`,
        ` · ${undated} 条无年代，只在经文轴上`);
    }
    if (l === 'zh') this.note.textContent = hant(this.note.textContent);
  }

  private title(ev: TrackEvent) {
    const name = currentLocale() === 'zh' ? hant(ev.zh) : ev.en;
    const ref = currentLocale() === 'zh' ? hant(ev.refZh) : ev.ref;
    return `${name} · ${ref}`;
  }

  resize() {
    if (!this.ctx) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.draw();
  }

  /** Slider position, in whichever space the slider is currently in. */
  setCursor(value: number) {
    this.cursor = value;
    this.draw();
  }

  /** Year mode drives the same verse cursor: the canon is revealed as far as
   *  the last event that had begun by this year. Chronological rather than
   *  canonical, which is the point of switching axis — Isaiah arrives in the
   *  eighth century, not after Song of Songs. */
  yearToIndex(year: number): number {
    let furthest = -1;
    for (const ev of this.dated) {
      if (ev.y0! <= year && ev.e > furthest) furthest = ev.e;
    }
    return furthest < 0 ? 0 : this.host.indexOfKey(furthest);
  }

  get years() { return { min: this.yearMin, max: this.yearMax }; }

  /** The year to put the slider at when switching INTO year mode, so the
   *  reader stays where they were: the year of the last event that has begun
   *  by the verse they are sitting on. */
  indexToYear(index: number): number {
    let year = this.yearMin;
    for (const ev of this.dated) {
      if (this.host.indexOfKey(ev.s) <= index && ev.y0! > year) year = ev.y0!;
    }
    return year;
  }

  private xOf(ev: TrackEvent, w: number): [number, number] | null {
    if (this.byYear) {
      if (ev.y0 === undefined || ev.y1 === undefined) return null; // verse axis only
      const span = this.yearMax - this.yearMin || 1;
      const x0 = ((ev.y0 - this.yearMin) / span) * w;
      const x1 = ((ev.y1 - this.yearMin) / span) * w;
      return [x0, Math.max(x1, x0 + 1)];
    }
    const steps = Math.max(1, this.host.verseSteps());
    const x0 = (this.host.indexOfKey(ev.s) / steps) * w;
    const x1 = (this.host.indexOfKey(ev.e) / steps) * w;
    return [x0, Math.max(x1, x0 + 1)];
  }

  /** Stacks overlapping bands so density reads as density instead of one
   *  smear. Beyond the last lane they overlap — with 549 events inside 2.4%
   *  of the year axis, no number of lanes untangles it, and pretending
   *  otherwise would mean moving bands off their own dates. */
  private layout(w: number) {
    const list = (this.byYear ? this.dated : this.events)
      .map((ev) => ({ ev, x: this.xOf(ev, w) }))
      .filter((r): r is { ev: TrackEvent; x: [number, number] } => r.x !== null)
      .sort((a, b) => a.x[0] - b.x[0]);

    const MAX_LANES = 6;
    const ends: number[] = [];
    this.boxes = list.map(({ ev, x }) => {
      let lane = ends.findIndex((end) => end <= x[0]);
      if (lane === -1) {
        if (ends.length < MAX_LANES) { lane = ends.length; ends.push(0); }
        else lane = (ends.length ? Math.floor(x[0]) % ends.length : 0);
      }
      ends[lane] = x[1] + 1;
      return { ev, x0: x[0], x1: x[1], lane };
    });
    this.lanes = Math.max(1, ends.length);
  }

  private draw() {
    const ctx = this.ctx;
    if (!ctx || !this.events.length) return;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    this.layout(w);

    const laneH = h / this.lanes;
    const barH = Math.max(3, laneH - 2);

    for (const { ev, x0, x1, lane } of this.boxes) {
      const y = lane * laneH;
      const width = Math.max(1, x1 - x0);
      ctx.save();
      ctx.globalAlpha = ev === this.selected ? 1 : 0.85;
      ctx.fillStyle = ev === this.selected ? PALETTE.selected
        : ev.spine ? PALETTE.spine
        : ev.c === 'disputed' ? PALETTE.disputed
        : ev.c === 'none' ? PALETTE.none
        : PALETTE.inferred;

      if (ev.c === 'disputed') {
        // Hatched: scholars disagree by more than the band's own width.
        ctx.fillRect(x0, y, width, barH);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#1a2436';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = x0 - barH; x < x1; x += 4) {
          ctx.moveTo(x, y + barH);
          ctx.lineTo(x + barH, y);
        }
        ctx.save();
        ctx.rect(x0, y, width, barH);
        ctx.clip();
        ctx.stroke();
        ctx.restore();
      } else if (ev.c === 'none') {
        // Dotted: the text supports no absolute date at all.
        ctx.globalAlpha = 0.9;
        for (let x = x0; x < x1; x += 3) ctx.fillRect(x, y + barH / 2 - 1, 1.5, 2);
        ctx.fillRect(x0, y, 1.5, barH);
      } else {
        ctx.fillRect(x0, y, width, barH);
      }

      // Spine-dated events carry a lid, so the firmest dates read as a spine
      // through the rest rather than as another colour among many.
      if (ev.spine) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = PALETTE.spine;
        ctx.fillRect(x0, y, width, 1.5);
      }
      ctx.restore();
    }

    // Where the slider is.
    const cx = this.byYear
      ? ((this.cursor - this.yearMin) / ((this.yearMax - this.yearMin) || 1)) * w
      : (this.cursor / Math.max(1, this.host.verseSteps())) * w;
    ctx.save();
    ctx.strokeStyle = PALETTE.cursor;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(cx) + 0.5, 0);
    ctx.lineTo(Math.round(cx) + 0.5, h);
    ctx.stroke();
    ctx.restore();
  }

  private hit(pointer: PointerEvent | MouseEvent): TrackEvent | null {
    const r = this.canvas.getBoundingClientRect();
    const x = pointer.clientX - r.left;
    const y = pointer.clientY - r.top;
    const laneH = r.height / this.lanes;
    const lane = Math.min(this.lanes - 1, Math.max(0, Math.floor(y / laneH)));
    // Nearest in the pointer's own lane, then anywhere — a 1px band is hard
    // to hit exactly and the reader meant the one they can see.
    const inLane = this.boxes.filter((b) => b.lane === lane && x >= b.x0 - 3 && x <= b.x1 + 3);
    if (inLane.length) return inLane[0]!.ev;
    let best: { ev: TrackEvent; d: number } | null = null;
    for (const b of this.boxes) {
      const d = x < b.x0 ? b.x0 - x : x > b.x1 ? x - b.x1 : 0;
      if (d <= 4 && (!best || d < best.d)) best = { ev: b.ev, d };
    }
    return best?.ev ?? null;
  }

  open(ev: TrackEvent | null) {
    this.selected = ev;
    this.host.showEvent(ev);
    if (ev) {
      if (ev.p.length) this.host.framePlaces(ev.p);
      // Put the cursor at the event, so the map's reveal matches what is open.
      if (!this.byYear) this.host.setVerseCursor(this.host.indexOfKey(ev.e));
    }
    this.draw();
  }
}
