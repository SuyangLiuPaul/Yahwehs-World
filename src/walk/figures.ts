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

// ── the register of figures ──────────────────────────────────────────────
//
// One place that says what each generated model is and how tall it stands, so
// a scene asks for a figure by name rather than repeating a number that might
// be wrong here and right there.
//
// WHICH HEIGHT. loadFigure scales by the model's bounding box, and for an
// animal that box is measured to whatever is highest AS POSED — a donkey's
// ears, a goat's horns — not to the withers, which is the height a farmer or
// a lexicon would quote. So `height` here is the overall height of the model
// standing as it stands, and `withers` records the shoulder height it
// corresponds to. Confusing the two would put a donkey's back at a man's
// chest, and getting sizes right is the whole reason this app exists.
export interface Figure {
  file: string;
  /** Overall height of the model as posed, in metres — what it is scaled to. */
  height: number;
  /** Shoulder height, for a quadruped, in metres. Not used; recorded. */
  withers?: number;
  en: string;
  zh: string;
  /** Why it looks the way it does. Shown in Evidence dialogs. */
  noteEn: string;
  noteZh: string;
}

export const FIGURES: Record<string, Figure> = {
  man: { file: 'man', height: 1.72, en: 'A man', zh: '男子',
    noteEn: 'Generic; identifies no one. Short-haired — 1 Cor 11:14 is the only word in the letters on a man\'s hair, and it says long hair on a man is a shame.',
    noteZh: '通用形象，不指任何人。短发——林前 11:14 是书信里唯一论到男人头发的话，说长头发是羞辱。' },
  woman: { file: 'woman', height: 1.63, en: 'A woman', zh: '女子',
    noteEn: 'Generic; identifies no one.', noteZh: '通用形象，不指任何人。' },
  priest: { file: 'priest', height: 1.70, en: 'A priest', zh: '祭司',
    noteEn: 'The garments of Ex 28:40–42: a linen coat, a girdle, a bonnet — and Ex 39:29 gives the girdle blue, purple and scarlet on fine twined linen. Barefoot: no shoe is among the garments. Hair polled, not shaven and not long (Ezek 44:20).',
    noteZh: '照出 28:40–42 的衣服：细麻内袍、腰带、裹头巾；腰带的蓝紫朱红出于出 39:29。赤脚——所记的祭司衣服里没有鞋。头发只可剪短，不可剃光也不可留长（结 44:20）。' },
  ox: { file: 'ox', height: 1.45, withers: 1.35, en: 'An ox', zh: '牛',
    noteEn: 'Stands for a clean kind (Gen 7:2). The number is the text\'s; the species is a display choice.',
    noteZh: '代表「洁净的一类」（创 7:2）。数目是经文的，种类是展示选择。' },
  camel: { file: 'camel', height: 2.05, withers: 1.90, en: 'A camel', zh: '骆驼',
    noteEn: 'The camel is named unclean in Lev 11:4, so this kind is the text\'s.',
    noteZh: '利 11:4 指名骆驼不洁净，所以这个种类是经文自己点的。' },
  sheep: { file: 'sheep', height: 0.86, withers: 0.76, en: 'A sheep', zh: '绵羊',
    noteEn: 'Fat-tailed, the Near Eastern breed — because Lev 3:9 has the whole rump taken off hard by the backbone and burnt, which is a fat tail and nothing else.',
    noteZh: '肥尾羊，近东的品种——因为利 3:9 要把「肥尾巴」整个从脊骨割下献上，那只有肥尾羊才有。' },
  lamb: { file: 'lamb', height: 0.63, withers: 0.55, en: 'A lamb', zh: '羊羔',
    noteEn: 'A yearling, which is what the daily offering and the passover both call for (Ex 12:5; 29:38). Not a shrunken sheep: a yearling is short-legged and big-headed, and it is modelled that way.',
    noteZh: '一岁的公羊羔，逾越节和每日的燔祭都是这个（出 12:5；29:38）。不是把羊缩小：一岁的羔腿短头大，是照这个做的。' },
  goat: { file: 'goat', height: 0.92, withers: 0.80, en: 'A goat', zh: '山羊',
    noteEn: 'The Syrian long-eared type. Sheep and goats are modelled as plainly different animals because Matt 25:32 turns on telling them apart.',
    noteZh: '叙利亚长耳山羊。绵羊与山羊做成明显不同的两种，因为太 25:32 整段比喻就建立在分得开这两样。' },
  ass: { file: 'ass', height: 1.35, withers: 1.05, en: 'An ass', zh: '驴',
    noteEn: 'Height is to the ear tips; the back is at 1.05 m, which is why a man rides one with his feet near the ground.',
    noteZh: '标的高度量到耳尖；背高一点零五米——所以骑驴的人脚几乎挨着地。' },
  dove: { file: 'dove', height: 0.30, en: 'A dove', zh: '鸽子',
    noteEn: 'Named in Gen 8:8, and the offering of the poor in Lev 5:7.',
    noteZh: '创 8:8 点名，也是利 5:7 里穷人的祭物。' },
  raven: { file: 'raven', height: 0.50, en: 'A raven', zh: '乌鸦',
    noteEn: 'Named in Gen 8:7 — the one sent out first.', noteZh: '创 8:7 点名——先放出去的那一只。' },
};

/** Loads a figure from the register, by name. */
export const loadNamed = (name: keyof typeof FIGURES) =>
  loadFigure(`/models/${FIGURES[name]!.file}.glb`, FIGURES[name]!.height);

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
