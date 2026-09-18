import * as THREE from 'three';

// Spring bones: the cloth that sways.
//
// A figure from tools/autorig/person.py carries, besides its body skeleton,
// chains of small extra bones under the parts of it that hang: eight columns
// down the skirt of the robe, one down each end of the girdle, five round the
// back of a head-cloth, one down the beard (tools/autorig/springs.py says
// what and where). The cloth is weighted to those chains. Nothing in the
// file moves them — every clip leaves them at rest — so without this they
// are a rigid skirt hung from the hips. This is what moves them.
//
// Each spring bone is treated as a rod of fixed length whose tip is a point
// with a little mass. Every step the tip
//   · keeps most of the velocity it had (Verlet: the difference from where
//     it was last step, less a drag),
//   · is pulled toward where it would hang if the bone sat at rest under its
//     parent (stiffness), and straight down (gravity),
//   · is held at the rod's length from the bone's head,
//   · is pushed out of any capsule collider it has entered — the thighs, the
//     shins, the hips, the chest, the neck, the head, the collar bones and
//     the upper arms, each measured from the body in Blender and carried in
//     the file in the frame of the bone it rides,
//   · is drawn a little toward its neighbours in the ring (a skirt), so a
//     leg that pushes one column pushes the cloth beside it too instead of
//     tenting it over a single pole,
//   · may lean no further from its rest than the chain allows,
// and the bone is turned to point at the tip. The chains are solved one
// LEVEL at a time — every first segment, then every second — so each
// segment sees the one above it already moved and its neighbours beside it.
//
// WHY THIS AND NOT A CLOTH SIMULATION. A crowd of three hundred is the case
// this app has to serve (Acts 2:41 is three thousand). Fifty points a figure
// with a handful of capsules each is a few thousand vector operations for
// the whole crowd; a cloth solver on one robe is more than that on its own.
// And it degrades gracefully: past `farDistance` a figure's springs are put
// to rest and left there, which at that distance is what the eye would see
// anyway.
//
// WHY NOT @pixiv/three-vrm. Its spring-bone solver is the same idea, but it
// arrives as a VRM extension reader and expects VRM's data; ours is plain
// glTF extras written by our own exporter step, and the solver is a page.
// Owning it also means the collider set, the ring constraint and the LOD
// are this app's to change.
//
// Units. The file is in metres; the figure is scaled at load (figures.ts) to
// its stated height, so every length here is taken from the bones' world
// matrices after that scale, and gravity is in metres per second squared of
// the world the figure stands in.

/** What a chain's first bone carries in its extras. */
export interface ChainParams {
  /** 1/s² — how hard a tip is pulled back toward where it rests. */
  stiffness: number;
  /** Fraction of its velocity a tip loses per 1/60 s. */
  drag: number;
  /** m/s², straight down. */
  gravity: number;
  /** m — the tip's own thickness against the colliders. */
  radius: number;
  /** Degrees a segment may lean from its rest direction. */
  maxAngle: number;
  /** Names of the colliders this chain answers to. */
  colliders: string[];
  /** Chains of this kind form a closed ring, in name order (a skirt). */
  ring?: boolean;
  /** 0..1: how far each tip is drawn toward its neighbours' each step. */
  lateral?: number;
  /** The bone whose turn the chain's rest follows, when it is not the bone
   *  the chain hangs from (a veil hangs from the head but rests with the
   *  chest, because the shoulders hold it). */
  restBone?: string;
}

interface SpringExtras extends Partial<ChainParams> {
  chain: string;
  seg: number;
  tail: [number, number, number];
}

interface ColliderExtras {
  name: string; bone: string; a: [number, number, number]; b: [number, number, number]; radius: number;
}

export interface Collider {
  name: string;
  bone: THREE.Object3D;
  /** Segment ends in the bone's own frame (a sphere when equal). */
  a: THREE.Vector3; b: THREE.Vector3;
  /** Radius in the file's metres. */
  radius: number;
  /** This frame, in the world. */
  wa: THREE.Vector3; wb: THREE.Vector3; wr: number;
}

export interface Joint {
  chain: string;
  seg: number;
  bone: THREE.Bone;
  parent: THREE.Object3D;
  /** The body bone whose turn the rest follows: the chain's root parent
   *  (the hips, the head) unless the chain names another (a veil: the chest). */
  restBone: THREE.Object3D;
  /** The bone's local rotation at rest — what every clip leaves it at. */
  restQuat: THREE.Quaternion;
  /** This bone's rest turn in the frame of `restBone`, measured from the
   *  file's rest pose at load: where this segment points when the WHOLE
   *  chain hangs at rest. The rest a segment is pulled toward is taken from
   *  this, not from the segment above it as it happens to lean now — taken
   *  from the segment above, a 35° allowance compounded to 175° over five
   *  segments and a knee lifted the hem to the thigh. */
  restRel: THREE.Quaternion;
  /** The rod's direction in the bone's own frame (unit). */
  axis: THREE.Vector3;
  /** The rod's tip in the bone's own frame, file metres. */
  tailLocal: THREE.Vector3;
  /** The rod's length and thickness in the world, measured after scaling. */
  length: number; radius: number;
  /** The tip now and one step ago, in the world. */
  cur: THREE.Vector3; prev: THREE.Vector3;
  /** This step: the bone's head, the rod's rest direction, its world rest turn. */
  pos: THREE.Vector3; restDir: THREE.Vector3; restWorld: THREE.Quaternion;
  /** This step: the direction chosen before and after the ring blend. */
  dir: THREE.Vector3; dir0: THREE.Vector3;
  params: ChainParams;
  colliders: Collider[];
  cosMax: number;
}

/** Chains of one kind that lean on each other: hem_00..hem_07 round the skirt. */
interface Ring { closed: boolean; lateral: number; levels: Joint[][] }

const DEFAULTS: ChainParams = { stiffness: 30, drag: 0.08, gravity: 9.8, radius: 0.02, maxAngle: 60, colliders: [] };
const STEP = 1 / 60;          // drag is defined per step of this
const MAX_FRAME = 1 / 20;     // a longer frame (a tab coming back) is not simulated across
const MAX_SUBSTEPS = 4;

// scratch, shared — this runs for every figure every frame and must not allocate
const _m = new THREE.Matrix4();
const _restTail = new THREE.Vector3(), _next = new THREE.Vector3(), _f = new THREE.Vector3();
const _cp = new THREE.Vector3(), _d = new THREE.Vector3(), _perp = new THREE.Vector3(), _avg = new THREE.Vector3();
const _prot = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _dq = new THREE.Quaternion();
const _local = new THREE.Vector3(), _ab = new THREE.Vector3();

/** The nearest point on the segment ab to p, into out. */
function closestOnSegment(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, out: THREE.Vector3) {
  _ab.subVectors(b, a);
  const l2 = _ab.lengthSq();
  if (l2 < 1e-12) return out.copy(a);
  const t = THREE.MathUtils.clamp(_d.subVectors(p, a).dot(_ab) / l2, 0, 1);
  return out.copy(a).addScaledVector(_ab, t);
}

/** Lean `dir` back toward `rest` until the angle between them is acos(cosMax). */
function clampLean(dir: THREE.Vector3, rest: THREE.Vector3, cosMax: number) {
  const cos = dir.dot(rest);
  if (cos >= cosMax) return;
  _perp.copy(dir).addScaledVector(rest, -cos);
  const pl = _perp.length();
  if (pl > 1e-9) dir.copy(rest).multiplyScalar(cosMax).addScaledVector(_perp.divideScalar(pl), Math.sqrt(1 - cosMax * cosMax));
  else dir.copy(rest);
}

export class SpringRig {
  readonly joints: Joint[] = [];
  readonly colliders: Collider[] = [];
  /** joints by segment index: every chain's first bone, then every second… */
  private readonly levels: Joint[][] = [];
  private readonly rings: Ring[] = [];
  /** Off: the bones stay wherever the clip leaves them (at rest). */
  enabled = true;
  /** Metres from the camera beyond which the springs are put to rest and skipped. */
  farDistance = 40;
  /** Milliseconds the last update took — for the demo's counter. */
  lastMs = 0;
  private far = false;
  private measured = false;

  private constructor(readonly root: THREE.Object3D) {}

  /** Finds the spring bones under `root` (a loaded figure, already scaled).
   *  Returns null when the file has none — the figure then simply has no
   *  secondary motion, as every figure had before this existed. */
  static from(root: THREE.Object3D): SpringRig | null {
    const rig = new SpringRig(root);
    root.updateWorldMatrix(true, true);          // the rest pose, for restRel below
    const byName = new Map<string, THREE.Object3D>();
    let colliderJson: string | undefined;
    root.traverse((o) => {
      byName.set(o.name, o);
      if (typeof o.userData.springColliders === 'string') colliderJson = o.userData.springColliders;
    });
    const colliders = new Map<string, Collider>();
    if (colliderJson) {
      for (const c of JSON.parse(colliderJson) as ColliderExtras[]) {
        // three.js strips the colon out of "mixamorig:Hips" on load
        const bone = byName.get(THREE.PropertyBinding.sanitizeNodeName(c.bone)) ?? byName.get(c.bone);
        if (!bone) continue;
        const col: Collider = { name: c.name, bone, a: new THREE.Vector3(...c.a), b: new THREE.Vector3(...c.b),
          radius: c.radius, wa: new THREE.Vector3(), wb: new THREE.Vector3(), wr: c.radius };
        colliders.set(c.name, col);
        rig.colliders.push(col);
      }
    }
    // the chains, in name order (which for a ring is the order round the figure), root segment first
    const found: { bone: THREE.Bone; ex: SpringExtras }[] = [];
    root.traverse((o) => {
      if ((o as THREE.Bone).isBone && typeof o.userData.spring === 'string') {
        try { found.push({ bone: o as THREE.Bone, ex: JSON.parse(o.userData.spring) as SpringExtras }); }
        catch { /* not ours */ }
      }
    });
    found.sort((p, q) => p.ex.chain === q.ex.chain ? p.ex.seg - q.ex.seg : p.ex.chain < q.ex.chain ? -1 : 1);
    const params = new Map<string, ChainParams>();
    for (const { bone, ex } of found) {
      if (ex.seg === 0) params.set(ex.chain, { ...DEFAULTS, ...ex, colliders: ex.colliders ?? [] } as ChainParams);
      const p = params.get(ex.chain) ?? DEFAULTS;
      const tailLocal = new THREE.Vector3(...ex.tail);
      if (!bone.parent || tailLocal.lengthSq() < 1e-12) continue;
      const above = ex.seg > 0 ? rig.joints[rig.joints.length - 1] : undefined;
      if (above && (above.chain !== ex.chain || above.seg !== ex.seg - 1)) continue;   // a broken chain: leave it
      const restBone = above ? above.restBone
        : (p.restBone && (byName.get(THREE.PropertyBinding.sanitizeNodeName(p.restBone)) ?? byName.get(p.restBone))) || bone.parent;
      // the file is in its rest pose now (no clip has run): this bone's turn
      // in the rest bone's frame is the rest the runtime keeps pulling toward
      _m.extractRotation(restBone.matrixWorld); _qi.setFromRotationMatrix(_m).invert();
      _m.extractRotation(bone.matrixWorld); _prot.setFromRotationMatrix(_m);
      const j: Joint = {
        chain: ex.chain, seg: ex.seg, bone, parent: bone.parent, restBone,
        restQuat: bone.quaternion.clone(),
        restRel: _qi.clone().multiply(_prot),
        axis: tailLocal.clone().normalize(), tailLocal,
        length: tailLocal.length(), radius: p.radius,
        cur: new THREE.Vector3(), prev: new THREE.Vector3(),
        pos: new THREE.Vector3(), restDir: new THREE.Vector3(), restWorld: new THREE.Quaternion(),
        dir: new THREE.Vector3(), dir0: new THREE.Vector3(),
        params: p,
        colliders: p.colliders.map((n) => colliders.get(n)).filter((c): c is Collider => !!c),
        cosMax: Math.cos(THREE.MathUtils.degToRad(p.maxAngle)),
      };
      rig.joints.push(j);
      (rig.levels[ex.seg] ??= []).push(j);
    }
    // rings: chains that share a kind ("hem" of "hem_03") and ask to lean on each other
    const kinds = new Map<string, Ring>();
    for (const j of rig.joints) {
      const lateral = j.params.lateral ?? 0;
      if (lateral <= 0) continue;
      const kind = j.chain.replace(/_\d+$/, '');
      const ring = kinds.get(kind) ?? { closed: !!j.params.ring, lateral, levels: [] };
      kinds.set(kind, ring);
      (ring.levels[j.seg] ??= []).push(j);
    }
    for (const r of kinds.values()) if (r.levels.some((l) => l && l.length > 1)) rig.rings.push(r);
    return rig.joints.length ? rig : null;
  }

  /** Lengths and radii in the world, after whatever scale the figure was
   *  given. Called on the first update; call again if the figure is rescaled. */
  remeasure() {
    this.root.updateWorldMatrix(true, true);
    for (const j of this.joints) {
      j.pos.setFromMatrixPosition(j.bone.matrixWorld);
      _next.copy(j.tailLocal).applyMatrix4(j.bone.matrixWorld);
      j.length = _next.distanceTo(j.pos);
      // the bone's world scale, for a radius given in file metres
      j.radius = j.params.radius * _d.setFromMatrixColumn(j.bone.matrixWorld, 1).length();
    }
    this.measured = true;
    this.reset();
  }

  /** Every tip back to where it hangs at rest, every bone to its rest turn. */
  reset() {
    for (const j of this.joints) j.bone.quaternion.copy(j.restQuat);
    this.root.updateWorldMatrix(true, true);
    for (const j of this.joints) {
      j.cur.copy(j.tailLocal).applyMatrix4(j.bone.matrixWorld);
      j.prev.copy(j.cur);
    }
  }

  /** One frame. Call AFTER the animation mixer has posed the body and BEFORE
   *  rendering. `distance` is the figure's distance from the camera, for the
   *  far cut-off; leave it out to always simulate. */
  update(dt: number, distance?: number) {
    if (!this.enabled) return;
    if (distance !== undefined && distance > this.farDistance) {
      if (!this.far) { this.reset(); this.far = true; }
      return;
    }
    this.far = false;
    const t0 = performance.now();
    if (!this.measured) this.remeasure();
    // the body this frame: the chains' parents and the colliders' bones
    this.root.updateWorldMatrix(true, true);
    for (const c of this.colliders) {
      c.wa.copy(c.a).applyMatrix4(c.bone.matrixWorld);
      c.wb.copy(c.b).applyMatrix4(c.bone.matrixWorld);
      c.wr = c.radius * _d.setFromMatrixColumn(c.bone.matrixWorld, 1).length();
    }
    // the frame is cut into steps no longer than 1/60 s, and a very long one
    // (the tab was hidden) is simulated only for its first twentieth of a second
    const h = Math.min(dt, MAX_FRAME);
    const n = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(h / STEP)));
    const hs = h / n;
    for (let i = 0; i < n; i++) this.step(hs);
    this.lastMs = performance.now() - t0;
  }

  private step(h: number) {
    for (const level of this.levels) {
      if (!level) continue;
      for (const j of level) this.solveTip(j, h);
      for (const r of this.rings) this.blendRing(r, level[0]!.seg);
      for (const j of level) this.turnBone(j);
    }
  }

  /** Where this segment's tip goes this step, before its neighbours have a say. */
  private solveTip(j: Joint, h: number) {
    const P = j.params;
    const m = j.parent.matrixWorld;
    // where the bone's head is, and which way its parent is turned
    j.pos.copy(j.bone.position).applyMatrix4(m);
    _m.extractRotation(m);
    _prot.setFromRotationMatrix(_m);
    // the bone's world turn at rest under its parent AS IT IS NOW — the frame
    // the new direction is written back in (turnBone)
    j.restWorld.copy(_prot).multiply(j.restQuat);
    // the rest the tip is pulled toward: the whole chain hanging at rest
    // in the frame of its rest bone, as that bone is turned now
    _m.extractRotation(j.restBone.matrixWorld);
    _qi.setFromRotationMatrix(_m).multiply(j.restRel);
    j.restDir.copy(j.axis).applyQuaternion(_qi);
    _restTail.copy(j.pos).addScaledVector(j.restDir, j.length);
    // a figure that was just placed, or moved far in one frame, does not
    // drag its hem across the scene behind it
    if (j.cur.distanceToSquared(j.pos) > 9 * j.length * j.length) { j.cur.copy(_restTail); j.prev.copy(_restTail); }
    // Verlet: carry the velocity, less drag; add the pull to rest and gravity
    const keep = Math.pow(1 - P.drag, h / STEP);
    _next.subVectors(j.cur, j.prev).multiplyScalar(keep).add(j.cur);
    _f.subVectors(_restTail, j.cur).multiplyScalar(P.stiffness);
    _f.y -= P.gravity;
    _next.addScaledVector(_f, h * h);
    // the rod's direction
    j.dir.subVectors(_next, j.pos);
    const len = j.dir.length();
    if (len < 1e-9) j.dir.copy(j.restDir); else j.dir.divideScalar(len);
    // out of the body; then no further from rest than the chain allows —
    // AFTER the colliders, so a capsule cannot fling a beard out sideways;
    // then out of the body once more, so a capped tip is not left inside a leg
    this.collide(j);
    clampLean(j.dir, j.restDir, j.cosMax);
    this.collide(j);
    j.dir0.copy(j.dir);
  }

  private collide(j: Joint) {
    _next.copy(j.pos).addScaledVector(j.dir, j.length);
    for (const c of j.colliders) {
      closestOnSegment(_next, c.wa, c.wb, _cp);
      _d.subVectors(_next, _cp);
      const R = c.wr + j.radius;
      const d2 = _d.lengthSq();
      if (d2 >= R * R) continue;
      const dist = Math.sqrt(d2);
      if (dist < 1e-9) _next.copy(_cp).addScaledVector(j.restDir, R);
      else _next.copy(_cp).addScaledVector(_d, R / dist);
      j.dir.subVectors(_next, j.pos).normalize();
      _next.copy(j.pos).addScaledVector(j.dir, j.length);
    }
  }

  /** A skirt is one cloth: each column leans a little toward the two beside it.
   *
   *  What is blended is each column's DEVIATION from its own rest, not its
   *  direction: the columns of a skirt flare at different angles at rest,
   *  and the end column of an open row (a veil, ear to ear) has only one
   *  neighbour, so blending directions pulled a resting veil's side column
   *  39° toward the back every idle frame and folded the cloth on the
   *  shoulder up into a shelf. Deviations are all zero at rest. */
  private blendRing(r: Ring, seg: number) {
    const row = r.levels[seg];
    if (!row || row.length < 2) return;
    const n = row.length;
    for (let i = 0; i < n; i++) {
      const j = row[i]!;
      const a = r.closed ? row[(i + n - 1) % n]! : row[Math.max(i - 1, 0)]!;
      const b = r.closed ? row[(i + 1) % n]! : row[Math.min(i + 1, n - 1)]!;
      // (dev_a + dev_b) / 2 − dev_j, where dev = dir0 − restDir
      _avg.addVectors(a.dir0, b.dir0).sub(a.restDir).sub(b.restDir).multiplyScalar(0.5)
        .sub(j.dir0).add(j.restDir);
      j.dir.copy(j.dir0).addScaledVector(_avg, r.lateral).normalize();
      clampLean(j.dir, j.restDir, j.cosMax);
    }
  }

  /** Commit the step: the tip moves, the bone points at it. */
  private turnBone(j: Joint) {
    j.prev.copy(j.cur);
    j.cur.copy(j.pos).addScaledVector(j.dir, j.length);
    // in the frame of the bone at rest, the rotation that takes the rod's
    // axis to the new direction
    _local.copy(j.dir).applyQuaternion(_qi.copy(j.restWorld).invert());
    _dq.setFromUnitVectors(j.axis, _local);
    j.bone.quaternion.copy(j.restQuat).multiply(_dq);
    j.bone.updateWorldMatrix(false, false);        // the next segment reads this
  }
}

/** The one call a scene makes: attach springs to a loaded figure, or get
 *  null if the file has none. */
export const attachSprings = (root: THREE.Object3D) => SpringRig.from(root);
