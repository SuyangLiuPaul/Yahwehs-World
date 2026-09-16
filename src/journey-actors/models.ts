import * as T from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { personStandingHeight, shipHullLength } from './geometry.ts';

// Generated actors for the miniature stage next to a route marker: the
// walking figures and the grain ship, standing in exactly where the text
// gives no measurement (D19, `handoff/13-asset-library.md`). Every fact this
// file leans on — the facing axis, the metalness bug, the Box3-vs-skeleton
// bug, the deck height — was found by rendering the models and looking, not
// assumed from a spec sheet; the reasoning for each is in the doc above.
//
// The ship's own loading pattern is the rule the whole file follows: the
// procedural miniature in `geometry.ts` renders first and is the fallback,
// never the other way round. A slow network, a missing file, or a browser
// that chokes on the GLB leaves `Staffage` drawing exactly what it always
// drew — nothing here is allowed to be a precondition for the map working.

const WALKER_URLS = ['models/traveller-v1.glb', 'models/shepherd-v1.glb'];
const SHIP_URL = 'models/roman-grain-ship-v1.glb';

/** These rigs face local +Z — confirmed by rendering the traveller from both
 * the +X and +Z sides and looking at which one shows a face. The stage's own
 * convention (the ship's hull, the procedural person) is local +X, so every
 * template is yawed once, before it is ever cloned, rather than trusting each
 * call site to remember a correction that has nothing to do with the route. */
const FACING_CORRECTION = Math.PI / 2;

/** Playback rate for the canned Casual_Walk clip. 1.0 (its native rate) reads
 * as marching rather than travelling — reported directly on this globe. */
const WALK_RATE = 0.62;

interface WalkerAsset { template: T.Object3D; clip: T.AnimationClip; scale: number; }

function clampMetalness(root: T.Object3D) {
  // Every character comes back from Meshy at metalness 1 with no metalness
  // map — a claim that an undyed wool robe is polished bronze. Lit by the
  // globe's plain directional lights, with no environment to reflect, that
  // renders as a near-black silhouette. Clamp it wherever there is no map to
  // defer to instead.
  root.traverse((o) => {
    const mesh = o as T.Mesh;
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of mats) {
      const std = m as T.MeshStandardMaterial;
      if (std.metalness !== undefined && !std.metalnessMap) std.metalness = Math.min(std.metalness, 0.06);
    }
  });
}

/** A rigged character's real height lives in its skeleton, not its geometry
 * box: Meshy exports the mesh in metres on a node scaled ×0.01, with the
 * bones in centimetres. Skinning composes the two correctly, so the figure
 * draws at the right size — but `Box3.setFromObject` never sees the bind
 * matrix that reconciles them, and reports a 1.7 m man as 17 mm. */
function skeletonHeight(root: T.Object3D): number {
  const box = new T.Box3(); const v = new T.Vector3(); let skinned = false;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const sm = o as T.SkinnedMesh;
    if (!sm.isSkinnedMesh) return;
    skinned = true;
    for (const bone of sm.skeleton.bones) box.expandByPoint(bone.getWorldPosition(v));
  });
  if (!skinned) box.setFromObject(root);
  return Math.max(0.1, box.max.y - box.min.y);
}

export class ActorModels {
  private walkers: WalkerAsset[] = [];
  private shipTemplate: T.Object3D | null = null;
  /** Height, in the ship's own fitted local units, at which a passenger's
   * feet meet the loaded hull's deck — found once by raycasting straight
   * down through the model at the same footprint the procedural passengers
   * already stand at, so a real hull's freeboard is measured, not guessed.
   * The `.56` here is the pre-existing procedural constant, used only until
   * the real measurement lands. */
  shipDeckY = 0.56;
  /** Resolves once loading has been attempted, success or failure — callers
   * poll `walkersReady` / `shipReady` per frame rather than await this; it
   * exists mainly so a caller can log once that nothing arrived. */
  readonly ready: Promise<void>;

  constructor() {
    const loader = new GLTFLoader();
    this.ready = Promise.allSettled([
      Promise.all(WALKER_URLS.map((url) => loader.loadAsync(url))),
      loader.loadAsync(SHIP_URL),
    ]).then(([walkers, ship]) => {
      if (walkers.status === 'fulfilled') this.prepareWalkers(walkers.value);
      else console.warn('journey figures did not load; the procedural miniature stands in.', walkers.reason);
      if (ship.status === 'fulfilled') this.prepareShip(ship.value.scene);
      else console.warn('the grain ship model did not load; the procedural hull stands in.', ship.reason);
    }).then(() => undefined);
  }

  private prepareWalkers(loaded: GLTF[]) {
    const target = personStandingHeight();
    this.walkers = loaded.flatMap((gltf) => {
      const clip = gltf.animations[0];
      if (!clip) return [];
      clampMetalness(gltf.scene);
      gltf.scene.rotation.y = FACING_CORRECTION;
      return [{ template: gltf.scene, clip, scale: target / skeletonHeight(gltf.scene) }];
    });
  }

  private prepareShip(scene: T.Object3D) {
    const box = new T.Box3().setFromObject(scene);
    const size = box.getSize(new T.Vector3());
    // Fit to the procedural hull's own length, measured, rather than a
    // hand-picked number — so redrawing either model keeps them the same size
    // on the map without this file changing.
    const scale = shipHullLength() / (size.x || 1);

    // Where a passenger's feet belong: raycast straight down through the raw
    // mesh at the same footprint the procedural passengers already use
    // (z = .27 in the hull's own units), converted into this model's
    // pre-scale space, offset from the mast rather than through it.
    const localZ = 0.27 / scale;
    let deckY = box.min.y + size.y * 0.4; // sane fallback if the cast misses
    const caster = new T.Raycaster(new T.Vector3(0, box.max.y + 1, localZ), new T.Vector3(0, -1, 0));
    const hit = caster.intersectObject(scene, true)[0];
    if (hit) deckY = hit.point.y;

    scene.scale.setScalar(scale);
    scene.position.y = -box.min.y * scale;
    this.shipDeckY = (deckY - box.min.y) * scale;
    this.shipTemplate = scene;
  }

  get walkersReady() { return this.walkers.length > 0; }
  get shipReady() { return this.shipTemplate !== null; }

  /** A fresh, independently animatable copy of walker `seed % count`, already
   * scaled to stand as tall as one procedural person at `scale=1` and facing
   * the way the stage calls forward. Wrapped in an empty group so a caller
   * can drive the per-instance display scale (matching `batch.person`'s own
   * `scale` argument) without disturbing the height fit baked in here. */
  spawnWalker(seed: number): { group: T.Object3D; mixer: T.AnimationMixer } | null {
    if (!this.walkers.length) return null;
    const asset = this.walkers[seed % this.walkers.length]!;
    const inner = SkeletonUtils.clone(asset.template);
    inner.scale.setScalar(asset.scale);
    const group = new T.Group(); group.add(inner);
    const mixer = new T.AnimationMixer(inner);
    const action = mixer.clipAction(asset.clip);
    // The canned Casual_Walk clip at its native rate reads as marching, not
    // travelling — reported directly against this. The voyage-demo close
    // scene (src/voyage-demo/main.ts) carries the same constant.
    action.timeScale = WALK_RATE;
    action.play();
    // Stagger the phase the way the procedural gait already does
    // (`index*.9` in ActorBatch.person), so cloned figures do not all step
    // in lockstep.
    mixer.update((seed * 0.9) % asset.clip.duration);
    return { group, mixer };
  }

  /** A fresh clone of the fitted hull. Static geometry, no rig, no mixer. */
  spawnShip(): T.Object3D | null {
    return this.shipTemplate ? this.shipTemplate.clone() : null;
  }
}
