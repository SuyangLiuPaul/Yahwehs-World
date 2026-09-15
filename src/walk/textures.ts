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
  return { c, x: c.getContext('2d')! };
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
  const sd = src.getContext('2d')!.getImageData(0, 0, n, n).data;
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
