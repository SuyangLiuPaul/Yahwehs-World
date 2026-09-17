import * as THREE from 'three';
let randomState=260027;
const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};

// Every surface in this scene was flat colour — 604 meshes, not one of them
// carrying a texture — which is the single largest reason it read as an
// unfinished prototype rather than a place. These are generated into canvases
// at load time, the same way the globe's basemap is: no image files, no
// licence, nothing to download, and each one is authored against what the
// passage says the material actually was.

const cv = (size: number) => {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  // Every one of these is read back to derive a normal map.
  return { c, x: c.getContext('2d', { willReadFrequently: true })! };
};

const wrap = (t: THREE.CanvasTexture, repeat: number) => {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

/** Derives a normal map from a canvas's luminance, so a painted grain also
 *  catches the light instead of only tinting it. */
function normalFrom(src: HTMLCanvasElement, strength = 2.2): THREE.CanvasTexture {
  const n = src.width;
  const { c, x } = cv(n);
  const sd = src.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, n, n).data;
  const out = x.createImageData(n, n);
  const lum = (i: number) => (sd[i * 4]! * 0.3 + sd[i * 4 + 1]! * 0.59 + sd[i * 4 + 2]! * 0.11) / 255;
  for (let y = 0; y < n; y++) {
    for (let X = 0; X < n; X++) {
      const i = y * n + X;
      const l = lum(i);
      const dx = (lum(y * n + ((X + 1) % n)) - l) * strength;
      const dy = (lum(((y + 1) % n) * n + X) - l) * strength;
      const v = new THREE.Vector3(-dx, -dy, 1).normalize();
      out.data[i * 4] = (v.x * 0.5 + 0.5) * 255;
      out.data[i * 4 + 1] = (v.y * 0.5 + 0.5) * 255;
      out.data[i * 4 + 2] = (v.z * 0.5 + 0.5) * 255;
      out.data[i * 4 + 3] = 255;
    }
  }
  x.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Value noise, tiling, so a surface never shows a seam. */
function noise(x: CanvasRenderingContext2D, n: number, cells: number, alpha: number) {
  const height=x.canvas.height;
  const step = n / cells;
  const grid: number[][] = [];
  for (let j = 0; j <= cells; j++) {
    grid[j] = [];
    for (let i = 0; i <= cells; i++) grid[j]![i] = random();
  }
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) grid[j]![cells] = grid[j]![0]!;
  for (let i = 0; i <= cells; i++) grid[cells]![i] = grid[0]![i]!;

  const img = x.getImageData(0, 0, n, height);
  const sm = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < height; y++) {
    for (let X = 0; X < n; X++) {
      const gx = X / step, gy = y / step;
      const i0 = Math.floor(gx), j0 = Math.floor(gy);
      const fx = sm(gx - i0), fy = sm(gy - j0);
      const a = grid[j0]![i0]!, b = grid[j0]![i0 + 1]!;
      const c2 = grid[j0 + 1]![i0]!, d = grid[j0 + 1]![i0 + 1]!;
      const v = (a * (1 - fx) + b * fx) * (1 - fy) + (c2 * (1 - fx) + d * fx) * fy;
      const k = (v - 0.5) * 255 * alpha;
      const idx = (y * n + X) * 4;
      for (let ch = 0; ch < 3; ch++) img.data[idx + ch] = Math.max(0, Math.min(255, img.data[idx + ch]! + k));
    }
  }
  x.putImageData(img, 0, 0);
}

export interface Surface { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap?: THREE.Texture }

/** Desert floor: fine grain over broad drift, the whole thing warm. */
export function sand(): Surface {
  const { c, x } = cv(512);
  x.fillStyle = '#c2ad87';
  x.fillRect(0, 0, 512, 512);
  // Tight grain, not broad blotches: a low cell count over a texture repeated
  // sixty times reads as cloud shadow rather than sand.
  noise(x, 512, 20, 0.035);
  noise(x, 512, 90, 0.07);
  noise(x, 512, 260, 0.08);
  return { map: wrap(new THREE.CanvasTexture(c), 180), normalMap: wrap(normalFrom(c, 1.9), 180) };
}

/** "Finely twisted linen" — Exodus 27:9. A woven cloth reads as a weave, and
 *  at this scale that is what separates cloth from cardboard. */
export function linen(): Surface {
  const { c, x } = cv(256);
  x.fillStyle = '#efe9dc';
  x.fillRect(0, 0, 256, 256);
  x.strokeStyle = '#d9d0bd';
  x.lineWidth = 1;
  for (let i = 0; i < 256; i += 3) {
    x.globalAlpha = 0.5 + random() * 0.35;
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke();
    x.beginPath(); x.moveTo(0, i + 1.5); x.lineTo(256, i + 1.5); x.stroke();
  }
  x.globalAlpha = 1;
  noise(x, 256, 24, 0.10);
  return { map: wrap(new THREE.CanvasTexture(c), 14), normalMap: wrap(normalFrom(c, 1.1), 14) };
}

/** The veil: blue, purple and scarlet worked into the linen — Exodus 26:31. */
export function veilCloth(): Surface {
  const { c, x } = cv(256);
  x.fillStyle = '#4a3b6e';
  x.fillRect(0, 0, 256, 256);
  // The three yarns as soft bands, not stripes: hard 4px lines repeated six
  // times across a four-metre curtain were a scan-line pattern from a step
  // away, and moiré from two.
  for (let i = 0; i < 256; i += 4) {
    x.strokeStyle = i % 12 === 0 ? '#6a3550' : i % 8 === 0 ? '#3e4478' : '#52447a';
    x.globalAlpha = 0.10 + random() * 0.12;
    x.lineWidth = 3;
    x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke();
  }
  x.globalAlpha = 1;
  noise(x, 256, 30, 0.08);
  const m = wrap(new THREE.CanvasTexture(c), 6); m.anisotropy = 16;
  return { map: m, normalMap: wrap(normalFrom(c, 0.6), 6) };
}

/** An embroidered hanging: the woven ground of the veil, a border, and a
 *  repeating figure. Exodus 26:31 says the veil carries cherubim — winged
 *  figures, form otherwise undescribed, so they are drawn as no more than a
 *  body and two raised wings — while 26:36 and 27:16 say only "the work of an
 *  embroiderer" for the door and gate screens, which therefore get the border
 *  and a plain lozenge and no figure the text did not name. */
export function embroidered(withCherubim: boolean): Surface {
  const n = 1024;
  const { c, x } = cv(n);
  x.fillStyle = '#343956';
  x.fillRect(0, 0, n, n);
  // The woven ground.
  for (let i = 0; i < n; i += 4) {
    x.strokeStyle = i % 12 === 0 ? '#7d2f3d' : i % 8 === 0 ? '#2f4a7d' : '#55447c';
    x.globalAlpha = 0.12 + random() * 0.12;
    x.lineWidth = 2;
    x.beginPath(); x.moveTo(0, i); x.lineTo(n, i); x.stroke();
  }
  x.globalAlpha = 1;
  // Linen-coloured embroidery. Gold yarn is not specified for these screens.
  x.strokeStyle = '#c8b898';
  x.lineWidth = 6; x.strokeRect(18, 18, n - 36, n - 36);
  x.lineWidth = 2; x.strokeRect(34, 34, n - 68, n - 68);
  // Scarlet running motif inside the border.
  x.strokeStyle = '#9c2f3a'; x.lineWidth = 3;
  for (let i = 44; i < n - 44; i += 24) {
    x.beginPath(); x.moveTo(i, 44); x.lineTo(i + 12, 52); x.lineTo(i + 24, 44); x.stroke();
    x.beginPath(); x.moveTo(i, n - 44); x.lineTo(i + 12, n - 52); x.lineTo(i + 24, n - 44); x.stroke();
  }
  if (withCherubim) {
    // Two figures, facing each other across the centre, wings up.
    const fig = (cx: number, flip: number) => {
      x.save(); x.translate(cx, n * 0.5); x.scale(flip, 1);
      x.fillStyle = '#c8b898';
      // body
      x.beginPath(); x.ellipse(0, 20, 22, 60, 0, 0, Math.PI * 2); x.fill();
      // head
      x.beginPath(); x.arc(0, -52, 16, 0, Math.PI * 2); x.fill();
      // wings — two raised sweeps
      x.strokeStyle = '#c8b898'; x.lineWidth = 9; x.lineCap = 'round';
      x.beginPath(); x.moveTo(14, -10); x.quadraticCurveTo(70, -60, 96, -140); x.stroke();
      x.beginPath(); x.moveTo(18, 10); x.quadraticCurveTo(80, -20, 110, -90); x.stroke();
      x.restore();
    };
    x.save();x.scale(.25,.25);
    for(let r=0;r<6;r++)for(let c=0;c<4;c++){
      x.save();x.translate(c*1024+128,r*580-110);fig(100,c%2?1:-1);x.restore();
    }x.restore();
  } else {
    // A single lozenge, the plainest figure an embroiderer would set.
    for(let row=0;row<10;row++)for(let col=0;col<8;col++){
      const xx=80+col*123,yy=82+row*95;
      x.strokeStyle=(row+col)%2?'#b6a68b':'#98424a';x.lineWidth=3;
      x.beginPath();x.moveTo(xx,yy-19);x.lineTo(xx+15,yy);x.lineTo(xx,yy+19);x.lineTo(xx-15,yy);x.closePath();x.stroke();
    }
  }
  noise(x, n, 40, 0.07);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  // One figure per hanging, so the pattern is not tiled.
  return { map: t, normalMap: normalFrom(c, 1.0) };
}

/** Gold overlaid on acacia and beaten by hand — Exodus 26:29, 25:31. The
 *  undulation is what makes it read as hammered rather than machined. */
export function beatenGold(): Surface {
  const { c, x } = cv(256);
  // Near-white gold: a metal's colour comes almost entirely from what it
  // reflects, and a map darker than the metal itself only muddies it. The
  // hammer marks live in the normal map, not the colour.
  x.fillStyle = '#f0d585';
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 380; i++) {
    const r = 5 + random() * 13;
    x.save();
    x.translate(random() * 256, random() * 256);
    const grd = x.createRadialGradient(0, 0, 0, 0, 0, r);
    grd.addColorStop(0, 'rgba(255,248,220,0.18)');
    grd.addColorStop(1, 'rgba(200,160,70,0.10)');
    x.fillStyle = grd;
    x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fill();
    x.restore();
  }
  noise(x, 256, 64, 0.04);
  const rough=cv(256);rough.x.fillStyle='#c4c4c4';rough.x.fillRect(0,0,256,256);
  noise(rough.x,256,16,.24);noise(rough.x,256,110,.12);
  const roughnessMap=wrap(new THREE.CanvasTexture(rough.c),3);roughnessMap.colorSpace=THREE.NoColorSpace;
  return { map: wrap(new THREE.CanvasTexture(c), 3), normalMap: wrap(normalFrom(c, 3.0), 3), roughnessMap };
}

/** Bronze for the court's pillars and the altar — Exodus 27:2, 27:10. */
export function bronze(): Surface {
  const { c, x } = cv(256);
  // Bronze is copper with tin: orange-gold, not brown. The old base was the
  // colour of a fence post.
  x.fillStyle = '#b7966c';
  x.fillRect(0, 0, 256, 256);
  noise(x, 256, 10, 0.045);
  noise(x, 256, 70, 0.025);
  // A little verdigris in the recesses.
  for (let i = 0; i < 60; i++) {
    x.save();
    x.translate(random() * 256, random() * 256);
    const r = 4 + random() * 10;
    const g = x.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, 'rgba(70,120,100,0.035)');
    g.addColorStop(1, 'rgba(70,120,100,0)');
    x.fillStyle = g;
    x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fill();
    x.restore();
  }
  const rough=cv(256);rough.x.fillStyle='#aeaeae';rough.x.fillRect(0,0,256,256);
  noise(rough.x,256,12,.14);noise(rough.x,256,90,.04);
  // Irregular rubbed strokes, not embossed decoration claimed by the text.
  for(let i=0;i<160;i++){
    rough.x.strokeStyle=`rgba(235,235,235,${.1+random()*.2})`;rough.x.lineWidth=.35+random();
    const px=random()*256,py=random()*256;rough.x.beginPath();rough.x.moveTo(px,py);
    rough.x.lineTo(px+(random()-.5)*35,py+random()*8);rough.x.stroke();
  }
  const roughnessMap=wrap(new THREE.CanvasTexture(rough.c),2);roughnessMap.colorSpace=THREE.NoColorSpace;
  return { map: wrap(new THREE.CanvasTexture(c), 2), normalMap: wrap(normalFrom(c, 1.8), 2), roughnessMap };
}

/** The outermost covering of the tent — "a covering of ram skins dyed red,
 *  and over that a covering of the hides of sea cows" (26:14). From outside,
 *  this is what the tabernacle looked like: dark leather, not gold. */
export function hide(): Surface {
  const { c, x } = cv(256);
  x.fillStyle = '#77624b';
  x.fillRect(0, 0, 256, 256);
  noise(x, 256, 8, 0.22);
  noise(x, 256, 40, 0.16);
  noise(x, 256, 140, 0.08);
  // Seams where the skins were sewn together.
  x.strokeStyle = 'rgba(30,20,14,0.5)';
  x.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const y = 32 + i * 64 + (random() - 0.5) * 8;
    x.beginPath(); x.moveTo(0, y); x.lineTo(256, y); x.stroke();
  }
  return { map: wrap(new THREE.CanvasTexture(c), 5), normalMap: wrap(normalFrom(c, 1.6), 5) };
}

/** Goat hair, the second covering (26:7) — dark, coarse, visible at the edges
 *  where it hangs below the hides. */
export function goatHair(): Surface {
  const { c, x } = cv(256);
  x.fillStyle = '#3a3129';
  x.fillRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(90,75,60,0.5)';
  x.lineWidth = 1;
  for (let i = 0; i < 700; i++) {
    const X = random() * 256, Y = random() * 256;
    x.beginPath(); x.moveTo(X, Y); x.lineTo(X + (random() - 0.5) * 4, Y + 6 + random() * 10); x.stroke();
  }
  noise(x, 256, 30, 0.10);
  return { map: wrap(new THREE.CanvasTexture(c), 6), normalMap: wrap(normalFrom(c, 1.3), 6) };
}

/** Jerusalem limestone ashlar — the stone the house is built of (1 Kgs 6:7).
 *  Courses of dressed blocks, warm pale, with joint shadow so the wall reads
 *  as masonry rather than a painted plane. */
export function ashlarStone(): Surface {
  const n = 512;
  const { c, x } = cv(n);
  x.fillStyle = '#d8cbb0';
  x.fillRect(0, 0, n, n);
  noise(x, n, 28, 0.05);
  noise(x, n, 90, 0.04);
  // Courses. Block length varies; joint lines are darker, never black.
  const course = 64;
  for (let row = 0; row < n / course; row++) {
    const y = row * course;
    x.strokeStyle = 'rgba(92,78,58,0.45)';
    x.lineWidth = 2;
    x.beginPath(); x.moveTo(0, y + 1); x.lineTo(n, y + 1); x.stroke();
    const offset = row % 2 ? 70 : 0;
    for (let bx = -offset; bx < n; bx += 120 + (row % 3) * 18) {
      x.strokeStyle = 'rgba(92,78,58,0.35)';
      x.lineWidth = 2;
      x.beginPath(); x.moveTo(bx, y); x.lineTo(bx, y + course); x.stroke();
      // Slight face variation per block.
      x.fillStyle = `rgba(${190 + random() * 40},${175 + random() * 35},${145 + random() * 30},0.12)`;
      x.fillRect(bx + 2, y + 2, 110, course - 4);
    }
  }
  return { map: wrap(new THREE.CanvasTexture(c), 8), normalMap: wrap(normalFrom(c, 2.4), 8) };
}

/** Cedar boards for the interior overlay — "he covered the house with pure
 *  gold" after cedar (1 Kgs 6:20-22), boards of fir/cypress and cedar. */
export function cedarWood(): Surface {
  const n = 256;
  const { c, x } = cv(n);
  x.fillStyle = '#8a6a3e';
  x.fillRect(0, 0, n, n);
  // Long grain along Y so a tall wall does not stretch the grain sideways.
  for (let i = 0; i < 220; i++) {
    const X = random() * n;
    const alpha = 0.08 + random() * 0.18;
    x.strokeStyle = `rgba(52,32,16,${alpha})`;
    x.lineWidth = 0.6 + random() * 1.8;
    x.beginPath();
    const wobble = 2 + random() * 6;
    x.moveTo(X, 0);
    x.bezierCurveTo(X + wobble, n * 0.3, X - wobble, n * 0.7, X + (random() - 0.5) * 4, n);
    x.stroke();
  }
  noise(x, n, 20, 0.08);
  return { map: wrap(new THREE.CanvasTexture(c), 6), normalMap: wrap(normalFrom(c, 1.5), 6) };
}

/** Olive wood for the doors — 1 Kgs 6:31-33. Warmer and tighter than cedar. */
export function oliveWood(): Surface {
  const n = 256;
  const { c, x } = cv(n);
  x.fillStyle = '#a07848';
  x.fillRect(0, 0, n, n);
  for (let i = 0; i < 180; i++) {
    const X = random() * n;
    x.strokeStyle = `rgba(70,42,20,${0.1 + random() * 0.16})`;
    x.lineWidth = 0.5 + random() * 1.2;
    x.beginPath();
    x.moveTo(X, 0);
    x.bezierCurveTo(X + (random() - 0.5) * 8, n * 0.4, X + (random() - 0.5) * 8, n * 0.7, X, n);
    x.stroke();
  }
  noise(x, n, 28, 0.06);
  return { map: wrap(new THREE.CanvasTexture(c), 5), normalMap: wrap(normalFrom(c, 1.2), 5) };
}

/** A desert sky as an equirectangular strip: deep above, bleached at the
 *  horizon. It replaces the studio environment the scene was lit by, which is
 *  why the gold read as showroom metal rather than sun. */
export function desertSky(): THREE.CanvasTexture {
  // Two to one, as an equirectangular map is; a square one stretches the
  // clouds into bands.
  const c = document.createElement('canvas');
  c.width = 2048; c.height = 1024;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 0, 1024);
  g.addColorStop(0.00, '#2f5b8c');
  g.addColorStop(0.34, '#7fa3c4');
  g.addColorStop(0.49, '#cfd6d2');
  g.addColorStop(0.52, '#c6b492');
  g.addColorStop(1.00, '#8d7c5e');
  x.fillStyle = g;
  x.fillRect(0, 0, 2048, 1024);
  noise(x, 2048, 8, 0.05);
  // Thin high cloud in the upper band: a sky with nothing in it reads as a
  // gradient, not a sky.
  x.globalCompositeOperation = 'lighter';
  // Each cloud is painted three times, a full width apart, so the map wraps
  // without a seam — the seam stood as a bright vertical line in the sky.
  for (let i = 0; i < 40; i++) {
    const cx0 = random() * 2048, cy = 80 + random() * 300;
    const rx = 80 + random() * 220, ry = 8 + random() * 20;
    for (const cx of [cx0 - 2048, cx0, cx0 + 2048]) {
      const cg = x.createRadialGradient(cx, cy, 0, cx, cy, rx);
      cg.addColorStop(0, 'rgba(255,255,255,0.08)');
      cg.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = cg;
      x.save(); x.translate(cx, cy); x.scale(1, ry / rx); x.translate(-cx, -cy);
      x.beginPath(); x.arc(cx, cy, rx, 0, Math.PI * 2); x.fill();
      x.restore();
    }
  }
  x.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ── Solomon's temple ────────────────────────────────────────────────────
// 1 Kings 6:29: "内殿、外殿周围的墙上，都刻着基路伯、棕树，和初开的花" — on the
// walls of BOTH rooms, carved cherubim, palm trees and open flowers, and all
// of it overlaid with gold (6:22). The forms are not described beyond their
// names, so the relief is drawn as no more than a palm, a winged figure and a
// rosette — authored silhouettes, not recovered art — and lives in the NORMAL
// map, where a carving lives: the colour stays gold and the light finds the
// figure. A figure two metres tall in the wall, at the scale a carver would
// have worked in a room ten metres high.

/** A height field, white where the carving stands proud, on which the
 *  relief motifs are drawn; the normal map is derived from it. */
function reliefCanvas(n: number, draw: (x: CanvasRenderingContext2D, n: number) => void) {
  const { c, x } = cv(n);
  x.fillStyle = '#808080';
  x.fillRect(0, 0, n, n);
  draw(x, n);
  // Soften the edges so the relief reads as carved and bevelled rather than
  // stamped: a two-pass blur of the height field.
  const blurred = cv(n);
  blurred.x.filter = 'blur(2px)';
  blurred.x.drawImage(c, 0, 0);
  return blurred.c;
}

const palm = (x: CanvasRenderingContext2D, cx: number, base: number, h: number) => {
  // Trunk, tapered, with the ring marks of a date palm.
  x.fillStyle = '#c8c8c8';
  x.beginPath();
  x.moveTo(cx - h * 0.045, base);
  x.lineTo(cx + h * 0.045, base);
  x.lineTo(cx + h * 0.025, base - h * 0.62);
  x.lineTo(cx - h * 0.025, base - h * 0.62);
  x.closePath(); x.fill();
  x.strokeStyle = '#9a9a9a'; x.lineWidth = 2;
  for (let i = 1; i < 14; i++) {
    const y = base - (h * 0.62) * (i / 14);
    x.beginPath(); x.moveTo(cx - h * 0.04, y); x.lineTo(cx + h * 0.04, y); x.stroke();
  }
  // Fronds: nine, fanned from the crown, each a tapered leaf with a midrib.
  const crownY = base - h * 0.62;
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.36;
    const len = h * (0.30 - Math.abs(i - 4) * 0.02);
    x.save(); x.translate(cx, crownY); x.rotate(a);
    x.fillStyle = '#d6d6d6';
    x.beginPath();
    x.moveTo(0, 0);
    x.quadraticCurveTo(len * 0.5, -len * 0.09, len, 0);
    x.quadraticCurveTo(len * 0.5, len * 0.09, 0, 0);
    x.fill();
    x.strokeStyle = '#9a9a9a'; x.lineWidth = 1.5;
    x.beginPath(); x.moveTo(0, 0); x.lineTo(len, 0); x.stroke();
    x.restore();
  }
};

const cherubRelief = (x: CanvasRenderingContext2D, cx: number, base: number, h: number) => {
  // A standing winged figure: robe, head, two raised wings with feather
  // lines. No face, no dress detail — the text names the creature and
  // nothing about its appearance.
  x.fillStyle = '#cfcfcf';
  x.beginPath();
  x.moveTo(cx - h * 0.09, base);
  x.lineTo(cx + h * 0.09, base);
  x.lineTo(cx + h * 0.05, base - h * 0.55);
  x.lineTo(cx - h * 0.05, base - h * 0.55);
  x.closePath(); x.fill();
  x.beginPath(); x.arc(cx, base - h * 0.62, h * 0.06, 0, Math.PI * 2); x.fill();
  for (const s of [-1, 1]) {
    x.save(); x.translate(cx, base - h * 0.5); x.scale(s, 1);
    x.fillStyle = '#dedede';
    x.beginPath();
    x.moveTo(h * 0.04, 0);
    x.quadraticCurveTo(h * 0.22, -h * 0.30, h * 0.30, -h * 0.62);
    x.quadraticCurveTo(h * 0.20, -h * 0.40, h * 0.06, -h * 0.12);
    x.closePath(); x.fill();
    x.strokeStyle = '#a8a8a8'; x.lineWidth = 1.5;
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      x.beginPath();
      x.moveTo(h * 0.05 + t * h * 0.02, -t * h * 0.12);
      x.lineTo(h * 0.10 + t * h * 0.19, -t * h * 0.60);
      x.stroke();
    }
    x.restore();
  }
};

const rosette = (x: CanvasRenderingContext2D, cx: number, cy: number, r: number) => {
  // "初开的花" — an open flower: eight petals round a boss.
  x.fillStyle = '#d2d2d2';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    x.save(); x.translate(cx, cy); x.rotate(a);
    x.beginPath(); x.ellipse(r * 0.55, 0, r * 0.45, r * 0.2, 0, 0, Math.PI * 2); x.fill();
    x.restore();
  }
  x.fillStyle = '#e4e4e4';
  x.beginPath(); x.arc(cx, cy, r * 0.22, 0, Math.PI * 2); x.fill();
};

/** The carved and gilded wall of the house — 6:29 in relief, 6:22 in
 *  colour. One tile is one palm and one cherub between two bands of open
 *  flowers; `worldMetres` is how wide that tile stands on the wall, so the
 *  figures are carved at a human scale whatever the wall's size. bevelBox
 *  maps two texture units to the metre, which the repeat accounts for. */
export function carvedGold(worldMetres = 2.6): Surface {
  const n = 1024;
  const height = reliefCanvas(n, (x) => {
    palm(x, n * 0.26, n * 0.80, n * 0.58);
    cherubRelief(x, n * 0.74, n * 0.80, n * 0.58);
    for (let i = 0; i < 6; i++) {
      rosette(x, n * (0.09 + i * 0.164), n * 0.09, n * 0.055);
      rosette(x, n * (0.09 + i * 0.164), n * 0.91, n * 0.055);
    }
  });
  // Colour: the beaten-gold ground, with the relief faintly warmer where it
  // stands proud so the carving reads even where the light is flat.
  const { c, x } = cv(n);
  x.fillStyle = '#efd484';
  x.fillRect(0, 0, n, n);
  for (let i = 0; i < 900; i++) {
    const r = 6 + random() * 18;
    x.save(); x.translate(random() * n, random() * n);
    const grd = x.createRadialGradient(0, 0, 0, 0, 0, r);
    grd.addColorStop(0, 'rgba(255,248,222,0.16)');
    grd.addColorStop(1, 'rgba(196,156,66,0.10)');
    x.fillStyle = grd;
    x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fill();
    x.restore();
  }
  x.globalAlpha = 0.28;
  x.globalCompositeOperation = 'multiply';
  x.drawImage(height, 0, 0);
  x.globalAlpha = 1;
  x.globalCompositeOperation = 'source-over';
  noise(x, n, 48, 0.04);
  const repeat = 1 / (worldMetres * 2);
  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(repeat, repeat);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const normalMap = normalFrom(height, 6.5);
  normalMap.repeat.set(repeat, repeat); normalMap.anisotropy = 8;
  const rough = cv(256); rough.x.fillStyle = '#b4b4b4'; rough.x.fillRect(0, 0, 256, 256);
  noise(rough.x, 256, 14, 0.22); noise(rough.x, 256, 96, 0.10);
  const roughnessMap = wrap(new THREE.CanvasTexture(rough.c), 3); roughnessMap.colorSpace = THREE.NoColorSpace;
  return { map, normalMap, roughnessMap };
}

/** The floor of the house: boards of cypress (6:15) overlaid with gold
 *  (6:30). Plank seams in the gold, so the floor reads as boards under leaf
 *  rather than as a poured metal sheet. */
export function goldPlanks(): Surface {
  const n = 512;
  const { c, x } = cv(n);
  x.fillStyle = '#ecd07e';
  x.fillRect(0, 0, n, n);
  for (let i = 0; i < 500; i++) {
    const r = 4 + random() * 12;
    x.save(); x.translate(random() * n, random() * n);
    const grd = x.createRadialGradient(0, 0, 0, 0, 0, r);
    grd.addColorStop(0, 'rgba(255,246,214,0.14)');
    grd.addColorStop(1, 'rgba(190,150,60,0.09)');
    x.fillStyle = grd;
    x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fill();
    x.restore();
  }
  // Boards a cubit and a half wide, running the length of the house.
  const height = reliefCanvas(n, (hx) => {
    hx.strokeStyle = '#3c3c3c'; hx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const y = i * (n / 4) + 2;
      hx.beginPath(); hx.moveTo(0, y); hx.lineTo(n, y); hx.stroke();
      // Staggered board ends.
      const bx = (i % 2 ? n * 0.3 : n * 0.75);
      hx.beginPath(); hx.moveTo(bx, y); hx.lineTo(bx, y + n / 4); hx.stroke();
    }
  });
  x.globalAlpha = 0.35; x.globalCompositeOperation = 'multiply';
  x.drawImage(height, 0, 0);
  x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  noise(x, n, 40, 0.05);
  // Four boards per tile, boards 0.67 m wide: a tile is 2.67 m.
  const repeat = 1 / (2.67 * 2);
  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(repeat, repeat);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const normalMap = normalFrom(height, 4.0);
  normalMap.repeat.set(repeat, repeat); normalMap.anisotropy = 8;
  const rough = cv(256); rough.x.fillStyle = '#b8b8b8'; rough.x.fillRect(0, 0, 256, 256);
  noise(rough.x, 256, 16, 0.2); noise(rough.x, 256, 100, 0.1);
  const roughnessMap = wrap(new THREE.CanvasTexture(rough.c), 3); roughnessMap.colorSpace = THREE.NoColorSpace;
  return { map, normalMap, roughnessMap };
}

/** A laver base's panel — 7:29 "心子上有狮子和牛，并基路伯": a lion, an ox and
 *  a cherub in relief on cast bronze, with the pendant wreaths (璎珞) below.
 *  Silhouettes only; the text names the animals and nothing of their pose. */
export function bronzePanel(): Surface {
  const n = 512;
  const height = reliefCanvas(n, (x) => {
    // Frame.
    x.strokeStyle = '#d0d0d0'; x.lineWidth = 14;
    x.strokeRect(22, 22, n - 44, n - 44);
    // Lion, left: a body, a maned head, a raised tail.
    x.fillStyle = '#cdcdcd';
    x.beginPath(); x.ellipse(n * 0.22, n * 0.5, n * 0.11, n * 0.06, 0, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(n * 0.33, n * 0.44, n * 0.06, 0, Math.PI * 2); x.fill();
    for (let i = 0; i < 4; i++) { x.fillRect(n * (0.13 + i * 0.05), n * 0.53, n * 0.02, n * 0.09); }
    x.strokeStyle = '#cdcdcd'; x.lineWidth = 5;
    x.beginPath(); x.moveTo(n * 0.11, n * 0.48); x.quadraticCurveTo(n * 0.04, n * 0.36, n * 0.08, n * 0.30); x.stroke();
    // Ox, centre: heavier body, horns.
    x.fillStyle = '#cdcdcd';
    x.beginPath(); x.ellipse(n * 0.52, n * 0.52, n * 0.12, n * 0.075, 0, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.ellipse(n * 0.65, n * 0.47, n * 0.05, n * 0.045, 0, 0, Math.PI * 2); x.fill();
    for (let i = 0; i < 4; i++) { x.fillRect(n * (0.43 + i * 0.055), n * 0.57, n * 0.022, n * 0.08); }
    x.lineWidth = 4;
    x.beginPath(); x.moveTo(n * 0.66, n * 0.43); x.lineTo(n * 0.70, n * 0.36); x.stroke();
    x.beginPath(); x.moveTo(n * 0.62, n * 0.43); x.lineTo(n * 0.60, n * 0.36); x.stroke();
    // Cherub, right.
    cherubRelief(x, n * 0.84, n * 0.66, n * 0.42);
    // Pendant wreaths along the bottom — 7:29.
    x.strokeStyle = '#c4c4c4'; x.lineWidth = 6;
    for (let i = 0; i < 6; i++) {
      const x0 = n * (0.10 + i * 0.135);
      x.beginPath(); x.moveTo(x0, n * 0.80); x.quadraticCurveTo(x0 + n * 0.067, n * 0.90, x0 + n * 0.135, n * 0.80); x.stroke();
    }
  });
  const { c, x } = cv(n);
  x.fillStyle = '#b7966c';
  x.fillRect(0, 0, n, n);
  noise(x, n, 10, 0.05); noise(x, n, 70, 0.03);
  x.globalAlpha = 0.3; x.globalCompositeOperation = 'multiply';
  x.drawImage(height, 0, 0);
  x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
  const normalMap = normalFrom(height, 5.0);
  normalMap.wrapS = normalMap.wrapT = THREE.ClampToEdgeWrapping;
  return { map, normalMap };
}
