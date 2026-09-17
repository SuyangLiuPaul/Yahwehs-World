import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// The people and the beasts.
//
// These are the only meshes in the project that are not written as geometry in
// this repository: they are generated models (Higgsfield → Tripo, text to 3D),
// downloaded once into public/models/ and committed. Provenance is recorded in
// handoff/MANIFEST-assets.md, which is the rule for every asset that is not
// authored here.
//
// Two things keep them honest:
//
//   · SCALE. A generated mesh arrives at whatever size the generator felt
//     like. Every figure is measured and scaled to a stated height in metres,
//     and stood on the ground, so an ox is an ox's height beside a person and
//     not a dog or a house. Nothing in this app is allowed to be the wrong
//     size; that is the whole point of it.
//   · WHAT THEY CLAIM. The forms are generic and identify no individual. Where
//     the text names a kind (the raven and the dove of Genesis 8), the kind is
//     the text's; where it does not, the species is a display choice and the
//     Evidence dialog says so.

const loader = new GLTFLoader();

/** Loads one figure, scaled to `height` metres and standing on y = 0. */
export async function loadFigure(url: string, height: number): Promise<THREE.Group> {
  const gltf = await loader.loadAsync(url);
  const root = gltf.scene;
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  if (size.y > 1e-4) root.scale.setScalar(height / size.y);
  // Re-measure after scaling: centre on x/z, and set the feet on the ground.
  const scaled = new THREE.Box3().setFromObject(root);
  const centre = scaled.getCenter(new THREE.Vector3());
  root.position.set(-centre.x, -scaled.min.y, -centre.z);
  const group = new THREE.Group();
  group.add(root);
  group.traverse((o) => {
    o.userData.dynamic = true;                 // generated meshes never batch
    if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; }
  });
  return group;
}

// ── making many out of one ───────────────────────────────────────────────
//
// Fourteen copies of one ox, or a crowd out of six people, is only honest if
// the copies are not identical: a rank of clones reads as a rank of clones,
// and it also teaches something false — a congregation was never one man
// repeated, and a herd was never one beast repeated. So every copy gets a
// height, a turn and a shade of its own.
//
// The numbers are a FIXED TABLE and not Math.random for the same reason the
// ark's eight stand at fixed offsets: what a reader photographs today has to
// be there tomorrow, and a scene that reshuffles itself every reload cannot
// be checked by an audit.
//
// Height first, because it is the one that carries. Adult stature varies by
// about four per cent either side of the mean, which is the range here — big
// enough to break the rank, small enough that nobody in it is the wrong size.
const HEIGHT = [1.000, 0.972, 1.031, 0.988, 1.016, 0.964, 1.004, 1.039, 0.980, 1.024, 0.956, 0.996];
const TURN = [0, 0.14, -0.09, 0.21, -0.17, 0.06, -0.23, 0.11, 0.18, -0.05, 0.25, -0.13];
// Undyed wool and a beast's hide are not one colour. Four shades, SHARED —
// one cloned material per shade per template, not one per copy, so a crowd
// of three hundred still costs four materials.
const SHADE = [0xffffff, 0xf3ece1, 0xe6dccb, 0xfdf6ec];
const shades = new Map<string, THREE.Material>();

function shade(mesh: THREE.Mesh, k: number) {
  if (k === 0) return;                          // the template's own colour
  const base = mesh.material as THREE.MeshStandardMaterial;
  const key = `${base.uuid}:${k}`;
  let m = shades.get(key);
  if (!m) {
    const c = base.clone();
    c.color = new THREE.Color(SHADE[k]!).multiply(base.color);
    shades.set(key, c);
    m = c;
  }
  mesh.material = m;
}

/** A figure placed many times: one load, one geometry, many transforms.
 *
 *  `n` says which copy this is; copies with the same `n` look the same, and
 *  consecutive ones do not. Pass it for anything that appears more than once.
 */
export function place(template: THREE.Group, x: number, y: number, z: number,
  facing: number, n = 0) {
  const copy = template.clone(true);
  copy.position.set(x, y, z);
  copy.rotation.y = facing + TURN[n % TURN.length]!;
  // The template already stands with its feet on its own origin, so scaling
  // the group keeps them there.
  copy.scale.setScalar(HEIGHT[n % HEIGHT.length]!);
  const k = n % SHADE.length;
  copy.traverse((o) => { if (o instanceof THREE.Mesh) shade(o, k); });
  return copy;
}
