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

/** A figure placed many times: one load, one geometry, many transforms. */
export function place(template: THREE.Group, x: number, y: number, z: number, facing: number) {
  const copy = template.clone(true);
  copy.position.set(x, y, z);
  copy.rotation.y = facing;
  return copy;
}
