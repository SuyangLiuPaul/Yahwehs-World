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
  /** How far out this door is worth showing, in globe radii — the scale of
   *  the thing itself, not of the passage. A building three hundred cubits
   *  long is worth a continent's view; the room a meal was eaten in is not.
   *  Without this, a plan with a hundred scenes in it puts a hundred cards
   *  over the Levant at every zoom and the map stops being a map. */
  from: number;
  href: string;
  zh: string; en: string;
  /** The verse that puts it at this place. */
  ref: string; refZh: string;
  /** What the text fixes, and what it does not. Shown on the card. */
  noteZh: string; noteEn: string;
}

export const DOORS: Door[] = [
  {
    id: 'ark', from: 1.5, slug: 'ararat', href: '/ark.html',
    zh: '走进方舟', en: 'Walk into the ark',
    ref: 'Gen 8:4', refZh: '创 8:4',
    noteZh: '「方舟停在亚拉腊山上」——原文是复数，指的是一个地区，不是一座山峰。今天指认的那座山属传统，不是经文所定。',
    noteEn: 'The ark rested on the mountains of Ararat — plural in the Hebrew, a region and not a peak. The single mountain of the pictures is a later identification, not the text\'s.',
  },
  {
    id: 'tabernacle', from: 1.5, slug: 'shiloh', href: '/tabernacle.html',
    zh: '走进会幕', en: 'Walk into the tabernacle',
    ref: 'Josh 18:1', refZh: '书 18:1',
    noteZh: '会幕是在西乃造的（出 25–40），而经文没有定下西乃在哪里。书 18:1 把帐幕支搭在示罗——那是经文指名、地也找得到的地方，所以门开在这里。',
    noteEn: 'The tent was made at Sinai (Ex 25–40), and the text does not fix where Sinai is. Josh 18:1 sets it up at Shiloh — a place the text names and the ground can be found — so the door stands there.',
  },
  {
    id: 'temple', from: 1.5, slug: 'mount-moriah', href: '/temple.html',
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

  /** Adds doors after construction. Dev only: it exists so the question
   *  「当有非常多的 3D 怎么办呢」 can be answered with a screenshot of a
   *  hundred of them rather than with an assurance. */
  add(doors: Placed[]) {
    for (const door of doors) {
      this.marks.push({ door, world: lonLatToVec3(door.lon, door.lat, 0) });
      const card = document.createElement('a');
      card.className = 'door';
      card.href = door.href;
      this.root.appendChild(card);
      this.cards.set(door.id, card);
    }
    this.write();
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

    // WHAT HAPPENS WHEN THERE ARE A HUNDRED OF THESE.
    //
    // Three doors already collided — Shiloh and Moriah are thirty-one
    // kilometres apart. The plan has fifty-six units and most of them will
    // have a scene, and Jerusalem alone will end up holding Solomon's house,
    // Herod's, the upper room, Gethsemane and the council. A card each is not
    // a design, it is a pile.
    //
    // So doors are thinned the way this app already thins 1,332 place names:
    // project them all, rank them, and let one winner claim each cell of a
    // screen-space grid. Nothing new is invented here; the discipline is
    // PlaceLabels'. Three rules on top of it:
    //
    //   · ZOOM FILTERS BY SIZE. Each door carries the distance it is worth
    //     seeing from. The ark is worth a continent's view. A room is not.
    //   · ONE PLACE, ONE ANCHOR. Doors sharing a gazetteer slug share a point,
    //     so ten scenes in Jerusalem are one card that says how many, not ten
    //     cards on the same pixel.
    //   · A BUDGET. One card opens, four more give their name, and the rest
    //     are a ring on the map until the reader comes closer. The 全部 menu
    //     has every one of them regardless, so nothing depends on being found.
    const onScreen: { door: Placed; x: number; y: number; d: number }[] = [];
    for (const { door, world } of this.marks) {
      const card = this.cards.get(door.id)!;
      const hide = () => { card.style.opacity = '0'; card.style.pointerEvents = 'none'; };
      if (distance > door.from) { hide(); continue; }
      if (world.dot(this.cameraLocal) <= horizon) { hide(); continue; }
      this.v.copy(world).applyMatrix4(globe.matrixWorld).project(camera);
      if (this.v.z > 1 || Math.abs(this.v.x) > 1.2 || Math.abs(this.v.y) > 1.2) {
        hide(); continue;
      }
      onScreen.push({
        door,
        x: (this.v.x + 1) * w / 2,
        y: (1 - this.v.y) * h / 2,
        d: Math.hypot((this.v.x + 1) * w / 2 - w / 2, (1 - this.v.y) * h / 2 - h / 2),
      });
    }
    // Nearest to the MIDDLE OF THE SCREEN, because that is where the reader is
    // looking — not nearest to the camera, which on a sphere is the same thing
    // only when they happen to be looking straight down.
    onScreen.sort((a, b) => a.d - b.d);

    // ONE WINNER PER CELL, AND THE LOSERS ARE COUNTED, NOT DRAWN.
    //
    // Hiding the losers is the whole trick. The first version demoted them to
    // dots and left them where they were: a hundred synthetic doors put
    // SEVENTY rings on top of Jerusalem, which is the pile this was meant to
    // prevent, only rounder. A cell now shows its winner and how many others
    // are under it — 「12」 on the ring — and the number falls as the reader
    // comes down and the cells divide the cluster.
    const CELL_X = 230, CELL_Y = 120;
    const winners = new Map<number, { spot: typeof onScreen[number]; n: number }>();
    const order: number[] = [];
    for (const spot of onScreen) {
      const key = Math.floor(spot.x / CELL_X) * 4096 + Math.floor(spot.y / CELL_Y);
      const cell = winners.get(key);
      if (cell) { cell.n++; this.cards.get(spot.door.id)!.style.opacity = '0'; continue; }
      winners.set(key, { spot, n: 1 });
      order.push(key);
    }
    // A budget on top of the grid, for a screen that is all one cluster: one
    // door opens, four give their name, the rest are a ring with a number.
    const NAMED = 5;
    const kept: typeof onScreen = [];
    for (const [i, key] of order.entries()) {
      const { spot, n } = winners.get(key)!;
      const card = this.cards.get(spot.door.id)!;
      card.dataset.count = n > 1 ? String(n) : '';
      if (i < NAMED) {
        card.classList.remove('door--dot');
        kept.push(spot);
        continue;
      }
      card.classList.add('door--dot');
      card.classList.remove('door--min', 'door--below');
      card.style.transform =
        `translate(${Math.round(spot.x)}px,${Math.round(spot.y)}px) translate(-50%, -50%)`;
      card.style.opacity = String(this.opacity * 0.9);
      card.style.pointerEvents = this.opacity > 0.6 ? 'auto' : 'none';
    }

    const taken: { x: number; y: number }[] = [];
    for (const [rank, spot] of kept.entries()) {
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
