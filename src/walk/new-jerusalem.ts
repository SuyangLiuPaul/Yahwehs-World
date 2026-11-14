import * as THREE from 'three';
import { batchStatic, bevelBox } from './craft';
import { detailedSurface, rockProjection } from './materials';

export interface NewJerusalemCounts {
  stadiaCube: number;
  wallCubits: number;
  foundationCourses: number;
  totalPearlGates: number;
  eastPearlGates: number;
  treesOfLife: number;
  fruitsPerTree: number;
  bridges: number;
}

export interface NewJerusalemCity {
  group: THREE.Group;
  colliders: THREE.Box3[];
  platforms: THREE.Box3[];
  counts: NewJerusalemCounts;
  skyTex: THREE.CanvasTexture;
  CUBIT: number;
  PROMENADE_Y: number;
  STREET_Y: number;
  THRONE_FORECOURT_Y: number;
  WALL_OVERLOOK_Y: number;
  floorY: (x: number, z: number) => number;
  rescale: (newCubit: number) => number;
  update: (dt: number, elapsed: number) => void;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function makeRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function texFrom(
  canvas: HTMLCanvasElement,
  repeatX = 1,
  repeatY = 1,
  srgb = true,
): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function normalFromLuminance(src: HTMLCanvasElement, strength = 2.2): THREE.CanvasTexture {
  const { width: w, height: h } = src;
  const sctx = src.getContext('2d')!;
  const data = sctx.getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const j = i * 4;
    lum[i] = (0.299 * (data[j] ?? 0) + 0.587 * (data[j + 1] ?? 0) + 0.114 * (data[j + 2] ?? 0)) / 255;
  }

  const [out, octx] = makeCanvas(w, h);
  const img = octx.createImageData(w, h);
  const d = img.data;
  const at = (x: number, y: number) => lum[((y + h) % h) * w + ((x + w) % w)] ?? 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const nz = 1.0;
      const len = Math.hypot(-dx, -dy, nz);
      const j = (y * w + x) * 4;
      d[j] = ((-dx / len) * 0.5 + 0.5) * 255;
      d[j + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      d[j + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      d[j + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(out);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/**
 * Celestial Glory Sky ("no need of sun or moon ... no night there", Rev 21:23, 25; 22:5).
 * Equirectangular panorama with luminous golden-pearl radiance centered in the West (-X)
 * and crystalline sapphire-emerald aurora bands arching across the vault, with zero sun/moon disc.
 */
export function buildCelestialSky(): THREE.CanvasTexture {
  const W = 1024;
  const H = 512;
  const [c, ctx] = makeCanvas(W, H);
  const rand = makeRng(2123);

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0.0, '#1f446e');
  grad.addColorStop(0.24, '#366899');
  grad.addColorStop(0.44, '#79a8be');
  grad.addColorStop(0.52, '#f6e4b2');
  grad.addColorStop(0.62, '#d5bf96');
  grad.addColorStop(1.0, '#4f463d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Soft emerald-jasper celestial aurora ribbons in upper hemisphere
  for (let band = 0; band < 5; band++) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const baseY = H * (0.14 + band * 0.065);
    ctx.beginPath();
    for (let x = 0; x <= W; x += 8) {
      const u = (x / W) * Math.PI * 2;
      const y = baseY + Math.sin(u * 2 + band * 1.1) * 18 + Math.cos(u * 3 - band) * 9;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = band % 2 === 0 ? 'rgba(92, 232, 186, 0.14)' : 'rgba(255, 226, 146, 0.14)';
    ctx.lineWidth = 26 - band * 3;
    ctx.stroke();
    ctx.restore();
  }

  // Broad Western Glory illumination (no sun disc — diffuse divine radiance filling the horizon)
  for (const cx of [W * 0.5, W * 0.0, W * 1.0]) {
    const isWest = Math.abs(cx - W * 0.5) < 1;
    const r = isWest ? W * 0.42 : W * 0.24;
    const rg = ctx.createRadialGradient(cx, H * 0.48, 8, cx, H * 0.48, r);
    if (isWest) {
      rg.addColorStop(0.0, 'rgba(255, 248, 214, 0.72)');
      rg.addColorStop(0.35, 'rgba(255, 224, 145, 0.38)');
      rg.addColorStop(0.7, 'rgba(130, 228, 198, 0.14)');
      rg.addColorStop(1.0, 'rgba(255, 224, 145, 0)');
    } else {
      rg.addColorStop(0.0, 'rgba(255, 238, 196, 0.24)');
      rg.addColorStop(1.0, 'rgba(255, 238, 196, 0)');
    }
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }

  // Luminous gossamer cloud wisps
  for (let i = 0; i < 65; i++) {
    const x = rand() * W;
    const y = H * (0.12 + rand() * 0.36);
    const rw = 50 + rand() * 140;
    const rh = 6 + rand() * 16;
    const cg = ctx.createRadialGradient(x, y, 2, x, y, rw);
    cg.addColorStop(0, `rgba(255, 250, 232, ${0.06 + rand() * 0.08})`);
    cg.addColorStop(1, 'rgba(255, 250, 232, 0)');
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, rh / rw);
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(0, 0, rw, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// PROCEDURAL TEXTURE & MINERAL SUITE (Rev 21:11, 18-21; 22:1-2)
// ---------------------------------------------------------------------------
interface FoundationSpec {
  order: string;
  en: string;
  zh: string;
  baseHex: string;
  veinHex: string;
  glowHex: string;
  banded?: boolean;
  flecked?: boolean;
}

export const TWELVE_FOUNDATIONS: readonly FoundationSpec[] = [
  { order: 'I', en: 'Jasper', zh: '碧玉', baseHex: '#4fb896', veinHex: '#bff5e2', glowHex: '#2c7d63' },
  { order: 'II', en: 'Sapphire', zh: '蓝宝石', baseHex: '#1f56b8', veinHex: '#ffd978', glowHex: '#143980', flecked: true },
  { order: 'III', en: 'Chalcedony', zh: '绿玛瑙', baseHex: '#68b6c4', veinHex: '#d8f4f8', glowHex: '#3d7c8a', banded: true },
  { order: 'IV', en: 'Emerald', zh: '绿宝石', baseHex: '#159952', veinHex: '#8cf2b8', glowHex: '#0d6b37' },
  { order: 'V', en: 'Sardonyx', zh: '红玛瑙', baseHex: '#ad4f32', veinHex: '#f5e6d3', glowHex: '#732e1a', banded: true },
  { order: 'VI', en: 'Carnelian', zh: '红宝石', baseHex: '#c92a32', veinHex: '#ff9688', glowHex: '#85161d' },
  { order: 'VII', en: 'Chrysolite', zh: '黄璧玺', baseHex: '#d4b235', veinHex: '#fff0a6', glowHex: '#877019' },
  { order: 'VIII', en: 'Beryl', zh: '水苍玉', baseHex: '#3bb598', veinHex: '#b8f7e8', glowHex: '#21735f' },
  { order: 'IX', en: 'Topaz', zh: '黄玉', baseHex: '#de9821', veinHex: '#ffe39e', glowHex: '#8c5b0d' },
  { order: 'X', en: 'Chrysoprase', zh: '翡翠', baseHex: '#76bf43', veinHex: '#d4f7b5', glowHex: '#467822' },
  { order: 'XI', en: 'Jacinth', zh: '紫玛瑙', baseHex: '#465ac4', veinHex: '#b8c4ff', glowHex: '#283685' },
  { order: 'XII', en: 'Amethyst', zh: '紫晶', baseHex: '#863ec2', veinHex: '#e3bdfc', glowHex: '#52217d' },
];

function paintJasperCrystal(): HTMLCanvasElement {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const rand = makeRng(2118);

  const bg = ctx.createLinearGradient(0, 0, S, S);
  bg.addColorStop(0, '#62c9ab');
  bg.addColorStop(0.5, '#86dec6');
  bg.addColorStop(1, '#4fb396');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);

  // Monumental crystalline ashlar courses with internal quartz facets
  const rows = 6;
  const rh = S / rows;
  for (let r = 0; r < rows; r++) {
    const cols = 3;
    const bw = S / cols;
    const off = (r % 2) * (bw * 0.5);
    for (let i = -1; i <= cols; i++) {
      const x = i * bw + off;
      const y = r * rh;
      const g = ctx.createLinearGradient(x, y, x + bw, y + rh);
      const shift = (rand() - 0.5) * 20;
      g.addColorStop(0, `rgba(${96 + shift}, ${208 + shift * 0.5}, ${180 + shift * 0.5}, 0.78)`);
      g.addColorStop(0.5, `rgba(210, 252, 240, 0.42)`);
      g.addColorStop(1, `rgba(${68 + shift}, ${176 + shift * 0.5}, ${150 + shift * 0.5}, 0.82)`);
      ctx.fillStyle = g;
      ctx.fillRect(x + 2, y + 2, bw - 4, rh - 4);

      // Crystalline diagonal cleavage lines
      ctx.strokeStyle = 'rgba(235, 255, 248, 0.36)';
      ctx.lineWidth = 1.4;
      for (let f = 0; f < 4; f++) {
        ctx.beginPath();
        const sx = x + 8 + rand() * (bw - 16);
        const sy = y + 6 + rand() * (rh - 12);
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + (rand() - 0.3) * 48, sy + (rand() - 0.3) * 32);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(255, 238, 178, 0.45)';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(x + 3, y + 3, bw - 6, rh - 6);
    }
  }
  return c;
}

function paintGoldGlass(): HTMLCanvasElement {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const rand = makeRng(2121);

  const bg = ctx.createLinearGradient(0, 0, S, S);
  bg.addColorStop(0, '#f4cb58');
  bg.addColorStop(0.5, '#ffe694');
  bg.addColorStop(1, '#dea932');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);

  const N = 4;
  const tile = S / N;
  for (let r = 0; r < N; r++) {
    for (let col = 0; col < N; col++) {
      const x = col * tile;
      const y = r * tile;
      const tg = ctx.createLinearGradient(x, y, x + tile, y + tile);
      const v = (rand() - 0.5) * 16;
      tg.addColorStop(0, `rgb(${246 + v}, ${206 + v}, ${96 + v})`);
      tg.addColorStop(0.52, `rgb(255, 241, 182)`);
      tg.addColorStop(1, `rgb(${216 + v}, ${166 + v}, ${56 + v})`);
      ctx.fillStyle = tg;
      ctx.fillRect(x + 3, y + 3, tile - 6, tile - 6);

      // Subtle inner geometric diamond facet suggesting translucent gold crystal
      ctx.strokeStyle = 'rgba(255, 252, 230, 0.52)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 9, y + 9, tile - 18, tile - 18);
      ctx.beginPath();
      ctx.moveTo(x + tile * 0.5, y + 12);
      ctx.lineTo(x + tile - 12, y + tile * 0.5);
      ctx.lineTo(x + tile * 0.5, y + tile - 12);
      ctx.lineTo(x + 12, y + tile * 0.5);
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255, 248, 214, 0.34)';
      ctx.stroke();
    }
  }
  return c;
}

function paintPearlNacre(): HTMLCanvasElement {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const bg = ctx.createRadialGradient(S * 0.42, S * 0.38, 18, S * 0.5, S * 0.5, S * 0.68);
  bg.addColorStop(0.0, '#ffffff');
  bg.addColorStop(0.28, '#fdf6ee');
  bg.addColorStop(0.55, '#eef6f8');
  bg.addColorStop(0.8, '#f7ecf2');
  bg.addColorStop(1.0, '#e6e1d6');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);

  // Delicate concentric mother-of-pearl orient shimmer rings
  for (let i = 0; i < 28; i++) {
    ctx.beginPath();
    const r = 18 + i * 13;
    ctx.arc(S * 0.48, S * 0.48, r, 0, Math.PI * 2);
    ctx.strokeStyle =
      i % 3 === 0
        ? 'rgba(255, 226, 236, 0.22)'
        : i % 3 === 1
          ? 'rgba(212, 246, 244, 0.22)'
          : 'rgba(255, 244, 214, 0.22)';
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  return c;
}

function paintGemstoneCourse(spec: FoundationSpec, seed: number): HTMLCanvasElement {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  const rand = makeRng(seed);

  ctx.fillStyle = spec.baseHex;
  ctx.fillRect(0, 0, S, S);

  if (spec.banded) {
    // Agate / onyx horizontal mineral bands (Chalcedony, Sardonyx)
    for (let y = 0; y < S; y += 8) {
      const wave = Math.sin(y * 0.09) * 4;
      ctx.fillStyle = y % 24 === 0 ? spec.veinHex : 'rgba(255,255,255,0.12)';
      ctx.globalAlpha = y % 24 === 0 ? 0.52 : 0.18;
      ctx.fillRect(0, y + wave, S, 3 + (rand() * 3));
    }
    ctx.globalAlpha = 1;
  } else if (spec.flecked) {
    // Golden pyrite flecks in deep royal Sapphire
    for (let i = 0; i < 140; i++) {
      ctx.fillStyle = rand() > 0.3 ? spec.veinHex : '#9ec4ff';
      ctx.globalAlpha = 0.35 + rand() * 0.55;
      const sz = 1.5 + rand() * 3.2;
      ctx.fillRect(rand() * S, rand() * S, sz, sz);
    }
    ctx.globalAlpha = 1;
  } else {
    // Crystalline internal facets & mineral veins
    for (let i = 0; i < 26; i++) {
      const x = rand() * S;
      const y = rand() * S;
      const r = 18 + rand() * 44;
      const rg = ctx.createRadialGradient(x, y, 2, x, y, r);
      rg.addColorStop(0, spec.veinHex);
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = 0.22 + rand() * 0.2;
      ctx.fillStyle = rg;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  }

  // Dressed gemstone block joints
  ctx.strokeStyle = 'rgba(255, 245, 210, 0.42)';
  ctx.lineWidth = 2;
  ctx.strokeRect(3, 3, S - 6, S - 6);
  ctx.beginPath();
  ctx.moveTo(S * 0.5, 0);
  ctx.lineTo(S * 0.5, S);
  ctx.stroke();

  return c;
}

function paintPlaqueTex(spec: FoundationSpec): THREE.CanvasTexture {
  const W = 256;
  const H = 320;
  const [c, ctx] = makeCanvas(W, H);

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#2b2214');
  bg.addColorStop(0.5, '#47371d');
  bg.addColorStop(1, '#241b0e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Gold filigree border
  ctx.strokeStyle = '#ffd978';
  ctx.lineWidth = 8;
  ctx.strokeRect(12, 12, W - 24, H - 24);
  ctx.strokeStyle = spec.veinHex;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(24, 24, W - 48, H - 48);

  // Gemstone inlay cabochon emblem at top
  const cg = ctx.createRadialGradient(W * 0.46, 82, 4, W * 0.5, 88, 34);
  cg.addColorStop(0, spec.veinHex);
  cg.addColorStop(0.55, spec.baseHex);
  cg.addColorStop(1, '#1a140c');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(W * 0.5, 88, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffe28a';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Roman numeral I - XII & symbolic apostolic foundation seal (Rev 21:14, 19-20)
  ctx.fillStyle = '#ffe8a3';
  ctx.textAlign = 'center';
  ctx.font = '600 44px Georgia, serif';
  ctx.fillText(spec.order, W * 0.5, 178);

  ctx.fillStyle = '#f5d78e';
  ctx.font = '600 22px system-ui, sans-serif';
  ctx.fillText(spec.en.toUpperCase(), W * 0.5, 224);

  ctx.fillStyle = '#fff2c6';
  ctx.font = '500 28px "PingFang SC", "Noto Sans SC", serif';
  ctx.fillText(spec.zh, W * 0.5, 268);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

function paintCrystalWater(): HTMLCanvasElement {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const rand = makeRng(2201);

  const bg = ctx.createLinearGradient(0, 0, 0, S);
  bg.addColorStop(0, '#5cd6e0');
  bg.addColorStop(0.5, '#aef7ff');
  bg.addColorStop(1, '#5cd6e0');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);

  // Flowing crystal caustic ribbons along X
  for (let i = 0; i < 95; i++) {
    const y = rand() * S;
    const x = rand() * S;
    const len = 50 + rand() * 130;
    const g = ctx.createLinearGradient(x, y, x + len, y);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, `rgba(255, 253, 240, ${0.28 + rand() * 0.35})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, len, 2 + rand() * 4);
  }
  return c;
}

function paintBeamTex(): THREE.CanvasTexture {
  const W = 128;
  const H = 256;
  const [c, ctx] = makeCanvas(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0.0, 'rgba(255, 250, 225, 0.0)');
  g.addColorStop(0.25, 'rgba(255, 246, 205, 0.65)');
  g.addColorStop(0.75, 'rgba(255, 235, 175, 0.32)');
  g.addColorStop(1.0, 'rgba(255, 225, 150, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Soft horizontal edge fade
  ctx.globalCompositeOperation = 'destination-in';
  const hg = ctx.createLinearGradient(0, 0, W, 0);
  hg.addColorStop(0.0, 'rgba(255,255,255,0)');
  hg.addColorStop(0.3, 'rgba(255,255,255,1)');
  hg.addColorStop(0.7, 'rgba(255,255,255,1)');
  hg.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, W, H);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function paintEmeraldRainbowTex(): THREE.CanvasTexture {
  const W = 64;
  const H = 256;
  const [c, ctx] = makeCanvas(W, H);
  // Multi-band emerald prism ("a rainbow around the throne that looked like an emerald", Rev 4:3)
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0.0, 'rgba(20, 180, 110, 0)');
  g.addColorStop(0.18, 'rgba(36, 215, 128, 0.55)');
  g.addColorStop(0.38, 'rgba(110, 255, 185, 0.92)');
  g.addColorStop(0.52, 'rgba(218, 255, 220, 0.95)');
  g.addColorStop(0.68, 'rgba(52, 232, 156, 0.85)');
  g.addColorStop(0.84, 'rgba(28, 178, 132, 0.45)');
  g.addColorStop(1.0, 'rgba(20, 150, 110, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function paintSoftHaloTex(innerRgba: string, midRgba: string): THREE.CanvasTexture {
  const S = 128;
  const [c, ctx] = makeCanvas(S, S);
  const rg = ctx.createRadialGradient(S * 0.5, S * 0.5, 2, S * 0.5, S * 0.5, S * 0.5);
  rg.addColorStop(0.0, innerRgba);
  rg.addColorStop(0.42, midRgba);
  rg.addColorStop(1.0, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

// ---------------------------------------------------------------------------
// DETERMINISTIC HIGH-MOUNTAIN & CITY HEIGHTFIELD IN CUBITS (Rev 21:10)
// ---------------------------------------------------------------------------
export const PROMENADE_C = -12.0;
export const STREET_C = 0.0;
export const THRONE_FORECOURT_C = 8.0;
export const WALL_OVERLOOK_C = 144.0;

/**
 * Returns ground elevation in cubits (`1 cubit = 0.445 m` default, Rev 21:17).
 * Keeps gradient strictly < MAX_CLIMB (1.0) on all walkable stairs, river banks,
 * and mountain approach paths, while plunging dramatically outside the high mountain summit.
 */
export function mountainCubits(cx: number, cz: number, visual = false): number {
  // 1. Inside the Holy City perimeter (X <= +28, |Z| <= 220)
  if (cx <= 28.0 && Math.abs(cz) <= 220.0) {
    if (visual) return -3.2; // sunk beneath city golden slabs & crystal river bed
    // Western Sanctuary stairs & Upper Sapphire Forecourt (X = -216..-252, |Z| <= 29)
    if (cx < -215.5 && cx >= -252.0 && Math.abs(cz) <= 29.0) {
      return THRONE_FORECOURT_C * smoothstep(-215.5, -236.0, cx);
    }
    // Central Crystal River ankle-deep bed (X = -215..-8, |Z| < 6.8)
    if (cx >= -215.0 && cx <= -8.0 && Math.abs(cz) < 6.8) {
      const bankT = smoothstep(5.6, 6.8, Math.abs(cz));
      return -0.62 * (1 - bankT);
    }
    return STREET_C;
  }

  // 2. East Wall Foundation & 3 Grand Pearl Gate Stairways (X = +28..+58, |Z| <= 220)
  if (cx > 28.0 && cx <= 58.0 && Math.abs(cz) <= 220.0) {
    if (visual) {
      // Crisp shelf at PROMENADE_C from X = 31.8 outward so all 12 Gemstone Courses show cleanly
      return cx < 31.8 ? -3.2 : PROMENADE_C;
    }
    const inCentralStair = 1 - smoothstep(11.0, 13.0, Math.abs(cz));
    const inNorthStair = 1 - smoothstep(6.5, 8.2, Math.abs(cz - 112.0));
    const inSouthStair = 1 - smoothstep(6.5, 8.2, Math.abs(cz + 112.0));
    const stairWeight = Math.max(inCentralStair, inNorthStair, inSouthStair);

    const stairRamp = PROMENADE_C * ((cx - 28.0) / 30.0); // gentle 0.40 slope under stairs
    // Outside stairs, ramp inside solid foundation masonry (X = 28..33) so X >= 33 is exact -12.0 c
    const wallRamp = cx >= 33.2 ? PROMENADE_C : PROMENADE_C * ((cx - 28.0) / 5.2);
    return stairWeight * stairRamp + (1 - stairWeight) * wallRamp;
  }

  // 3. High Mountain Summit Promenade & Dramatic Alpine Crags Beyond (Rev 21:10)
  const overEast = Math.max(0, cx - 110.0);
  const overWest = Math.max(0, -282.0 - cx);
  const overZ = Math.max(0, Math.abs(cz) - (cx > 28.0 ? 164.0 : 224.0));
  const rimDist = Math.hypot(Math.max(overEast, overWest), overZ);

  if (rimDist <= 0.01) return PROMENADE_C;

  const plunge = smoothstep(0, 145, rimDist) * 118.0;
  const crags =
    Math.sin(cx * 0.038) * Math.cos(cz * 0.034) * 7.5 +
    Math.sin(cx * 0.085 + cz * 0.072) * 3.2 +
    Math.cos(cx * 0.019 - cz * 0.022) * 11.0;
  // Distant surrounding lower mountain peaks across the horizon
  const farPeaks = smoothstep(155, 380, rimDist) * (24.0 + Math.sin(cx * 0.016) * Math.cos(cz * 0.018) * 22.0);

  return PROMENADE_C - plunge + smoothstep(4, 48, rimDist) * crags + farPeaks;
}

// ---------------------------------------------------------------------------
// MAIN 1:1 SCENE BUILDER (`DEFAULT_CUBIT = 0.445 m`, Rev 21:17)
// ---------------------------------------------------------------------------
export function buildNewJerusalemCity(initialCubit = 0.445): NewJerusalemCity {
  const skyTex = buildCelestialSky();

  const jasperCanvas = paintJasperCrystal();
  const jasperTex = texFrom(jasperCanvas, 1, 1);
  const jasperNorm = normalFromLuminance(jasperCanvas, 2.2);

  const goldCanvas = paintGoldGlass();
  const goldTex = texFrom(goldCanvas, 18, 6);
  const goldNorm = normalFromLuminance(goldCanvas, 1.6);
  goldNorm.repeat.set(18, 6);

  const goldArchTex = texFrom(goldCanvas, 2, 2);
  const goldArchNorm = normalFromLuminance(goldCanvas, 1.8);
  goldArchNorm.repeat.set(2, 2);

  const pearlCanvas = paintPearlNacre();
  const pearlTex = texFrom(pearlCanvas, 1, 1);
  const pearlNorm = normalFromLuminance(pearlCanvas, 1.1);

  const waterCanvas = paintCrystalWater();
  const waterAlbedo = texFrom(waterCanvas, 16, 2);
  const waterNormal = normalFromLuminance(waterCanvas, 2.0);
  waterNormal.repeat.set(16, 2);

  const beamTex = paintBeamTex();
  const rainbowTex = paintEmeraldRainbowTex();
  const jasperHaloTex = paintSoftHaloTex('rgba(255, 252, 230, 0.95)', 'rgba(110, 245, 212, 0.48)');
  const carnelianHaloTex = paintSoftHaloTex('rgba(255, 236, 198, 0.92)', 'rgba(255, 92, 74, 0.46)');

  // Core Architectural Materials
  const jasperCoreMat = new THREE.MeshStandardMaterial({
    name: 'InteriorJasperCore',
    map: jasperTex,
    normalMap: jasperNorm,
    color: new THREE.Color('#8be6cc'),
    emissive: new THREE.Color('#195948'),
    emissiveIntensity: 0.28,
    roughness: 0.22,
    metalness: 0.18,
  });

  const jasperGlassMat = new THREE.MeshStandardMaterial({
    name: 'InteriorJasperCrystal',
    map: jasperTex,
    normalMap: jasperNorm,
    color: new THREE.Color('#b8ffea'),
    emissive: new THREE.Color('#2d8a72'),
    emissiveIntensity: 0.34,
    roughness: 0.09,
    metalness: 0.25,
    transparent: true,
    opacity: 0.56,
  });

  const goldBaseMat = new THREE.MeshStandardMaterial({
    name: 'InteriorGoldBase',
    map: goldTex,
    normalMap: goldNorm,
    color: new THREE.Color('#ffd970'),
    emissive: new THREE.Color('#7a5310'),
    emissiveIntensity: 0.28,
    roughness: 0.2,
    metalness: 0.86,
  });

  const goldGlassGlazeMat = new THREE.MeshStandardMaterial({
    name: 'InteriorGoldGlaze',
    color: new THREE.Color('#ffea9f'),
    emissive: new THREE.Color('#6b480c'),
    emissiveIntensity: 0.2,
    roughness: 0.05,
    metalness: 0.62,
    transparent: true,
    opacity: 0.38,
  });

  const goldTrimMat = new THREE.MeshStandardMaterial({
    name: 'InteriorGoldTrim',
    map: goldArchTex,
    normalMap: goldArchNorm,
    color: new THREE.Color('#ffe07d'),
    emissive: new THREE.Color('#6e4b0e'),
    emissiveIntensity: 0.3,
    roughness: 0.18,
    metalness: 0.88,
  });

  const goldCrystalColMat = new THREE.MeshStandardMaterial({
    name: 'InteriorGoldCrystalCol',
    color: new THREE.Color('#ffe9a6'),
    emissive: new THREE.Color('#855b14'),
    emissiveIntensity: 0.34,
    roughness: 0.12,
    metalness: 0.72,
    transparent: true,
    opacity: 0.76,
  });

  const pearlMat = new THREE.MeshStandardMaterial({
    name: 'InteriorPearlGate',
    map: pearlTex,
    normalMap: pearlNorm,
    color: new THREE.Color('#fffdf9'),
    emissive: new THREE.Color('#cfdcf0'),
    emissiveIntensity: 0.3,
    roughness: 0.11,
    metalness: 0.22,
  });

  const sapphireMat = new THREE.MeshStandardMaterial({
    name: 'InteriorSapphireDais',
    color: new THREE.Color('#2462c9'),
    emissive: new THREE.Color('#12377a'),
    emissiveIntensity: 0.36,
    roughness: 0.14,
    metalness: 0.38,
  });

  const seaOfGlassMat = new THREE.MeshStandardMaterial({
    name: 'InteriorSeaOfGlass',
    color: new THREE.Color('#d9fbff'),
    emissive: new THREE.Color('#4aa6b8'),
    emissiveIntensity: 0.32,
    roughness: 0.06,
    metalness: 0.35,
    transparent: true,
    opacity: 0.54,
  });

  const waterMat = new THREE.MeshStandardMaterial({
    map: waterAlbedo,
    normalMap: waterNormal,
    color: new THREE.Color('#b8fbff'),
    emissive: new THREE.Color('#2a8fa3'),
    emissiveIntensity: 0.38,
    roughness: 0.07,
    metalness: 0.25,
    transparent: true,
    opacity: 0.78,
  });

  const summitPavingMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#d8ceb8'),
    roughness: 0.78,
    metalness: 0.08,
  });

  const oliveGoldBarkMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#9e7e46'),
    emissive: new THREE.Color('#38290e'),
    emissiveIntensity: 0.18,
    roughness: 0.62,
    metalness: 0.32,
  });

  const healingLeafMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#4fd17c'),
    emissive: new THREE.Color('#1e6e3c'),
    emissiveIntensity: 0.34,
    roughness: 0.36,
    metalness: 0.08,
  });

  // 12 Gemstone Foundation Materials & Plaque Materials
  const foundationMats: THREE.MeshStandardMaterial[] = TWELVE_FOUNDATIONS.map((spec, idx) => {
    const gc = paintGemstoneCourse(spec, 2119 + idx * 31);
    const gt = texFrom(gc, 6, 1);
    const gn = normalFromLuminance(gc, 2.0);
    gn.repeat.set(6, 1);
    return new THREE.MeshStandardMaterial({
      map: gt,
      normalMap: gn,
      color: new THREE.Color('#ffffff'),
      emissive: new THREE.Color(spec.glowHex),
      emissiveIntensity: 0.34,
      roughness: 0.16,
      metalness: 0.28,
    });
  });

  const plaqueMats: THREE.MeshStandardMaterial[] = TWELVE_FOUNDATIONS.map((spec) => {
    const pt = paintPlaqueTex(spec);
    return new THREE.MeshStandardMaterial({
      map: pt,
      emissive: new THREE.Color('#594114'),
      emissiveIntensity: 0.26,
      roughness: 0.24,
      metalness: 0.65,
    });
  });

  // 12 Distinct Glowing Fruit Cluster Materials (Rev 22:2)
  const fruitPalette = [
    '#ff4757', '#ffa502', '#ffda54', '#7bed9f',
    '#70a1ff', '#c56cf0', '#ff6b81', '#eccc68',
    '#2ed573', '#48dbfb', '#ff9ff3', '#fff29c',
  ];
  const fruitMats = fruitPalette.map(
    (hex) =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(hex),
        emissive: new THREE.Color(hex),
        emissiveIntensity: 0.62,
        roughness: 0.2,
        metalness: 0.15,
      }),
  );

  // Scene Hierarchy (1 local unit = 1 cubit inside unitGroup)
  const root = new THREE.Group();
  root.name = 'NewJerusalemRoot';

  const unitGroup = new THREE.Group();
  unitGroup.name = 'NewJerusalemUnitScale';
  root.add(unitGroup);

  const staticGroup = new THREE.Group();
  const dynamicGroup = new THREE.Group();
  unitGroup.add(staticGroup);
  unitGroup.add(dynamicGroup);

  const rawColliders: THREE.Box3[] = [];
  const rawPlatforms: THREE.Box3[] = [];
  const colliders: THREE.Box3[] = [];
  const platforms: THREE.Box3[] = [];

  const counts: NewJerusalemCounts = {
    stadiaCube: 12000,
    wallCubits: 144,
    foundationCourses: 12,
    totalPearlGates: 12,
    eastPearlGates: 0,
    treesOfLife: 0,
    fruitsPerTree: 12,
    bridges: 0,
  };

  function pushCollider(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
    rawColliders.push(
      new THREE.Box3(
        new THREE.Vector3(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)),
        new THREE.Vector3(Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)),
      ),
    );
  }

  function pushPlatform(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
    rawPlatforms.push(
      new THREE.Box3(
        new THREE.Vector3(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)),
        new THREE.Vector3(Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)),
      ),
    );
  }

  function addBoxMesh(
    parent: THREE.Object3D,
    cx: number,
    y0: number,
    cz: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    bevel = 0.03,
    uvMul = 0.18,
  ): THREE.Mesh {
    const m = bevelBox(w, h, d, mat, bevel);
    m.position.set(cx, y0 + h * 0.5, cz);
    const uv = m.geometry.attributes.uv;
    if (uv) {
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, uv.getX(i) * uvMul, uv.getY(i) * uvMul);
      }
      uv.needsUpdate = true;
    }
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function addSolidBlock(
    x0: number,
    y0: number,
    z0: number,
    x1: number,
    y1: number,
    z1: number,
    mat: THREE.Material,
    collide = true,
  ): THREE.Mesh {
    const cx = (x0 + x1) * 0.5;
    const cz = (z0 + z1) * 0.5;
    const w = Math.abs(x1 - x0);
    const h = Math.abs(y1 - y0);
    const d = Math.abs(z1 - z0);
    const m = addBoxMesh(staticGroup, cx, Math.min(y0, y1), cz, w, h, d, mat);
    if (collide) pushCollider(x0, y0, z0, x1, y1, z1);
    return m;
  }

  function addGlassLayer(
    cx: number,
    y0: number,
    cz: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
  ): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(cx, y0 + h * 0.5, cz);
    m.castShadow = false;
    m.receiveShadow = false;
    m.userData.dynamic = true;
    m.userData.noCast = true;
    m.userData.noAO = true;
    dynamicGroup.add(m);
    return m;
  }

  // ---------------------------------------------------------------------------
  // 1. HIGH MOUNTAIN EASTERN APPROACH TERRACE & ALPINE SUMMIT (Rev 21:10)
  //    (Custom rocky mountain summit — zero desert sand dunes!)
  // ---------------------------------------------------------------------------
  const mountainMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#9e9589'),
    roughness: 0.92,
    metalness: 0.04,
  });
  detailedSurface(mountainMat, 'desert-rock', 48, 0.35);
  rockProjection(mountainMat, 42);

  const terrainSpan = 1500;
  const terrainSegs = 160;
  const tGeo = new THREE.PlaneGeometry(terrainSpan, terrainSpan, terrainSegs, terrainSegs);
  tGeo.rotateX(-Math.PI / 2); // +Y vertex normals guaranteed
  const tPos = tGeo.attributes.position!;
  for (let i = 0; i < tPos.count; i++) {
    const vx = tPos.getX(i) - 60; // centered around X = -60
    const vz = tPos.getZ(i);
    tPos.setX(i, vx);
    tPos.setY(i, mountainCubits(vx, vz, true) - 0.18);
  }
  tGeo.computeVertexNormals();
  const mountainMesh = new THREE.Mesh(tGeo, mountainMat);
  mountainMesh.receiveShadow = true;
  mountainMesh.castShadow = false;
  mountainMesh.userData.dynamic = true;
  mountainMesh.userData.noCast = true;
  dynamicGroup.add(mountainMesh);

  // Dressed Stone Eastern Foundation Promenade & High Mountain Approach Plaza (Y = -12.0 c)
  const promenadeSlab = new THREE.Mesh(new THREE.BoxGeometry(79, 0.5, 326), summitPavingMat);
  promenadeSlab.position.set(71.5, PROMENADE_C - 0.25, 0);
  promenadeSlab.receiveShadow = true;
  promenadeSlab.userData.dynamic = true;
  promenadeSlab.userData.noCast = true;
  dynamicGroup.add(promenadeSlab);
  pushPlatform(32.5, PROMENADE_C - 0.5, -163, 110.5, PROMENADE_C, 163);

  // Ceremonial gold-inlaid central approach carpet leading to the East Pearl Gate stairs
  addBoxMesh(staticGroup, 84, PROMENADE_C - 0.06, 0, 52, 0.1, 22, goldTrimMat, 0.02, 0.25);

  // Natural rocky summit rim crags & safety parapet boulders along mountain cliff edge
  for (let bz = -160; bz <= 160; bz += 16) {
    const cragH = 2.6 + Math.abs(Math.sin(bz * 0.13)) * 1.6;
    addBoxMesh(staticGroup, 111.5, PROMENADE_C, bz, 3.2, cragH, 14.5, mountainMat, 0.12, 0.15);
  }
  pushCollider(110.2, PROMENADE_C, -165, 114.0, PROMENADE_C + 4.5, 165);
  pushCollider(28.0, PROMENADE_C, 162.5, 114.0, PROMENADE_C + 4.5, 166);
  pushCollider(28.0, PROMENADE_C, -166, 114.0, PROMENADE_C + 4.5, -162.5);
  addBoxMesh(staticGroup, 71, PROMENADE_C, 164, 84, 3.0, 3.2, mountainMat, 0.1, 0.15);
  addBoxMesh(staticGroup, 71, PROMENADE_C, -164, 84, 3.0, 3.2, mountainMat, 0.1, 0.15);

  // ---------------------------------------------------------------------------
  // 2. TWELVE NAMED GEMSTONE FOUNDATION TIERS & APOSTOLIC PLAQUES (Rev 21:14, 19-20)
  // ---------------------------------------------------------------------------
  // East Wall segments around the 3 East Pearl Gates (Z = -112, 0, +112)
  const foundationZSegments: [number, number][] = [
    [-220, -120.2],
    [-103.8, -13.2],
    [13.2, 103.8],
    [120.2, 220],
  ];

  for (const [z0, z1] of foundationZSegments) {
    const segLen = z1 - z0;
    const cz = (z0 + z1) * 0.5;
    // Solid inner foundation core collider
    pushCollider(4.0, PROMENADE_C, z0, 32.5, STREET_C, z1);

    // 12 Distinct Stepped Gemstone Courses (Course 1 = Jasper at bottom Y=-12..-11 -> Course 12 = Amethyst at Y=-1..0)
    for (let i = 0; i < 12; i++) {
      const y0 = PROMENADE_C + i * 1.0;
      const xFront = 32.4 - i * 0.36;
      const w = xFront - 4.0;
      addBoxMesh(staticGroup, 4.0 + w * 0.5, y0, cz, w, 0.98, segLen, foundationMats[i]!, 0.02, 0.12);
    }
  }

  // North & South Return Foundation Courses (Z = ±220, X = -280..+32)
  for (const side of [-1, 1]) {
    const rz = side * 226;
    pushCollider(-280, PROMENADE_C, side > 0 ? 220 : -232, 32.4, STREET_C, side > 0 ? 232 : -220);
    for (let i = 0; i < 12; i++) {
      const y0 = PROMENADE_C + i * 1.0;
      addBoxMesh(staticGroup, -124, y0, rz, 312, 0.98, 12, foundationMats[i]!, 0.02, 0.08);
    }
  }

  // 12 Symbolic Apostolic Foundation Stelae / Plaques along the Eastern Promenade (Rev 21:14)
  // 6 North of Central Stairs (Courses I-VI) and 6 South of Central Stairs (Courses VII-XII)
  const plaqueZPositions = [22, 36, 50, 64, 78, 92, -22, -36, -50, -64, -78, -92];
  for (let i = 0; i < 12; i++) {
    const pz = plaqueZPositions[i]!;
    // Stepped golden-crystal pedestal at X = 34.0 on the promenade
    addSolidBlock(32.8, PROMENADE_C, pz - 1.5, 35.2, PROMENADE_C + 1.2, pz + 1.5, goldTrimMat);
    addSolidBlock(33.1, PROMENADE_C + 1.2, pz - 1.2, 34.9, PROMENADE_C + 4.4, pz + 1.2, foundationMats[i]!);
    // Inscribed plaque facing East (+X) toward the promenade
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.7, 2.1), plaqueMats[i]!);
    plaque.position.set(34.96, PROMENADE_C + 2.8, pz);
    staticGroup.add(plaque);
  }

  // ---------------------------------------------------------------------------
  // 3. 144-CUBIT CRYSTALLINE JASPER WALL & THREE EAST PEARL GATES (Rev 21:11-13, 17-18, 21, 25)
  // ---------------------------------------------------------------------------
  function buildPearlGateAndStairs(gateZ: number, halfOpen: number, archH: number, stairHalfW: number): void {
    // 30 Walkable Grand Steps rising from PROMENADE_C (-12.0 c) at X=+58 to STREET_C (0.0 c) at X=+28
    const STEPS = 30;
    const stepRise = (STREET_C - PROMENADE_C) / STEPS; // 0.40 c = 0.178 m (<= 0.50 m!)
    for (let s = 0; s < STEPS; s++) {
      const topY = PROMENADE_C + (s + 1) * stepRise;
      const xOuter = 58.0 - s * 1.0;
      const xInner = xOuter - 1.08;
      // Alternating golden-trim and gemstone-inlaid marble treads
      const mat = s % 5 === 4 ? goldTrimMat : pearlMat;
      addBoxMesh(
        staticGroup,
        (xOuter + xInner) * 0.5,
        PROMENADE_C,
        gateZ,
        Math.abs(xOuter - xInner),
        topY - PROMENADE_C,
        stairHalfW * 2,
        mat,
        0.02,
        0.2,
      );
      pushPlatform(xInner, PROMENADE_C, gateZ - stairHalfW, xOuter, topY, gateZ + stairHalfW);
    }

    // Stepped 12-Gemstone Cheek Balustrades flanking the stairway
    for (const side of [-1, 1]) {
      const zIn = gateZ + side * stairHalfW;
      const zOut = gateZ + side * (stairHalfW + 2.2);
      pushCollider(28.0, PROMENADE_C, Math.min(zIn, zOut), 58.0, STREET_C + 2.8, Math.max(zIn, zOut));
      for (let i = 0; i < 12; i++) {
        const xEnd = 58.0 - i * 2.5;
        const yTop = PROMENADE_C + (i + 1) * 1.0 + 1.8;
        addBoxMesh(
          staticGroup,
          (28.0 + xEnd) * 0.5,
          PROMENADE_C + i * 1.0,
          (zIn + zOut) * 0.5,
          xEnd - 28.0,
          yTop - (PROMENADE_C + i * 1.0),
          2.2,
          foundationMats[i]!,
          0.03,
          0.16,
        );
      }
      // Pure gold coping rail atop stair cheek-wall
      addBoxMesh(staticGroup, 43.0, STREET_C - 3.5, (zIn + zOut) * 0.5, 30.0, 0.45, 2.35, goldTrimMat);
    }

    // Walkable Gate Threshold Floor Slab (X = -8..+28.5)
    addBoxMesh(staticGroup, 10.2, -0.45, gateZ, 36.8, 0.45, (halfOpen + 4) * 2, goldBaseMat, 0.02, 0.22);
    pushPlatform(-8.2, -0.45, gateZ - (halfOpen + 3), 28.5, STREET_C, gateZ + (halfOpen + 3));

    // Monolithic Single-Pearl Gateway Jambs & Sculpted Nacreous Arch (Rev 21:21, 25)
    const jambOuter = halfOpen + 4.8;
    for (const side of [-1, 1]) {
      const jz0 = gateZ + side * halfOpen;
      const jz1 = gateZ + side * jambOuter;
      // Solid monolithic pearl jamb pier (collider)
      addSolidBlock(4.0, STREET_C, Math.min(jz0, jz1), 28.0, archH, Math.max(jz0, jz1), pearlMat, true);

      // Sculpted cylindrical pearl colonnettes on East & West portals
      for (const px of [4.2, 16.0, 27.8]) {
        const pCol = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.85, archH - 1.5, 20), pearlMat);
        pCol.position.set(px, (archH - 1.5) * 0.5, gateZ + side * (halfOpen + 1.5));
        pCol.castShadow = true;
        pCol.receiveShadow = true;
        staticGroup.add(pCol);

        const gRing = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.28, 10, 24), goldTrimMat);
        gRing.rotation.x = Math.PI * 0.5;
        gRing.position.set(px, archH - 1.5, gateZ + side * (halfOpen + 1.5));
        staticGroup.add(gRing);
      }

      // Permanently Open Carved Pearl Portal Leaves swung back into jamb recesses (Rev 21:25)
      const openLeaf = bevelBox(5.6, archH - 4.0, 0.65, pearlMat, 0.08);
      openLeaf.position.set(10.5, (archH - 4.0) * 0.5, gateZ + side * (halfOpen - 0.38));
      staticGroup.add(openLeaf);
    }

    // Overhead Monolithic Pearl Arch Vault & Collider strictly above archH!
    addSolidBlock(4.0, archH, gateZ - jambOuter, 28.0, archH + 8.5, gateZ + jambOuter, pearlMat, true);

    // Sculpted Nacreous Pearl Torus Arch Rings on East (+28.2) & West (+3.8) faces
    for (const ax of [3.8, 10.0, 16.0, 22.0, 28.2]) {
      const pearlArch = new THREE.Mesh(
        new THREE.TorusGeometry(halfOpen + 1.6, 1.85, 16, 40, Math.PI),
        pearlMat,
      );
      pearlArch.rotation.y = Math.PI * 0.5;
      pearlArch.position.set(ax, archH - halfOpen - 0.5, gateZ);
      pearlArch.castShadow = true;
      staticGroup.add(pearlArch);

      const goldFiligree = new THREE.Mesh(
        new THREE.TorusGeometry(halfOpen + 3.55, 0.35, 10, 40, Math.PI),
        goldTrimMat,
      );
      goldFiligree.rotation.y = Math.PI * 0.5;
      goldFiligree.position.set(ax, archH - halfOpen - 0.5, gateZ);
      staticGroup.add(goldFiligree);
    }

    // Tribal Marker Gold-Crystal Crown Lintel above East & West Pearl Arches (Rev 21:12)
    addBoxMesh(staticGroup, 28.4, archH + 3.2, gateZ, 0.8, 3.2, halfOpen * 1.7, goldTrimMat, 0.04, 0.3);
    addBoxMesh(staticGroup, 3.6, archH + 3.2, gateZ, 0.8, 3.2, halfOpen * 1.7, goldTrimMat, 0.04, 0.3);

    counts.eastPearlGates++;
  }

  // Central East Pearl Gate (Z = 0, 17c wide, 26c clear arch) + NE (+112) & SE (-112) Flanking Pearl Gates
  buildPearlGateAndStairs(0, 8.5, 26.0, 11.0);
  buildPearlGateAndStairs(112, 5.5, 20.0, 6.5);
  buildPearlGateAndStairs(-112, 5.5, 20.0, 6.5);

  // Towering 144-Cubit (64.08 m) Crystalline Jasper Wall (X = +4..+28, Y = 0..144 c)
  const wallLowerSpans: [number, number][] = [
    [-220, -122.3],
    [-101.7, -13.3],
    [13.3, 101.7],
    [122.3, 220],
  ];
  for (const [z0, z1] of wallLowerSpans) {
    // Lower tier (Y = 0..36 c) between the 3 Pearl Gates
    addSolidBlock(5.5, STREET_C, z0, 26.5, 36.0, z1, jasperCoreMat, true);
    addGlassLayer(4.75, STREET_C, (z0 + z1) * 0.5, 1.5, 36.0, z1 - z0, jasperGlassMat);
    addGlassLayer(27.25, STREET_C, (z0 + z1) * 0.5, 1.5, 36.0, z1 - z0, jasperGlassMat);
  }

  // Continuous Upper Crystalline Jasper Wall (Y = 36..144 c across Z = -220..+220!)
  // Over NE/SE gates fill Y = 28.5..36 first so there is zero gap
  addSolidBlock(5.5, 28.5, 101.7, 26.5, 36.0, 122.3, jasperCoreMat, true);
  addSolidBlock(5.5, 28.5, -122.3, 26.5, 36.0, -101.7, jasperCoreMat, true);
  // Main soaring jasper mass (Y = 36..144 c)
  addSolidBlock(5.5, 36.0, -220, 26.5, WALL_OVERLOOK_C, 220, jasperCoreMat, true);
  addGlassLayer(4.75, 36.0, 0, 1.5, WALL_OVERLOOK_C - 36.0, 440, jasperGlassMat);
  addGlassLayer(27.25, 36.0, 0, 1.5, WALL_OVERLOOK_C - 36.0, 440, jasperGlassMat);

  // 12 Horizontal Pure-Gold Measurement Courses every 12 cubits up the 144-cubit Jasper Wall (12 x 12 = 144!)
  for (let tier = 1; tier <= 12; tier++) {
    const by = tier * 12.0;
    if (by >= 36.0) {
      addBoxMesh(staticGroup, 16.0, by - 0.35, 0, 24.6, 0.7, 440.4, goldTrimMat, 0.02, 0.08);
    }
  }

  // Vertical Crystalline Jasper Buttress Pilasters along the 144-cubit Wall
  for (const bz of [-195, -165, -138, -86, -56, -28, 28, 56, 86, 138, 165, 195]) {
    addBoxMesh(staticGroup, 27.6, STREET_C, bz, 1.8, WALL_OVERLOOK_C, 4.2, jasperCoreMat, 0.04, 0.08);
    addBoxMesh(staticGroup, 4.4, STREET_C, bz, 1.8, WALL_OVERLOOK_C, 4.2, jasperCoreMat, 0.04, 0.08);
  }

  // North & South Distant Return Walls of Crystalline Jasper (Z = ±224, X = -280..+28, Y = 0..144 c)
  for (const side of [-1, 1]) {
    const wz0 = side > 0 ? 220 : -232;
    const wz1 = side > 0 ? 232 : -220;
    addSolidBlock(-280, STREET_C, wz0, 28, WALL_OVERLOOK_C, wz1, jasperCoreMat, true);
    addBoxMesh(staticGroup, -126, WALL_OVERLOOK_C, (wz0 + wz1) * 0.5, 308, 2.2, 12.6, goldTrimMat, 0.02, 0.06);
  }

  // ---------------------------------------------------------------------------
  // 4. WALKABLE 144-CUBIT INTERIOR RAMP-STAIR & WALL OVERLOOK TERRACE (Y = +144.0 c)
  // ---------------------------------------------------------------------------
  // Straight continuous stepped ramp ascending North along inner East Wall (X = -6.5..+1.5, Z = +18..+206)
  const RAMP_STEPS = 320;
  const RAMP_Z0 = 18.0;
  const RAMP_Z1 = 206.0;
  const rampDz = (RAMP_Z1 - RAMP_Z0) / RAMP_STEPS; // 0.5875 c
  const rampDy = WALL_OVERLOOK_C / RAMP_STEPS; // 0.45 c = 0.200 m (<= 0.50 m!)

  for (let s = 0; s < RAMP_STEPS; s++) {
    const zStart = RAMP_Z0 + s * rampDz;
    const zEnd = zStart + rampDz + 0.08;
    const topY = (s + 1) * rampDy;
    const thick = 1.6;
    const yBottom = Math.max(0, topY - thick);
    const treadMat = s % 8 === 0 ? jasperCoreMat : goldTrimMat;
    addBoxMesh(staticGroup, -2.5, yBottom, (zStart + zEnd) * 0.5, 8.0, topY - yBottom, zEnd - zStart, treadMat, 0.01, 0.25);
    pushPlatform(-6.5, yBottom, zStart, 1.5, topY, zEnd);
  }

  // Soaring Gold-Jasper Arcade Piers beneath the Ramp (leaving Z = +100..+124 wide open for NE Gate!)
  for (let pz = 28; pz <= 200; pz += 18) {
    if (pz > 96 && pz < 128) continue; // clear 32-cubit arch span in front of NE Pearl Gate!
    const hAtZ = ((pz - RAMP_Z0) / (RAMP_Z1 - RAMP_Z0)) * WALL_OVERLOOK_C - 1.5;
    if (hAtZ > 3.0) {
      addSolidBlock(-6.2, 0, pz - 1.4, -4.4, hAtZ, pz + 1.4, goldTrimMat, true);
      addSolidBlock(-0.6, 0, pz - 1.4, 1.2, hAtZ, pz + 1.4, jasperCoreMat, true);
    }
  }

  // Stepped Ramp Balustrades (elevated y0 so ground level beneath high ramp is 100% open!)
  for (let seg = 0; seg < 20; seg++) {
    const sz0 = RAMP_Z0 + seg * 9.4;
    const sz1 = sz0 + 9.4;
    const yLow = Math.max(0, ((sz0 - RAMP_Z0) / (RAMP_Z1 - RAMP_Z0)) * WALL_OVERLOOK_C - 1.0);
    const yHigh = ((sz1 - RAMP_Z0) / (RAMP_Z1 - RAMP_Z0)) * WALL_OVERLOOK_C + 3.4;
    // West guardrail (X = -7.3..-6.5)
    addSolidBlock(-7.3, yLow, sz0, -6.5, yHigh, sz1, goldTrimMat, true);
    // East guardrail (X = +1.5..+4.0)
    addSolidBlock(1.5, yLow, sz0, 4.0, yHigh, sz1, jasperCoreMat, true);
  }

  // Top Landing (X = -6.5..+26.0, Z = +206..+218, Y = +144.0 c) + Wall Overlook Terrace (X = +5.5..+26.0, Z = +16..+218)
  addBoxMesh(staticGroup, 9.75, 142.4, 212.0, 32.5, 1.6, 12.2, goldBaseMat, 0.02, 0.25);
  pushPlatform(-6.5, 142.4, 205.8, 26.0, WALL_OVERLOOK_C, 218.2);

  addBoxMesh(staticGroup, 15.325, 143.2, 111.0, 21.75, 0.8, 190.0, goldBaseMat, 0.02, 0.2);
  addGlassLayer(15.325, WALL_OVERLOOK_C, 111.0, 21.75, 0.04, 190.0, goldGlassGlazeMat);
  pushPlatform(4.45, 143.2, 16.0, 26.0, WALL_OVERLOOK_C + 0.04, 206.0);

  // Overlook Terrace Crystal-Gold Safety Parapets
  // East outer wall battlement (full Z = -220..+220)
  addSolidBlock(26.2, WALL_OVERLOOK_C, -220, 28.0, WALL_OVERLOOK_C + 3.6, 220, jasperCoreMat, true);
  addBoxMesh(staticGroup, 27.1, WALL_OVERLOOK_C + 3.6, 0, 2.0, 0.5, 440, goldTrimMat);
  // West inner waist-high crystal-gold balustrade (WALL_OVERLOOK_C + 2.2 collider, open sightline over city)
  pushCollider(4.0, WALL_OVERLOOK_C, 16.0, 4.45, WALL_OVERLOOK_C + 2.2, 205.5);
  addBoxMesh(staticGroup, 4.225, WALL_OVERLOOK_C, 110.75, 0.45, 1.1, 189.5, goldTrimMat, 0.01, 0.15);
  addGlassLayer(4.225, WALL_OVERLOOK_C + 1.1, 110.75, 0.14, 0.95, 189.5, seaOfGlassMat);
  addBoxMesh(staticGroup, 4.225, WALL_OVERLOOK_C + 2.05, 110.75, 0.36, 0.15, 189.5, goldTrimMat, 0.01, 0.15);
  addSolidBlock(4.0, WALL_OVERLOOK_C, -220.0, 4.45, WALL_OVERLOOK_C + 2.2, 16.0, goldTrimMat, true);
  // Landing West/North/South guardrails so walker turns cleanly onto the Wall Overlook
  addSolidBlock(-7.3, WALL_OVERLOOK_C - 1.5, 205.8, -6.5, WALL_OVERLOOK_C + 3.6, 219.5, goldTrimMat, true);
  addSolidBlock(-7.3, WALL_OVERLOOK_C - 1.5, 218.2, 28.0, WALL_OVERLOOK_C + 3.6, 220.0, jasperCoreMat, true);
  addSolidBlock(1.5, WALL_OVERLOOK_C - 1.5, 204.6, 4.45, WALL_OVERLOOK_C + 2.2, 205.8, goldTrimMat, true);
  // South end waist-high balustrade overlooking the Central Pearl Gate & Golden Boulevard (Z = +14.6..+16.0)
  addSolidBlock(4.0, WALL_OVERLOOK_C, 14.6, 28.0, WALL_OVERLOOK_C + 2.2, 16.0, goldTrimMat, true);

  // ---------------------------------------------------------------------------
  // 5. STREET OF PURE GOLD, LIKE TRANSPARENT GLASS (Rev 21:18, 21)
  // ---------------------------------------------------------------------------
  // City-wide Pure-Gold Base Terrace across entire walled interior (visible from 144c Overlook & Aerial!)
  const cityGoldFloor = new THREE.Mesh(new THREE.BoxGeometry(464, 0.45, 440), goldBaseMat);
  cityGoldFloor.position.set(-228, -0.58, 0);
  cityGoldFloor.receiveShadow = true;
  cityGoldFloor.userData.dynamic = true;
  cityGoldFloor.userData.noCast = true;
  dynamicGroup.add(cityGoldFloor);

  // East Plaza inside Central Pearl Gate (X = -8.5..+4.2, Z = -220..+220)
  addBoxMesh(staticGroup, -2.2, -0.4, 0, 12.8, 0.4, 438, goldBaseMat, 0.01, 0.25);
  addGlassLayer(-2.2, STREET_C, 0, 12.8, 0.03, 438, goldGlassGlazeMat);
  pushPlatform(-8.6, -0.4, -219, 4.2, STREET_C + 0.03, 219);

  // North & South Golden-Glass Boulevards flanking the Crystal River (X = -216..-8.5, |Z| = 6.6..32.5)
  for (const side of [-1, 1]) {
    const bz = side * 19.55;
    addBoxMesh(staticGroup, -112.25, -0.4, bz, 207.5, 0.4, 25.9, goldBaseMat, 0.01, 0.22);
    addGlassLayer(-112.25, STREET_C, bz, 207.5, 0.03, 25.9, goldGlassGlazeMat);
    pushPlatform(-216.0, -0.4, side > 0 ? 6.6 : -32.5, -8.5, STREET_C + 0.03, side > 0 ? 32.5 : -6.6);

    // Low steppable pure-gold crystal river kerbs (|Z| = 6.5..7.1, height 0.20 c)
    addBoxMesh(staticGroup, -112.25, STREET_C, side * 6.8, 207.5, 0.2, 0.6, goldTrimMat, 0.02, 0.3);
  }

  // Ankle-deep Crystal River Bed Platform so stepping into the Water of Life is walkable & safe
  addBoxMesh(staticGroup, -112.25, -0.95, 0, 207.5, 0.33, 13.2, seaOfGlassMat, 0.01, 0.2);
  pushPlatform(-216.0, -0.95, -6.6, -8.5, -0.62, 6.6);

  // ---------------------------------------------------------------------------
  // 6. THREE WALKABLE ARCHED GOLD-GLASS FOOTBRIDGES OVER THE RIVER (Rev 22:1)
  // ---------------------------------------------------------------------------
  const bridgeCentersX = [-52, -116, -180];
  for (const bx of bridgeCentersX) {
    const TREADS = 17; // Z = -8.5..+8.5 (1.0 c per tread)
    for (let t = 0; t < TREADS; t++) {
      const z0 = -8.5 + t * 1.0;
      const z1 = z0 + 1.06;
      const zMid = (z0 + z1) * 0.5;
      const u = zMid / 8.5; // -1..+1
      const archY = Math.max(0.18, (1 - u * u) * 2.2); // max step rise <= 0.28 c = 0.125 m!
      addBoxMesh(staticGroup, bx, archY - 0.35, zMid, 9.0, 0.35, 1.06, goldTrimMat, 0.02, 0.35);
      addGlassLayer(bx, archY, zMid, 8.2, 0.03, 1.02, goldGlassGlazeMat);
      pushPlatform(bx - 4.4, archY - 0.35, z0, bx + 4.4, archY + 0.03, z1);
    }
    // Arched Gold-Glass Side Balustrades (leaving 8.0 cubits wide clear bridge deck!)
    for (const sx of [-1, 1]) {
      const rx = bx + sx * 4.25;
      addSolidBlock(rx - 0.3, 0.2, -8.4, rx + 0.3, 3.8, 8.4, goldCrystalColMat, true);
      addBoxMesh(staticGroup, rx, 3.8, 0, 0.7, 0.28, 17.0, goldTrimMat);
    }
    counts.bridges++;
  }

  // ---------------------------------------------------------------------------
  // 7. TREES OF LIFE ON BOTH BANKS WITH 12 GLOWING FRUITS EACH (Rev 22:2)
  // ---------------------------------------------------------------------------
  const treeFoliageHalos: { sprite: THREE.Sprite; baseOp: number; phase: number }[] = [];

  function buildTreeOfLife(tx: number, tz: number, leanSign: number, seedIdx: number): void {
    const tg = new THREE.Group();
    tg.position.set(tx, STREET_C, tz);

    // Sculpted golden-olive trunk + root plinth
    addBoxMesh(tg, 0, 0, 0, 2.3, 0.28, 2.3, goldTrimMat, 0.04, 0.4);
    const lowerTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.76, 4.6, 12), oliveGoldBarkMat);
    lowerTrunk.position.set(0, 2.3, leanSign * 0.18);
    lowerTrunk.rotation.x = leanSign * 0.08;
    lowerTrunk.castShadow = true;
    tg.add(lowerTrunk);

    // Graceful overarching boughs reaching toward the Crystal River & Boulevard
    const boughSpecs: [number, number, number, number, number][] = [
      [0, 5.4, leanSign * 1.4, 0.38, leanSign * 0.42],
      [-1.3, 5.1, leanSign * 0.6, -0.35, leanSign * 0.2],
      [1.3, 5.2, leanSign * 0.6, 0.35, leanSign * 0.2],
      [0, 5.3, -leanSign * 0.9, 0, -leanSign * 0.32],
    ];
    for (const [bx, by, bz, rz, rx] of boughSpecs) {
      const bough = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.34, 3.4, 8), oliveGoldBarkMat);
      bough.position.set(bx, by, bz);
      bough.rotation.set(rx, 0, rz);
      bough.castShadow = true;
      tg.add(bough);
    }

    // Lush Healing Foliage Canopies ("leaves of the tree were for the healing of the nations", Rev 22:2)
    const canopyClusters: [number, number, number, number][] = [
      [0, 7.6, leanSign * 1.1, 2.9],
      [-2.1, 6.7, leanSign * 0.7, 2.2],
      [2.1, 6.8, leanSign * 0.7, 2.2],
      [0, 6.9, leanSign * 2.7, 2.1],
      [0, 6.6, -leanSign * 1.4, 2.0],
    ];
    for (const [cx, cy, cz, rad] of canopyClusters) {
      const leafMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(rad, 1), healingLeafMat);
      leafMesh.scale.set(1.15, 0.78, 1.15);
      leafMesh.position.set(cx, cy, cz);
      leafMesh.castShadow = true;
      leafMesh.receiveShadow = true;
      tg.add(leafMesh);
    }

    // 12 Distinct Glowing Fruit Clusters arranged around the lower boughs (12 manner of fruits, Rev 22:2!)
    for (let f = 0; f < 12; f++) {
      const ang = (f / 12) * Math.PI * 2 + seedIdx * 0.4;
      const r = 2.15 + (f % 2) * 0.55;
      const fx = Math.cos(ang) * r;
      const fz = leanSign * 0.85 + Math.sin(ang) * r;
      const fy = 5.15 + (f % 3) * 0.38;
      const fMat = fruitMats[f]!;
      // Berry/fruit triad cluster
      for (const [ox, oy, oz] of [
        [0, 0, 0],
        [0.18, -0.14, 0.12],
        [-0.16, -0.12, -0.12],
      ] as [number, number, number][]) {
        const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), fMat);
        fruit.position.set(fx + ox, fy + oy, fz + oz);
        tg.add(fruit);
      }
    }

    staticGroup.add(tg);
    pushCollider(tx - 0.85, STREET_C, tz - 0.85, tx + 0.85, STREET_C + 6.5, tz + 0.85);

    // Subtle golden-emerald healing aura sprite (marked noAO)
    const haloMat = new THREE.SpriteMaterial({
      map: jasperHaloTex,
      color: new THREE.Color('#b8ffcf'),
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sp = new THREE.Sprite(haloMat);
    sp.position.set(tx, STREET_C + 6.8, tz + leanSign * 0.9);
    sp.scale.set(9.5, 7.5, 1);
    sp.userData.dynamic = true;
    sp.userData.noCast = true;
    sp.userData.noAO = true;
    dynamicGroup.add(sp);
    treeFoliageHalos.push({ sprite: sp, baseOp: 0.22, phase: seedIdx * 0.9 });

    counts.treesOfLife++;
  }

  const treeXCoords = [-26, -72, -96, -138, -160, -200];
  for (let i = 0; i < treeXCoords.length; i++) {
    const tx = treeXCoords[i]!;
    buildTreeOfLife(tx, 10.2, -1, i * 2); // North bank arching South over river
    buildTreeOfLife(tx, -10.2, 1, i * 2 + 1); // South bank arching North over river
  }

  // ---------------------------------------------------------------------------
  // 8. FLANKING GOLD-GLASS CRYSTAL COLONNADES & RISING 2,220 KM CITY VISTAS
  // ---------------------------------------------------------------------------
  for (const side of [-1, 1]) {
    // 2 low walkable gold steps up into the Boulevard Colonnades (|Z| = 32.5..46.5, Y = +0.60 c)
    const s1z = side * 32.9;
    const s2z = side * 39.8;
    addBoxMesh(staticGroup, -112, 0, s1z, 208, 0.3, 1.2, goldTrimMat, 0.01, 0.25);
    pushPlatform(-216, 0, Math.min(side * 32.3, side * 33.5), -8, 0.3, Math.max(side * 32.3, side * 33.5));

    addBoxMesh(staticGroup, -112, 0, s2z, 208, 0.6, 13.0, goldBaseMat, 0.01, 0.22);
    addGlassLayer(-112, 0.6, s2z, 208, 0.03, 13.0, goldGlassGlazeMat);
    pushPlatform(-216, 0, Math.min(side * 33.4, side * 46.2), -8, 0.63, Math.max(side * 33.4, side * 46.2));

    // Fluted Pure-Gold & Crystal-Glass Colonnade Columns (every 13 c along X = -14..-209)
    for (let cx = -14; cx >= -209; cx -= 13) {
      for (const rowZ of [34.2, 43.8]) {
        const cz = side * rowZ;
        addSolidBlock(cx - 0.85, 0.6, cz - 0.85, cx + 0.85, 1.8, cz + 0.85, goldTrimMat, true);
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.8, 16.5, 14), goldCrystalColMat);
        shaft.position.set(cx, 1.8 + 8.25, cz);
        shaft.castShadow = true;
        staticGroup.add(shaft);
        addBoxMesh(staticGroup, cx, 18.3, cz, 2.1, 1.1, 2.1, goldTrimMat, 0.03, 0.4);
      }
    }

    // Colonnade Entablature, Upper Clerestory Arcade & Back Crystal Wall (|Z| = 46..48.5)
    addBoxMesh(staticGroup, -112, 19.4, side * 39.5, 208, 2.2, 13.5, goldTrimMat, 0.03, 0.14);
    addGlassLayer(-112, 21.6, side * 39.5, 206, 8.5, 11.5, jasperGlassMat);
    addBoxMesh(staticGroup, -112, 30.1, side * 39.5, 208, 1.6, 14.2, goldTrimMat, 0.03, 0.14);
    addSolidBlock(
      -218,
      0.6,
      Math.min(side * 46.0, side * 48.8),
      -8,
      32.0,
      Math.max(side * 46.0, side * 48.8),
      jasperCoreMat,
      true,
    );

    // Rising Stepped Celestial Terraces & Faceted Crystal-Gold Pavilions (|Z| = 62..195)
    // Suggesting the soaring 12,000-stadia (2,220 km) golden-glass city — classical stepped sanctuaries, zero skyscrapers!
    const terraceTiers: [number, number, number, number][] = [
      [68, 24, 44, 0.52],
      [108, 30, 74, 0.46],
      [156, 38, 112, 0.4],
    ];
    for (const [zDist, depth, height, glassOp] of terraceTiers) {
      for (let bx = -24; bx >= -234; bx -= 42) {
        const bw = 34;
        const cz = side * zDist;
        // Stepped classical gold-crystal plinth + upper faceted pavilion
        addBoxMesh(staticGroup, bx, 0, cz, bw, height * 0.55, depth, goldTrimMat, 0.04, 0.08);
        addBoxMesh(staticGroup, bx, height * 0.55, cz, bw * 0.78, height * 0.32, depth * 0.78, jasperCoreMat, 0.04, 0.08);
        const crownMat = jasperGlassMat.clone();
        crownMat.opacity = glassOp;
        addGlassLayer(bx, height * 0.87, cz, bw * 0.58, height * 0.22, depth * 0.58, crownMat);
        addBoxMesh(staticGroup, bx, height * 1.09, cz, bw * 0.62, 1.4, depth * 0.62, goldTrimMat, 0.03, 0.12);
      }
    }
  }

  // Distant Rising Western Horizon Tiers behind the Throne Dais (X = -320..-460)
  // Evoking the city's immense vertical majesty rising into the luminous western glory
  for (const [wx, wz, ww, wh, wd] of [
    [-335, 95, 46, 138, 62],
    [-335, -95, 46, 138, 62],
    [-395, 150, 56, 185, 74],
    [-395, -150, 56, 185, 74],
    [-425, 0, 64, 165, 96],
  ] as [number, number, number, number, number][]) {
    addBoxMesh(staticGroup, wx, 0, wz, ww, wh * 0.62, wd, goldTrimMat, 0.04, 0.06);
    addGlassLayer(wx, wh * 0.62, wz, ww * 0.76, wh * 0.38, wd * 0.76, jasperGlassMat);
  }

  // ---------------------------------------------------------------------------
  // 9. WESTERN FOCAL RISE — STRICTLY ANICONIC RADIANT THRONE DAIS (Rev 4:3; 21:22-23; 22:1, 3-5)
  //    (Explicitly NO temple building; ZERO human, anthropomorphic, or animal/lamb figures!)
  // ---------------------------------------------------------------------------
  // Two Symmetrical Sapphire-and-Gold Walkable Stairways (X = -216..-236, 20 steps to Y = +8.0 c)
  const SANCT_STEPS = 20;
  for (const side of [-1, 1]) {
    const szCenter = side * 17.0; // Z = +8.5..+25.5 and Z = -25.5..-8.5 (17c wide each!)
    for (let s = 0; s < SANCT_STEPS; s++) {
      const topY = ((s + 1) / SANCT_STEPS) * THRONE_FORECOURT_C; // 0.40 c = 0.178 m rise!
      const xEast = -216.0 - s * 1.0;
      const xWest = xEast - 1.06;
      const mat = s % 3 === 0 ? goldTrimMat : sapphireMat;
      addBoxMesh(staticGroup, (xEast + xWest) * 0.5, 0, szCenter, 1.06, topY, 17.0, mat, 0.02, 0.25);
      pushPlatform(xWest, 0, side > 0 ? 8.5 : -25.5, xEast, topY, side > 0 ? 25.5 : -8.5);
    }
    // Inner cheek balustrade beside the central Crystal Cascade (|Z| = 7.5..8.5)
    addSolidBlock(
      -236.0,
      0,
      Math.min(side * 7.5, side * 8.5),
      -216.0,
      THRONE_FORECOURT_C + 2.2,
      Math.max(side * 7.5, side * 8.5),
      goldTrimMat,
      true,
    );
    // Outer cheek balustrade (|Z| = 25.5..27.0)
    addSolidBlock(
      -236.0,
      0,
      Math.min(side * 25.5, side * 27.0),
      -216.0,
      THRONE_FORECOURT_C + 2.4,
      Math.max(side * 25.5, side * 27.0),
      sapphireMat,
      true,
    );
  }

  // Walkable Upper Sapphire & Sea-of-Glass Forecourt Terrace (X = -236..-249, Z = -28..+28, Y = +8.0 c)
  // Spans across Z = -8.5..+8.5 via a vaulted Sea-of-Glass Crystal Bridge above the Waterfall!
  addBoxMesh(staticGroup, -242.5, 0, 18.25, 13.2, THRONE_FORECOURT_C, 19.5, sapphireMat, 0.02, 0.2);
  addBoxMesh(staticGroup, -242.5, 0, -18.25, 13.2, THRONE_FORECOURT_C, 19.5, sapphireMat, 0.02, 0.2);
  // Central arched bridge deck at Y = +8.0 c leaving Y = 0..6.8 open underneath for the Crystal Spring Cascade!
  addBoxMesh(staticGroup, -242.5, 6.8, 0, 13.2, 1.2, 17.0, goldTrimMat, 0.02, 0.25);
  addGlassLayer(-242.5, THRONE_FORECOURT_C, 0, 13.0, 0.05, 56.0, seaOfGlassMat);
  pushPlatform(-249.0, 6.8, -28.0, -236.0, THRONE_FORECOURT_C + 0.05, 28.0);

  // Forecourt Safety Balustrades (preventing walking onto the sacred Throne Dais or off sides)
  addSolidBlock(-250.2, THRONE_FORECOURT_C, -28.5, -249.0, THRONE_FORECOURT_C + 2.3, 28.5, goldCrystalColMat, true);
  addSolidBlock(-250.2, THRONE_FORECOURT_C, 28.0, -236.0, THRONE_FORECOURT_C + 2.5, 29.2, goldTrimMat, true);
  addSolidBlock(-250.2, THRONE_FORECOURT_C, -29.2, -236.0, THRONE_FORECOURT_C + 2.5, -28.0, goldTrimMat, true);
  // East rail on central bridge overlooking the Golden Street & River of Life (X = -236.8..-236.0, Z = -8.5..+8.5)
  addSolidBlock(-236.8, THRONE_FORECOURT_C, -8.5, -236.0, THRONE_FORECOURT_C + 2.2, 8.5, goldCrystalColMat, true);

  // Stepped Sapphire, Pure-Gold & Crystalline-Jasper Throne Dais (X = -251..-276, Z = -24..+24)
  // Collider-protected sacred focal plinth — open to heaven, NO temple walls or roof (Rev 21:22)!
  pushCollider(-280.0, 0, -26.0, -250.0, 32.0, 26.0);
  addBoxMesh(staticGroup, -263.0, 0, 0, 24.0, 11.0, 44.0, sapphireMat, 0.04, 0.16);
  addBoxMesh(staticGroup, -263.5, 11.0, 0, 19.0, 3.2, 34.0, goldTrimMat, 0.04, 0.18);
  addBoxMesh(staticGroup, -264.0, 14.2, 0, 14.5, 3.0, 25.0, jasperCoreMat, 0.04, 0.2);
  addBoxMesh(staticGroup, -264.5, 17.2, 0, 10.2, 2.8, 16.5, goldTrimMat, 0.04, 0.24);
  addGlassLayer(-264.5, 20.0, 0, 9.6, 0.4, 15.6, seaOfGlassMat);

  // Pure Aniconic Jasper & Carnelian Glory Light Core above the Dais (Rev 4:3; 21:11, 23 — ZERO FIGURES!)
  const jasperCoreFacet = new THREE.Mesh(
    new THREE.OctahedronGeometry(4.4, 1),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#cffff0'),
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  jasperCoreFacet.scale.set(0.85, 2.1, 1.15);
  jasperCoreFacet.position.set(-264.5, 28.5, 0);
  jasperCoreFacet.userData.dynamic = true;
  jasperCoreFacet.userData.noCast = true;
  jasperCoreFacet.userData.noAO = true;
  dynamicGroup.add(jasperCoreFacet);

  const carnelianInnerGlow = new THREE.Mesh(
    new THREE.OctahedronGeometry(2.8, 2),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ff735c'),
      transparent: true,
      opacity: 0.56,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  carnelianInnerGlow.scale.set(0.8, 1.85, 1.0);
  carnelianInnerGlow.position.set(-264.5, 28.0, 0);
  carnelianInnerGlow.userData.dynamic = true;
  carnelianInnerGlow.userData.noCast = true;
  carnelianInnerGlow.userData.noAO = true;
  dynamicGroup.add(carnelianInnerGlow);

  const gloryJasperSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: jasperHaloTex,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  gloryJasperSprite.position.set(-264.5, 29.0, 0);
  gloryJasperSprite.scale.set(34, 42, 1);
  gloryJasperSprite.userData.dynamic = true;
  gloryJasperSprite.userData.noCast = true;
  gloryJasperSprite.userData.noAO = true;
  dynamicGroup.add(gloryJasperSprite);

  const gloryCarnelianSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: carnelianHaloTex,
      transparent: true,
      opacity: 0.68,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  gloryCarnelianSprite.position.set(-264.0, 27.5, 0);
  gloryCarnelianSprite.scale.set(24, 30, 1);
  gloryCarnelianSprite.userData.dynamic = true;
  gloryCarnelianSprite.userData.noCast = true;
  gloryCarnelianSprite.userData.noAO = true;
  dynamicGroup.add(gloryCarnelianSprite);

  // Overarching Emerald Rainbow Encircling the Throne Dais (Rev 4:3)
  const rainbowMats: THREE.MeshBasicMaterial[] = [];
  for (const [radius, tube, op, col] of [
    [36.5, 2.3, 0.68, '#38f29d'],
    [39.5, 3.1, 0.38, '#9cffd0'],
    [33.8, 1.4, 0.42, '#18b87c'],
  ] as [number, number, number, string][]) {
    const rMat = new THREE.MeshBasicMaterial({
      map: rainbowTex,
      color: new THREE.Color(col),
      transparent: true,
      opacity: op,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    rainbowMats.push(rMat);
    const rainbowArc = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 16, 72, Math.PI), rMat);
    rainbowArc.rotation.y = Math.PI * 0.5; // arches across Z (-39..+39) facing East along the Boulevard!
    rainbowArc.position.set(-264.0, 16.0, 0);
    rainbowArc.userData.dynamic = true;
    rainbowArc.userData.noCast = true;
    rainbowArc.userData.noAO = true;
    dynamicGroup.add(rainbowArc);
  }

  // Radiant Crystal Light Shafts Fanning Outward from the Throne Glory (Rev 21:23; 22:5)
  const gloryBeams: { mesh: THREE.Mesh; baseOp: number; phase: number }[] = [];
  const beamDefs = [
    { x: -252, y: 36, z: 0, w: 22, len: 130, tiltZ: -0.48, rotY: 0, col: '#fff1b8', op: 0.22 },
    { x: -248, y: 38, z: -12, w: 16, len: 125, tiltZ: -0.52, rotY: -0.16, col: '#a8ffe4', op: 0.17 },
    { x: -248, y: 38, z: 12, w: 16, len: 125, tiltZ: -0.52, rotY: 0.16, col: '#a8ffe4', op: 0.17 },
    { x: -256, y: 42, z: 0, w: 18, len: 110, tiltZ: -0.26, rotY: 0, col: '#ffb899', op: 0.16 },
    { x: -165, y: 30, z: 0, w: 20, len: 115, tiltZ: -0.55, rotY: 0, col: '#ffea9e', op: 0.14 },
    { x: -75, y: 28, z: 0, w: 20, len: 110, tiltZ: -0.55, rotY: 0, col: '#ffea9e', op: 0.13 },
  ];
  for (let i = 0; i < beamDefs.length; i++) {
    const bd = beamDefs[i]!;
    const bMat = new THREE.MeshBasicMaterial({
      map: beamTex,
      color: new THREE.Color(bd.col),
      transparent: true,
      opacity: bd.op,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(bd.w, bd.len), bMat);
    plane.position.set(bd.x, bd.y, bd.z);
    plane.rotation.set(0, bd.rotY, bd.tiltZ);
    plane.userData.dynamic = true;
    plane.userData.noCast = true;
    plane.userData.noAO = true;
    dynamicGroup.add(plane);
    gloryBeams.push({ mesh: plane, baseOp: bd.op, phase: i * 0.85 });
  }

  // ---------------------------------------------------------------------------
  // 10. CRYSTAL-CLEAR RIVER OF THE WATER OF LIFE RIBBON (Rev 22:1)
  //     (Issuing from the Throne Dais at X = -252, cascading down X = -252..-215,
  //      and flowing East down the middle of the Golden Street to X = -8!)
  //     Verified +Y upward triangle winding: (a=z-w, b=z+w, c=next_z-w) -> (+Z) x (+X) = +Y!
  // ---------------------------------------------------------------------------
  const rSegs = 96;
  const rPos: number[] = [];
  const rUv: number[] = [];
  const rIdx: number[] = [];

  for (let i = 0; i <= rSegs; i++) {
    const t = i / rSegs;
    const rx = -252.0 + t * 244.0; // -252.0 .. -8.0 (strictly increasing +X!)
    const halfW = rx < -216 ? 4.4 + smoothstep(-252, -216, rx) * 1.9 : 6.3;

    let ry = -0.14;
    if (rx < -248) {
      ry = 11.2 - smoothstep(-252, -248, rx) * 4.4; // crystal springhead welling out of Throne Dais
    } else if (rx < -236) {
      ry = 6.4; // flowing beneath the Upper Sapphire Forecourt arch bridge
    } else if (rx < -215) {
      ry = 6.4 * (1 - smoothstep(-236, -215, rx)) - 0.14 * smoothstep(-236, -215, rx); // stepped cascade
    }

    // a = (rx, ry, -halfW), b = (rx, ry, +halfW)
    rPos.push(rx, ry, -halfW);
    rPos.push(rx, ry, halfW);
    rUv.push(t * 24, 0);
    rUv.push(t * 24, 1);

    if (i < rSegs) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      // ab = (0, 0, +2*halfW), ac = (+dx, dy, 0) -> ab x ac has +Y > 0!
      rIdx.push(a, b, c, b, d, c);
    }
  }
  const riverGeo = new THREE.BufferGeometry();
  riverGeo.setAttribute('position', new THREE.Float32BufferAttribute(rPos, 3));
  riverGeo.setAttribute('uv', new THREE.Float32BufferAttribute(rUv, 2));
  riverGeo.setIndex(rIdx);
  riverGeo.computeVertexNormals();

  const riverMesh = new THREE.Mesh(riverGeo, waterMat);
  riverMesh.receiveShadow = false;
  riverMesh.userData.dynamic = true;
  riverMesh.userData.noCast = true;
  riverMesh.userData.noAO = true;
  dynamicGroup.add(riverMesh);

  // Crystal Springhead Basin Rim at the base of the Throne Dais (X = -251, Y = +10.8 c)
  const springRim = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.55, 12, 32), jasperCoreMat);
  springRim.rotation.x = Math.PI * 0.5;
  springRim.position.set(-251.5, 11.2, 0);
  staticGroup.add(springRim);

  // Real-time PointLights for Throne Glory & Golden Street Luminance
  const throneGloryLight = new THREE.PointLight('#fff0c2', 36, 150, 1.3);
  throneGloryLight.position.set(-258, 30, 0);
  throneGloryLight.userData.dynamic = true;
  dynamicGroup.add(throneGloryLight);

  const emeraldArchLight = new THREE.PointLight('#5ef5b0', 18, 95, 1.4);
  emeraldArchLight.position.set(-250, 22, 0);
  emeraldArchLight.userData.dynamic = true;
  dynamicGroup.add(emeraldArchLight);

  const streetMidLight = new THREE.PointLight('#ffe49c', 20, 130, 1.3);
  streetMidLight.position.set(-116, 22, 0);
  streetMidLight.userData.dynamic = true;
  dynamicGroup.add(streetMidLight);

  const pearlGateLight = new THREE.PointLight('#fff8eb', 22, 95, 1.3);
  pearlGateLight.position.set(16, 18, 0);
  pearlGateLight.userData.dynamic = true;
  dynamicGroup.add(pearlGateLight);

  // Batch static solid geometry for low draw calls
  batchStatic(staticGroup);

  // Dynamic Cubit Rescaling (`0.445 m` default angel's/man's cubit per Rev 21:17)
  let currentCubit = initialCubit;
  const syncScaledBoxes = (cubitVal: number): void => {
    colliders.length = 0;
    for (const b of rawColliders) {
      colliders.push(
        new THREE.Box3(b.min.clone().multiplyScalar(cubitVal), b.max.clone().multiplyScalar(cubitVal)),
      );
    }
    platforms.length = 0;
    for (const p of rawPlatforms) {
      platforms.push(
        new THREE.Box3(p.min.clone().multiplyScalar(cubitVal), p.max.clone().multiplyScalar(cubitVal)),
      );
    }
    unitGroup.scale.setScalar(cubitVal);
    throneGloryLight.distance = 150 * cubitVal;
    emeraldArchLight.distance = 95 * cubitVal;
    streetMidLight.distance = 130 * cubitVal;
    pearlGateLight.distance = 95 * cubitVal;
  };

  syncScaledBoxes(currentCubit);

  const result: NewJerusalemCity = {
    group: root,
    colliders,
    platforms,
    counts,
    skyTex,
    CUBIT: currentCubit,
    PROMENADE_Y: PROMENADE_C * currentCubit,
    STREET_Y: STREET_C * currentCubit,
    THRONE_FORECOURT_Y: THRONE_FORECOURT_C * currentCubit,
    WALL_OVERLOOK_Y: WALL_OVERLOOK_C * currentCubit,
    floorY(x: number, z: number): number {
      return mountainCubits(x / result.CUBIT, z / result.CUBIT, false) * result.CUBIT;
    },
    rescale(newCubit: number): number {
      const clamped = Math.max(0.4, Math.min(0.6, newCubit));
      currentCubit = clamped;
      result.CUBIT = clamped;
      result.PROMENADE_Y = PROMENADE_C * clamped;
      result.STREET_Y = STREET_C * clamped;
      result.THRONE_FORECOURT_Y = THRONE_FORECOURT_C * clamped;
      result.WALL_OVERLOOK_Y = WALL_OVERLOOK_C * clamped;
      syncScaledBoxes(clamped);
      return clamped;
    },
    update(dt: number, elapsed: number): void {
      // Crystal River of the Water of Life flowing East (+X) down the middle of the golden street
      waterAlbedo.offset.x -= dt * 0.46;
      waterNormal.offset.x -= dt * 0.68;
      waterNormal.offset.y += Math.sin(elapsed * 0.8) * dt * 0.03;

      // Subtle living breathing of the aniconic Jasper & Carnelian Throne Glory (Rev 4:3; 21:11, 23)
      jasperCoreFacet.rotation.y = elapsed * 0.18;
      carnelianInnerGlow.rotation.y = -elapsed * 0.24;
      const pulse = 0.9 + 0.1 * Math.sin(elapsed * 1.6);
      (gloryJasperSprite.material as THREE.SpriteMaterial).opacity = 0.84 * pulse;
      (gloryCarnelianSprite.material as THREE.SpriteMaterial).opacity =
        0.64 * (0.9 + 0.1 * Math.cos(elapsed * 2.1));
      throneGloryLight.intensity = 34 + Math.sin(elapsed * 1.8) * 3.5;

      if (rainbowMats[1]) {
        rainbowMats[1].opacity = 0.34 + 0.08 * Math.sin(elapsed * 1.25);
      }

      for (const b of gloryBeams) {
        const mat = b.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = b.baseOp * (0.86 + 0.14 * Math.sin(elapsed * 1.1 + b.phase));
      }

      for (const h of treeFoliageHalos) {
        const mat = h.sprite.material as THREE.SpriteMaterial;
        mat.opacity = h.baseOp * (0.85 + 0.15 * Math.sin(elapsed * 1.4 + h.phase));
      }
    },
  };

  return result;
}
