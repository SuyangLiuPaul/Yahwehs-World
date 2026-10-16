// Generates public/icon.svg, public/loading-globe.svg, and brand/icon.svg
// from the canonical Lion & Lamb emblem at public/logo.png.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const b64 = readFileSync(join(ROOT, 'public/logo.png')).toString('base64');

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <image width="512" height="512" href="data:image/png;base64,${b64}"/>
</svg>
`;

const loadingSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 560" width="560" height="560">
  <defs>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f6d365" stop-opacity="0.42"/>
      <stop offset="65%" stop-color="#3ba3f8" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#0b1f36" stop-opacity="0"/>
    </radialGradient>
    <style>
      @keyframes floatGlow {
        0%, 100% { transform: translateY(0px) scale(1); }
        50% { transform: translateY(-6px) scale(1.02); }
      }
      .emblem { transform-origin: 280px 280px; animation: floatGlow 3.2s ease-in-out infinite; }
    </style>
  </defs>
  <circle cx="280" cy="280" r="270" fill="url(#halo)"/>
  <g class="emblem">
    <image x="24" y="24" width="512" height="512" href="data:image/png;base64,${b64}"/>
  </g>
</svg>
`;

mkdirSync(join(ROOT, 'brand'), { recursive: true });
writeFileSync(join(ROOT, 'brand/icon.svg'), iconSvg);
writeFileSync(join(ROOT, 'public/icon.svg'), iconSvg);
writeFileSync(join(ROOT, 'public/loading-globe.svg'), loadingSvg);
console.log('build-icon: updated brand/icon.svg, public/icon.svg, public/loading-globe.svg from public/logo.png');
