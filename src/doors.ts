import * as THREE from 'three';
import { GLOBE_RADIUS, lonLatToVec3 } from './globe.ts';
import { hant, onLocale, t } from './locale.ts';

// The doors: the places on the globe you can walk into.
//
// The owner's idea, and it is the right one. Until now the globe was a map and
// the three walks were three other URLs; a reader had no way of learning from
// the map that the ark is a place they can stand inside. So the walks now
// stand ON the globe, at the coordinates the gazetteer gives for the place the
// text puts them, and you reach them by finding them.
//
// They appear only when the camera is close — closer than the shaded relief
// fades in at — because that is what makes them a reward for looking rather
// than three more buttons over a map.
//
// WHERE EACH ONE STANDS is the whole substance of this file, and two of the
// three need saying out loud:
//
//   · THE ARK. Gen 8:4 is 「方舟停在亚拉腊山上」 — הָרֵי אֲרָרָט, the mountains
//     of Ararat, PLURAL. It names a region, the Urartu of the Assyrian
//     records, not a peak. The single mountain everyone pictures, Ağrı Dağı,
//     is a much later identification. The gazetteer already knows this: its
//     Ararat record is typed `region` and carries the precision note "point in
//     region". The door says so.
//   · THE TABERNACLE. It was made at Sinai (Ex 25–40) and the text does not
//     fix where Sinai is — the traditional Jebel Musa is one candidate among
//     several. But Josh 18:1 sets the tent up at Shiloh, and Shiloh is
//     identified with confidence (Khirbet Seilun, a tel). So the door stands
//     at the place the text names AND the ground can be found, and the card
//     says the tent was made somewhere the text leaves open.
//   · THE TEMPLE. 2 Chr 3:1 puts the house on Mount Moriah in Jerusalem. This
//     one is not in doubt.
//
// Coordinates are NOT written here. Each door names a gazetteer slug and the
// place payload answers, so a correction to the gazetteer reaches the door and
// the two can never disagree.

export interface Door {
  id: string;
  /** The gazetteer slug this door stands on. */
  slug: string;
  href: string;
  zh: string; en: string;
  /** The verse that puts it at this place. */
  ref: string; refZh: string;
  /** What the text fixes, and what it does not. Shown on the card. */
  noteZh: string; noteEn: string;
}

export const DOORS: Door[] = [
  {
    id: 'ark', slug: 'ararat', href: '/ark.html',
    zh: '走进方舟', en: 'Walk into the ark',
    ref: 'Gen 8:4', refZh: '创 8:4',
    noteZh: '「方舟停在亚拉腊山上」——原文是复数，指的是一个地区，不是一座山峰。今天指认的那座山属传统，不是经文所定。',
    noteEn: 'The ark rested on the mountains of Ararat — plural in the Hebrew, a region and not a peak. The single mountain of the pictures is a later identification, not the text\'s.',
  },
  {
    id: 'tabernacle', slug: 'shiloh', href: '/tabernacle.html',
    zh: '走进会幕', en: 'Walk into the tabernacle',
    ref: 'Josh 18:1', refZh: '书 18:1',
    noteZh: '会幕是在西乃造的（出 25–40），而经文没有定下西乃在哪里。书 18:1 把帐幕支搭在示罗——那是经文指名、地也找得到的地方，所以门开在这里。',
    noteEn: 'The tent was made at Sinai (Ex 25–40), and the text does not fix where Sinai is. Josh 18:1 sets it up at Shiloh — a place the text names and the ground can be found — so the door stands there.',
  },
  {
    id: 'temple', slug: 'mount-moriah', href: '/temple.html',
    zh: '走进圣殿', en: 'Walk into the temple',
    ref: '2 Chr 3:1', refZh: '代下 3:1',
    noteZh: '「在耶路撒冷摩利亚山上」。这一处没有疑问。',
    noteEn: 'In Jerusalem, on Mount Moriah. This one is not in doubt.',
  },
];

/** Where a door stands, once the gazetteer has answered. */
export interface Placed extends Door {
  lon: number; lat: number;
  /** The gazetteer's own word for how exactly it is located. */
  precisionZh: string; precisionEn: string;
}

// Closer than this, in globe radii, and the doors are there. The relief fades
// in between 2.45 and 1.55; the doors come after it, so a reader meets the
// ground first and the buildings on it second.
const SHOW = 1.5;
const FULL = 1.22;

export class Doors {
  private readonly root: HTMLElement;
  private readonly cards = new Map<string, HTMLElement>();
  private readonly marks: { door: Placed; world: THREE.Vector3 }[] = [];
  private opacity = 0;
  private readonly cameraLocal = new THREE.Vector3();
  private readonly v = new THREE.Vector3();

  constructor(doors: Placed[], parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'doors';
    this.root.hidden = true;
    parent.appendChild(this.root);

    // The anchor is DRAWN IN THE DOM, not in the scene.
    //
    // It began as a ring and a spire in three.js, lying on the globe. They
    // never appeared. Forced to opaque red, six times the size, depthTest off
    // and renderOrder 999, cloned straight into the scene at a measured world
    // point 101.86 units out with the globe's rotation at identity — still
    // nothing, so the cause is not the material, the transform, the culling or
    // the draw order, and I did not find it. The DOM anchor is not a
    // workaround dressed up as a design: the card already has to be projected
    // and positioned, so the dot costs one element and cannot fail the same
    // way.
    for (const door of doors) {
      const world = lonLatToVec3(door.lon, door.lat, 0);
      this.marks.push({ door, world });

      const card = document.createElement('a');
      card.className = 'door';
      card.href = door.href;
      this.root.appendChild(card);
      this.cards.set(door.id, card);
    }
    this.write();
    onLocale(() => this.write());
  }

  private write() {
    for (const { door } of this.marks) {
      const card = this.cards.get(door.id)!;
      card.innerHTML =
        `<b>${t(door.en, hant(door.zh))}</b>` +
        `<i>${t(door.ref, hant(door.refZh))} · ${t(door.precisionEn, hant(door.precisionZh))}</i>` +
        `<span>${t(door.noteEn, hant(door.noteZh))}</span>` +
        `<em>${t('Enter in 3D', '进入 3D')} ↗</em>`;
    }
  }

  /** Called every frame from the render loop. */
  update(camera: THREE.PerspectiveCamera, globe: THREE.Object3D, dt: number) {
    const distance = camera.position.length() / GLOBE_RADIUS;
    const want = THREE.MathUtils.clamp((SHOW - distance) / (SHOW - FULL), 0, 1);
    // Eased rather than snapped, so a door arrives as the reader comes down
    // to it instead of appearing between two frames.
    this.opacity += (want - this.opacity) * Math.min(1, dt * 5);
    const on = this.opacity > 0.01;
    this.root.hidden = !on;
    if (!on) return;

    // Behind the globe is behind the globe: the horizon plane p·c = R².
    this.cameraLocal.copy(camera.position);
    globe.worldToLocal(this.cameraLocal);
    const horizon = GLOBE_RADIUS * GLOBE_RADIUS;
    const w = innerWidth, h = innerHeight;

    // Shiloh and Moriah are thirty-one kilometres apart, so at any useful zoom
    // their cards land on top of one another — which is what happened. Only
    // the door nearest the middle of the screen opens fully; the others shrink
    // to a name, and a name that still collides is stepped down out of the
    // way. Nearest-to-centre rather than nearest-to-camera because the middle
    // of the screen is where the reader is actually looking.
    const onScreen: { door: Placed; x: number; y: number; d: number }[] = [];
    for (const { door, world } of this.marks) {
      const facing = world.dot(this.cameraLocal) > horizon;

      const card = this.cards.get(door.id)!;
      if (!facing) { card.style.opacity = '0'; card.style.pointerEvents = 'none'; continue; }
      this.v.copy(world).applyMatrix4(globe.matrixWorld).project(camera);
      if (this.v.z > 1 || Math.abs(this.v.x) > 1.2 || Math.abs(this.v.y) > 1.2) {
        card.style.opacity = '0'; card.style.pointerEvents = 'none'; continue;
      }
      onScreen.push({
        door,
        x: (this.v.x + 1) * w / 2,
        y: (1 - this.v.y) * h / 2,
        d: Math.hypot((this.v.x + 1) * w / 2 - w / 2, (1 - this.v.y) * h / 2 - h / 2),
      });
    }
    onScreen.sort((a, b) => a.d - b.d);

    const taken: { x: number; y: number }[] = [];
    for (const [rank, spot] of onScreen.entries()) {
      const card = this.cards.get(spot.door.id)!;
      card.classList.toggle('door--min', rank > 0);
      const { x, y } = spot;
      // A full card always hangs ABOVE its beacon, so a name that would land
      // in one goes BELOW its own instead. Flipping is free; stepping upward
      // is not, because it would have to know how tall the card above it is,
      // and reading that back out of the layout every frame is a reflow.
      const clash = taken.some((q) => Math.abs(q.x - x) < 220 && Math.abs(q.y - y) < 190);
      taken.push({ x, y });
      const lift = rank > 0 && clash
        ? 'translate(-50%, 26px)'
        : 'translate(-50%, calc(-100% - 26px))';
      card.classList.toggle('door--below', rank > 0 && clash);
      // Anchored ABOVE the beacon and centred on it, so the card never covers
      // the thing it is pointing at.
      card.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px) ${lift}`;
      card.style.opacity = String(this.opacity);
      card.style.pointerEvents = this.opacity > 0.6 ? 'auto' : 'none';
    }
  }
}

/** Resolves each door against the place payload. A door whose place is not in
 *  the gazetteer is dropped rather than guessed at, and says so once. */
export function placeDoors(
  lookup: (slug: string) => { lon: number; lat: number; precision?: string; precisionNote?: string } | undefined,
): Placed[] {
  const PRECISION: Record<string, { zh: string; en: string }> = {
    region: { zh: '定位到地区', en: 'located to a region' },
    terrain: { zh: '定位到地形', en: 'located to the terrain' },
    tel: { zh: '定位到遗址土丘', en: 'located to the tel' },
    settlement: { zh: '定位到聚落', en: 'located to the settlement' },
  };
  const out: Placed[] = [];
  for (const door of DOORS) {
    const p = lookup(door.slug);
    if (!p) { console.warn(`doors: no gazetteer place "${door.slug}" — ${door.id} has no door`); continue; }
    const k = PRECISION[p.precision ?? ''] ?? { zh: '位置见地名数据', en: 'located as the gazetteer has it' };
    out.push({ ...door, lon: p.lon, lat: p.lat, precisionZh: k.zh, precisionEn: k.en });
  }
  return out;
}
