import * as THREE from 'three';
import { type Structure } from './specs.ts';
import { buildArkChest } from './ark-chest.ts';
import { buildMenorah } from './menorah.ts';
import { buildPillar, buildSea, buildStandingCherub } from './temple-parts.ts';
import { buildHighPriest } from './highpriest.ts';
import {
  buildBronzeAltar,
  buildIncenseAltar,
  buildShowbreadTable,
  buildWheeledLaver,
} from './furnishings.ts';
import {
  buildDuraImage,
  buildEzekielAltar,
  buildEzekielGate,
  buildForestHouse,
  buildGoliath,
  buildTabernacleTent,
} from './monuments.ts';
import {
  buildEzekielWheels,
  buildHerodSanctuary,
  buildSecondTemple,
  buildWildernessCamp,
} from './visions-and-temples.ts';
import {
  buildCarmelAltar,
  buildNehemiahWall,
  buildShunammiteChamber,
  buildShushanCourt,
} from './narrative-monuments.ts';
import {
  buildPaulShip,
  buildPentecostRoom,
  buildRev4ThroneRoom,
  buildSevenLampstands,
} from './apocalyptic-and-acts.ts';
import {
  buildAsiaChurchesRelief,
  buildCanaanAllotment,
  buildDispersionRelief,
  buildExodusRelief,
  buildGerizimEbalRelief,
  buildNinevehRelief,
  buildPaulJourneysRelief,
  buildPaulLettersRelief,
} from './relief-sandboxes.ts';
import {
  buildArkUpToZion,
  buildGideonThreeHundred,
  buildJordanTwelveStones,
} from './counted-scenes.ts';
import {
  buildBeatitudesHillside,
  buildBethlehemManger,
  buildGalileeBoat,
  buildIsaiahThrone,
  buildRedSeaCrossing,
  buildSinaiBounds,
  buildZionAscent,
} from './gospel-and-prophetic-scenes.ts';
import {
  buildActsCoastalRelief,
  buildJosephGranaries,
  buildMamreJordanRelief,
} from './relief-sandboxes.ts';
import {
  buildBethelPillar,
  buildCaesareaHall,
  buildDavidPreparations,
  buildEnclosedGarden,
  buildJobWhirlwind,
  buildPerpetualAltar,
  buildPottersHouse,
} from './wisdom-and-exile-scenes.ts';

interface BuildTex {
  gopherWood: THREE.CanvasTexture;
  limestone: THREE.CanvasTexture;
  goldTile: THREE.CanvasTexture;
  bronze: THREE.CanvasTexture;
  stripeGate: THREE.CanvasTexture;
}

let cachedBuildTex: BuildTex | null = null;

function shareBuildTex(c: HTMLCanvasElement, rx = 1, ry = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.userData.shared = true;
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}

function getBuildTex(): BuildTex {
  if (cachedBuildTex) return cachedBuildTex;

  // Timber & dark bitumen pitch seams for Noah's Ark
  const wc = document.createElement('canvas');
  wc.width = 256;
  wc.height = 256;
  const wx = wc.getContext('2d')!;
  wx.fillStyle = '#5c3c22';
  wx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 24) {
    wx.fillStyle = y % 48 === 0 ? '#6e492a' : '#53351d';
    wx.fillRect(0, y, 256, 21);
    wx.fillStyle = '#24180f'; // Pitch seam
    wx.fillRect(0, y + 21, 256, 3);
  }
  const gopherWood = shareBuildTex(wc, 6, 3);

  // Dressed Jerusalem limestone ashlar
  const lc = document.createElement('canvas');
  lc.width = 256;
  lc.height = 256;
  const lx = lc.getContext('2d')!;
  lx.fillStyle = '#ded3bc';
  lx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++) {
    const y = row * 32;
    const off = (row % 2) * 32;
    for (let col = -1; col < 5; col++) {
      const shade = 212 + (((row * 5 + col * 11) & 15) - 7) * 2;
      lx.fillStyle = `rgb(${shade}, ${shade - 8}, ${shade - 22})`;
      lx.fillRect(col * 64 + off + 2, y + 2, 60, 28);
    }
  }
  const limestone = shareBuildTex(lc, 5, 3);

  // Carved cedar/gold panels for Most Holy Place
  const gc = document.createElement('canvas');
  gc.width = 128;
  gc.height = 128;
  const gx = gc.getContext('2d')!;
  gx.fillStyle = '#d9ac3e';
  gx.fillRect(0, 0, 128, 128);
  gx.strokeStyle = '#9c7216';
  gx.lineWidth = 4;
  gx.strokeRect(8, 8, 112, 112);
  gx.strokeRect(24, 24, 80, 80);
  const goldTile = shareBuildTex(gc, 4, 4);

  // Cast bronze patina
  const bc = document.createElement('canvas');
  bc.width = 128;
  bc.height = 128;
  const bx = bc.getContext('2d')!;
  bx.fillStyle = '#b4743c';
  bx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 160; i++) {
    bx.fillStyle = i % 2 === 0 ? 'rgba(224,168,98,0.2)' : 'rgba(90,52,20,0.2)';
    bx.beginPath();
    bx.arc((i * 47) % 128, (i * 89) % 128, 3 + (i % 4), 0, Math.PI * 2);
    bx.fill();
  }
  const bronze = shareBuildTex(bc, 2, 4);

  // Tabernacle court eastern gate screen (blue, purple, scarlet, white linen)
  const sc = document.createElement('canvas');
  sc.width = 256;
  sc.height = 128;
  const sx = sc.getContext('2d')!;
  const cols = ['#efe8d8', '#1e4e8d', '#5c246b', '#a32424'];
  for (let x = 0; x < 256; x += 16) {
    sx.fillStyle = cols[(x >> 4) % cols.length] ?? '#efe8d8';
    sx.fillRect(x, 0, 16, 128);
  }
  const stripeGate = shareBuildTex(sc, 3, 1);

  cachedBuildTex = { gopherWood, limestone, goldTile, bronze, stripeGate };
  return cachedBuildTex;
}

/**
 * Accurate 1.72m short-haired human scale figure (1 Cor 11:14) in modest tunic & sandals.
 */
export function humanFigure(heightM = 1.72): THREE.Group {
  const s = heightM / 1.72;
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xc2926b, roughness: 0.72 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x261c17, roughness: 0.88 });
  const tunic = new THREE.MeshStandardMaterial({ color: 0xddd4c2, roughness: 0.84 });
  const sash = new THREE.MeshStandardMaterial({ color: 0x5c738f, roughness: 0.8 });

  // Sandaled feet & calves
  for (const side of [-1, 1]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.03 * s, 0.21 * s), hair);
    foot.position.set(side * 0.08 * s, 0.015 * s, 0.02 * s);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.042 * s, 0.036 * s, 0.22 * s, 10), skin);
    shin.position.set(side * 0.08 * s, 0.13 * s, 0);
    g.add(foot, shin);
  }

  // Modest full tunic
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.155 * s, 0.205 * s, 1.18 * s, 18), tunic);
  robe.scale.set(1.06, 1, 0.7);
  robe.position.y = 0.82 * s;
  g.add(robe);

  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.172 * s, 0.176 * s, 0.07 * s, 18), sash);
  belt.scale.set(1.06, 1, 0.71);
  belt.position.y = 0.99 * s;
  g.add(belt);

  // Arms at sides
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.044 * s, 0.038 * s, 0.56 * s, 10), tunic);
    arm.position.set(side * 0.195 * s, 1.12 * s, 0);
    arm.rotation.z = side * 0.1;
    g.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.034 * s, 8, 6), skin);
    hand.position.set(side * 0.225 * s, 0.83 * s, 0);
    g.add(hand);
  }

  // Neck, head & short cropped hair
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.048 * s, 0.056 * s, 0.09 * s, 12), skin);
  neck.position.y = 1.44 * s;
  g.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.096 * s, 16, 14), skin);
  head.scale.set(0.86, 1.08, 0.94);
  head.position.y = 1.56 * s;
  g.add(head);

  const shortHair = new THREE.Mesh(
    new THREE.SphereGeometry(0.100 * s, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    hair,
  );
  shortHair.scale.set(0.87, 0.96, 0.96);
  shortHair.position.set(0, 1.578 * s, -0.008 * s);
  shortHair.rotation.x = -0.22;
  g.add(shortHair);

  // Crown top sits at ~1.67m + slight hair thickness -> top of box ~1.72m
  const crownTop = new THREE.Mesh(new THREE.SphereGeometry(0.055 * s, 10, 8), hair);
  crownTop.scale.set(1.2, 0.65, 1.2);
  crownTop.position.set(0, 1.66 * s, 0);
  g.add(crownTop);

  return g;
}

function isAnimatedNode(obj: THREE.Object3D): boolean {
  const ud = obj.userData;
  if (!ud) return false;
  return (
    typeof ud.flame === 'number' ||
    typeof ud.water === 'number' ||
    typeof ud.ember === 'number' ||
    Boolean(ud.smoke && typeof ud.smoke === 'object') ||
    typeof ud.orbitGlow === 'number' ||
    typeof ud.shimmer === 'number'
  );
}

function animateNode(obj: THREE.Object3D, elapsed: number): void {
  const ud = obj.userData;
  if (!ud) return;

  if (typeof ud.flame === 'number') {
    const f = ud.flame;
    const flicker = Math.sin(elapsed * 7.2 + f * 1.9) * 0.08 + Math.cos(elapsed * 11.4 + f * 3.1) * 0.05;
    obj.scale.set(1 - flicker * 0.35, 1 + flicker, 1 - flicker * 0.35);
    obj.rotation.z = Math.sin(elapsed * 5.3 + f * 2.4) * 0.06;
  }

  if (typeof ud.water === 'number') {
    const w = ud.water;
    if (typeof ud.waterBaseY !== 'number') ud.waterBaseY = obj.position.y;
    obj.rotation.z = Math.sin(elapsed * 1.1 + w) * 0.008;
    obj.position.y = (ud.waterBaseY as number) + Math.sin(elapsed * 2.1 + w * 1.7) * 0.004;
  }

  if (typeof ud.ember === 'number' && obj instanceof THREE.Mesh) {
    const m = obj.material;
    if (m instanceof THREE.MeshStandardMaterial) {
      m.emissiveIntensity = 0.65 + Math.sin(elapsed * 3.1 + ud.ember) * 0.2;
    }
  }

  if (ud.smoke && typeof ud.smoke === 'object') {
    const s = ud.smoke as { index: number; baseY: number; amplitude: number };
    const phase = (elapsed * 0.65 + s.index * 0.48) % 1;
    obj.position.y = s.baseY + phase * s.amplitude * 2.2;
    obj.position.x = Math.sin(elapsed * 1.8 + s.index * 1.3) * s.amplitude * 0.45;
    if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
      obj.material.opacity = Math.max(0.03, (1 - phase) * 0.24);
    }
  }

  if (typeof ud.orbitGlow === 'number') {
    obj.rotation.z = elapsed * (0.08 * (ud.orbitGlow % 2 === 0 ? 1 : -1));
    if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
      obj.material.emissiveIntensity = 0.45 + Math.sin(elapsed * 1.6 + ud.orbitGlow) * 0.18;
    }
  }

  if (typeof ud.shimmer === 'number' && obj instanceof THREE.Mesh) {
    const m = obj.material;
    if (m instanceof THREE.MeshStandardMaterial) {
      m.emissiveIntensity = 0.08 + Math.max(0, Math.sin(elapsed * 2.2 + ud.shimmer * 0.9)) * 0.16;
    }
  }
}

/** Collects animated child nodes once after building so per-frame animation avoids full-tree traversal. */
export function collectAnimatedNodes(root: THREE.Object3D): THREE.Object3D[] {
  const nodes: THREE.Object3D[] = [];
  root.traverse((obj) => {
    if (isAnimatedNode(obj)) nodes.push(obj);
  });
  return nodes;
}

/** Drives ambient motion across pre-collected animated structure nodes. */
export function animateStructureNodes(nodes: readonly THREE.Object3D[], elapsed: number): void {
  for (let i = 0; i < nodes.length; i++) {
    animateNode(nodes[i]!, elapsed);
  }
}

/**
 * Drives subtle ambient motion across structure meshes (flames, water, embers, smoke, orbit, gold shimmer).
 */
export function animateStructure(root: THREE.Object3D, elapsed: number): void {
  root.traverse((obj) => animateNode(obj, elapsed));
}

function buildNoahArk(C: number, variant: string): THREE.Group {
  const L = 300 * C;
  const W = 50 * C;
  const H = 30 * C;
  const tex = getBuildTex();
  const g = new THREE.Group();
  const cut = variant !== 'enclosed';

  const wood = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex.gopherWood,
    roughness: 0.85,
  });
  const pitchWood = new THREE.MeshStandardMaterial({ color: 0x3b2718, roughness: 0.92 });
  const deckWood = new THREE.MeshStandardMaterial({ color: 0x8a5b32, roughness: 0.82 });
  const clerestoryGlow = new THREE.MeshStandardMaterial({
    color: 0xf7dca1,
    emissive: 0xd9a84e,
    emissiveIntensity: 0.42,
    roughness: 0.4,
  });

  // Keel & gently tapered bow/stern barge hull (Gen 6:14-16)
  const hullBodyL = L * 0.78;
  const taperL = (L - hullBodyL) * 0.5;
  const wallT = 1.6 * C;
  const clerestoryH = 1.0 * C;
  const sideH = H - clerestoryH;

  // Floor slab
  const floor = new THREE.Mesh(new THREE.BoxGeometry(L, wallT, W), pitchWood);
  floor.position.y = wallT * 0.5;
  g.add(floor);

  // Port (-Z) full wall + sloped/chined bow & stern endwalls
  const portWall = new THREE.Mesh(new THREE.BoxGeometry(hullBodyL, sideH, wallT), wood);
  portWall.position.set(0, sideH * 0.5, -W * 0.5 + wallT * 0.5);
  g.add(portWall);

  for (const sx of [-1, 1]) {
    const xEnd = sx * (hullBodyL * 0.5 + taperL * 0.5);
    const wedge = new THREE.Mesh(new THREE.BoxGeometry(taperL, sideH, W * 0.86), wood);
    wedge.position.set(xEnd, sideH * 0.5, 0);
    g.add(wedge);

    const stemPost = new THREE.Mesh(new THREE.BoxGeometry(wallT * 1.4, H, W * 0.7), pitchWood);
    stemPost.position.set(sx * (L * 0.5 - wallT * 0.7), H * 0.5, 0);
    g.add(stemPost);
  }

  // Starboard (+Z) wall: open 65% in 'cutaway' showing 3 full decks + timber ribs + stalls; full with side door in 'enclosed'
  if (cut) {
    for (const sx of [-1, 1]) {
      const stub = new THREE.Mesh(new THREE.BoxGeometry(L * 0.14, sideH, wallT), wood);
      stub.position.set(sx * (hullBodyL * 0.5 - L * 0.07), sideH * 0.5, W * 0.5 - wallT * 0.5);
      g.add(stub);
    }
    const lowerRail = new THREE.Mesh(new THREE.BoxGeometry(hullBodyL, 2.5 * C, wallT), pitchWood);
    lowerRail.position.set(0, 1.25 * C, W * 0.5 - wallT * 0.5);
    g.add(lowerRail);
  } else {
    const starWall = new THREE.Mesh(new THREE.BoxGeometry(hullBodyL, sideH, wallT), wood);
    starWall.position.set(0, sideH * 0.5, W * 0.5 - wallT * 0.5);
    g.add(starWall);

    // Side access door framed in pitch timber (Gen 6:16)
    const door = new THREE.Mesh(new THREE.BoxGeometry(8 * C, 12 * C, wallT * 1.2), pitchWood);
    door.position.set(L * 0.12, 13 * C, W * 0.5 - wallT * 0.5);
    g.add(door);
  }

  // Three interior decks (lower, second, third — Gen 6:16) + interior ribs & compartment bins
  for (const dy of [9.5 * C, 19.0 * C]) {
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(L * 0.94, 0.9 * C, W - wallT * 2.2),
      deckWood,
    );
    deck.position.y = dy;
    g.add(deck);
  }

  // Vertical interior stanchions & stall partitions
  for (let i = -5; i <= 5; i++) {
    const px = i * (hullBodyL / 11);
    for (const pz of [-W * 0.25, W * 0.25]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(1.1 * C, sideH, 1.1 * C), pitchWood);
      post.position.set(px, sideH * 0.5, pz);
      g.add(post);
    }
  }

  // 1-cubit top light-gap (Tsohar, Gen 6:16) running along upper eaves beneath roof canopy
  const lightBand = new THREE.Mesh(
    new THREE.BoxGeometry(L * 0.9, clerestoryH, W * 0.96),
    clerestoryGlow,
  );
  lightBand.position.y = H - clerestoryH * 0.5;
  g.add(lightBand);

  // Slightly pitched roof deck (cut back along front edge in cutaway mode so top stalls stay clear)
  const roofW = cut ? W * 0.58 : W + 2 * C;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(L + 2 * C, 1.2 * C, roofW), wood);
  roof.position.set(0, H + 0.6 * C, cut ? -W * 0.22 : 0);
  g.add(roof);

  return g;
}

function buildCourt(C: number): THREE.Group {
  const L = 100 * C;
  const W = 50 * C;
  const H = 5 * C;
  const tex = getBuildTex();
  const g = new THREE.Group();

  const sand = new THREE.MeshStandardMaterial({ color: 0xcab48c, roughness: 0.96 });
  const linen = new THREE.MeshStandardMaterial({
    color: 0xf4ede0,
    roughness: 0.88,
    side: THREE.DoubleSide,
  });
  const gateCurtain = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex.stripeGate,
    roughness: 0.78,
    side: THREE.DoubleSide,
  });
  const wood = new THREE.MeshStandardMaterial({ color: 0x734a26, roughness: 0.8 });
  const bronze = new THREE.MeshStandardMaterial({ color: 0xb5753d, metalness: 0.72, roughness: 0.34 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xd6dde6, metalness: 0.86, roughness: 0.24 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe6b847, metalness: 0.86, roughness: 0.24 });

  // Courtyard ground floor + subtle east/west 50x50 square boundary line
  const floor = new THREE.Mesh(new THREE.BoxGeometry(L + 8 * C, 0.22 * C, W + 8 * C), sand);
  floor.position.y = 0.11 * C;
  g.add(floor);

  const postGeo = new THREE.CylinderGeometry(0.18 * C, 0.22 * C, H, 10);
  const socketGeo = new THREE.BoxGeometry(0.65 * C, 0.38 * C, 0.65 * C);
  const capGeo = new THREE.CylinderGeometry(0.28 * C, 0.22 * C, 0.28 * C, 12);
  const pegGeo = new THREE.CylinderGeometry(0.06 * C, 0.03 * C, 0.45 * C, 6);

  const addPost = (x: number, z: number, cordDx: number, cordDz: number) => {
    const sock = new THREE.Mesh(socketGeo, bronze);
    sock.position.set(x, 0.19 * C, z);
    const post = new THREE.Mesh(postGeo, wood);
    post.position.set(x, H * 0.5 + 0.18 * C, z);
    const cap = new THREE.Mesh(capGeo, silver);
    cap.position.set(x, H + 0.18 * C, z);
    g.add(sock, post, cap);

    // Outer tent rope + bronze peg (Exod 27:19)
    const ropeLen = Math.hypot(cordDx, H * 0.88, cordDz);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * C, 0.03 * C, ropeLen, 4), linen);
    rope.position.set(x + cordDx * 0.5, H * 0.55, z + cordDz * 0.5);
    rope.lookAt(x + cordDx, 0.2 * C, z + cordDz);
    rope.rotateX(Math.PI / 2);
    const peg = new THREE.Mesh(pegGeo, bronze);
    peg.position.set(x + cordDx, 0.2 * C, z + cordDz);
    g.add(rope, peg);
  };

  // South (+Z, 20 bays -> 21 posts? Use 5C spacing: 20 intervals) & North (-Z) 100 cubit walls
  for (let i = 0; i <= 20; i++) {
    const x = -L * 0.5 + i * 5 * C;
    addPost(x, -W * 0.5, 0, -2.5 * C);
    addPost(x, W * 0.5, 0, 2.5 * C);
  }
  const northCurtain = new THREE.Mesh(new THREE.PlaneGeometry(L, H), linen);
  northCurtain.position.set(0, H * 0.5 + 0.2 * C, -W * 0.5);
  const southCurtain = northCurtain.clone();
  southCurtain.position.z = W * 0.5;
  g.add(northCurtain, southCurtain);

  // West rear wall (50 cubits = 10 bays)
  for (let i = 1; i < 10; i++) {
    const z = -W * 0.5 + i * 5 * C;
    addPost(-L * 0.5, z, -2.5 * C, 0);
  }
  const westCurtain = new THREE.Mesh(new THREE.PlaneGeometry(W, H), linen);
  westCurtain.rotation.y = Math.PI / 2;
  westCurtain.position.set(-L * 0.5, H * 0.5 + 0.2 * C, 0);
  g.add(westCurtain);

  // East wall: 15C wing + 20C colorful woven gate screen + 15C wing
  for (let i = 1; i < 10; i++) {
    const z = -W * 0.5 + i * 5 * C;
    addPost(L * 0.5, z, 2.5 * C, 0);
  }
  for (const sz of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.PlaneGeometry(15 * C, H), linen);
    wing.rotation.y = Math.PI / 2;
    wing.position.set(L * 0.5, H * 0.5 + 0.2 * C, sz * 17.5 * C);
    g.add(wing);
  }
  const eastGate = new THREE.Mesh(new THREE.PlaneGeometry(20 * C, H), gateCurtain);
  eastGate.rotation.y = Math.PI / 2;
  eastGate.position.set(L * 0.5 + 0.1 * C, H * 0.5 + 0.2 * C, 0);
  g.add(eastGate);

  // Inner courtyard layout reference massings (5x5 altar, circular laver, 30x10x10 Tabernacle tent)
  const altarRef = new THREE.Mesh(new THREE.BoxGeometry(5 * C, 3 * C, 5 * C), bronze);
  altarRef.position.set(25 * C, 1.5 * C, 0);
  const laverRef = new THREE.Mesh(new THREE.CylinderGeometry(2.2 * C, 1.5 * C, 2.4 * C, 16), bronze);
  laverRef.position.set(14 * C, 1.2 * C, 0);
  const tentRef = new THREE.Mesh(new THREE.BoxGeometry(30 * C, 10 * C, 10 * C), gold);
  tentRef.position.set(-22 * C, 5.2 * C, 0);
  const tentRoof = new THREE.Mesh(new THREE.BoxGeometry(31 * C, 0.8 * C, 11 * C), wood);
  tentRoof.position.set(-22 * C, 10.4 * C, 0);
  g.add(altarRef, laverRef, tentRef, tentRoof);

  return g;
}

function buildTempleHouse(C: number, variant: string): THREE.Group {
  const L = 60 * C;
  const W = 20 * C;
  const H = 30 * C;
  const porchL = 10 * C;
  const tex = getBuildTex();
  const g = new THREE.Group();
  const cut = variant !== 'exterior';

  const stone = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex.limestone,
    roughness: 0.85,
  });
  const cedar = new THREE.MeshStandardMaterial({ color: 0x734423, roughness: 0.78 });
  const gold = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex.goldTile,
    metalness: 0.8,
    roughness: 0.24,
  });
  const bronze = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex.bronze,
    metalness: 0.74,
    roughness: 0.32,
  });

  // Raised limestone podium + eastern stairs
  const podiumH = 3.0 * C;
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(L + porchL + 18 * C, podiumH, W + 20 * C),
    stone,
  );
  platform.position.set(porchL * 0.3, podiumH * 0.5, 0);
  g.add(platform);

  const wallT = 3.2 * C;
  // Back (-Z) and West (-X) outer walls + inner walls
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(L + wallT * 2, H, wallT), stone);
  backWall.position.set(0, podiumH + H * 0.5, -W * 0.5 - wallT * 0.5);
  const westWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, H, W + wallT * 2), stone);
  westWall.position.set(-L * 0.5 - wallT * 0.5, podiumH + H * 0.5, 0);
  g.add(backWall, westWall);

  // Side chamber tiers (5C / 6C / 7C wide in three stepped ledges along north & west, 1 Kgs 6:5-6)
  for (let tier = 0; tier < 3; tier++) {
    const chW = (5 + tier) * C;
    const chH = 5 * C;
    const cy = podiumH + tier * 5.2 * C + chH * 0.5;
    const northAnnex = new THREE.Mesh(new THREE.BoxGeometry(L, chH, chW), stone);
    northAnnex.position.set(0, cy, -W * 0.5 - wallT - chW * 0.5);
    g.add(northAnnex);

    if (!cut) {
      const southAnnex = northAnnex.clone();
      southAnnex.position.z = W * 0.5 + wallT + chW * 0.5;
      g.add(southAnnex);
    }
  }

  // Interior Holy Place cedar ceiling (40C at y = 30C) + Most Holy Place 20x20x20 pure gold cube (west 20C)
  const debirSize = 20 * C;
  const debirFloor = new THREE.Mesh(new THREE.BoxGeometry(debirSize, 0.5 * C, W), gold);
  debirFloor.position.set(-L * 0.5 + debirSize * 0.5, podiumH + 0.25 * C, 0);
  const debirBack = new THREE.Mesh(new THREE.BoxGeometry(debirSize, debirSize, 0.6 * C), gold);
  debirBack.position.set(-L * 0.5 + debirSize * 0.5, podiumH + debirSize * 0.5, -W * 0.5 + 0.3 * C);
  const debirWest = new THREE.Mesh(new THREE.BoxGeometry(0.6 * C, debirSize, W), gold);
  debirWest.position.set(-L * 0.5 + 0.3 * C, podiumH + debirSize * 0.5, 0);
  const debirCeiling = new THREE.Mesh(new THREE.BoxGeometry(debirSize, 0.8 * C, W), gold);
  debirCeiling.position.set(-L * 0.5 + debirSize * 0.5, podiumH + debirSize, 0);
  g.add(debirFloor, debirBack, debirWest, debirCeiling);

  // Partition wall separating 40C Hekal & 20C Debir with central doorway
  for (const sz of [-1, 1]) {
    const part = new THREE.Mesh(new THREE.BoxGeometry(0.8 * C, debirSize, 7 * C), gold);
    part.position.set(-10 * C, podiumH + debirSize * 0.5, sz * 6.5 * C);
    g.add(part);
  }

  // Twin 10-cubit standing Cherubim inside Debir (1 Kgs 6:23-28) + Ark of the Covenant
  for (const sz of [-1, 1]) {
    const ch = buildStandingCherub(C, gold);
    ch.rotation.y = Math.PI / 2; // wings span across the 20C north-south room, facing east
    ch.position.set(-20 * C, podiumH + 0.5 * C, sz * 5 * C);
    g.add(ch);
  }
  const innerArk = buildArkChest(C);
  innerArk.position.set(-20 * C, podiumH + 0.5 * C, 0);
  g.add(innerArk);

  // East Porch (Ulam: 20 x 10 cubits) + Twin Jachin & Boaz pillars flanking the east entrance
  const porchBackWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, H, 7 * C), stone);
  for (const sz of [-1, 1]) {
    const jamb = porchBackWall.clone();
    jamb.position.set(L * 0.5, podiumH + H * 0.5, sz * 7.5 * C);
    g.add(jamb);
  }
  const porchFloor = new THREE.Mesh(new THREE.BoxGeometry(porchL, 0.6 * C, W), stone);
  porchFloor.position.set(L * 0.5 + porchL * 0.5, podiumH + 0.3 * C, 0);
  const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(porchL, 1.8 * C, W + wallT * 2), stone);
  porchRoof.position.set(L * 0.5 + porchL * 0.5, podiumH + H - 1.0 * C, 0);
  g.add(porchFloor, porchRoof);

  for (const sz of [-1, 1]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(1.8 * C, 1.9 * C, 23 * C, 16), bronze);
    col.position.set(L * 0.5 + porchL - 1.5 * C, podiumH + 11.5 * C, sz * 6.5 * C);
    g.add(col);
  }

  // East stairs
  for (let i = 0; i < 6; i++) {
    const stepH = (podiumH / 6) * (i + 1);
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.4 * C, stepH, 14 * C), stone);
    step.position.set(L * 0.5 + porchL + 6 * C - i * 1.3 * C, stepH * 0.5, 0);
    g.add(step);
  }

  // Exterior South wall + main cedar roof when not cutaway
  if (!cut) {
    const southWall = backWall.clone();
    southWall.position.z = W * 0.5 + wallT * 0.5;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(L + wallT * 2, 1.8 * C, W + wallT * 2), cedar);
    roof.position.set(0, podiumH + H + 0.9 * C, 0);
    g.add(southWall, roof);
  } else {
    // Partial back roof lip + clerestory window cutouts along upper north wall
    const halfRoof = new THREE.Mesh(new THREE.BoxGeometry(L + wallT, 1.5 * C, W * 0.42), cedar);
    halfRoof.position.set(0, podiumH + H + 0.75 * C, -W * 0.32);
    g.add(halfRoof);
  }

  return g;
}

function buildNewJerusalem(unitM: number): THREE.Group {
  const S = 12000 * unitM; // 2,220 km cube
  const g = new THREE.Group();

  // Translucent radiant jasper-gold glass cube (Rev 21:16-21)
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xffdf7a,
    emissive: 0x9b6d18,
    emissiveIntensity: 0.42,
    metalness: 0.45,
    roughness: 0.16,
    transparent: true,
    opacity: 0.34,
  });
  const cube = new THREE.Mesh(new THREE.BoxGeometry(S, S, S), coreMat);
  cube.position.y = S * 0.5;
  g.add(cube);

  // Pure gold structural edges & corner framing
  const edgeMat = new THREE.MeshStandardMaterial({
    color: 0xf7cf5c,
    emissive: 0x8a6110,
    emissiveIntensity: 0.45,
    metalness: 0.9,
    roughness: 0.18,
  });
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(S, S, S)),
    new THREE.LineBasicMaterial({ color: 0xffe488, transparent: true, opacity: 0.85 }),
  );
  edges.position.y = S * 0.5;
  g.add(edges);

  // 12 Jeweled Foundation Courses beneath the base (Rev 21:19-20)
  const foundColors = [
    0x6eb88d, 0x2659b5, 0x73b0b8, 0x1e8f4e,
    0xa35a38, 0xb8292f, 0xd4ad38, 0x45a384,
    0xd49c24, 0x7eb848, 0x3b6cb8, 0x7a3ea3,
  ];
  const bandH = S * 0.008;
  for (let i = 0; i < 12; i++) {
    const layer = new THREE.Mesh(
      new THREE.BoxGeometry(S * 1.03, bandH, S * 1.03),
      new THREE.MeshStandardMaterial({
        color: foundColors[i],
        emissive: foundColors[i],
        emissiveIntensity: 0.28,
        roughness: 0.3,
      }),
    );
    layer.position.y = bandH * (i + 0.5);
    g.add(layer);
  }

  // 12 Pearl Gates (3 per wall along the base perimeter, Rev 21:12-13, 21)
  const pearlMat = new THREE.MeshStandardMaterial({
    color: 0xfcfbf7,
    emissive: 0xd8e0f0,
    emissiveIntensity: 0.35,
    roughness: 0.12,
  });
  const gateSize = S * 0.025;
  for (const side of [-1, 1]) {
    for (const off of [-0.28, 0, 0.28]) {
      const gx = new THREE.Mesh(new THREE.SphereGeometry(gateSize, 12, 10), pearlMat);
      gx.position.set(off * S, gateSize * 1.5, side * S * 0.515);
      const gz = new THREE.Mesh(new THREE.SphereGeometry(gateSize, 12, 10), pearlMat);
      gz.position.set(side * S * 0.515, gateSize * 1.5, off * S);
      g.add(gx, gz);
    }
  }

  // Gently orbiting celestial ring highlight
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(S * 0.78, S * 0.004, 8, 72),
    edgeMat,
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = S * 0.5;
  halo.userData.orbitGlow = 1;
  g.add(halo);

  // Macro Earth curvature horizon sphere beneath (R = 6,371 km vs 2,220 km city!)
  const R_EARTH = 6_371_000;
  const earthCap = new THREE.Mesh(
    new THREE.SphereGeometry(R_EARTH, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.22),
    new THREE.MeshStandardMaterial({
      color: 0x1b456b,
      emissive: 0x0a2138,
      emissiveIntensity: 0.35,
      roughness: 0.82,
    }),
  );
  earthCap.position.y = -R_EARTH - S * 0.02;
  g.add(earthCap);

  // Subtle 408 km ISS orbital altitude arc above Earth's surface (~18% of city height!)
  const issOrbit = new THREE.Mesh(
    new THREE.TorusGeometry(R_EARTH + 408_000, S * 0.003, 6, 80, Math.PI * 0.34),
    new THREE.MeshStandardMaterial({
      color: 0x70c7ff,
      emissive: 0x3b8ec4,
      emissiveIntensity: 0.6,
    }),
  );
  issOrbit.rotation.z = Math.PI * 0.33;
  issOrbit.position.y = -R_EARTH - S * 0.02;
  g.add(issOrbit);

  return g;
}

/**
 * Builds measured and counted biblical 3D structures and reliefs in world metres, seated on y = 0.
 * Compatible with external callers passing 2 arguments: `buildStructure(arkSpec, cubit)`.
 */
export function buildStructure(
  s: Structure,
  cubitM: number,
  variant?: string,
): THREE.Group {
  const C = cubitM;
  const v = variant ?? s.variants?.options[0]?.id ?? '';

  switch (s.kind) {
    case 'ark':
      return buildNoahArk(C, v);

    case 'chest':
      return buildArkChest(C);

    case 'court':
      return buildCourt(C);

    case 'menorah': {
      const form = v === 'straight' ? 'straight' : 'arch';
      const h = s.assumedHeight ?? 1.5;
      const { group } = buildMenorah(h, form);
      // 7 gently flickering olive-oil flames aligned directly over each lamp bowl (Exod 25:37)
      const unit = h / 8.6;
      const topY = unit * 7.5;
      const xs = [0];
      for (let pair = 0; pair < 3; pair++) {
        const r = unit * (2.15 + pair * 0.78);
        xs.push(-r, r);
      }
      const flameMat = new THREE.MeshStandardMaterial({
        color: 0xffdc7a,
        emissive: 0xff8a1c,
        emissiveIntensity: 1.45,
        roughness: 0.2,
      });
      const oilMat = new THREE.MeshStandardMaterial({
        color: 0xd19c2e,
        roughness: 0.18,
      });
      xs.forEach((bx, idx) => {
        const oilPool = new THREE.Mesh(
          new THREE.CylinderGeometry(unit * 0.22, unit * 0.20, unit * 0.03, 14),
          oilMat,
        );
        oilPool.position.set(bx, topY + unit * 0.12, 0);
        const flame = new THREE.Mesh(
          new THREE.ConeGeometry(unit * 0.10, unit * 0.42, 10),
          flameMat,
        );
        flame.position.set(bx + unit * 0.25, topY + unit * 0.34, 0);
        flame.userData.flame = idx + 1;
        group.add(oilPool, flame);
      });
      return group;
    }

    case 'tabernacleTent':
      return buildTabernacleTent(C, v === 'covered' ? 'covered' : 'cutaway');

    case 'showbreadTable':
      return buildShowbreadTable(C, v === 'cutaway' ? 'cutaway' : 'full');

    case 'incenseAltar':
      return buildIncenseAltar(C, v === 'cutaway' ? 'cutaway' : 'lit');

    case 'bronzeAltar':
      return buildBronzeAltar(
        C,
        v === 'tabernacle-full' ? 'tabernacle-full' : 'tabernacle-cutaway',
      );

    case 'highpriest':
      return buildHighPriest(
        C,
        v === 'breastpiece' ? 'breastpiece' : 'vested',
        s.assumedHeight ?? 1.72,
      );

    case 'templeHouse':
      return buildTempleHouse(C, v);

    case 'bronzePillar': {
      const tex = getBuildTex();
      const bronze = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: tex.bronze,
        metalness: 0.76,
        roughness: 0.3,
      });
      const height = v === 'chronicles-35' ? 35 : 18;
      const root = new THREE.Group();
      // Twin pillars Jachin & Boaz side-by-side (1 Kgs 7:15-22)
      for (const sx of [-1, 1]) {
        const { group } = buildPillar(
          { cubit: C, height, girth: 12, capital: 5, pomegranates: 200 },
          bronze,
        );
        group.position.x = sx * 4.4 * C;
        root.add(group);
      }
      return root;
    }

    case 'bronzeSea': {
      const tex = getBuildTex();
      const bronze = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: tex.bronze,
        metalness: 0.76,
        roughness: 0.3,
      });
      const { group } = buildSea({ cubit: C, diameter: 10, height: 5, girth: 30 }, bronze);
      // Animated turquoise water plane inside the 10-cubit bowl
      const waterMat = new THREE.MeshStandardMaterial({
        color: 0x267e9e,
        emissive: 0x0a394d,
        emissiveIntensity: 0.25,
        metalness: 0.38,
        roughness: 0.12,
        transparent: true,
        opacity: 0.88,
      });
      const water = new THREE.Mesh(new THREE.CircleGeometry(4.65 * C, 48), waterMat);
      water.rotation.x = -Math.PI / 2;
      water.position.y = (0.86 * 1.55 - 0.05 + 4.42) * C;
      water.userData.water = 1;
      group.add(water);
      return group;
    }

    case 'wheeledLaver':
      return buildWheeledLaver(C, v === 'five-row' ? 'five-row' : 'single');

    case 'forestHouse':
      return buildForestHouse(C, v === '4-rows' ? '4-rows' : '3-rows');

    case 'ezekielGate':
      return buildEzekielGate(C, v === 'full' ? 'full' : 'cutaway');

    case 'ezekielAltar':
      return buildEzekielAltar(C, v === 'section' ? 'section' : 'full');

    case 'goliath':
      return buildGoliath(C, v === 'lxx-4-cubits' ? 'lxx-4-cubits' : 'mt-6-cubits');

    case 'duraImage':
      return buildDuraImage(C, v === 'daniel2-metals' ? 'daniel2-metals' : 'dura-gold');

    case 'herodSanctuary':
      return buildHerodSanctuary(C, v === 'cutaway' ? 'cutaway' : 'facade');

    case 'secondTemple':
      return buildSecondTemple(C, v === 'compare-solomon' ? 'compare-solomon' : 'cyrus-decree');

    case 'wildernessCamp':
      return buildWildernessCamp(C, v === 'compact' ? 'compact' : 'proportional');

    case 'ezekielWheels':
      return buildEzekielWheels(C, v === 'wheel-detail' ? 'wheel-detail' : 'full-vision');

    case 'nehemiahWall':
      return buildNehemiahWall(C, v === 'gate-cutaway' ? 'gate-cutaway' : 'broad-wall');

    case 'carmelAltar':
      return buildCarmelAltar(C, v === 'fire-from-heaven' ? 'fire-from-heaven' : 'water-filled');

    case 'shunammiteChamber':
      return buildShunammiteChamber(C, v === 'rooftop' ? 'rooftop' : 'cutaway');

    case 'shushanCourt':
      return buildShushanCourt(C, v === 'pavement-detail' ? 'pavement-detail' : 'canopied');

    case 'paulShip':
      return buildPaulShip(C, v === 'melita-reef' ? 'melita-reef' : 'hull-cutaway');

    case 'rev4ThroneRoom':
      return buildRev4ThroneRoom(C, v === 'throne-and-lamps' ? 'throne-and-lamps' : 'full-council');

    case 'sevenLampstands':
      return buildSevenLampstands(C, v === 'compare-menorah' ? 'compare-menorah' : 'seven-churches');

    case 'pentecostRoom':
      return buildPentecostRoom(C, v === 'jerusalem-house' ? 'jerusalem-house' : 'cutaway-flames');

    case 'canaanAllotment':
      return buildCanaanAllotment(C, v === 'refuge-levites' ? 'refuge-levites' : 'tribes-west-east');

    case 'exodusRelief':
      return buildExodusRelief(C, v === 'red-sea-sinai' ? 'red-sea-sinai' : 'full-itinerary');

    case 'gerizimEbalRelief':
      return buildGerizimEbalRelief(C, v === 'ebal-altar' ? 'ebal-altar' : 'covenant-assembly');

    case 'paulJourneysRelief':
      return buildPaulJourneysRelief(
        C,
        v === 'aegean-galatia' ? 'aegean-galatia' : v === 'rome-voyage' ? 'rome-voyage' : 'all-four',
      );

    case 'asiaChurchesRelief':
      return buildAsiaChurchesRelief(C, v === 'valleys-acropoleis' ? 'valleys-acropoleis' : 'postal-loop');

    case 'jordanCrossing':
      return buildJordanTwelveStones(C, v === 'gilgal-monument' ? 'gilgal-monument' : 'riverbed-ark');

    case 'gideonDiorama':
      return buildGideonThreeHundred(C, v === 'pitcher-torch-horn' ? 'pitcher-torch-horn' : 'three-companies');

    case 'arkToZion':
      return buildArkUpToZion(C, v === 'tent-of-david' ? 'tent-of-david' : 'six-paces');

    case 'redSeaCrossing':
      return buildRedSeaCrossing(C, v === 'seabed-and-wheels' ? 'seabed-and-wheels' : 'night-corridor');

    case 'sinaiBounds':
      return buildSinaiBounds(C, v === 'altar-twelve-pillars' ? 'altar-twelve-pillars' : 'mountain-bounds');

    case 'zionAscent':
      return buildZionAscent(C, v === 'fifteen-steps' ? 'fifteen-steps' : 'pilgrim-climb');

    case 'isaiahThrone':
      return buildIsaiahThrone(C, v === 'altar-live-coal' ? 'altar-live-coal' : 'high-throne-train');

    case 'ninevehRelief':
      return buildNinevehRelief(C, v === 'jonah-booth' ? 'jonah-booth' : 'walled-metropolis');

    case 'beatitudesHillside':
      return buildBeatitudesHillside(C, v === 'five-thousand-ranks' ? 'five-thousand-ranks' : 'hillside-seat');

    case 'galileeBoat':
      return buildGalileeBoat(C, v === 'great-calm' ? 'great-calm' : 'storm-waves');

    case 'bethlehemManger':
      return buildBethlehemManger(C, v === 'stone-manger-detail' ? 'stone-manger-detail' : 'cutaway-house');

    case 'paulLettersRelief':
      return buildPaulLettersRelief(C, v === 'prison-and-pastoral' ? 'prison-and-pastoral' : 'all-epistles');

    case 'dispersionRelief':
      return buildDispersionRelief(C, v === 'anatolian-highlands' ? 'anatolian-highlands' : 'five-provinces-loop');

    case 'davidPreparations':
      return buildDavidPreparations(C, v === 'blueprint-table' ? 'blueprint-table' : 'stockpile-yard');

    case 'enclosedGarden':
      return buildEnclosedGarden(C, v === 'seven-pillars-portico' ? 'seven-pillars-portico' : 'walled-spring-garden');

    case 'pottersHouse':
      return buildPottersHouse(C, v === 'earthen-jar-deeds' ? 'earthen-jar-deeds' : 'potter-wheels');

    case 'mamreJordanRelief':
      return buildMamreJordanRelief(C, v === 'mamre-oaks-altar' ? 'mamre-oaks-altar' : 'parting-overlook');

    case 'bethelPillar':
      return buildBethelPillar(C, v === 'anointed-pillar' ? 'anointed-pillar' : 'heavenward-steps');

    case 'josephGranaries':
      return buildJosephGranaries(C, v === 'dothan-to-egypt' ? 'dothan-to-egypt' : 'beehive-silos');

    case 'perpetualAltar':
      return buildPerpetualAltar(C, v === 'five-offerings-table' ? 'five-offerings-table' : 'ever-burning-hearth');

    case 'actsCoastalRelief':
      return buildActsCoastalRelief(C, v === 'joppa-rooftop' ? 'joppa-rooftop' : 'coastal-roads');

    case 'jobWhirlwind':
      return buildJobWhirlwind(C, v === 'pleiades-and-orion' ? 'pleiades-and-orion' : 'cornerstone-and-sea-doors');

    case 'caesareaHall':
      return buildCaesareaHall(C, v === 'promontory-praetorium' ? 'promontory-praetorium' : 'agrippa-hearing');

    case 'cube':
      return buildNewJerusalem(s.unit?.m ?? 185);
  }
}
