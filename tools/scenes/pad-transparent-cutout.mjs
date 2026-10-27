#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const [input, output, ...paddingArgs] = process.argv.slice(2);
if (!input || !output || paddingArgs.length !== 4) {
  console.error('Usage: node tools/scenes/pad-transparent-cutout.mjs <input.png> <output.png> <left> <top> <right> <bottom>');
  process.exit(2);
}
const [left, top, right, bottom] = paddingArgs.map(Number);
if (![left, top, right, bottom].every(value => Number.isInteger(value) && value >= 0)) {
  throw new Error('Padding values must be non-negative integers');
}
if (path.resolve(input) === path.resolve(output)) throw new Error('Input and output must differ');

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const source = fs.readFileSync(input);
if (!source.subarray(0, 8).equals(signature)) throw new Error('Input is not a PNG');
const chunks = [];
for (let offset = 8; offset < source.length;) {
  const length = source.readUInt32BE(offset);
  const type = source.toString('ascii', offset + 4, offset + 8);
  chunks.push({ type, data: Buffer.from(source.subarray(offset + 8, offset + 8 + length)) });
  offset += length + 12;
  if (type === 'IEND') break;
}
const ihdr = chunks.find(chunk => chunk.type === 'IHDR')?.data;
if (!ihdr || ihdr[8] !== 8 || ihdr[9] !== 6 || ihdr[12] !== 0) {
  throw new Error('Expected a non-interlaced 8-bit RGBA PNG');
}
const width = ihdr.readUInt32BE(0);
const height = ihdr.readUInt32BE(4);
const stride = width * 4;
const packed = zlib.inflateSync(Buffer.concat(chunks.filter(chunk => chunk.type === 'IDAT').map(chunk => chunk.data)));
const pixels = Buffer.alloc(stride * height);
const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};
for (let y = 0, cursor = 0; y < height; y++) {
  const filter = packed[cursor++];
  const row = y * stride;
  for (let x = 0; x < stride; x++) {
    const raw = packed[cursor++];
    const a = x >= 4 ? pixels[row + x - 4] : 0;
    const b = y ? pixels[row - stride + x] : 0;
    const c = y && x >= 4 ? pixels[row - stride + x - 4] : 0;
    let predictor = 0;
    if (filter === 1) predictor = a;
    else if (filter === 2) predictor = b;
    else if (filter === 3) predictor = Math.floor((a + b) / 2);
    else if (filter === 4) predictor = paeth(a, b, c);
    else if (filter !== 0) throw new Error(`Unsupported PNG row filter: ${filter}`);
    pixels[row + x] = (raw + predictor) & 255;
  }
}

const newWidth = width + left + right;
const newHeight = height + top + bottom;
const newStride = newWidth * 4;
const padded = Buffer.alloc(newStride * newHeight);
for (let y = 0; y < height; y++) {
  pixels.copy(padded, (y + top) * newStride + left * 4, y * stride, (y + 1) * stride);
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  let crc = 0xffffffff;
  for (const byte of chunk.subarray(4, data.length + 8)) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, data.length + 8);
  return chunk;
}
const rawRows = Buffer.alloc((newStride + 1) * newHeight);
for (let y = 0; y < newHeight; y++) {
  const target = y * (newStride + 1);
  rawRows[target] = 0;
  padded.copy(rawRows, target + 1, y * newStride, (y + 1) * newStride);
}
const outputIhdr = Buffer.from(ihdr);
outputIhdr.writeUInt32BE(newWidth, 0);
outputIhdr.writeUInt32BE(newHeight, 4);
const outputChunks = [signature];
let wroteData = false;
for (const chunk of chunks) {
  if (chunk.type === 'IHDR') outputChunks.push(pngChunk('IHDR', outputIhdr));
  else if (chunk.type === 'IDAT') {
    if (!wroteData) outputChunks.push(pngChunk('IDAT', zlib.deflateSync(rawRows, { level: 9 })));
    wroteData = true;
  } else if (chunk.type !== 'IEND') outputChunks.push(pngChunk(chunk.type, chunk.data));
  else outputChunks.push(pngChunk('IEND', Buffer.alloc(0)));
}
fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
fs.writeFileSync(output, Buffer.concat(outputChunks));
console.log(JSON.stringify({ input: path.resolve(input), output: path.resolve(output), sourceSize: [width, height], outputSize: [newWidth, newHeight], padding: { left, top, right, bottom }, pixelContentResampled: false }, null, 2));
