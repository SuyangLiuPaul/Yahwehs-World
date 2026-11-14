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

export interface EzekielTexSet {
  ashlarMat: THREE.MeshStandardMaterial;
  ashlarTrimMat: THREE.MeshStandardMaterial;
  pavingMat: THREE.MeshStandardMaterial;
  ritzpahMat: THREE.MeshStandardMaterial;
  palmPilasterMat: THREE.MeshStandardMaterial;
  cedarPlainMat: THREE.MeshStandardMaterial;
  cedarCarvedMat: THREE.MeshStandardMaterial;
  debirGoldMat: THREE.MeshStandardMaterial;
  bronzeMat: THREE.MeshStandardMaterial;
  hearthMat: THREE.MeshStandardMaterial;
  emberMat: THREE.MeshStandardMaterial;
  waterMat: THREE.MeshStandardMaterial;
  waterNormal: THREE.CanvasTexture;
  waterAlbedo: THREE.CanvasTexture;
  foliageMat: THREE.MeshStandardMaterial;
  barkMat: THREE.MeshStandardMaterial;
  smokeTex: THREE.CanvasTexture;
  beamTex: THREE.CanvasTexture;
}

function paintAshlarCanvas(): HTMLCanvasElement {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const rand = makeRng(4005);

  ctx.fillStyle = '#ddd0b7';
  ctx.fillRect(0, 0, S, S);

  const rows = 8;
  const rowH = S / rows;
  for (let r = 0; r < rows; r++) {
    const cols = r % 2 === 0 ? 4 : 3;
    const offset = (r % 2) * (S / (cols * 2));
    let x = -offset;
    for (let i = 0; i <= cols + 1; i++) {
      const bw = S / cols + (rand() - 0.5) * 18;
      const y = r * rowH;
      const tone = 216 + Math.round((rand() - 0.5) * 22);
      const warm = Math.round((rand() - 0.5) * 10);
      ctx.fillStyle = `rgb(${tone + 10}, ${tone + 1 + warm}, ${tone - 18})`;
      ctx.fillRect(x + 2, y + 2, bw - 4, rowH - 4);

      // Subtle drafted margin around monumental Ezekiel ashlar block
      ctx.strokeStyle = 'rgba(248, 240, 224, 0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 5, y + 5, Math.max(4, bw - 10), rowH - 10);

      // Fine tool marks & limestone mineral specks
      for (let k = 0; k < 28; k++) {
        const px = x + 4 + rand() * Math.max(1, bw - 8);
        const py = y + 4 + rand() * (rowH - 8);
        const alpha = 0.04 + rand() * 0.08;
        ctx.fillStyle = rand() > 0.45 ? `rgba(115, 96, 70, ${alpha})` : `rgba(255, 250, 238, ${alpha})`;
        ctx.fillRect(px, py, 2 + rand() * 3, 1.5);
      }

      // Mortar line
      ctx.strokeStyle = 'rgba(130, 114, 88, 0.72)';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x + 1, y + 1, bw - 2, rowH - 2);
      x += bw;
    }
  }
  return c;
}

function paintPavingCanvas(ornate: boolean): HTMLCanvasElement {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const rand = makeRng(ornate ? 4017 : 4047);

  ctx.fillStyle = ornate ? '#cbb692' : '#d6c5a7';
  ctx.fillRect(0, 0, S, S);

  const n = 8;
  const cell = S / n;
  for (let gy = 0; gy < n; gy++) {
    for (let gx = 0; gx < n; gx++) {
      const x = gx * cell;
      const y = gy * cell;
      const isBorder = ornate && (gx === 0 || gy === 0 || gx === n - 1 || gy === n - 1);
      const isInlay = ornate && ((gx + gy) % 2 === 0) && !isBorder;
      const base = isBorder ? 176 : isInlay ? 202 : 218;
      const v = base + Math.round((rand() - 0.5) * 18);
      ctx.fillStyle = isBorder
        ? `rgb(${v + 12}, ${v - 6}, ${v - 28})`
        : `rgb(${v + 10}, ${v + 2}, ${v - 18})`;
      ctx.fillRect(x + 1.5, y + 1.5, cell - 3, cell - 3);

      for (let k = 0; k < 14; k++) {
        ctx.fillStyle = `rgba(98, 82, 60, ${0.03 + rand() * 0.06})`;
        ctx.fillRect(x + 3 + rand() * (cell - 6), y + 3 + rand() * (cell - 6), 2.5, 2.5);
      }

      ctx.strokeStyle = 'rgba(116, 98, 74, 0.55)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2);
    }
  }

  if (ornate) {
    ctx.strokeStyle = 'rgba(138, 92, 54, 0.45)';
    ctx.lineWidth = 4;
    ctx.strokeRect(cell, cell, S - cell * 2, S - cell * 2);
  }
  return c;
}

function drawDatePalm(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  bottomY: number,
  scale: number,
  fgColor: string,
  accentColor: string,
): void {
  const h = bottomY - topY;
  const trunkW = 14 * scale;

  // Trunk scales (diamond lattice of date palm trunk)
  ctx.fillStyle = fgColor;
  ctx.fillRect(cx - trunkW * 0.5, topY + h * 0.24, trunkW, h * 0.72);
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.6 * scale;
  const steps = 11;
  for (let i = 0; i < steps; i++) {
    const sy = topY + h * 0.27 + (i / steps) * (h * 0.66);
    ctx.beginPath();
    ctx.moveTo(cx - trunkW * 0.5, sy);
    ctx.lineTo(cx, sy + 7 * scale);
    ctx.lineTo(cx + trunkW * 0.5, sy);
    ctx.stroke();
  }

  // Crown of arching palm fronds (7 sweeping fronds)
  const crownY = topY + h * 0.26;
  const angles = [-2.55, -2.05, -1.55, -1.05, -0.55, -0.15, -2.95];
  for (const ang of angles) {
    const len = (54 + (Math.abs(ang + Math.PI / 2) > 0.7 ? 12 : 0)) * scale;
    const ex = cx + Math.cos(ang) * len;
    const ey = crownY + Math.sin(ang) * len + 18 * scale;
    const mx = cx + Math.cos(ang) * len * 0.55;
    const my = crownY + Math.sin(ang) * len * 0.45 - 6 * scale;

    ctx.strokeStyle = fgColor;
    ctx.lineWidth = 3.2 * scale;
    ctx.beginPath();
    ctx.moveTo(cx, crownY);
    ctx.quadraticCurveTo(mx, my, ex, ey);
    ctx.stroke();

    // Leaflets
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.4 * scale;
    for (let t = 0.2; t <= 0.92; t += 0.14) {
      const bx = (1 - t) * (1 - t) * cx + 2 * (1 - t) * t * mx + t * t * ex;
      const by = (1 - t) * (1 - t) * crownY + 2 * (1 - t) * t * my + t * t * ey;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + (ex >= cx ? 6 : -6) * scale, by + 11 * scale);
      ctx.stroke();
    }
  }

  // Date clusters beneath crown
  ctx.fillStyle = accentColor;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + side * 11 * scale, crownY + 13 * scale, 5 * scale, 8 * scale, side * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintPalmPilasterCanvas(): HTMLCanvasElement {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const rand = makeRng(4022);

  ctx.fillStyle = '#ddd0b7';
  ctx.fillRect(0, 0, S, S);

  // Subtle ashlar courses behind the carved stone relief
  for (let y = 0; y < S; y += 64) {
    ctx.fillStyle = `rgb(${216 + Math.round(rand() * 12)}, ${204 + Math.round(rand() * 10)}, ${178 + Math.round(rand() * 10)})`;
    ctx.fillRect(0, y + 1, S, 62);
  }

  // Recessed pilaster frame
  ctx.strokeStyle = 'rgba(136, 114, 82, 0.72)';
  ctx.lineWidth = 8;
  ctx.strokeRect(24, 24, S - 48, S - 48);
  ctx.strokeStyle = 'rgba(250, 242, 224, 0.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(34, 34, S - 68, S - 68);

  // Tall relief palm tree centered on pilaster (Ezek 40:16, 22, 26)
  drawDatePalm(ctx, S * 0.5, 48, S - 46, 2.2, '#b99b6b', '#876b43');
  return c;
}

function drawTwoFacedCherub(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
): void {
  // Ezek 41:18-20: two faces — man's face toward palm on left, young lion's face toward palm on right
  ctx.save();

  // Four sweeping gilded wings (upper & lower arched silhouettes)
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#cfa352';
    ctx.strokeStyle = '#6f4216';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(cx + side * 6 * scale, cy - 8 * scale);
    ctx.bezierCurveTo(
      cx + side * 42 * scale,
      cy - 54 * scale,
      cx + side * 68 * scale,
      cy - 22 * scale,
      cx + side * 58 * scale,
      cy + 14 * scale,
    );
    ctx.quadraticCurveTo(cx + side * 26 * scale, cy + 4 * scale, cx + side * 8 * scale, cy + 10 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Wing feather striations
    ctx.strokeStyle = 'rgba(92, 52, 16, 0.55)';
    ctx.lineWidth = 1.2 * scale;
    for (let f = 0.25; f <= 0.8; f += 0.18) {
      ctx.beginPath();
      ctx.moveTo(cx + side * 12 * scale, cy - 2 * scale);
      ctx.lineTo(cx + side * (52 * f + 12) * scale, cy - (36 * (1 - f)) * scale);
      ctx.stroke();
    }
  }

  // Central winged torso column
  ctx.fillStyle = '#c49240';
  ctx.strokeStyle = '#6b3e14';
  ctx.lineWidth = 1.8 * scale;
  ctx.beginPath();
  ctx.roundRect(cx - 12 * scale, cy - 10 * scale, 24 * scale, 52 * scale, 6 * scale);
  ctx.fill();
  ctx.stroke();

  // Left profile: face of a man facing left toward adjacent palm tree
  ctx.fillStyle = '#dfc07c';
  ctx.beginPath();
  ctx.arc(cx - 14 * scale, cy - 20 * scale, 10 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#5a3310';
  ctx.fillRect(cx - 21 * scale, cy - 22 * scale, 3 * scale, 3 * scale);
  // Short sculpted beard/jaw contour
  ctx.beginPath();
  ctx.moveTo(cx - 24 * scale, cy - 20 * scale);
  ctx.lineTo(cx - 26 * scale, cy - 16 * scale);
  ctx.lineTo(cx - 20 * scale, cy - 12 * scale);
  ctx.stroke();

  // Right profile: face of a young lion facing right toward opposite palm tree (with sculpted mane ring)
  ctx.fillStyle = '#b47c2e';
  ctx.beginPath();
  ctx.arc(cx + 15 * scale, cy - 20 * scale, 13 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d9b161';
  ctx.beginPath();
  ctx.arc(cx + 17 * scale, cy - 20 * scale, 8.5 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#5a3310';
  ctx.fillRect(cx + 19 * scale, cy - 23 * scale, 3 * scale, 3 * scale);
  ctx.fillRect(cx + 22 * scale, cy - 18 * scale, 4 * scale, 3 * scale);

  ctx.restore();
}

function paintCedarCanvas(carved: boolean): HTMLCanvasElement {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const rand = makeRng(carved ? 4118 : 4116);

  ctx.fillStyle = '#7b4827';
  ctx.fillRect(0, 0, S, S);

  // Vertical cedar boards + warm grain
  const planks = 8;
  const pw = S / planks;
  for (let p = 0; p < planks; p++) {
    const x = p * pw;
    const tone = (rand() - 0.5) * 16;
    ctx.fillStyle = `rgb(${124 + tone}, ${72 + tone * 0.7}, ${39 + tone * 0.5})`;
    ctx.fillRect(x, 0, pw, S);

    for (let g = 0; g < 18; g++) {
      ctx.strokeStyle = `rgba(66, 34, 15, ${0.08 + rand() * 0.14})`;
      ctx.lineWidth = 1 + rand() * 1.5;
      const gx = x + rand() * pw;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.bezierCurveTo(gx + (rand() - 0.5) * 12, S * 0.33, gx + (rand() - 0.5) * 12, S * 0.66, gx, S);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(42, 20, 8, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, S);
    ctx.stroke();
  }

  if (carved) {
    // Upper and lower gilded geometric borders (Ezek 41:17-20 wainscot paneling)
    ctx.fillStyle = '#c59944';
    ctx.fillRect(0, 26, S, 12);
    ctx.fillRect(0, S - 38, S, 12);
    ctx.strokeStyle = '#533012';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 44, S, S - 88);

    // Alternating carved palms & two-faced cherubim along cedar wall paneling
    drawDatePalm(ctx, S * 0.125, 68, S - 64, 1.45, '#d4aa57', '#6a3d16');
    drawTwoFacedCherub(ctx, S * 0.375, S * 0.5, 1.38);
    drawDatePalm(ctx, S * 0.625, 68, S - 64, 1.45, '#d4aa57', '#6a3d16');
    drawTwoFacedCherub(ctx, S * 0.875, S * 0.5, 1.38);
  }
  return c;
}

function paintWaterAlbedo(): HTMLCanvasElement {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const rand = makeRng(4701);

  const g = ctx.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, '#44b8b0');
  g.addColorStop(0.5, '#1b8f94');
  g.addColorStop(1, '#44b8b0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  // Shimmering turquoise stream filaments & subtle sun caustics
  for (let i = 0; i < 160; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const len = 32 + rand() * 88;
    const bright = rand() > 0.45;
    ctx.strokeStyle = bright
      ? `rgba(182, 248, 244, ${0.12 + rand() * 0.2})`
      : `rgba(12, 92, 98, ${0.15 + rand() * 0.2})`;
    ctx.lineWidth = 1.5 + rand() * 3.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + len * 0.35, y + (rand() - 0.5) * 14, x + len * 0.65, y + (rand() - 0.5) * 14, x + len, y);
    ctx.stroke();
  }
  return c;
}

function paintWaterNormal(): HTMLCanvasElement {
  const S = 512;
  const [c, ctx] = makeCanvas(S, S);
  const rand = makeRng(4709);

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, S, S);

  for (let i = 0; i < 260; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const rx = 20 + rand() * 44;
    const ry = 4 + rand() * 9;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, rx);
    const v = rand() > 0.5 ? 225 : 40;
    grad.addColorStop(0, `rgba(${v},${v},${v},0.45)`);
    grad.addColorStop(1, 'rgba(128,128,128,0)');
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  return c;
}

function paintHearthCanvas(embers: boolean): HTMLCanvasElement {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  const rand = makeRng(embers ? 4315 : 4623);

  ctx.fillStyle = embers ? '#2a160c' : '#534c44';
  ctx.fillRect(0, 0, S, S);

  for (let i = 0; i < 360; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = 2 + rand() * 9;
    if (embers) {
      const hot = rand();
      ctx.fillStyle = hot > 0.72
        ? `rgba(255, 162, 42, ${0.4 + rand() * 0.5})`
        : hot > 0.4
          ? `rgba(218, 66, 18, ${0.35 + rand() * 0.4})`
          : `rgba(42, 30, 26, ${0.65 + rand() * 0.3})`;
    } else {
      const v = 58 + Math.round(rand() * 42);
      ctx.fillStyle = `rgba(${v + 4}, ${v}, ${v - 4}, 0.55)`;
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

function paintFoliageCanvas(): HTMLCanvasElement {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  const rand = makeRng(4712);

  ctx.fillStyle = '#2f6a32';
  ctx.fillRect(0, 0, S, S);

  for (let i = 0; i < 240; i++) {
    const x = rand() * S;
    const y = rand() * S;
    const r = 6 + rand() * 14;
    const g = 88 + Math.round(rand() * 58);
    ctx.fillStyle = `rgb(${36 + Math.round(rand() * 28)}, ${g}, ${34 + Math.round(rand() * 22)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Monthly fruit accents (Ezek 47:12 — fresh fruit every month!)
  for (let i = 0; i < 26; i++) {
    const x = 12 + rand() * (S - 24);
    const y = 12 + rand() * (S - 24);
    ctx.fillStyle = rand() > 0.45 ? '#e48a2c' : '#b83c34';
    ctx.beginPath();
    ctx.arc(x, y, 4.5 + rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

function paintSpriteRadial(kind: 'smoke' | 'beam'): THREE.CanvasTexture {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  if (kind === 'smoke') {
    const g = ctx.createRadialGradient(S / 2, S / 2, 8, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(246, 240, 232, 0.52)');
    g.addColorStop(0.45, 'rgba(225, 218, 210, 0.25)');
    g.addColorStop(1, 'rgba(210, 205, 198, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  } else {
    // Vertical soft-edged golden light beam (Ezek 43:2-5)
    const g = ctx.createLinearGradient(0, 0, S, 0);
    g.addColorStop(0, 'rgba(255, 224, 140, 0)');
    g.addColorStop(0.25, 'rgba(255, 220, 128, 0.34)');
    g.addColorStop(0.5, 'rgba(255, 236, 174, 0.72)');
    g.addColorStop(0.75, 'rgba(255, 220, 128, 0.34)');
    g.addColorStop(1, 'rgba(255, 224, 140, 0)');
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

export function buildEzekielTextures(): EzekielTexSet {
  const ashlarC = paintAshlarCanvas();
  const ashlarMat = new THREE.MeshStandardMaterial({
    map: texFrom(ashlarC, 1, 1, true),
    normalMap: normalFromLuminance(ashlarC, 2.3),
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughnessMap: roughnessFromLuminance(ashlarC, 0.62, 0.94),
    roughness: 0.88,
    metalness: 0.02,
  });

  const ashlarTrimMat = new THREE.MeshStandardMaterial({
    map: texFrom(ashlarC, 1, 1, true),
    normalMap: normalFromLuminance(ashlarC, 1.9),
    normalScale: new THREE.Vector2(0.6, 0.6),
    color: new THREE.Color('#eee2ca'),
    roughness: 0.78,
    metalness: 0.03,
  });

  const pavingC = paintPavingCanvas(false);
  const pavingMat = new THREE.MeshStandardMaterial({
    map: texFrom(pavingC, 1, 1, true),
    normalMap: normalFromLuminance(pavingC, 2.0),
    normalScale: new THREE.Vector2(0.65, 0.65),
    roughnessMap: roughnessFromLuminance(pavingC, 0.56, 0.88),
    roughness: 0.82,
    metalness: 0.02,
  });

  const ritzpahC = paintPavingCanvas(true);
  const ritzpahMat = new THREE.MeshStandardMaterial({
    map: texFrom(ritzpahC, 1, 1, true),
    normalMap: normalFromLuminance(ritzpahC, 2.2),
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughnessMap: roughnessFromLuminance(ritzpahC, 0.52, 0.86),
    roughness: 0.8,
    metalness: 0.03,
  });

  const pilasterC = paintPalmPilasterCanvas();
  const palmPilasterMat = new THREE.MeshStandardMaterial({
    map: texFrom(pilasterC, 1, 1, true),
    normalMap: normalFromLuminance(pilasterC, 2.8),
    normalScale: new THREE.Vector2(1.05, 1.05),
    roughness: 0.78,
    metalness: 0.04,
  });

  const cedarPlainC = paintCedarCanvas(false);
  const cedarPlainMat = new THREE.MeshStandardMaterial({
    map: texFrom(cedarPlainC, 1, 1, true),
    normalMap: normalFromLuminance(cedarPlainC, 1.9),
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.68,
    metalness: 0.04,
  });

  const cedarCarvedC = paintCedarCanvas(true);
  const cedarCarvedMat = new THREE.MeshStandardMaterial({
    map: texFrom(cedarCarvedC, 1, 1, true),
    normalMap: normalFromLuminance(cedarCarvedC, 2.7),
    normalScale: new THREE.Vector2(0.95, 0.95),
    roughness: 0.56,
    metalness: 0.14,
  });

  const debirGoldMat = new THREE.MeshStandardMaterial({
    name: 'Interior Debir Gold',
    map: texFrom(cedarCarvedC, 1, 1, true),
    normalMap: normalFromLuminance(cedarCarvedC, 2.4),
    normalScale: new THREE.Vector2(0.75, 0.75),
    color: new THREE.Color('#f0c665'),
    emissive: new THREE.Color('#3a2508'),
    emissiveIntensity: 0.22,
    roughness: 0.34,
    metalness: 0.78,
  });

  const bronzeMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#9c6f38'),
    roughness: 0.36,
    metalness: 0.84,
  });

  const hearthC = paintHearthCanvas(false);
  const hearthMat = new THREE.MeshStandardMaterial({
    map: texFrom(hearthC, 2, 2, true),
    normalMap: normalFromLuminance(hearthC, 2.6),
    roughness: 0.92,
    metalness: 0.04,
  });

  const emberC = paintHearthCanvas(true);
  const emberMat = new THREE.MeshStandardMaterial({
    map: texFrom(emberC, 2, 2, true),
    emissive: new THREE.Color('#ff5d14'),
    emissiveMap: texFrom(emberC, 2, 2, true),
    emissiveIntensity: 1.45,
    roughness: 0.85,
  });

  const waterAlbedoC = paintWaterAlbedo();
  const waterAlbedo = texFrom(waterAlbedoC, 8, 2, true);
  const waterNormalHeight = paintWaterNormal();
  const waterNormal = normalFromLuminance(waterNormalHeight, 3.0);
  waterNormal.repeat.set(10, 3);

  const waterMat = new THREE.MeshStandardMaterial({
    map: waterAlbedo,
    normalMap: waterNormal,
    normalScale: new THREE.Vector2(0.9, 0.9),
    color: new THREE.Color('#6fe8e2'),
    emissive: new THREE.Color('#0c484c'),
    emissiveIntensity: 0.32,
    roughness: 0.14,
    metalness: 0.12,
    transparent: true,
    opacity: 0.88,
  });

  const foliageC = paintFoliageCanvas();
  const foliageMat = new THREE.MeshStandardMaterial({
    map: texFrom(foliageC, 1, 1, true),
    normalMap: normalFromLuminance(foliageC, 2.2),
    roughness: 0.76,
    metalness: 0.02,
  });

  const barkMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#694b34'),
    roughness: 0.92,
  });

  return {
    ashlarMat,
    ashlarTrimMat,
    pavingMat,
    ritzpahMat,
    palmPilasterMat,
    cedarPlainMat,
    cedarCarvedMat,
    debirGoldMat,
    bronzeMat,
    hearthMat,
    emberMat,
    waterMat,
    waterNormal,
    waterAlbedo,
    foliageMat,
    barkMat,
    smokeTex: paintSpriteRadial('smoke'),
    beamTex: paintSpriteRadial('beam'),
  };
}
