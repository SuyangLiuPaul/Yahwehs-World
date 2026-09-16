import * as THREE from 'three';
import { GLOBE_RADIUS } from './globe.ts';
import { placeLabel } from './names.ts';
import { REGION_NAMES } from './regions.ts';
import type { Place } from './types.ts';

// Which places the globe shows, and which of them get their name printed.
//
// Every place named anywhere in the canon used to get a dot the moment the
// timeline reached it, and 1,275 of the 1,332 are reached by the last verse.
// They are not spread over the sphere — better than half sit inside the Levant
// — so the honest result of drawing them all is a brown smear over Israel with
// no name on it. A reader cannot find Jerusalem on a map of 1,275 dots.
//
// Real atlases solve this with scale: a continental sheet names a dozen cities,
// a regional sheet names two hundred, and the same place appears on both. That
// is what this does. Every frame-ish, the places the timeline has reached are
// projected to the screen and dropped into a grid; the most-mentioned place in
// each cell survives and the rest are hidden. The cell is wide when the camera
// is far and narrow when it is close, so zooming out thins the map to its
// capitals and zooming in fills the same ground back in.
//
// Two consequences worth stating. The choice is made in screen space, so what
// survives depends on where the camera is, not on a list someone curated — no
// place is permanently second-class. And importance is verse count, which is a
// count of mentions and not a judgement: Jerusalem wins because the text says
// it 955 times.

/** Grid cell in CSS pixels at the far and near ends of the camera's travel.
 *  At the far end a cell is wide enough that most surviving dots can also
 *  carry their name, which is the point of thinning. */
const CELL_FAR = 54;
const CELL_NEAR = 16;
/** Camera distances, in globe radii, between which the cell size interpolates. */
const D_FAR = 3.2;
const D_NEAR = 1.3;

/** How many names may be on screen at once. The declutter below usually places
 *  far fewer — most candidates lose their ground to a neighbour — so this is a
 *  bound on the measuring work, not a target. */
const POOL = 64;

/** Recompute at 11 Hz rather than every frame. The grid result is stable under
 *  small camera movement, and each pass reads layout back from the DOM. */
const INTERVAL = 0.09;

interface Slot { el: HTMLElement; w: number; h: number }
interface Box { left: number; right: number; top: number; bottom: number }

const clashes = (a: Box, b: Box) =>
  a.left < b.right + 3 && a.right > b.left - 3 && a.top < b.bottom + 2 && a.bottom > b.top - 2;

export class PlaceLabels {
  /** Per place: 1 if the marker for it may be drawn at this camera distance.
   *  `Markers` reads this; it is never written anywhere else. */
  readonly shown: Uint8Array;
  private readonly root = document.createElement('div');
  private readonly slots: Slot[] = [];
  /** Place indices, most-mentioned first. Ties broken by index so the order is
   *  stable and a place never flickers against an equally-mentioned neighbour. */
  private readonly byImportance: Int32Array;
  private readonly world = new THREE.Vector3();
  private readonly cameraLocal = new THREE.Vector3();
  private readonly screenX: Float32Array;
  private readonly screenY: Float32Array;
  private time = INTERVAL;
  private maskDirty = false;
  private readonly namedElsewhere: boolean[];

  constructor(private readonly places: Place[]) {
    this.root.id = 'place-labels';
    this.root.setAttribute('aria-hidden', 'true');
    document.body.append(this.root);
    for (let i = 0; i < POOL; i++) {
      const el = document.createElement('span');
      el.className = 'place-label';
      el.style.display = 'none';
      this.root.append(el);
      this.slots.push({ el, w: 0, h: 0 });
    }
    this.shown = new Uint8Array(places.length);
    this.screenX = new Float32Array(places.length);
    this.screenY = new Float32Array(places.length);
    this.byImportance = Int32Array.from(places.keys())
      .sort((a, b) => places[b]!.verseCount - places[a]!.verseCount || a - b);
    // A region already named across its territory by RegionLabels still gets
    // its dot — it is a place the text names — but not a second name beside it.
    this.namedElsewhere = places.map((p) => REGION_NAMES.has(p.name));
  }

  /** True once since the last call if the set of drawable markers changed. */
  consumeMaskChange() { const d = this.maskDirty; this.maskDirty = false; return d; }

  /**
   * @param isVisible whether the timeline has reached this place yet
   * @param pin       a place that must survive declutter (the selected one), or -1
   * @param mute      hide the names but keep thinning the dots — used while a
   *                  route is playing, where the route's own labels do the naming
   * @param worldRadius size of the dot, so the name clears it rather than hiding
   *                  under it
   */
  update(
    camera: THREE.PerspectiveCamera, globe: THREE.Object3D, locale: 'zh' | 'en',
    isVisible: (i: number) => boolean, band: { top: number; bottom: number },
    dt: number, pin = -1, mute = false, worldRadius: (i: number) => number = () => 0,
  ) {
    this.time += dt;
    if (this.time < INTERVAL) return;
    this.time = 0;

    const w = innerWidth, h = innerHeight;
    const distance = camera.position.length() / GLOBE_RADIUS;
    const u = THREE.MathUtils.clamp((D_FAR - distance) / (D_FAR - D_NEAR), 0, 1);
    const cell = THREE.MathUtils.lerp(CELL_FAR, CELL_NEAR, u);

    // Anything at or beyond the horizon as seen from the camera is behind the
    // globe. In the globe's own frame that is the plane p·c = R², which costs a
    // dot product and no square roots.
    this.cameraLocal.copy(camera.position);
    globe.worldToLocal(this.cameraLocal);
    const horizon = GLOBE_RADIUS * GLOBE_RADIUS;

    // World units to pixels at the globe's surface. The camera is always
    // looking at the centre, so one factor serves every marker closely enough
    // to keep a name off its dot.
    const surface = Math.max(1, camera.position.length() - GLOBE_RADIUS);
    const perUnit = h / (2 * surface * Math.tan(camera.fov * Math.PI / 360));

    const winner = new Map<number, number>();
    for (const i of this.byImportance) {
      if (this.shown[i] === 1) { this.shown[i] = 0; this.maskDirty = true; }
      if (!isVisible(i)) continue;
      const p = this.places[i]!;
      this.world.set(0, 0, 0);
      const v = lonLat(this.world, p.lon, p.lat);
      if (v.dot(this.cameraLocal) <= horizon) continue;
      v.applyMatrix4(globe.matrixWorld).project(camera);
      if (v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) continue;
      const x = (v.x + 1) * w / 2, y = (1 - v.y) * h / 2;
      this.screenX[i] = x; this.screenY[i] = y;
      const key = Math.floor(x / cell) * 4096 + Math.floor(y / cell);
      // byImportance order means the first place to claim a cell is the
      // most-mentioned one in it, so no comparison is needed here.
      if (!winner.has(key)) winner.set(key, i);
    }
    // The reader's own selection is never thinned away under them.
    if (pin >= 0 && isVisible(pin)) winner.set(-1, pin);
    for (const i of winner.values()) if (this.shown[i] === 0) { this.shown[i] = 1; this.maskDirty = true; }

    this.root.hidden = mute;
    if (mute) return;

    // Names, in importance order, for as many of the surviving dots as fit.
    const wanted: number[] = [];
    for (const i of this.byImportance) {
      if (this.shown[i] !== 1 || this.namedElsewhere[i]) continue;
      wanted.push(i);
      if (wanted.length === POOL) break;
    }
    wanted.forEach((i, s) => {
      const slot = this.slots[s]!;
      const p = this.places[i]!;
      const text = placeLabel(p.name, p.zh, locale);
      if (slot.el.textContent !== text) slot.el.textContent = text;
      slot.el.style.display = '';
      slot.el.style.visibility = 'hidden';
    });
    for (let s = wanted.length; s < POOL; s++) this.slots[s]!.el.style.display = 'none';
    // One layout read for the whole pool, after every write above.
    wanted.forEach((_, s) => {
      const slot = this.slots[s]!;
      slot.w = slot.el.offsetWidth; slot.h = slot.el.offsetHeight;
    });

    // A route's own labels are placed before this and keep their ground. Region
    // names are not: they are placed after, and dodge these. A settlement is a
    // point the text puts events at; a region label is a cartographic anchor
    // that the layer itself says is "not a boundary" (regions.ts). When the two
    // want the same pixels, Jerusalem should win over Canaan.
    const taken: Box[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('.rlab'))) {
      if (el.style.display === 'none' || !el.isConnected) continue;
      const r = el.getBoundingClientRect();
      if (r.width) taken.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
    }

    const edge = 8;
    wanted.forEach((i, s) => {
      const slot = this.slots[s]!;
      const x = this.screenX[i]!, y = this.screenY[i]!;
      // Fixed attachment, up and to the right of the dot, flipping only at a
      // frame edge. A label that slides to dodge a neighbour stops pointing at
      // anything in particular (D9).
      const gap = Math.min(40, worldRadius(i) * perUnit) + 6;
      let left = x + gap;
      if (left + slot.w > w - edge) left = x - slot.w - gap;
      let top = y - slot.h / 2;
      if (top < band.top + edge) top = band.top + edge;
      if (top + slot.h > band.bottom - edge) top = band.bottom - edge - slot.h;
      const box = { left, right: left + slot.w, top, bottom: top + slot.h };
      if (box.left < edge || box.right > w - edge
        || box.top < band.top || box.bottom > band.bottom
        || taken.some((t) => clashes(box, t))) {
        slot.el.style.display = 'none';
        return;
      }
      taken.push(box);
      slot.el.style.transform = `translate(${Math.round(box.left)}px,${Math.round(box.top)}px)`;
      slot.el.style.visibility = '';
    });
  }
}

/** lonLat into an existing vector, so the per-place loop allocates nothing. */
function lonLat(out: THREE.Vector3, lon: number, lat: number) {
  const phi = (90 - lat) * (Math.PI / 180), theta = (lon + 180) * (Math.PI / 180);
  const r = GLOBE_RADIUS + 0.6;
  return out.set(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}
