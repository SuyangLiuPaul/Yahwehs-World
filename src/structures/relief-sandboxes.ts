import * as THREE from 'three';
import {
  ASIA_CHURCH_SITES,
  CANAAN_SITES,
  RELIEF_GRIDS,
  RELIEF_JOURNEYS,
  type ReliefGridData,
  type ReliefJourneyData,
} from './relief-data.ts';

interface TableLayout {
  grid: ReliefGridData;
  spanX: number;
  spanZ: number;
  baseY: number;
  seaY: number;
  vScale: number;
  toXZ: (lon: number, lat: number) => [number, number];
  sampleElevM: (lon: number, lat: number) => number;
  sampleMask: (lon: number, lat: number) => number;
  toY: (lon: number, lat: number, lift?: number) => number;
}

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0 || 1)));
  return t * t * (3 - 2 * t);
}

/**
 * Shared museum-grade 3D relief table plinth + vertex-colored terrain surface +
 * water plane + geological cross-section skirts + North compass + scale bar.
 */
function createReliefTable(
  grid: ReliefGridData,
  opts: {
    targetSpan?: number;
    maxReliefH?: number;
    northArrow?: boolean;
    rockTint?: 'levant' | 'sinai' | 'anatolia' | 'med';
  } = {},
): { group: THREE.Group; layout: TableLayout } {
  const g = new THREE.Group();
  const targetSpan = opts.targetSpan ?? 12.2;
  const midLatRad = (((grid.north + grid.south) * 0.5) * Math.PI) / 180;
  const geoW = (grid.east - grid.west) * Math.cos(midLatRad);
  const geoH = grid.north - grid.south;
  const aspect = geoW / Math.max(1e-4, geoH);
  const spanX = aspect >= 1 ? targetSpan : targetSpan * aspect;
  const spanZ = aspect >= 1 ? targetSpan / aspect : targetSpan;

  const baseY = 0.58;
  const elevBytes = decodeBase64(grid.elevB64);
  const maskBytes = decodeBase64(grid.maskB64);
  const { cols, rows, west, south, east, north, minM, maxM } = grid;

  const maxReliefH = opts.maxReliefH ?? 1.45;
  const zeroFrac = Math.max(0.08, Math.min(0.45, -minM / (maxM - minM)));
  const seaY = baseY + 0.16 + zeroFrac * (maxReliefH * 0.55);
  const vScale = (maxReliefH - (seaY - baseY - 0.12)) / Math.max(1, maxM);
  const negScale = (seaY - baseY - 0.08) / Math.max(1, Math.abs(Math.min(-1, minM)));

  const rawElevAtRC = (r: number, c: number) => {
    const rr = Math.max(0, Math.min(rows - 1, r));
    const cc = Math.max(0, Math.min(cols - 1, c));
    const u = elevBytes[rr * cols + cc]! / 255;
    return minM + u * (maxM - minM);
  };

  const toXZ = (lon: number, lat: number): [number, number] => {
    const u = (lon - west) / (east - west);
    const v = (north - lat) / (north - south);
    return [(u - 0.5) * spanX, (v - 0.5) * spanZ];
  };

  const sampleElevM = (lon: number, lat: number): number => {
    const u = Math.max(0, Math.min(1, (lon - west) / (east - west))) * (cols - 1);
    const v = Math.max(0, Math.min(1, (north - lat) / (north - south))) * (rows - 1);
    const c0 = Math.floor(u), c1 = Math.min(cols - 1, c0 + 1);
    const r0 = Math.floor(v), r1 = Math.min(rows - 1, r0 + 1);
    const tx = u - c0, ty = v - r0;
    const h00 = rawElevAtRC(r0, c0);
    const h10 = rawElevAtRC(r0, c1);
    const h01 = rawElevAtRC(r1, c0);
    const h11 = rawElevAtRC(r1, c1);
    return (h00 * (1 - tx) + h10 * tx) * (1 - ty) + (h01 * (1 - tx) + h11 * tx) * ty;
  };

  const sampleMask = (lon: number, lat: number): number => {
    const c = Math.round(Math.max(0, Math.min(1, (lon - west) / (east - west))) * (cols - 1));
    const r = Math.round(Math.max(0, Math.min(1, (north - lat) / (north - south))) * (rows - 1));
    return maskBytes[r * cols + c] ?? 1;
  };

  const elevToWorldY = (elevM: number, maskVal: number): number => {
    if (maskVal === 0) {
      return Math.max(baseY + 0.05, seaY - 0.14 + Math.max(-0.08, elevM * 0.0005));
    }
    if (maskVal === 2 && elevM < -20) {
      // Sunken rift water surface slightly depressed below surrounding shoreline
      return Math.max(baseY + 0.07, seaY + elevM * negScale * 0.78);
    }
    if (elevM >= 0) {
      return seaY + Math.max(0.032, elevM * vScale);
    }
    // Below sea-level Rift valley floor (Galilee basin / Jordan Valley / Dead Sea shores)
    return Math.max(baseY + 0.08, seaY + elevM * negScale * 0.72);
  };

  const toY = (lon: number, lat: number, lift = 0): number => {
    const e = sampleElevM(lon, lat);
    const m = sampleMask(lon, lat);
    const surf = elevToWorldY(e, m);
    return (m === 0 ? Math.max(surf, seaY + 0.01) : surf) + lift;
  };

  // ── Plinth Base & Brass Frame ───────────────────────────────────────────────
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.76, metalness: 0.14 });
  const walnutMat = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.68, metalness: 0.08 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd3a748, roughness: 0.28, metalness: 0.84 });

  const padW = spanX + 0.88;
  const padD = spanZ + 0.88;
  const subPlinth = new THREE.Mesh(new THREE.BoxGeometry(padW, baseY * 0.66, padD), walnutMat);
  subPlinth.position.y = baseY * 0.33;
  const innerPlinth = new THREE.Mesh(
    new THREE.BoxGeometry(spanX + 0.22, baseY * 0.38, spanZ + 0.22),
    frameMat,
  );
  innerPlinth.position.y = baseY * 0.82;
  g.add(subPlinth, innerPlinth);

  // Brass rim trim strips
  const railH = 0.045;
  for (const sz of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(padW + 0.04, railH, 0.08), brassMat);
    rail.position.set(0, baseY * 0.66, sz * (padD * 0.5 - 0.04));
    g.add(rail);
  }
  for (const sx of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, railH, padD + 0.04), brassMat);
    rail.position.set(sx * (padW * 0.5 - 0.04), baseY * 0.66, 0);
    g.add(rail);
  }

  // Brass North Compass Indicator in upper-left margin (-Z is North)
  if (opts.northArrow !== false) {
    const compX = -spanX * 0.5 - 0.19;
    const compZ = -spanZ * 0.5 + 0.38;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.018, 8, 24), brassMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(compX, baseY * 0.69, compZ);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.24, 4), brassMat);
    arrow.rotation.x = -Math.PI / 2;
    arrow.position.set(compX, baseY * 0.72, compZ - 0.04);
    g.add(ring, arrow);
  }

  // Front graduated brass scale bar (+Z bevel)
  const scaleLen = spanX * 0.28;
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Mesh(
      new THREE.BoxGeometry(scaleLen / 4 - 0.015, 0.025, 0.075),
      i % 2 === 0 ? brassMat : frameMat,
    );
    seg.position.set(
      -scaleLen * 0.375 + i * (scaleLen / 4),
      baseY * 0.695,
      spanZ * 0.5 + 0.26,
    );
    g.add(seg);
  }

  // ── Vertex-Colored Terrain Surface Mesh ─────────────────────────────────────
  const vertCount = cols * rows;
  const positions = new Float32Array(vertCount * 3);
  const colors = new Float32Array(vertCount * 3);
  const colTmp = new THREE.Color();

  const tint = opts.rockTint ?? 'levant';
  for (let r = 0; r < rows; r++) {
    const v = r / (rows - 1);
    for (let c = 0; c < cols; c++) {
      const u = c / (cols - 1);
      const idx = r * cols + c;
      const m = maskBytes[idx]!;
      const elevM = minM + (elevBytes[idx]! / 255) * (maxM - minM);
      const wy = elevToWorldY(elevM, m);
      positions[idx * 3 + 0] = (u - 0.5) * spanX;
      positions[idx * 3 + 1] = wy;
      positions[idx * 3 + 2] = (v - 0.5) * spanZ;

      if (m === 0) {
        colTmp.setRGB(0.08, 0.18, 0.28);
      } else if (m === 2) {
        colTmp.setRGB(0.11, 0.44, 0.56);
      } else if (elevM < -40) {
        // Rift Valley alluvial floor
        colTmp.setRGB(0.56, 0.52, 0.38);
      } else {
        const t = Math.max(0, Math.min(1, elevM / Math.max(900, maxM * 0.8)));
        if (tint === 'sinai') {
          colTmp.setRGB(0.84 - t * 0.24, 0.69 - t * 0.34, 0.48 - t * 0.24);
          if (elevM > 1400) colTmp.lerp(new THREE.Color(0x8c4f3b), smoothstep(1300, 2100, elevM));
        } else if (tint === 'anatolia') {
          colTmp.setRGB(0.62 - t * 0.14, 0.61 - t * 0.18, 0.41 - t * 0.10);
          if (elevM > 1400) colTmp.lerp(new THREE.Color(0x9a8f7b), smoothstep(1300, 2200, elevM));
        } else if (tint === 'med') {
          colTmp.setRGB(0.66 - t * 0.18, 0.63 - t * 0.18, 0.44 - t * 0.12);
          if (elevM > 1800) colTmp.lerp(new THREE.Color(0xb8afa0), smoothstep(1700, 2800, elevM));
        } else {
          // Levant: warm limestone plains -> olive/terracotta hill ridges -> Hermon frost peak
          colTmp.setRGB(0.75 - t * 0.19, 0.68 - t * 0.22, 0.46 - t * 0.14);
          if (elevM > 1700) colTmp.lerp(new THREE.Color(0xe6e0d4), smoothstep(1600, 2600, elevM));
        }
      }
      colors[idx * 3 + 0] = colTmp.r;
      colors[idx * 3 + 1] = colTmp.g;
      colors[idx * 3 + 2] = colTmp.b;
    }
  }

  const indices: number[] = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = (r + 1) * cols + c;
      const e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const terrainMesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.84,
      metalness: 0.04,
      flatShading: false,
    }),
  );
  g.add(terrainMesh);

  // ── Cross-Section Geological Perimeter Skirts ──────────────────────────────
  const skirtPos: number[] = [];
  const skirtIdx: number[] = [];
  const addSkirtStrip = (ringPts: [number, number, number][]) => {
    const baseVertex = skirtPos.length / 3;
    for (let i = 0; i < ringPts.length; i++) {
      const [px, py, pz] = ringPts[i]!;
      skirtPos.push(px, Math.max(py, baseY + 0.02), pz);
      skirtPos.push(px, baseY, pz);
      if (i < ringPts.length - 1) {
        const a = baseVertex + i * 2;
        const b = a + 1;
        const c = a + 2;
        const d = a + 3;
        skirtIdx.push(a, b, c, c, b, d);
      }
    }
  };
  const edgePt = (r: number, c: number): [number, number, number] => {
    const i = r * cols + c;
    return [positions[i * 3]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!];
  };
  const topEdge: [number, number, number][] = [];
  for (let c = 0; c < cols; c++) topEdge.push(edgePt(0, c));
  const rightEdge: [number, number, number][] = [];
  for (let r = 0; r < rows; r++) rightEdge.push(edgePt(r, cols - 1));
  const bottomEdge: [number, number, number][] = [];
  for (let c = cols - 1; c >= 0; c--) bottomEdge.push(edgePt(rows - 1, c));
  const leftEdge: [number, number, number][] = [];
  for (let r = rows - 1; r >= 0; r--) leftEdge.push(edgePt(r, 0));

  for (const s of [topEdge, rightEdge, bottomEdge, leftEdge]) addSkirtStrip(s);
  const skirtGeo = new THREE.BufferGeometry();
  skirtGeo.setAttribute('position', new THREE.Float32BufferAttribute(skirtPos, 3));
  skirtGeo.setIndex(skirtIdx);
  skirtGeo.computeVertexNormals();
  const skirtMesh = new THREE.Mesh(
    skirtGeo,
    new THREE.MeshStandardMaterial({ color: 0x3b3228, roughness: 0.9, side: THREE.DoubleSide }),
  );
  g.add(skirtMesh);

  // ── Translucent Specular Marine Plane (Mediterranean / Aegean / Red Sea) ───
  const seaMat = new THREE.MeshStandardMaterial({
    color: 0x16526d,
    emissive: 0x061d2b,
    emissiveIntensity: 0.35,
    roughness: 0.16,
    metalness: 0.35,
    transparent: true,
    opacity: 0.78,
  });
  // Build sea surface tiles ONLY over marine cells (m === 0) so inland Jordan Rift stays dry above/below sea level!
  const seaQuads: number[] = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const m0 = maskBytes[r * cols + c]!;
      const m1 = maskBytes[r * cols + c + 1]!;
      const m2 = maskBytes[(r + 1) * cols + c]!;
      const m3 = maskBytes[(r + 1) * cols + c + 1]!;
      if (m0 === 0 || m1 === 0 || m2 === 0 || m3 === 0) {
        const i0 = r * cols + c;
        const i1 = i0 + 1;
        const i2 = (r + 1) * cols + c;
        const i3 = i2 + 1;
        seaQuads.push(
          positions[i0 * 3]!, seaY, positions[i0 * 3 + 2]!,
          positions[i2 * 3]!, seaY, positions[i2 * 3 + 2]!,
          positions[i1 * 3]!, seaY, positions[i1 * 3 + 2]!,
          positions[i1 * 3]!, seaY, positions[i1 * 3 + 2]!,
          positions[i2 * 3]!, seaY, positions[i2 * 3 + 2]!,
          positions[i3 * 3]!, seaY, positions[i3 * 3 + 2]!,
        );
      }
    }
  }
  if (seaQuads.length) {
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(seaQuads, 3));
    sg.computeVertexNormals();
    const seaMesh = new THREE.Mesh(sg, seaMat);
    seaMesh.userData.water = 1;
    g.add(seaMesh);
  }

  return {
    group: g,
    layout: { grid, spanX, spanZ, baseY, seaY, vScale, toXZ, sampleElevM, sampleMask, toY },
  };
}

function addBeaconPin(
  parent: THREE.Group,
  x: number,
  y: number,
  z: number,
  color: number,
  opts: { stemH?: number; headR?: number; emberId?: number; ring?: boolean } = {},
): THREE.Group {
  const pin = new THREE.Group();
  const stemH = opts.stemH ?? 0.38;
  const headR = opts.headR ?? 0.11;

  const brass = new THREE.MeshStandardMaterial({ color: 0xe3ba56, metalness: 0.85, roughness: 0.25 });
  const gem = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.62,
    roughness: 0.2,
    metalness: 0.15,
  });

  if (opts.ring !== false) {
    const baseRing = new THREE.Mesh(
      new THREE.TorusGeometry(headR * 1.45, headR * 0.22, 6, 16),
      brass,
    );
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = 0.015;
    pin.add(baseRing);
  }

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(headR * 0.18, headR * 0.24, stemH, 8),
    brass,
  );
  stem.position.y = stemH * 0.5;
  const head = new THREE.Mesh(new THREE.OctahedronGeometry(headR, 1), gem);
  head.position.y = stemH + headR * 0.65;
  if (typeof opts.emberId === 'number') head.userData.ember = opts.emberId;
  pin.add(stem, head);

  pin.position.set(x, y, z);
  parent.add(pin);
  return pin;
}

function addRouteTube(
  parent: THREE.Group,
  layout: TableLayout,
  pts: [number, number][],
  opts: { color: number; radius?: number; lift?: number; dashed?: boolean; opacity?: number },
): void {
  if (pts.length < 2) return;
  const mat = new THREE.MeshStandardMaterial({
    color: opts.color,
    emissive: opts.color,
    emissiveIntensity: opts.opacity && opts.opacity < 0.5 ? 0.18 : 0.45,
    roughness: 0.3,
    metalness: 0.35,
    transparent: opts.opacity !== undefined && opts.opacity < 1,
    opacity: opts.opacity ?? 1,
  });
  const radius = opts.radius ?? 0.045;
  const lift = opts.lift ?? 0.085;

  // Subdivide long segments so routes drape smoothly across terrain relief
  const dense: THREE.Vector3[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [lonA, latA] = pts[i]!;
    const [lonB, latB] = pts[i + 1]!;
    const dist = Math.hypot(lonB - lonA, latB - latA);
    const steps = Math.max(2, Math.min(22, Math.ceil(dist * 10)));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const lon = lonA + (lonB - lonA) * t;
      const lat = latA + (latB - latA) * t;
      const [x, z] = layout.toXZ(lon, lat);
      const arcBump = opts.dashed ? Math.sin(t * Math.PI) * 0.04 : 0;
      const y = layout.toY(lon, lat, lift + arcBump);
      dense.push(new THREE.Vector3(x, y, z));
    }
  }
  const [endLon, endLat] = pts[pts.length - 1]!;
  const [ex, ez] = layout.toXZ(endLon, endLat);
  dense.push(new THREE.Vector3(ex, layout.toY(endLon, endLat, lift), ez));

  const curve = new THREE.CatmullRomCurve3(dense, false, 'centripetal', 0.25);
  if (opts.dashed) {
    const totalLen = curve.getLength();
    const nDots = Math.max(6, Math.floor(totalLen / 0.24));
    const dashGeo = new THREE.CapsuleGeometry(radius * 0.9, radius * 1.9, 4, 8);
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i <= nDots; i++) {
      const u = i / nDots;
      const p = curve.getPointAt(u);
      const tang = curve.getTangentAt(u);
      const m = new THREE.Mesh(dashGeo, mat);
      m.position.copy(p);
      m.quaternion.setFromUnitVectors(up, tang);
      parent.add(m);
    }
  } else {
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, Math.min(200, dense.length * 2), radius, 8, false),
      mat,
    );
    parent.add(tube);
  }
}

// ── 1. Twelve Tribes Allotment & Cities of Refuge Relief (Joshua 13–21) ────────
export function buildCanaanAllotment(_C: number, variant: string): THREE.Group {
  const { group, layout } = createReliefTable(RELIEF_GRIDS.canaan, {
    targetSpan: 11.4,
    maxReliefH: 1.55,
    rockTint: 'levant',
  });
  const refugeOnly = variant === 'refuge-levites';
  const refugeIds = new Set(['kedesh', 'shechem', 'hebron', 'bezer', 'ramoth-gilead', 'golan']);

  const shiloh = CANAAN_SITES.find((s) => s.id === 'shiloh')!;
  const [sx, sz] = layout.toXZ(shiloh.lon, shiloh.lat);
  const sy = layout.toY(shiloh.lon, shiloh.lat, 0.02);

  // Miniature White-and-Gold Shiloh Sanctuary Tent Marker (Josh 18:1, 10)
  const tent = new THREE.Group();
  const linen = new THREE.MeshStandardMaterial({ color: 0xf4ede0, roughness: 0.72 });
  const roof = new THREE.MeshStandardMaterial({
    color: 0xe8c468,
    emissive: 0xc29224,
    emissiveIntensity: 0.45,
    roughness: 0.35,
  });
  const courtWall = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.11, 0.24), linen);
  courtWall.position.y = 0.055;
  const tentHouse = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.14), roof);
  tentHouse.position.set(-0.04, 0.11, 0);
  tentHouse.userData.ember = 1;
  tent.add(courtWall, tentHouse);
  tent.position.set(sx, sy, sz);
  group.add(tent);

  // Jordan Rift / Dan-to-Beersheba reference corridor
  addRouteTube(
    group,
    layout,
    [
      [35.652, 33.249], // Dan
      [35.58, 32.85], // Upper Jordan
      [35.56, 32.15], // Central Jordan
      [35.46, 31.87], // Crossing opposite Jericho
    ],
    { color: 0x4fb4d6, radius: 0.032, lift: 0.05, opacity: 0.85 },
  );

  // The Six Cities of Refuge (3 west + 3 east of Jordan, Josh 20:7-8)
  let eIdx = 2;
  for (const site of CANAAN_SITES) {
    if (!refugeIds.has(site.id)) continue;
    const [px, pz] = layout.toXZ(site.lon, site.lat);
    const py = layout.toY(site.lon, site.lat, 0.01);
    const isEast = site.lon > 35.56;
    const color = refugeOnly ? (isEast ? 0xe87b4f : 0xf2c14e) : 0xd96846;
    addBeaconPin(group, px, py, pz, color, {
      stemH: refugeOnly ? 0.56 : 0.36,
      headR: refugeOnly ? 0.145 : 0.1,
      emberId: eIdx++,
    });

    if (refugeOnly) {
      // Road radiating from Shiloh to each City of Refuge
      addRouteTube(
        group,
        layout,
        [
          [shiloh.lon, shiloh.lat],
          [site.lon, site.lat],
        ],
        { color: isEast ? 0xd98a5b : 0xe0b956, radius: 0.028, lift: 0.075, dashed: true, opacity: 0.72 },
      );
    }
  }

  if (!refugeOnly) {
    // Twelve Tribal Standard Markers across Cisjordan (9.5) and Transjordan (2.5)
    const tribes: { lon: number; lat: number; color: number }[] = [
      { lon: 35.16, lat: 32.95, color: 0x5da9d6 }, // Asher
      { lon: 35.54, lat: 33.12, color: 0x7bc47f }, // Naphtali
      { lon: 35.24, lat: 32.72, color: 0x9ac96b }, // Zebulun
      { lon: 35.42, lat: 32.56, color: 0xd9c255 }, // Issachar
      { lon: 35.12, lat: 32.42, color: 0xe3a84f }, // W Manasseh
      { lon: 35.15, lat: 32.08, color: 0xe08f4a }, // Ephraim
      { lon: 34.78, lat: 32.02, color: 0x62b4d9 }, // Dan (coastal)
      { lon: 35.25, lat: 31.86, color: 0xc9b59b }, // Benjamin
      { lon: 35.06, lat: 31.60, color: 0xe8b941 }, // Judah
      { lon: 34.78, lat: 31.26, color: 0xc47e49 }, // Simeon
      { lon: 35.88, lat: 32.78, color: 0xb47bd4 }, // E Manasseh
      { lon: 35.78, lat: 32.22, color: 0xd9687a }, // Gad
      { lon: 35.78, lat: 31.66, color: 0xa87660 }, // Reuben
    ];
    for (const tr of tribes) {
      const [tx, tz] = layout.toXZ(tr.lon, tr.lat);
      const ty = layout.toY(tr.lon, tr.lat, 0.01);
      addBeaconPin(group, tx, ty, tz, tr.color, { stemH: 0.28, headR: 0.082 });
    }
  } else {
    // Western Dan-Beersheba anchor pins for geographic scale
    for (const id of ['dan', 'beersheba', 'jericho']) {
      const site = CANAAN_SITES.find((s) => s.id === id);
      if (!site) continue;
      const [px, pz] = layout.toXZ(site.lon, site.lat);
      addBeaconPin(group, px, layout.toY(site.lon, site.lat, 0.01), pz, 0x99b3cc, {
        stemH: 0.22,
        headR: 0.075,
        ring: false,
      });
    }
  }

  return group;
}

// ── 2. Exodus & Wilderness Itinerary Relief (Numbers 33; Exodus 14; 19) ───────
export function buildExodusRelief(_C: number, variant: string): THREE.Group {
  const { group, layout } = createReliefTable(RELIEF_GRIDS.exodus, {
    targetSpan: 12.0,
    maxReliefH: 1.5,
    rockTint: 'sinai',
  });
  const sinaiFocus = variant === 'red-sea-sinai';
  const j = RELIEF_JOURNEYS.exodus;

  // Draw canonical attested segments from journeys.json
  j.segments.forEach((seg, segIdx) => {
    const segPts: [number, number][] = sinaiFocus && segIdx > 0 ? [] : seg;
    if (sinaiFocus && segIdx === 0) {
      // Truncate cleanly after Sinai segment (index ~9 -> Sinai is around 33.97, 28.53)
      const sinaiIdx = seg.findIndex(([lon, lat]) => lon > 33.9 && lat < 28.65);
      const sliced = sinaiIdx > 0 ? seg.slice(0, sinaiIdx + 2) : seg;
      addRouteTube(group, layout, sliced, { color: 0xe6b847, radius: 0.055, lift: 0.095 });
    } else if (segPts.length >= 2) {
      addRouteTube(group, layout, segPts, {
        color: segIdx === 0 ? 0xe6b847 : 0xd9914e,
        radius: 0.048,
        lift: 0.09,
      });
    }
  });

  // Honest dotted gap connecting attested Segment 1 end to Segment 2 start (unlocated wilderness stops)
  if (!sinaiFocus && j.segments.length >= 2) {
    const s0 = j.segments[0]!;
    const s1 = j.segments[1]!;
    addRouteTube(group, layout, [s0[s0.length - 1]!, s1[0]!], {
      color: 0x8f8572,
      radius: 0.025,
      lift: 0.11,
      dashed: true,
      opacity: 0.52,
    });
  }

  // Red Sea parting emblem near Gulf of Suez / Pi-hahiroth (Exod 14:22)
  const [rx, rz] = layout.toXZ(32.55, 29.88);
  const waterWallMat = new THREE.MeshStandardMaterial({
    color: 0x359ec9,
    emissive: 0x14536e,
    emissiveIntensity: 0.45,
    roughness: 0.18,
    transparent: true,
    opacity: 0.86,
  });
  for (const off of [-0.14, 0.14]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.08), waterWallMat);
    wall.position.set(rx, layout.seaY + 0.11, rz + off);
    wall.rotation.y = -0.32;
    wall.userData.water = 2;
    group.add(wall);
  }

  // Strictly Aniconic Mount Sinai Cloud & Fire Boundary (Exod 19:12, 18 — ZERO human form!)
  const [mx, mz] = layout.toXZ(33.9733, 28.5397);
  const my = layout.toY(33.9733, 28.5397, 0.02);
  const boundMat = new THREE.MeshStandardMaterial({
    color: 0xe0743a,
    emissive: 0x8a3010,
    emissiveIntensity: 0.45,
    roughness: 0.5,
  });
  const boundRing = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.032, 8, 32), boundMat);
  boundRing.rotation.x = Math.PI / 2;
  boundRing.position.set(mx, my + 0.03, mz);
  group.add(boundRing);

  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0x2e3440,
    emissive: 0x161922,
    emissiveIntensity: 0.25,
    roughness: 0.92,
    transparent: true,
    opacity: 0.85,
  });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.24 + (i % 2) * 0.06, 12, 10), cloudMat);
    puff.scale.y = 0.62;
    puff.position.set(mx + Math.cos(a) * 0.18, my + 0.36 + (i % 2) * 0.05, mz + Math.sin(a) * 0.18);
    group.add(puff);
  }
  const fireMat = new THREE.MeshStandardMaterial({
    color: 0xffb347,
    emissive: 0xff6a1a,
    emissiveIntensity: 0.95,
    roughness: 0.25,
    transparent: true,
    opacity: 0.92,
  });
  const firePillar = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.72, 10), fireMat);
  firePillar.position.set(mx, my + 0.42, mz);
  firePillar.userData.flame = 1;
  group.add(firePillar);

  // Key marker pins along the active portion
  let eIdx = 2;
  for (const mk of j.markers) {
    if (sinaiFocus && mk.n > 14) continue;
    const [px, pz] = layout.toXZ(mk.lon, mk.lat);
    const isMajor = ['Rameses', 'Elim', 'Sinai', 'Kadesh', 'Abel-shittim'].some((name) =>
      mk.place.startsWith(name),
    );
    addBeaconPin(group, px, layout.toY(mk.lon, mk.lat, 0.01), pz, isMajor ? 0xf2c14e : 0xb59e6b, {
      stemH: isMajor ? 0.42 : 0.22,
      headR: isMajor ? 0.11 : 0.065,
      emberId: isMajor ? eIdx++ : undefined,
      ring: isMajor,
    });
  }

  return group;
}

// ── 3. Gerizim & Ebal Valley Acoustic Bowl & Ebal Altar (Deut 27; Josh 8) ─────
export function buildGerizimEbalRelief(_C: number, variant: string): THREE.Group {
  const g = new THREE.Group();
  const spanX = 11.4;
  const spanZ = 9.2;
  const baseY = 0.56;
  const altarFocus = variant === 'ebal-altar';

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.76 });
  const walnutMat = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.68 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd3a748, roughness: 0.28, metalness: 0.84 });

  const subPlinth = new THREE.Mesh(new THREE.BoxGeometry(spanX + 0.86, baseY * 0.66, spanZ + 0.86), walnutMat);
  subPlinth.position.y = baseY * 0.33;
  const inner = new THREE.Mesh(new THREE.BoxGeometry(spanX + 0.18, baseY * 0.36, spanZ + 0.18), frameMat);
  inner.position.y = baseY * 0.82;
  g.add(subPlinth, inner);

  // North Compass Arrow (-Z = North toward Mount Ebal!)
  const compArrow = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.26, 4), brassMat);
  compArrow.rotation.x = -Math.PI / 2;
  compArrow.position.set(-spanX * 0.5 - 0.18, baseY * 0.72, -spanZ * 0.5 + 0.36);
  g.add(compArrow);

  // Procedural high-resolution Shechem Pass terrain (72 x 64):
  // -Z = North = Mount Ebal (~940 m peak)
  // +Z = South = Mount Gerizim (~881 m peak)
  // Center Z~0 = Narrow E-W Shechem Valley floor (~500 m elevation saddle)
  const cols = 72;
  const rows = 64;
  const ridgeHeightAt = (x: number, z: number): number => {
    const nx = x / (spanX * 0.5);
    // North mountain: Ebal crest around z = -2.25, gently terraced inner face
    const dEbal = Math.hypot((x + 0.15) * 0.34, (z + 2.35) * 0.68);
    const ebal = 2.42 * Math.exp(-dEbal * dEbal) + 0.32 * Math.exp(-Math.pow((z + 2.4) * 0.55, 2));
    // South mountain: Gerizim crest around z = +2.35
    const dGer = Math.hypot((x - 0.1) * 0.36, (z - 2.35) * 0.66);
    const ger = 2.18 * Math.exp(-dGer * dGer) + 0.28 * Math.exp(-Math.pow((z - 2.35) * 0.55, 2));
    // Deep flat Shechem pass through z=0..+0.4
    const valleyFloor = 0.24 + 0.08 * Math.sin(nx * 2.5);
    const strataStep = Math.sin(z * 5.2 + Math.cos(x * 1.4)) * 0.045;
    return baseY + valleyFloor + ebal + ger + strataStep * Math.min(1, (ebal + ger) * 0.45);
  };

  const pos = new Float32Array(cols * rows * 3);
  const col = new Float32Array(cols * rows * 3);
  const clr = new THREE.Color();
  for (let r = 0; r < rows; r++) {
    const z = (r / (rows - 1) - 0.5) * spanZ;
    for (let c = 0; c < cols; c++) {
      const x = (c / (cols - 1) - 0.5) * spanX;
      const idx = r * cols + c;
      const y = ridgeHeightAt(x, z);
      pos[idx * 3 + 0] = x;
      pos[idx * 3 + 1] = y;
      pos[idx * 3 + 2] = z;

      const t = Math.max(0, Math.min(1, (y - baseY - 0.25) / 2.35));
      if (t < 0.14) {
        // Verdant cultivated Shechem pass floor
        clr.setRGB(0.46, 0.53, 0.34);
      } else {
        // Warm pale Samaria limestone slopes (Gerizim slightly olive-warm, Ebal bare karst)
        const ebalShade = z < 0 ? -0.04 : 0.03;
        clr.setRGB(0.76 - t * 0.12 + ebalShade, 0.69 - t * 0.14 + ebalShade, 0.54 - t * 0.1);
      }
      col[idx * 3 + 0] = clr.r;
      col[idx * 3 + 1] = clr.g;
      col[idx * 3 + 2] = clr.b;
    }
  }

  const indices: number[] = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = (r + 1) * cols + c;
      const e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
  }

  const tGeo = new THREE.BufferGeometry();
  tGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  tGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  tGeo.setIndex(indices);
  tGeo.computeVertexNormals();
  g.add(new THREE.Mesh(tGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 })));

  // Side skirts enclosing terrain down to baseY
  const sPos: number[] = [];
  const sIdx: number[] = [];
  const addEdge = (pts: [number, number, number][]) => {
    const bv = sPos.length / 3;
    for (let i = 0; i < pts.length; i++) {
      const [px, py, pz] = pts[i]!;
      sPos.push(px, py, pz, px, baseY, pz);
      if (i < pts.length - 1) {
        const a = bv + i * 2;
        sIdx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
      }
    }
  };
  const ptAt = (r: number, c: number): [number, number, number] => {
    const i = r * cols + c;
    return [pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!];
  };
  const eTop: [number, number, number][] = [];
  for (let c = 0; c < cols; c++) eTop.push(ptAt(0, c));
  const eRight: [number, number, number][] = [];
  for (let r = 0; r < rows; r++) eRight.push(ptAt(r, cols - 1));
  const eBot: [number, number, number][] = [];
  for (let c = cols - 1; c >= 0; c--) eBot.push(ptAt(rows - 1, c));
  const eLeft: [number, number, number][] = [];
  for (let r = rows - 1; r >= 0; r--) eLeft.push(ptAt(r, 0));
  for (const edge of [eTop, eRight, eBot, eLeft]) addEdge(edge);

  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3));
  sGeo.setIndex(sIdx);
  sGeo.computeVertexNormals();
  g.add(new THREE.Mesh(sGeo, new THREE.MeshStandardMaterial({ color: 0x3f362c, roughness: 0.9, side: THREE.DoubleSide })));

  // Valley Center: Miniature Gold Ark & Levites Station (Josh 8:33)
  const arkMat = new THREE.MeshStandardMaterial({
    color: 0xf2c955,
    emissive: 0xc29224,
    emissiveIntensity: 0.45,
    metalness: 0.85,
    roughness: 0.25,
  });
  const valleyY = ridgeHeightAt(0, 0);
  const arkBox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.26), arkMat);
  arkBox.position.set(0, valleyY + 0.12, 0);
  arkBox.userData.ember = 1;
  g.add(arkBox);

  // Ancient Shechem gate marker slightly east in valley pass
  const shechemY = ridgeHeightAt(1.8, 0.12);
  addBeaconPin(g, 1.8, shechemY, 0.12, 0xd9b86c, { stemH: 0.34, headR: 0.085 });

  if (!altarFocus) {
    // Covenant Assembly: 6 tribal formations on Gerizim (+Z) for blessing & 6 on Ebal (-Z) for curse
    const blessMat = new THREE.MeshStandardMaterial({ color: 0xf2e8cf, emissive: 0xd9b24c, emissiveIntensity: 0.35, roughness: 0.45 });
    const curseMat = new THREE.MeshStandardMaterial({ color: 0xc26a4a, emissive: 0x7d321c, emissiveIntensity: 0.35, roughness: 0.45 });
    for (let i = 0; i < 6; i++) {
      const tx = -3.0 + i * 1.2;
      const gx = tx;
      const gz = 1.25 + (i % 2) * 0.25;
      const gy = ridgeHeightAt(gx, gz);
      const bBlock = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.18, 0.36), blessMat);
      bBlock.position.set(gx, gy + 0.09, gz);
      g.add(bBlock);
      addBeaconPin(g, gx, gy + 0.18, gz, 0xe8c45e, { stemH: 0.28, headR: 0.075, ring: false });

      const ez = -1.25 - (i % 2) * 0.25;
      const ey = ridgeHeightAt(gx, ez);
      const cBlock = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.18, 0.36), curseMat);
      cBlock.position.set(gx, ey + 0.09, ez);
      g.add(cBlock);
      addBeaconPin(g, gx, ey + 0.18, ez, 0xd46748, { stemH: 0.28, headR: 0.075, ring: false });
    }
  } else {
    // Ebal Summit Fieldstone Altar & Whitewashed Torah Stelae (Deut 27:4-8; Josh 8:30-32)
    const ax = -0.15;
    const az = -2.25;
    const ay = ridgeHeightAt(ax, az);
    const fieldstone = new THREE.MeshStandardMaterial({ color: 0x9b9282, roughness: 0.94 });
    const altarBase = new THREE.Group();
    // Uncut irregular boulders piled into a stepped altar platform + ascending stone ramp
    for (let row = 0; row < 3; row++) {
      for (let sx = -2; sx <= 2; sx++) {
        for (let sz = -2; sz <= 2; sz++) {
          if (row === 2 && (Math.abs(sx) === 2 || Math.abs(sz) === 2)) continue;
          const b = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14, 0), fieldstone);
          b.scale.set(1.2, 0.7, 1.1);
          b.position.set(sx * 0.16, row * 0.11 + 0.06, sz * 0.16);
          altarBase.add(b);
        }
      }
    }
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.65), fieldstone);
    ramp.rotation.x = 0.24;
    ramp.position.set(0, 0.12, 0.56);
    altarBase.add(ramp);

    const ember = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.28, 0.05, 10),
      new THREE.MeshStandardMaterial({ color: 0xff8c2b, emissive: 0xe64a19, emissiveIntensity: 0.9 }),
    );
    ember.position.y = 0.32;
    ember.userData.ember = 2;
    altarBase.add(ember);

    const smokeMat = new THREE.MeshStandardMaterial({
      color: 0xe8e4dc,
      transparent: true,
      opacity: 0.22,
      roughness: 1,
    });
    for (let i = 0; i < 4; i++) {
      const sm = new THREE.Mesh(new THREE.SphereGeometry(0.14 + i * 0.03, 8, 6), smokeMat.clone());
      sm.userData.smoke = { index: i, baseY: 0.44 + i * 0.18, amplitude: 0.26 };
      altarBase.add(sm);
    }

    // Whitewashed lime-plaster Torah stelae beside the altar (Deut 27:2-4)
    const plaster = new THREE.MeshStandardMaterial({ color: 0xf4f0e6, roughness: 0.68 });
    for (const dx of [-0.62, -0.82, 0.62, 0.82]) {
      const stele = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.08), plaster);
      stele.position.set(dx, 0.18, 0.18);
      altarBase.add(stele);
    }

    altarBase.position.set(ax, ay - 0.02, az);
    g.add(altarBase);
  }

  return g;
}

// ── 4. Paul's Four Mediterranean Journeys (Acts 13–28) ────────────────────────
export function buildPaulJourneysRelief(_C: number, variant: string): THREE.Group {
  const { group, layout } = createReliefTable(RELIEF_GRIDS.paul, {
    targetSpan: 12.6,
    maxReliefH: 1.35,
    rockTint: 'med',
  });

  const focusRome = variant === 'rome-voyage';
  const focusAegean = variant === 'aegean-galatia';

  const routes: {
    data: ReliefJourneyData;
    color: number;
    showLand: boolean;
    active: boolean;
  }[] = [
    { data: RELIEF_JOURNEYS.paul1, color: 0xe8c152, showLand: false, active: !focusRome },
    { data: RELIEF_JOURNEYS.paul2, color: 0x4cc4d4, showLand: false, active: !focusRome },
    { data: RELIEF_JOURNEYS.paul3, color: 0x62cc7b, showLand: false, active: !focusRome },
    { data: RELIEF_JOURNEYS.paulRome, color: 0xe06b50, showLand: true, active: !focusAegean },
  ];

  let emberIdx = 1;
  for (const rt of routes) {
    const r = rt.active ? 0.044 : 0.024;
    const opacity = rt.active ? 1.0 : 0.34;
    for (const seg of rt.data.segments) {
      addRouteTube(group, layout, seg, {
        color: rt.color,
        radius: r,
        lift: rt.active ? 0.095 : 0.055,
        dashed: rt.showLand,
        opacity,
      });
    }

    if (rt.active) {
      // Key city pins on active routes
      for (const mk of rt.data.markers) {
        const major =
          mk.n === 1 ||
          /Antioch|Jerusalem|Paphos|Iconium|Lystra|Troas|Philippi|Athens|Corinth|Ephesus|Malta|Rome|Fair Havens|Caesarea/.test(
            mk.place,
          );
        if (!major) continue;
        const [px, pz] = layout.toXZ(mk.lon, mk.lat);
        addBeaconPin(group, px, layout.toY(mk.lon, mk.lat, 0.01), pz, rt.color, {
          stemH: /Jerusalem|Antioch 1|Ephesus|Corinth|Rome|Malta/.test(mk.place) ? 0.42 : 0.28,
          headR: /Jerusalem|Antioch 1|Rome/.test(mk.place) ? 0.1 : 0.072,
          emberId: emberIdx <= 14 ? emberIdx++ : undefined,
          ring: /Jerusalem|Antioch 1|Rome/.test(mk.place),
        });
      }
    }
  }

  // In Rome Voyage focus, mark Malta shipwreck shoal with a tiny ship hull marker (Acts 27:41)
  if (focusRome || variant === 'all-four') {
    const [mx, mz] = layout.toXZ(14.53, 35.85);
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.1, 0.11),
      new THREE.MeshStandardMaterial({ color: 0xa6693a, roughness: 0.72 }),
    );
    hull.position.set(mx, layout.seaY + 0.07, mz);
    hull.rotation.y = 0.45;
    group.add(hull);
  }

  return group;
}

// ── 5. Seven Churches of Asia Postal Circuit (Revelation 1–3) ─────────────────
export function buildAsiaChurchesRelief(_C: number, variant: string): THREE.Group {
  const { group, layout } = createReliefTable(RELIEF_GRIDS.asia, {
    targetSpan: 11.4,
    maxReliefH: 1.45,
    rockTint: 'anatolia',
  });
  const valleysView = variant === 'valleys-acropoleis';

  const patmos = ASIA_CHURCH_SITES[0]!;
  const churches = ASIA_CHURCH_SITES.slice(1); // Exact Rev 1:11 clockwise postal order!

  // Sea leg from Patmos island across Icarian sea to Ephesus harbor
  addRouteTube(
    group,
    layout,
    [
      [patmos.lon, patmos.lat],
      [churches[0]!.lon, churches[0]!.lat],
    ],
    { color: 0x56b9db, radius: 0.042, lift: 0.08, dashed: true },
  );

  // Roman clockwise postal road loop across western Asia Minor
  addRouteTube(
    group,
    layout,
    churches.map((c) => [c.lon, c.lat] as [number, number]),
    { color: 0xebbd4d, radius: 0.052, lift: 0.095 },
  );

  // Patmos island beacon (Rev 1:9)
  const [px, pz] = layout.toXZ(patmos.lon, patmos.lat);
  addBeaconPin(group, px, layout.toY(patmos.lon, patmos.lat, 0.01), pz, 0x5cc5e6, {
    stemH: 0.44,
    headR: 0.11,
    emberId: 1,
  });

  // Seven Golden Lampstand Beacons + Acropolis blocks in Valleys mode
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xf0c24b, metalness: 0.88, roughness: 0.22 });
  const flameMat = new THREE.MeshStandardMaterial({
    color: 0xffdd78,
    emissive: 0xff8c24,
    emissiveIntensity: 0.95,
  });
  const acropMat = new THREE.MeshStandardMaterial({ color: 0xc2b8a3, roughness: 0.8 });

  churches.forEach((city, idx) => {
    const [cx, cz] = layout.toXZ(city.lon, city.lat);
    const cy = layout.toY(city.lon, city.lat, 0.01);

    const marker = new THREE.Group();
    const baseDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.05, 16), goldMat);
    baseDisc.position.y = 0.025;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.048, 0.34, 10), goldMat);
    shaft.position.y = 0.2;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.045, 0.07, 12), goldMat);
    bowl.position.y = 0.38;
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.16, 8), flameMat);
    flame.position.y = 0.49;
    flame.userData.flame = idx + 2;
    marker.add(baseDisc, shaft, bowl, flame);

    if (valleysView && ['pergamum', 'sardis', 'laodicea'].includes(city.id)) {
      const citadel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.18, 6), acropMat);
      citadel.position.y = 0.09;
      marker.position.set(cx, cy + 0.08, cz);
      baseDisc.position.y += 0.14;
      shaft.position.y += 0.14;
      bowl.position.y += 0.14;
      flame.position.y += 0.14;
      marker.add(citadel);
    } else {
      marker.position.set(cx, cy, cz);
    }
    group.add(marker);
  });

  if (valleysView) {
    // Draw subtle E-W valley drainage ribbons along Cayster, Hermus & Maeander/Lycus corridors
    const valleys: [number, number][][] = [
      [
        [27.95, 39.12],
        [27.18, 39.13],
        [26.85, 39.06],
      ], // Caicus -> Pergamum coast
      [
        [28.55, 38.45],
        [28.04, 38.53],
        [27.14, 38.45],
      ], // Hermus -> Sardis -> Smyrna gulf
      [
        [29.11, 37.84],
        [28.15, 37.84],
        [27.28, 37.54],
      ], // Lycus/Maeander -> Laodicea -> Miletus bay
    ];
    for (const v of valleys) {
      addRouteTube(group, layout, v, { color: 0x2e7e9c, radius: 0.025, lift: 0.032, opacity: 0.72 });
    }
  }

  return group;
}
