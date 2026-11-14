import * as THREE from 'three';

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

function normalFromLuminance(
  src: HTMLCanvasElement,
  strength = 2.4,
): THREE.CanvasTexture {
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

function roughnessFromLuminance(
  src: HTMLCanvasElement,
  minR = 0.45,
  maxR = 0.92,
  invert = true,
): THREE.CanvasTexture {
  const { width: w, height: h } = src;
  const data = src.getContext('2d')!.getImageData(0, 0, w, h).data;
  const [out, octx] = makeCanvas(w, h);
  const img = octx.createImageData(w, h);
  const d = img.data;
  for (let i = 0; i < w * h; i++) {
    const j = i * 4;
    const lum = (0.299 * (data[j] ?? 0) + 0.587 * (data[j + 1] ?? 0) + 0.114 * (data[j + 2] ?? 0)) / 255;
    const r = minR + (invert ? 1 - lum : lum) * (maxR - minR);
    const v = Math.max(0, Math.min(255, Math.round(r * 255)));
    d[j] = d[j + 1] = d[j + 2] = v;
    d[j + 3] = 255;
  }
  octx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(out);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

export interface HerodTexSet {
  herodianAshlarMat: THREE.MeshStandardMaterial;
  sanctuaryWhiteMat: THREE.MeshStandardMaterial;
  pavingMat: THREE.MeshStandardMaterial;
  opusSectileMat: THREE.MeshStandardMaterial;
  corinthianMarbleMat: THREE.MeshStandardMaterial;
  royalCedarMat: THREE.MeshStandardMaterial;
  hekhalCedarMat: THREE.MeshStandardMaterial;
  soregLatticeMat: THREE.MeshStandardMaterial;
  soregSteleMat: THREE.MeshStandardMaterial;
  whitewashMat: THREE.MeshStandardMaterial;
  scarletMat: THREE.MeshStandardMaterial;
  sanctuaryGoldMat: THREE.MeshStandardMaterial;
  corinthianBronzeMat: THREE.MeshStandardMaterial;
  bronzeMat: THREE.MeshStandardMaterial;
  ironMat: THREE.MeshStandardMaterial;
  marbleMat: THREE.MeshStandardMaterial;
  bedrockMat: THREE.MeshStandardMaterial;
  veilMat: THREE.MeshStandardMaterial;
  hearthMat: THREE.MeshStandardMaterial;
  emberMat: THREE.MeshStandardMaterial;
  terracottaRoofMat: THREE.MeshStandardMaterial;
  oliveFoliageMat: THREE.MeshStandardMaterial;
  barkMat: THREE.MeshStandardMaterial;
  smokeTex: THREE.CanvasTexture;
  flameTex: THREE.CanvasTexture;
  beamTex: THREE.CanvasTexture;
}

/**
 * Classic Herodian drafted-margin ashlar masonry (smooth recessed frame + low flat central boss).
 * When `snowWhite` is true, renders the gleaming white Sanctuary blocks of Mark 13:1 & War 5.223.
 */
function paintHerodianAshlar(snowWhite: boolean): HTMLCanvasElement {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const rand = makeRng(snowWhite ? 5223 : 1541);

  ctx.fillStyle = snowWhite ? '#efeae0' : '#dfd2ba';
  ctx.fillRect(0, 0, S, S);

  const rows = 8;
  const rowH = S / rows;
  for (let r = 0; r < rows; r++) {
    const cols = r % 2 === 0 ? 3 : 4;
    const offset = (r % 2) * (S / (cols * 2));
    let x = -offset;
    for (let i = 0; i <= cols + 1; i++) {
      const bw = S / cols + (rand() - 0.5) * 16;
      const y = r * rowH;
      const base = snowWhite ? 240 : 219;
      const tone = base + Math.round((rand() - 0.5) * (snowWhite ? 10 : 18));
      const warm = snowWhite ? 2 : 9;

      // Recessed drafted margin (chiseled smooth border around block)
      ctx.fillStyle = `rgb(${tone + warm - 10}, ${tone - 12}, ${tone - warm - 16})`;
      ctx.fillRect(x + 1.5, y + 1.5, Math.max(4, bw - 3), rowH - 3);

      // Raised flat Herodian boss
      const m = 7;
      ctx.fillStyle = `rgb(${Math.min(255, tone + warm)}, ${Math.min(255, tone + 1)}, ${Math.max(0, tone - warm - 2)})`;
      ctx.fillRect(x + m, y + m, Math.max(2, bw - m * 2), rowH - m * 2);

      // Crisp upper-left highlight & lower-right bevel shadow on the boss
      ctx.strokeStyle = snowWhite ? 'rgba(255, 253, 248, 0.72)' : 'rgba(252, 244, 228, 0.55)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x + m, y + rowH - m);
      ctx.lineTo(x + m, y + m);
      ctx.lineTo(x + Math.max(m + 2, bw - m), y + m);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(122, 104, 78, 0.42)';
      ctx.beginPath();
      ctx.moveTo(x + Math.max(m + 2, bw - m), y + m);
      ctx.lineTo(x + Math.max(m + 2, bw - m), y + rowH - m);
      ctx.lineTo(x + m, y + rowH - m);
      ctx.stroke();

      // Subtle Jerusalem Meleke limestone grain
      for (let k = 0; k < 22; k++) {
        const px = x + m + rand() * Math.max(1, bw - m * 2);
        const py = y + m + rand() * Math.max(1, rowH - m * 2);
        const a = 0.025 + rand() * 0.055;
        ctx.fillStyle = rand() > 0.5 ? `rgba(128, 110, 84, ${a})` : `rgba(255, 252, 244, ${a})`;
        ctx.fillRect(px, py, 2 + rand() * 3, 1.4);
      }

      // Tight dry-jointed Herodian seam (Josephus notes blocks fitted without visible mortar)
      ctx.strokeStyle = snowWhite ? 'rgba(155, 145, 128, 0.55)' : 'rgba(118, 100, 74, 0.68)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, Math.max(2, bw - 2), rowH - 2);
      x += bw;
    }
  }
  return c;
}

/**
 * Herodian Temple Mount courtyard paving & polychrome opus-sectile bands (Josephus War 5.192).
 */
function paintPavingCanvas(opusSectile: boolean): HTMLCanvasElement {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const rand = makeRng(opusSectile ? 5192 : 2112);

  ctx.fillStyle = opusSectile ? '#d5c3a6' : '#dfd2bb';
  ctx.fillRect(0, 0, S, S);

  if (!opusSectile) {
    const n = 8;
    const cell = S / n;
    for (let gy = 0; gy < n; gy++) {
      for (let gx = 0; gx < n; gx++) {
        const x = gx * cell;
        const y = gy * cell;
        const v = 216 + Math.round((rand() - 0.5) * 18);
        ctx.fillStyle = `rgb(${v + 9}, ${v + 2}, ${v - 14})`;
        ctx.fillRect(x + 1.5, y + 1.5, cell - 3, cell - 3);
        for (let k = 0; k < 12; k++) {
          ctx.fillStyle = `rgba(104, 88, 66, ${0.03 + rand() * 0.05})`;
          ctx.fillRect(x + 3 + rand() * (cell - 6), y + 3 + rand() * (cell - 6), 2.5, 2.5);
        }
        ctx.strokeStyle = 'rgba(132, 114, 88, 0.48)';
        ctx.lineWidth = 1.8;
        ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2);
      }
    }
    return c;
  }

  // Geometric Second-Temple opus sectile tile panels (bitumen-grey, reddish Jerusalem stone, cream limestone)
  const tiles = 4;
  const step = S / tiles;
  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      const ox = tx * step;
      const oy = ty * step;
      ctx.fillStyle = '#e2d5be';
      ctx.fillRect(ox + 2, oy + 2, step - 4, step - 4);

      // Outer reddish-ochre Mizi Ahmar frame
      ctx.strokeStyle = '#a86b52';
      ctx.lineWidth = 8;
      ctx.strokeRect(ox + 10, oy + 10, step - 20, step - 20);

      // Rotated dark grey-slate diamond inlay
      ctx.fillStyle = '#6f6c68';
      ctx.beginPath();
      ctx.moveTo(ox + step * 0.5, oy + 18);
      ctx.lineTo(ox + step - 18, oy + step * 0.5);
      ctx.lineTo(ox + step * 0.5, oy + step - 18);
      ctx.lineTo(ox + 18, oy + step * 0.5);
      ctx.closePath();
      ctx.fill();

      // Inner warm cream square
      ctx.fillStyle = '#eadec9';
      ctx.fillRect(ox + step * 0.34, oy + step * 0.34, step * 0.32, step * 0.32);

      ctx.strokeStyle = 'rgba(92, 78, 58, 0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(ox + 1, oy + 1, step - 2, step - 2);
    }
  }
  return c;
}

/**
 * Fluted white Corinthian marble/limestone column shaft (Ant. 15.413-414).
 */
function paintFlutedMarbleCanvas(): HTMLCanvasElement {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const flutes = 24;
  const fw = S / flutes;
  for (let i = 0; i < flutes; i++) {
    const x = i * fw;
    const g = ctx.createLinearGradient(x, 0, x + fw, 0);
    g.addColorStop(0, '#cfc4b0');
    g.addColorStop(0.18, '#f2ece0');
    g.addColorStop(0.5, '#dcd2bf');
    g.addColorStop(0.82, '#f5efe4');
    g.addColorStop(1, '#cfc4b0');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, fw + 0.5, S);
  }
  return c;
}

/**
 * Deeply coffered cedar ceilings & gilded botanical wainscot (strictly aniconic Herodian rosettes & vines, Ant. 15.414).
 */
function paintHerodianCedarCanvas(gildedSanctuary: boolean): HTMLCanvasElement {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const rand = makeRng(gildedSanctuary ? 4070 : 1544);

  ctx.fillStyle = '#6c3e20';
  ctx.fillRect(0, 0, S, S);

  // Cedar wood grain base
  for (let i = 0; i < 90; i++) {
    const x = rand() * S;
    ctx.strokeStyle = `rgba(42, 20, 8, ${0.08 + rand() * 0.14})`;
    ctx.lineWidth = 1.5 + rand() * 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.bezierCurveTo(x + (rand() - 0.5) * 16, S * 0.35, x + (rand() - 0.5) * 16, S * 0.7, x, S);
    ctx.stroke();
  }

  const n = 2;
  const cell = S / n;
  for (let cy = 0; cy < n; cy++) {
    for (let cx = 0; cx < n; cx++) {
      const ox = cx * cell;
      const oy = cy * cell;

      // Stepped coffer mouldings
      ctx.strokeStyle = gildedSanctuary ? '#d7ab4e' : '#4a2811';
      ctx.lineWidth = 12;
      ctx.strokeRect(ox + 14, oy + 14, cell - 28, cell - 28);

      ctx.strokeStyle = gildedSanctuary ? '#f2cf78' : '#8d5630';
      ctx.lineWidth = 4;
      ctx.strokeRect(ox + 28, oy + 28, cell - 56, cell - 56);

      // 8-petalled Second-Temple Jerusalem rosette (strictly floral/geometric)
      const mx = ox + cell * 0.5;
      const my = oy + cell * 0.5;
      ctx.fillStyle = gildedSanctuary ? '#e4ba5b' : '#9c6338';
      for (let p = 0; p < 8; p++) {
        const a = (p * Math.PI) / 4;
        ctx.save();
        ctx.translate(mx + Math.cos(a) * 34, my + Math.sin(a) * 34);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, 0, 26, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = gildedSanctuary ? '#fae098' : '#b77b49';
      ctx.beginPath();
      ctx.arc(mx, my, 15, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return c;
}

/**
 * Soreg 3-cubit pierced stone lattice screen (Middot 2:3; Josephus War 5.193).
 */
function paintSoregLatticeCanvas(): HTMLCanvasElement {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  ctx.fillStyle = '#bfb097';
  ctx.fillRect(0, 0, S, S);

  // Dark recessed diamond apertures
  ctx.fillStyle = '#4e463b';
  const step = 64;
  for (let y = 32; y < S; y += step) {
    for (let x = 32; x < S; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, y - 20);
      ctx.lineTo(x + 20, y);
      ctx.lineTo(x, y + 20);
      ctx.lineTo(x - 20, y);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Carved stone top & bottom coping rails
  ctx.fillStyle = '#e7dcc8';
  ctx.fillRect(0, 0, S, 24);
  ctx.fillRect(0, S - 24, S, 24);
  ctx.strokeStyle = '#928168';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 2, S, 20);
  ctx.strokeRect(0, S - 22, S, 20);
  return c;
}

/**
 * Inscribed Jerusalem Soreg Warning Stele in Greek capitals (Acts 21:28; Eph 2:14; War 5.193-194;
 * modeled after the extant 1871 Clermont-Ganneau limestone tablet).
 */
function paintSoregSteleCanvas(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(512, 384);
  ctx.fillStyle = '#e5dac4';
  ctx.fillRect(0, 0, 512, 384);

  // Moulded limestone frame
  ctx.strokeStyle = '#9e8d72';
  ctx.lineWidth = 14;
  ctx.strokeRect(16, 16, 480, 352);
  ctx.strokeStyle = '#f7f0e2';
  ctx.lineWidth = 4;
  ctx.strokeRect(28, 28, 456, 328);

  // Chiseled red-rubricated Greek capitals (authentic Soreg wording)
  const lines = [
    'ΜΗΘΕΝΑ ΑΛΛΟΓΕΝΗ ΕΙΣΠΟ',
    'ΡΕΥΕΣΘΑΙ ΕΝΤΟΣ ΤΟΥ ΠΕ',
    'ΡΙ ΤΟ ΙΕΡΟΝ ΤΡΥΦΑΚΤΟΥ',
    'ΚΑΙ ΠΕΡΙΒΟΛΟΥ ΟΣ Δ ΑΝ',
    'ΛΗΦΘΗ ΕΑΥΤΩΙ ΑΙΤΙΟΣ Ε',
    'ΣΤΑΙ ΔΙΑ ΤΟ ΕΞΑΚΟΛΟΥ',
    'ΘΕΙΝ ΘΑΝΑΤΟΝ',
  ];
  ctx.font = '600 26px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < lines.length; i++) {
    const y = 74 + i * 39;
    ctx.fillStyle = 'rgba(255, 250, 240, 0.7)';
    ctx.fillText(lines[i]!, 257, y + 1.5);
    ctx.fillStyle = '#7c3426';
    ctx.fillText(lines[i]!, 256, y);
  }
  return c;
}

/**
 * Unhewn whitewashed stones of the 32x32 Altar (Middot 3:4 — never touched by iron, lime-washed twice a year).
 */
function paintWhitewashAltarCanvas(): HTMLCanvasElement {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const rand = makeRng(3034);

  ctx.fillStyle = '#f2eee4';
  ctx.fillRect(0, 0, S, S);

  // Softly rounded unhewn fieldstone contours beneath thick white lime plaster
  for (let i = 0; i < 95; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const rx = 24 + rand() * 34;
    const ry = 16 + rand() * 22;
    const v = 232 + Math.round((rand() - 0.5) * 18);
    ctx.fillStyle = `rgba(${v + 4}, ${v + 2}, ${v - 4}, 0.55)`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, (rand() - 0.5) * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(186, 178, 162, 0.38)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  return c;
}

/**
 * Second-Temple Babylonian Veil (Matt 27:51; Josephus War 5.212-214):
 * Fine white linen, blue, scarlet, and purple — strictly aniconic celestial bands, zero figures!
 */
function paintSecondTempleVeilCanvas(): HTMLCanvasElement {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const rand = makeRng(2751);

  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, '#1f3b73'); // hyacinth blue (tekhelet)
  g.addColorStop(0.34, '#5b225e'); // royal purple (argaman)
  g.addColorStop(0.68, '#8e2230'); // crimson scarlet (tola'at shani)
  g.addColorStop(1, '#233f78');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  // Fine twisted white byssus linen weave threads
  for (let y = 0; y < S; y += 4) {
    ctx.fillStyle = y % 8 === 0 ? 'rgba(246, 238, 222, 0.12)' : 'rgba(16, 10, 28, 0.14)';
    ctx.fillRect(0, y, S, 2);
  }
  for (let x = 0; x < S; x += 4) {
    ctx.fillStyle = 'rgba(246, 238, 222, 0.08)';
    ctx.fillRect(x, 0, 1.5, S);
  }

  // Ornamental gold & white linen geometric tapestry bands (strictly aniconic!)
  for (const by of [56, 176, 336, 456]) {
    ctx.fillStyle = 'rgba(232, 192, 98, 0.78)';
    ctx.fillRect(0, by - 8, S, 16);
    ctx.fillStyle = 'rgba(248, 242, 228, 0.65)';
    for (let x = 16; x < S; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, by - 6);
      ctx.lineTo(x + 8, by);
      ctx.lineTo(x, by + 6);
      ctx.lineTo(x - 8, by);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Subtle celestial gold-thread star-points (War 5.214 — cosmic tapestry excluding zodiac images)
  for (let i = 0; i < 64; i++) {
    const sx = 12 + rand() * (S - 24);
    const sy = 12 + rand() * (S - 24);
    ctx.fillStyle = `rgba(250, 222, 138, ${0.35 + rand() * 0.4})`;
    ctx.fillRect(sx - 2, sy - 2, 4, 4);
  }
  return c;
}

function paintBedrockCanvas(): HTMLCanvasElement {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const rand = makeRng(5002);

  ctx.fillStyle = '#b9a88c';
  ctx.fillRect(0, 0, S, S);

  for (let i = 0; i < 320; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = 6 + rand() * 28;
    const v = 158 + Math.round(rand() * 52);
    ctx.fillStyle = `rgba(${v + 12}, ${v + 4}, ${v - 12}, 0.42)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Natural limestone bedding fissures on Even HaShetiyah
  for (let i = 0; i < 24; i++) {
    ctx.strokeStyle = `rgba(82, 70, 52, ${0.22 + rand() * 0.25})`;
    ctx.lineWidth = 1.5 + rand() * 2.5;
    const y = rand() * S;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(S * 0.33, y + (rand() - 0.5) * 36, S * 0.66, y + (rand() - 0.5) * 36, S, y + (rand() - 0.5) * 20);
    ctx.stroke();
  }
  return c;
}

function paintHearthCanvas(embers: boolean): HTMLCanvasElement {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  const rand = makeRng(embers ? 3015 : 3012);
  ctx.fillStyle = embers ? '#2a150b' : '#585046';
  ctx.fillRect(0, 0, S, S);

  for (let i = 0; i < 340; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = 2 + rand() * 9;
    if (embers) {
      const hot = rand();
      ctx.fillStyle =
        hot > 0.7
          ? `rgba(255, 168, 46, ${0.42 + rand() * 0.5})`
          : hot > 0.38
            ? `rgba(222, 68, 18, ${0.35 + rand() * 0.4})`
            : `rgba(44, 30, 24, ${0.65 + rand() * 0.3})`;
    } else {
      const v = 60 + Math.round(rand() * 44);
      ctx.fillStyle = `rgba(${v + 4}, ${v}, ${v - 4}, 0.55)`;
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

function paintOliveFoliageCanvas(): HTMLCanvasElement {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  const rand = makeRng(2403);
  ctx.fillStyle = '#536844';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 240; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = 5 + rand() * 13;
    const g = 96 + Math.round(rand() * 46);
    // Silvery-sage Judean olive leaf palette
    ctx.fillStyle = `rgb(${g - 14}, ${g + 8}, ${g - 22})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

function paintSpriteRadial(kind: 'smoke' | 'flame' | 'beam'): THREE.CanvasTexture {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  if (kind === 'smoke') {
    const g = ctx.createRadialGradient(S / 2, S / 2, 8, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(248, 243, 235, 0.5)');
    g.addColorStop(0.45, 'rgba(228, 222, 214, 0.24)');
    g.addColorStop(1, 'rgba(212, 206, 198, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  } else if (kind === 'flame') {
    const g = ctx.createRadialGradient(S / 2, S * 0.58, 4, S / 2, S * 0.5, S * 0.46);
    g.addColorStop(0, 'rgba(255, 250, 218, 0.98)');
    g.addColorStop(0.32, 'rgba(255, 196, 72, 0.82)');
    g.addColorStop(0.68, 'rgba(242, 108, 22, 0.34)');
    g.addColorStop(1, 'rgba(210, 60, 8, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  } else {
    const g = ctx.createLinearGradient(0, 0, S, 0);
    g.addColorStop(0, 'rgba(255, 228, 152, 0)');
    g.addColorStop(0.28, 'rgba(255, 224, 138, 0.3)');
    g.addColorStop(0.5, 'rgba(255, 240, 184, 0.65)');
    g.addColorStop(0.72, 'rgba(255, 224, 138, 0.3)');
    g.addColorStop(1, 'rgba(255, 228, 152, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);

    const fade = ctx.createLinearGradient(0, 0, 0, S);
    fade.addColorStop(0, 'rgba(255,255,255,0)');
    fade.addColorStop(0.18, 'rgba(255,255,255,1)');
    fade.addColorStop(0.82, 'rgba(255,255,255,0.85)');
    fade.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, S, S);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

export function buildHerodTextures(): HerodTexSet {
  const ashlarC = paintHerodianAshlar(false);
  const herodianAshlarMat = new THREE.MeshStandardMaterial({
    map: texFrom(ashlarC, 1, 1, true),
    normalMap: normalFromLuminance(ashlarC, 2.5),
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughnessMap: roughnessFromLuminance(ashlarC, 0.58, 0.92),
    roughness: 0.84,
    metalness: 0.02,
  });

  const whiteC = paintHerodianAshlar(true);
  const sanctuaryWhiteMat = new THREE.MeshStandardMaterial({
    map: texFrom(whiteC, 1, 1, true),
    normalMap: normalFromLuminance(whiteC, 2.1),
    normalScale: new THREE.Vector2(0.65, 0.65),
    roughnessMap: roughnessFromLuminance(whiteC, 0.34, 0.68),
    color: new THREE.Color('#fbf7ef'),
    roughness: 0.52,
    metalness: 0.04,
  });

  const pavingC = paintPavingCanvas(false);
  const pavingMat = new THREE.MeshStandardMaterial({
    map: texFrom(pavingC, 28, 28, true),
    normalMap: normalFromLuminance(pavingC, 1.9),
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughnessMap: roughnessFromLuminance(pavingC, 0.5, 0.86),
    roughness: 0.78,
    metalness: 0.02,
  });
  pavingMat.normalMap!.repeat.set(28, 28);
  pavingMat.roughnessMap!.repeat.set(28, 28);

  const opusC = paintPavingCanvas(true);
  const opusSectileMat = new THREE.MeshStandardMaterial({
    map: texFrom(opusC, 10, 10, true),
    normalMap: normalFromLuminance(opusC, 1.8),
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.56,
    metalness: 0.05,
  });
  opusSectileMat.normalMap!.repeat.set(10, 10);

  const fluteC = paintFlutedMarbleCanvas();
  const corinthianMarbleMat = new THREE.MeshStandardMaterial({
    map: texFrom(fluteC, 1, 1, true),
    normalMap: normalFromLuminance(fluteC, 2.6),
    normalScale: new THREE.Vector2(0.85, 0.85),
    color: new THREE.Color('#f7f1e5'),
    roughness: 0.48,
    metalness: 0.03,
  });

  const royalCedarC = paintHerodianCedarCanvas(false);
  const royalCedarMat = new THREE.MeshStandardMaterial({
    map: texFrom(royalCedarC, 1, 1, true),
    normalMap: normalFromLuminance(royalCedarC, 2.4),
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughness: 0.64,
    metalness: 0.05,
  });

  const hekhalCedarC = paintHerodianCedarCanvas(true);
  const hekhalCedarMat = new THREE.MeshStandardMaterial({
    name: 'Interior Hekhal Cedar',
    map: texFrom(hekhalCedarC, 1, 1, true),
    normalMap: normalFromLuminance(hekhalCedarC, 2.6),
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughness: 0.44,
    metalness: 0.38,
  });

  const soregC = paintSoregLatticeCanvas();
  const soregLatticeMat = new THREE.MeshStandardMaterial({
    map: texFrom(soregC, 1, 1, true),
    normalMap: normalFromLuminance(soregC, 2.8),
    normalScale: new THREE.Vector2(0.95, 0.95),
    roughness: 0.76,
    metalness: 0.02,
  });

  const steleC = paintSoregSteleCanvas();
  const soregSteleMat = new THREE.MeshStandardMaterial({
    map: texFrom(steleC, 1, 1, true),
    normalMap: normalFromLuminance(steleC, 2.2),
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughness: 0.74,
    metalness: 0.02,
  });

  const whitewashC = paintWhitewashAltarCanvas();
  const whitewashMat = new THREE.MeshStandardMaterial({
    map: texFrom(whitewashC, 1, 1, true),
    normalMap: normalFromLuminance(whitewashC, 2.0),
    normalScale: new THREE.Vector2(0.6, 0.6),
    color: new THREE.Color('#faf6ed'),
    roughness: 0.82,
    metalness: 0.01,
  });

  const scarletMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#a61c24'),
    emissive: new THREE.Color('#300508'),
    emissiveIntensity: 0.18,
    roughness: 0.72,
    metalness: 0.04,
  });

  const sanctuaryGoldMat = new THREE.MeshStandardMaterial({
    name: 'Interior Sanctuary Gold',
    map: texFrom(hekhalCedarC, 1, 1, true),
    normalMap: normalFromLuminance(hekhalCedarC, 1.8),
    normalScale: new THREE.Vector2(0.45, 0.45),
    color: new THREE.Color('#f4ca62'),
    emissive: new THREE.Color('#3c2606'),
    emissiveIntensity: 0.24,
    roughness: 0.26,
    metalness: 0.86,
  });

  const corinthianBronzeMat = new THREE.MeshStandardMaterial({
    name: 'Interior Nicanor Bronze',
    map: texFrom(hekhalCedarC, 1, 1, true),
    normalMap: normalFromLuminance(hekhalCedarC, 2.0),
    normalScale: new THREE.Vector2(0.6, 0.6),
    color: new THREE.Color('#d99b4e'),
    emissive: new THREE.Color('#2c1805'),
    emissiveIntensity: 0.16,
    roughness: 0.28,
    metalness: 0.88,
  });

  const bronzeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#9e6f38'),
    roughness: 0.36,
    metalness: 0.84,
  });

  const ironMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#4c4f54'),
    roughness: 0.48,
    metalness: 0.78,
  });

  const marbleMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#f1ede4'),
    roughness: 0.34,
    metalness: 0.04,
  });

  const bedrockC = paintBedrockCanvas();
  const bedrockMat = new THREE.MeshStandardMaterial({
    map: texFrom(bedrockC, 1, 1, true),
    normalMap: normalFromLuminance(bedrockC, 3.0),
    normalScale: new THREE.Vector2(1.05, 1.05),
    roughness: 0.94,
    metalness: 0.01,
  });

  const veilC = paintSecondTempleVeilCanvas();
  const veilMat = new THREE.MeshStandardMaterial({
    map: texFrom(veilC, 2, 3, true),
    normalMap: normalFromLuminance(veilC, 1.8),
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughness: 0.76,
    metalness: 0.12,
    side: THREE.DoubleSide,
  });
  veilMat.normalMap!.repeat.set(2, 3);

  const hearthC = paintHearthCanvas(false);
  const hearthMat = new THREE.MeshStandardMaterial({
    map: texFrom(hearthC, 2, 2, true),
    normalMap: normalFromLuminance(hearthC, 2.5),
    roughness: 0.92,
    metalness: 0.04,
  });

  const emberC = paintHearthCanvas(true);
  const emberMat = new THREE.MeshStandardMaterial({
    map: texFrom(emberC, 2, 2, true),
    emissive: new THREE.Color('#ff6218'),
    emissiveMap: texFrom(emberC, 2, 2, true),
    emissiveIntensity: 1.5,
    roughness: 0.84,
  });

  const terracottaRoofMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#b66a45'),
    roughness: 0.78,
    metalness: 0.04,
  });

  const oliveC = paintOliveFoliageCanvas();
  const oliveFoliageMat = new THREE.MeshStandardMaterial({
    map: texFrom(oliveC, 1, 1, true),
    normalMap: normalFromLuminance(oliveC, 2.1),
    roughness: 0.82,
    metalness: 0.02,
  });

  const barkMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#6b533b'),
    roughness: 0.92,
  });

  return {
    herodianAshlarMat,
    sanctuaryWhiteMat,
    pavingMat,
    opusSectileMat,
    corinthianMarbleMat,
    royalCedarMat,
    hekhalCedarMat,
    soregLatticeMat,
    soregSteleMat,
    whitewashMat,
    scarletMat,
    sanctuaryGoldMat,
    corinthianBronzeMat,
    bronzeMat,
    ironMat,
    marbleMat,
    bedrockMat,
    veilMat,
    hearthMat,
    emberMat,
    terracottaRoofMat,
    oliveFoliageMat,
    barkMat,
    smokeTex: paintSpriteRadial('smoke'),
    flameTex: paintSpriteRadial('flame'),
    beamTex: paintSpriteRadial('beam'),
  };
}
