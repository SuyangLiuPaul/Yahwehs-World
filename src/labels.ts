import * as THREE from 'three';
import { GLOBE_RADIUS } from './globe.ts';
import type { RouteMarker } from './routes.ts';
import { placeLabel } from './names.ts';

// Labels are HTML positioned over the canvas each frame, not textures drawn
// into the scene. Chinese type rendered as a texture at this size turns to mud;
// as HTML it stays crisp at any zoom, reflows, and can be selected.
//
// The one thing the DOM will not do for itself is hide a label whose place is
// on the far side of the world, so that test is done here: a marker facing away
// from the camera is behind the globe, and its label has to go with it.

interface LabelItem { el: HTMLElement; pos: THREE.Vector3; marker: RouteMarker; w: number; h: number }

export class RouteLabels {
  readonly root = document.createElement('div');
  private items: LabelItem[] = [];
  private readonly v = new THREE.Vector3();
  /** Viewport width the pill boxes were last measured at, or -1 for stale.
   *  The boxes have to be measured rather than assumed: one stop's name is
   *  three characters and the next is seventeen, and the 900px breakpoint
   *  moves both the type size and the padding. */
  private measuredAt = -1;

  constructor(parent: HTMLElement) {
    this.root.className = 'route-labels';
    parent.appendChild(this.root);
  }

  build(markers: THREE.Object3D[], locale: 'zh' | 'en') {
    this.root.innerHTML = '';
    this.measuredAt = -1;
    // Re-armed on every build rather than taken once in the constructor:
    // fonts.ready is replaced with a fresh promise each time a new face starts
    // loading, so a single early read misses the swap it was written for.
    void document.fonts.ready.then(() => { this.measuredAt = -1; });
    const last = markers.length - 1;
    this.items = markers.map((mesh, i) => {
      const m = mesh.userData.marker as RouteMarker;
      // Four ranks, because they are four different things to a reader: where
      // it began, where it ended, where the company is now, and the rest.
      const rank = i === 0 ? ' start' : i === last ? ' end' : '';
      const el = document.createElement('div');
      el.className = 'rlab' + rank + (m.stops.length > 1 ? ' many' : '');
      const ord = m.stops.length > 1
        ? `${m.stops[0]}–${m.stops[m.stops.length - 1]}`
        : String(m.n);
      const name = placeLabel(m.place, m.zh, locale);
      const tag = i === 0 ? '<u>起</u>' : i === last ? '<u>终</u>' : '';
      el.innerHTML = `<b>${ord}</b><span>${name}</span>${tag}`;
      // A merged marker says outright that it is a guess, on the label itself
      // rather than only in a panel the reader may never open.
      if (m.stops.length > 1) el.title = `${m.stops.length} 站共用一个坐标——这些营站的位置从未考定`;
      // Hidden until the first update places it; otherwise every label flashes
      // at the top-left corner for a frame before it is positioned.
      el.style.display = 'none';
      this.root.appendChild(el);
      return { el, pos: mesh.position.clone(), marker: m, w: 0, h: 0 };
    });
  }

  clear() { this.root.innerHTML = ''; this.items = []; this.measuredAt = -1; }

  /** Measures every pill once per layout, in one write pass then one read pass
   *  so the browser reflows once rather than once per label. Hidden elements
   *  report a zero box, so they are shown invisibly for the read. */
  private measure(vw: number) {
    if (this.measuredAt === vw || !this.items.length) return;
    const was = this.items.map((it) => it.el.style.display);
    for (const it of this.items) { it.el.style.visibility = 'hidden'; it.el.style.display = ''; }
    for (const it of this.items) { it.w = it.el.offsetWidth; it.h = it.el.offsetHeight; }
    this.items.forEach((it, i) => { it.el.style.display = was[i] ?? 'none'; it.el.style.visibility = ''; });
    // Marked done even if a box came back zero. Retrying every frame would pin
    // a synchronous layout inside the render loop; the next build or resize
    // re-measures anyway, and an unmeasured pill falls back to centring.
    this.measuredAt = vw;
  }

  /** Projects every label, hides the ones the globe is in front of, and drops
   *  whatever will not fit.
   *
   *  Decluttering is the difference between having labels and being able to
   *  read them: the wilderness camps sit within a few degrees of each other,
   *  and drawn naively their labels pile into an unreadable stack. Placement is
   *  greedy in priority order — the stop the company has just reached first,
   *  then identified sites, then the shared-coordinate clusters — and a label
   *  that would overlap one already placed is dropped rather than shuffled,
   *  because a label moved off its marker points at the wrong place.
   *
   *  The frame's edge is held to the same rule. A pill that would hang off it
   *  is not slid back into view — that would point it at the wrong place — it
   *  swings to the marker's other side, so a corner lands on the marker
   *  instead of its midline and it still names what it touches. */
  update(camera: THREE.PerspectiveCamera, globe: THREE.Object3D, reached: number, w: number, h: number) {
    if (!this.items.length || w < 2 || h < 2) return;
    this.measure(w);
    const camDir = camera.position.clone().normalize();

    const candidates: { it: LabelItem; x: number; y: number; op: number; rank: number }[] = [];

    this.items.forEach((it, i) => {
      it.el.classList.toggle('now', i === reached);
      this.v.copy(it.pos).applyMatrix4(globe.matrixWorld);
      // On the far hemisphere: the surface normal points away from the camera.
      const facing = this.v.clone().normalize().dot(camDir);
      if (facing <= 0.12 || i > reached) { it.el.style.display = 'none'; return; }

      this.v.project(camera);
      // Behind the camera, or panned clean out of frame. An off-screen marker
      // otherwise still gets a pill clinging to the edge, naming a place that
      // is not on screen, and it goes on taking a slot in the greedy pass.
      if (this.v.z > 1 || Math.abs(this.v.x) > 1 || Math.abs(this.v.y) > 1) {
        it.el.style.display = 'none'; return;
      }

      candidates.push({
        it,
        x: (this.v.x + 1) / 2 * w,
        y: (-this.v.y + 1) / 2 * h,
        // Fade near the limb, where a label sits over the globe's silhouette
        // and reads as floating in space.
        op: Math.min(1, (facing - 0.12) / 0.22),
        // Endpoints outrank ordinary stops for space: losing the start of a
        // journey to a collision is worse than losing its ninth camp.
        rank: i === reached ? 0
            : (i === 0 || i === this.items.length - 1) ? 1
            : (it.marker.stops.length > 1 ? 3 : 2),
      });
    });

    candidates.sort((a, b) => a.rank - b.rank || b.op - a.op);

    const taken: { x: number; y: number }[] = [];
    // Spacing scales with the viewport. A fixed 62px gap is a sixth of a phone
    // screen and a twentieth of a desktop one, so the same rule that reads as
    // comfortable on a laptop leaves a phone with labels stacked on top of one
    // another.
    const GAP_X = Math.max(52, Math.min(96, w * 0.24));
    const GAP_Y = w < 520 ? 20 : 15;
    /** Breathing room kept between a pill and the frame. */
    const EDGE = 6;
    for (const c of candidates) {
      const clash = taken.some((t) => Math.abs(t.x - c.x) < GAP_X && Math.abs(t.y - c.y) < GAP_Y);
      if (clash) { c.it.el.style.display = 'none'; continue; }
      taken.push({ x: c.x, y: c.y });
      c.it.el.style.display = '';
      c.it.el.style.opacity = String(c.op);
      const bw = c.it.w, bh = c.it.h;
      if (!bw || !bh) {
        // Never measured — centre it, which is what it did before.
        c.it.el.style.transform = `translate(-50%,-150%) translate(${c.x}px, ${c.y}px)`;
        continue;
      }
      // Centred by default; swung to one side only when that side would clip.
      // The two cases are exclusive, or a right-flip that lands inside the
      // frame gets overwritten by the left test on the margin alone.
      let l = c.x - bw / 2;
      if (l + bw > w - EDGE) l = Math.max(EDGE, c.x - bw);
      else if (l < EDGE) l = Math.min(w - EDGE - bw, c.x);
      const t = Math.max(EDGE, c.y - bh * 1.5);
      c.it.el.style.transform = `translate(${Math.round(l)}px, ${Math.round(t)}px)`;
    }
  }
}

export const globeRadius = GLOBE_RADIUS;
