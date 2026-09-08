import * as THREE from 'three';

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
  const step = n / cells;
  const grid: number[][] = [];
  for (let j = 0; j <= cells; j++) {
    grid[j] = [];
    for (let i = 0; i <= cells; i++) grid[j]![i] = Math.random();
  }
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) grid[j]![cells] = grid[j]![0]!;
  for (let i = 0; i <= cells; i++) grid[cells]![i] = grid[0]![i]!;

  const img = x.getImageData(0, 0, n, n);
  const sm = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < n; y++) {
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

export interface Surface { map: THREE.Texture; normalMap: THREE.Texture }

/** Desert floor: fine grain over broad drift, the whole thing warm. */
export function sand(): Surface {
  const { c, x } = cv(512);
  x.fillStyle = '#a8906a';
  x.fillRect(0, 0, 512, 512);
  // Tight grain, not broad blotches: a low cell count over a texture repeated
  // sixty times reads as cloud shadow rather than sand.
  noise(x, 512, 20, 0.16);
  noise(x, 512, 90, 0.20);
  noise(x, 512, 260, 0.14);
  return { map: wrap(new THREE.CanvasTexture(c), 60), normalMap: wrap(normalFrom(c, 1.9), 60) };
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
    x.globalAlpha = 0.5 + Math.random() * 0.35;
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
  for (let i = 0; i < 256; i += 4) {
    x.strokeStyle = i % 12 === 0 ? '#7d2f3d' : i % 8 === 0 ? '#2f4a7d' : '#55447c';
    x.globalAlpha = 0.35 + Math.random() * 0.3;
    x.lineWidth = 2;
    x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke();
  }
  x.globalAlpha = 1;
  noise(x, 256, 30, 0.10);
  return { map: wrap(new THREE.CanvasTexture(c), 6), normalMap: wrap(normalFrom(c, 1.0), 6) };
}

/** Gold overlaid on acacia and beaten by hand — Exodus 26:29, 25:31. The
 *  undulation is what makes it read as hammered rather than machined. */
export function beatenGold(): Surface {
  const { c, x } = cv(256);
  x.fillStyle = '#c8a33a';
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 340; i++) {
    const r = 5 + Math.random() * 13;
    const g = x.createRadialGradient(Math.random() * 256, Math.random() * 256, 0, 0, 0, r);
    x.save();
    x.translate(Math.random() * 256, Math.random() * 256);
    const grd = x.createRadialGradient(0, 0, 0, 0, 0, r);
    grd.addColorStop(0, 'rgba(255,236,175,0.20)');
    grd.addColorStop(1, 'rgba(140,105,20,0.14)');
    x.fillStyle = grd;
    x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fill();
    x.restore();
    void g;
  }
  noise(x, 256, 64, 0.06);
  return { map: wrap(new THREE.CanvasTexture(c), 3), normalMap: wrap(normalFrom(c, 2.6), 3) };
}

/** Bronze for the court's pillars and the altar — Exodus 27:2, 27:10. */
export function bronze(): Surface {
  const { c, x } = cv(256);
  x.fillStyle = '#8a6a3a';
  x.fillRect(0, 0, 256, 256);
  noise(x, 256, 10, 0.30);
  noise(x, 256, 70, 0.16);
  return { map: wrap(new THREE.CanvasTexture(c), 2), normalMap: wrap(normalFrom(c, 1.8), 2) };
}

/** A desert sky as an equirectangular strip: deep above, bleached at the
 *  horizon. It replaces the studio environment the scene was lit by, which is
 *  why the gold read as showroom metal rather than sun. */
export function desertSky(): THREE.CanvasTexture {
  const { c, x } = cv(1024);
  const g = x.createLinearGradient(0, 0, 0, 1024);
  g.addColorStop(0.00, '#2f5b8c');
  g.addColorStop(0.34, '#7fa3c4');
  g.addColorStop(0.49, '#cfd6d2');
  g.addColorStop(0.52, '#c6b492');
  g.addColorStop(1.00, '#8d7c5e');
  x.fillStyle = g;
  x.fillRect(0, 0, 1024, 1024);
  noise(x, 1024, 8, 0.05);
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
