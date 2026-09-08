import * as THREE from 'three';
import { GLOBE_RADIUS } from './globe.ts';
import type { RouteMarker } from './routes.ts';

// Labels are HTML positioned over the canvas each frame, not textures drawn
// into the scene. Chinese type rendered as a texture at this size turns to mud;
// as HTML it stays crisp at any zoom, reflows, and can be selected.
//
// The one thing the DOM will not do for itself is hide a label whose place is
// on the far side of the world, so that test is done here: a marker facing away
// from the camera is behind the globe, and its label has to go with it.

interface LabelItem { el: HTMLElement; pos: THREE.Vector3; marker: RouteMarker }

export class RouteLabels {
  readonly root = document.createElement('div');
  private items: LabelItem[] = [];
  private readonly v = new THREE.Vector3();

  constructor(parent: HTMLElement) {
    this.root.className = 'route-labels';
    parent.appendChild(this.root);
  }

  build(markers: THREE.Object3D[], locale: 'zh' | 'en') {
    this.root.innerHTML = '';
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
      const name = locale === 'zh' ? m.zh : m.place;
      const tag = i === 0 ? '<u>起</u>' : i === last ? '<u>终</u>' : '';
      el.innerHTML = `<b>${ord}</b><span>${name}</span>${tag}`;
      // A merged marker says outright that it is a guess, on the label itself
      // rather than only in a panel the reader may never open.
      if (m.stops.length > 1) el.title = `${m.stops.length} 站共用一个坐标——这些营站的位置从未考定`;
      this.root.appendChild(el);
      return { el, pos: mesh.position.clone(), marker: m };
    });
  }

  clear() { this.root.innerHTML = ''; this.items = []; }

  /** Projects every label, hides the ones the globe is in front of, and drops
   *  whatever will not fit.
   *
   *  Decluttering is the difference between having labels and being able to
   *  read them: the wilderness camps sit within a few degrees of each other,
   *  and drawn naively their labels pile into an unreadable stack. Placement is
   *  greedy in priority order — the stop the company has just reached first,
   *  then identified sites, then the shared-coordinate clusters — and a label
   *  that would overlap one already placed is dropped rather than shuffled,
   *  because a label moved off its marker points at the wrong place. */
  update(camera: THREE.PerspectiveCamera, globe: THREE.Object3D, reached: number, w: number, h: number) {
    if (!this.items.length) return;
    const camDir = camera.position.clone().normalize();

    const candidates: { it: LabelItem; x: number; y: number; op: number; rank: number }[] = [];

    this.items.forEach((it, i) => {
      it.el.classList.toggle('now', i === reached);
      this.v.copy(it.pos).applyMatrix4(globe.matrixWorld);
      // On the far hemisphere: the surface normal points away from the camera.
      const facing = this.v.clone().normalize().dot(camDir);
      if (facing <= 0.12 || i > reached) { it.el.style.display = 'none'; return; }

      this.v.project(camera);
      if (this.v.z > 1) { it.el.style.display = 'none'; return; }

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
    const GAP_X = 62, GAP_Y = 15;
    for (const c of candidates) {
      const clash = taken.some((t) => Math.abs(t.x - c.x) < GAP_X && Math.abs(t.y - c.y) < GAP_Y);
      if (clash) { c.it.el.style.display = 'none'; continue; }
      taken.push({ x: c.x, y: c.y });
      c.it.el.style.display = '';
      c.it.el.style.opacity = String(c.op);
      c.it.el.style.transform = `translate(-50%,-150%) translate(${c.x}px, ${c.y}px)`;
    }
  }
}

export const globeRadius = GLOBE_RADIUS;
