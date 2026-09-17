// The events layer (handoff/07 C1, ASTRA-PROMPTS P4).
//
// All 1,443 events as bands on a second track under the verse slider, each one
// sitting under the verses it happens in — the same canonical scale the slider
// is already on, so the band's width is how much text the event covers.
//
// THERE IS NO YEAR AXIS, AND THIS IS DELIBERATE. There was one: a linear
// −4114→95 scale the reader could switch the slider into. The owner removed it
// on 2026-09-18 — "year那个不make sense" — and the reasons are in the data. Most
// of these dates are bounded by the events around them rather than attested;
// 549 of the dated ones land in years 0–100, which is 2.4% of that axis, so the
// entire New Testament was a sliver a reader could not aim at; and a printed
// year gives a derived number the same authority as an attested one. The dates
// are still IN the data (events.json keeps yearEarly / yearLate /
// dateConfidence / dateBasis, and audit-events.mjs still checks them), so this
// is a decision about the interface, not a deletion. Nothing here should put a
// year in front of a reader again without being asked for.
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
  /** Move the verse cursor to an opened event. */
  setVerseCursor(index: number): void;
  /** Show an opened event in the readout. */
  showEvent(ev: TrackEvent | null): void;
}

// One tone for every band. The bands used to be coloured by how firm the
// event's date was — spine / inferred / disputed / undated — which was a key
// the page never printed anywhere, and with the year axis gone it encodes a
// fact the interface no longer shows. What the track says now it says plainly:
// here is where in the canon the events are, and how much text each covers.
const PALETTE = {
  band:     '#a89c84',
  selected: '#f3e9cf',
  cursor:   '#e8c55a',
};

export class EventsTrack {
  private events: TrackEvent[] = [];
  private readonly root = document.getElementById('t-events') as HTMLElement;
  private readonly canvas = document.getElementById('t-events-canvas') as HTMLCanvasElement;
  private readonly note = document.getElementById('t-events-note') as HTMLElement;
  private ctx: CanvasRenderingContext2D | null = null;
  /** Where each event was last drawn, for hit testing. */
  private boxes: { ev: TrackEvent; x0: number; x1: number; lane: number }[] = [];
  private selected: TrackEvent | null = null;
  private cursor = 0;
  private lanes = 1;

  constructor(private readonly host: TrackHost) {}

  get count() { return this.events.length; }
  /** How many bands the last draw actually laid out. Reported rather than
   *  assumed: "1,443 events are in the file" and "1,443 bands are on the
   *  track" are different claims, and only the second one is the feature. */
  get drawnCount() { return this.boxes.length; }
  /** The loaded events, for anything that needs to list rather than draw
   *  them — see src/events-menu.ts. */
  get all(): readonly TrackEvent[] { return this.events; }

  async load(url: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`events.json → ${res.status}`);
    const data = await res.json() as Payload;
    this.events = data.events;

    this.root.hidden = false;
    this.ctx = this.canvas.getContext('2d');
    this.wire();
    this.relabel();
    this.resize();
  }

  private wire() {
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
    const n = this.events.length;
    this.note.textContent = t(
      `${n.toLocaleString('en-US')} events, in the order the canon tells them`,
      `${n} 条事件，按经文顺序排列`,
    );
    if (l === 'zh') this.note.textContent = hant(this.note.textContent);
    // role="img" with no accessible name is a picture a screen reader cannot
    // describe; the note is exactly the description.
    this.canvas.setAttribute('aria-label', this.note.textContent);
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

  /** Slider position, in verse-index space. */
  setCursor(value: number) {
    this.cursor = value;
    this.draw();
  }

  private xOf(ev: TrackEvent, w: number): [number, number] {
    const steps = Math.max(1, this.host.verseSteps());
    const x0 = (this.host.indexOfKey(ev.s) / steps) * w;
    const x1 = (this.host.indexOfKey(ev.e) / steps) * w;
    return [x0, Math.max(x1, x0 + 1)];
  }

  /** Stacks overlapping bands so density reads as density instead of one
   *  smear. Beyond the last lane they overlap — the alternative is moving a
   *  band off the verses it belongs to, which is the one thing its position
   *  means. */
  private layout(w: number) {
    const list = this.events
      .map((ev) => ({ ev, x: this.xOf(ev, w) }))
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
      const on = ev === this.selected;
      ctx.globalAlpha = on ? 1 : 0.8;
      ctx.fillStyle = on ? PALETTE.selected : PALETTE.band;
      ctx.fillRect(x0, y, width, barH);
      ctx.restore();
    }

    // Where the slider is.
    const cx = (this.cursor / Math.max(1, this.host.verseSteps())) * w;
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
      this.host.setVerseCursor(this.host.indexOfKey(ev.e));
    }
    this.draw();
  }
}
