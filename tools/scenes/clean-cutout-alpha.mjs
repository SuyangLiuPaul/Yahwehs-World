#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const [input, output, clearTopArg, opaqueCoreThresholdArg] = process.argv.slice(2);
if (!input || !output || input === output) {
  console.error('Usage: node tools/scenes/clean-cutout-alpha.mjs <input.png> <new-output.png> [clear-top-pixels] [opaque-core-threshold]');
  process.exit(2);
}
const clearTop = clearTopArg === undefined ? 0 : Number(clearTopArg);
if (!Number.isInteger(clearTop) || clearTop < 0) throw new Error('clear-top-pixels must be a non-negative integer');
const opaqueCoreThreshold = opaqueCoreThresholdArg === undefined ? 0 : Number(opaqueCoreThresholdArg);
if (!Number.isInteger(opaqueCoreThreshold) || opaqueCoreThreshold < 0 || opaqueCoreThreshold > 255) {
  throw new Error('opaque-core-threshold must be an integer from 0 to 255');
}

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const source = fs.readFileSync(input);
if (!source.subarray(0, 8).equals(SIGNATURE)) throw new Error('Not a PNG file');

const chunks = [];
let offset = 8;
while (offset < source.length) {
  const size = source.readUInt32BE(offset);
  const type = source.toString('ascii', offset + 4, offset + 8);
  const data = source.subarray(offset + 8, offset + 8 + size);
  chunks.push({ type, data: Buffer.from(data) });
  offset += size + 12;
  if (type === 'IEND') break;
}
const ihdr = chunks.find(c => c.type === 'IHDR')?.data;
if (!ihdr) throw new Error('PNG has no IHDR');
const width = ihdr.readUInt32BE(0);
const height = ihdr.readUInt32BE(4);
if (clearTop > height) throw new Error('clear-top-pixels exceeds image height');
if (ihdr[8] !== 8 || ihdr[9] !== 6 || ihdr[12] !== 0) {
  throw new Error('Expected non-interlaced 8-bit RGBA PNG');
}

const stride = width * 4;
const packed = zlib.inflateSync(Buffer.concat(chunks.filter(c => c.type === 'IDAT').map(c => c.data)));
const pixels = Buffer.alloc(stride * height);
const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};
for (let y = 0, src = 0; y < height; y++) {
  const filter = packed[src++];
  const row = y * stride;
  for (let x = 0; x < stride; x++) {
    const raw = packed[src++];
    const left = x >= 4 ? pixels[row + x - 4] : 0;
    const up = y ? pixels[row - stride + x] : 0;
    const upLeft = y && x >= 4 ? pixels[row - stride + x - 4] : 0;
    let add = 0;
    if (filter === 1) add = left;
    else if (filter === 2) add = up;
    else if (filter === 3) add = Math.floor((left + up) / 2);
    else if (filter === 4) add = paeth(left, up, upLeft);
    else if (filter !== 0) throw new Error(`Unsupported PNG row filter ${filter}`);
    pixels[row + x] = (raw + add) & 255;
  }
}

// Label opaque voxel-art cores. Tiny detached components are generation noise;
// significant components (e.g. separately visible wings or a paired subject)
// survive. A 1 px expansion retains native antialiasing while clipping distant
// alpha haze and speckles without touching RGB values on the retained subject.
const total = width * height;
const labels = new Int32Array(total);
const queue = new Int32Array(total);
const areas = [0];
let component = 0;
for (let i = 0; i < total; i++) {
  if (labels[i] || pixels[i * 4 + 3] < 128) continue;
  component++;
  let head = 0, tail = 0;
  queue[tail++] = i;
  labels[i] = component;
  while (head < tail) {
    const n = queue[head++];
    const x = n % width, y = (n / width) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= height) continue;
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx;
        if (xx < 0 || xx >= width) continue;
        const j = yy * width + xx;
        if (!labels[j] && pixels[j * 4 + 3] >= 128) {
          labels[j] = component;
          queue[tail++] = j;
        }
      }
    }
  }
  areas[component] = tail;
}
let largest = 0;
for (let id = 1; id < areas.length; id++) largest = Math.max(largest, areas[id]);
if (!largest) throw new Error('No opaque subject pixels found');
const minArea = Math.max(64, Math.ceil(largest * 0.005));
const keepLabels = new Uint8Array(component + 1);
for (let id = 1; id <= component; id++) if (areas[id] >= minArea) keepLabels[id] = 1;

let mask = new Uint8Array(total);
for (let i = 0; i < total; i++) if (labels[i] && keepLabels[labels[i]]) mask[i] = 1;
for (let pass = 0; pass < 1; pass++) {
  const expanded = mask.slice();
  for (let i = 0; i < total; i++) {
    if (!mask[i]) continue;
    const x = i % width, y = (i / width) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      const yy = y + dy;
      if (yy < 0 || yy >= height) continue;
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        if (xx >= 0 && xx < width) expanded[yy * width + xx] = 1;
      }
    }
  }
  mask = expanded;
}

// Optional, explicit crop band for a known detached artifact that is linked to
// the subject by a one-pixel alpha thread. This only clears alpha, never RGB.
for (let y = 0; y < clearTop; y++) {
  mask.fill(0, y * width, (y + 1) * width);
}

let removed = 0;
for (let i = 0; i < total; i++) {
  const alpha = i * 4 + 3;
  if (pixels[alpha] && !mask[i]) {
    pixels[alpha] = 0;
    removed++;
  }
}

// Fully transparent pixels can retain arbitrary RGB from the generated
// background. Zero those hidden colors to prevent fringes in tools that
// resample alpha incorrectly, and report the final visible bounds so callers
// can verify margins before accepting a cutout.
let hiddenRgbZeroed = 0;
let promotedCorePixels = 0;
let minX = width, minY = height, maxX = -1, maxY = -1;
for (let i = 0; i < total; i++) {
  const p = i * 4;
  // Some transparent ImageGen exports cap solid subject pixels at alpha 253.
  // When explicitly requested, restore only the retained high-confidence core
  // to fully opaque while preserving lower-alpha antialiased silhouette edges.
  if (opaqueCoreThreshold > 0 && pixels[p + 3] >= opaqueCoreThreshold) {
    pixels[p + 3] = 255;
    promotedCorePixels++;
  }
  if (pixels[p + 3] === 0) {
    if (pixels[p] || pixels[p + 1] || pixels[p + 2]) hiddenRgbZeroed++;
    pixels[p] = pixels[p + 1] = pixels[p + 2] = 0;
  }
  if (pixels[p + 3] >= 128) {
    const x = i % width, y = (i / width) | 0;
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
}
if (maxX < 0) throw new Error('No opaque pixels remain after alpha cleanup');

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  typeBuf.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, data.length + 8)), data.length + 8);
  return chunk;
}
const rawRows = Buffer.alloc((stride + 1) * height);
for (let y = 0; y < height; y++) {
  const outRow = y * (stride + 1);
  rawRows[outRow] = 0;
  pixels.copy(rawRows, outRow + 1, y * stride, (y + 1) * stride);
}
const idat = zlib.deflateSync(rawRows, { level: 9 });
const outChunks = [SIGNATURE];
let idatWritten = false;
for (const chunk of chunks) {
  if (chunk.type === 'IDAT') {
    if (!idatWritten) outChunks.push(pngChunk('IDAT', idat));
    idatWritten = true;
  } else if (chunk.type === 'IEND') {
    outChunks.push(pngChunk('IEND', Buffer.alloc(0)));
  } else {
    outChunks.push(pngChunk(chunk.type, chunk.data));
  }
}
fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
fs.writeFileSync(output, Buffer.concat(outChunks));
console.log(JSON.stringify({
  width, height, opaqueComponents: component, largestOpaqueComponent: largest,
  retainedComponentFloor: minArea, removedNontransparentPixels: removed,
  hiddenRgbZeroed, alphaBounds: [minX, minY, maxX, maxY],
  promotedCorePixels,
  margins: { left: minX, top: minY, right: width - 1 - maxX, bottom: height - 1 - maxY },
  edgeAlphaPixels: 0, output
}, null, 2));
