import * as THREE from 'three';
import { PALETTE } from './grid.ts';

// THE BLOCK ITSELF — WHICH IS WHERE MINECRAFT'S LOOK ACTUALLY COMES FROM.
//
// Every block in this scene was one flat colour per face. Measured against
// the picture we are chasing, that showed up as three numbers: one 32-pixel
// tile in six was a single solid colour (theirs: one in a hundred and sixty),
// 2,582 distinct colours against their 9,134, and half their surface detail.
//
// The fix is not a better shader. It is the thing Minecraft did in 2009: give
// each KIND of block a little pixel texture, so oak planks have grain, hay
// has straws and wool has fuzz. The cube never changes; the sixteen-by-
// sixteen square painted on its face carries the detail.
//
// The tiles here are GENERATED, not downloaded: a pattern per material,
// drawn from the palette colour the block already had, so nothing has to be
// re-authored and no texture file ships. Deterministic, so the world looks
// the same on every machine and in every screenshot.

const TILE = 16;                                    // pixels per block face

/** How a material is drawn. Chosen per palette entry by name below. */
type Pattern = 'plank' | 'grain' | 'tar' | 'grass' | 'dirt' | 'sand' | 'stone'
  | 'straw' | 'cloth' | 'leaf' | 'water' | 'skin' | 'metal' | 'plain';

/** A small deterministic hash — the same tile on every machine, every run. */
function rand(x: number, y: number, seed: number) {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) * 1274126177 >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Which pattern a palette entry gets, by what it is called. The names were
 *  already descriptive, so no table has to be kept in step by hand. */
function patternFor(name: string): Pattern {
  const n = name.toLowerCase();
  if (/pitch|char|tar/.test(n)) return 'tar';
  if (/plank|deck|roof|door|gopher|wale|post|beam|trunk|wood|fence|crate|cart/.test(n)) return 'plank';
  if (/grass|moss|meadow/.test(n)) return 'grass';
  if (/dirt|path|mud|soil/.test(n)) return 'dirt';
  if (/sand|dune/.test(n)) return 'sand';
  if (/stone|rock|pebble|granite|slab/.test(n)) return 'stone';
  if (/hay|straw|wicker|grain|thatch/.test(n)) return 'straw';
  if (/wool|cloth|tent|linen|robe|sack|canvas|veil/.test(n)) return 'cloth';
  if (/leaf|leaves|foliage|bush|reed|lily/.test(n)) return 'leaf';
  if (/water|river|pond|wave/.test(n)) return 'water';
  if (/skin|hide|flesh|hair|beard/.test(n)) return 'skin';
  if (/iron|copper|metal|gold|bronze|lamp/.test(n)) return 'metal';
  return 'plain';
}

/** Draws one 16×16 tile for a colour, in place, into an RGBA byte array. */
function drawTile(out: Uint8ClampedArray, atlasW: number, ox: number, oy: number,
  colour: number, pattern: Pattern, seed: number) {
  const base = new THREE.Color(colour);          // THREE.Color decodes to LINEAR
  const put = (x: number, y: number, mul: number, tint?: THREE.Color) => {
    // Shade in linear — which is where multiplying light is meaningful — and
    // then convert BACK to sRGB before writing the byte, because the texture
    // is tagged sRGB and the GPU will decode it again on the way in. Writing
    // linear bytes into an sRGB texture darkens and over-saturates the whole
    // scene, and (the giveaway) REDUCES the number of distinct colours.
    const c = (tint ?? base).clone().multiplyScalar(mul).convertLinearToSRGB();
    const i = ((oy + y) * atlasW + (ox + x)) * 4;
    out[i] = Math.min(255, c.r * 255);
    out[i + 1] = Math.min(255, c.g * 255);
    out[i + 2] = Math.min(255, c.b * 255);
    out[i + 3] = 255;
  };

  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const r = rand(x, y, seed);
      let m = 1;
      switch (pattern) {
        case 'plank': {
          // boards four pixels deep, with a dark seam between them and grain
          // running along each board
          const board = Math.floor(y / 4);
          const seam = y % 4 === 3;
          const grain = rand(Math.floor(x / 2), board, seed) * 0.10 - 0.05;
          m = seam ? 0.78 : 1 + grain + (r - 0.5) * 0.05;
          if (!seam && rand(x, board, seed + 7) > 0.965) m *= 0.86;     // a knot
          break;
        }
        case 'grain':
          m = 1 + (rand(Math.floor(x / 3), y, seed) - 0.5) * 0.16;
          break;
        case 'tar':
          m = 0.92 + r * 0.16;
          if (r > 0.93) m *= 1.18;                                       // a glint
          break;
        case 'grass': {
          // upright blades, a few longer, so the top face reads as turf
          const blade = rand(x, Math.floor(y / 5), seed) > 0.55;
          m = blade ? 1.06 + r * 0.10 : 0.88 + r * 0.14;
          if (rand(x, y, seed + 3) > 0.97) m *= 1.18;
          break;
        }
        case 'dirt':
          m = 0.86 + r * 0.28;
          if (r > 0.94) m *= 0.82;                                       // small stones
          break;
        case 'sand':
          m = 0.94 + r * 0.12;
          break;
        case 'stone': {
          const blotch = rand(Math.floor(x / 4), Math.floor(y / 4), seed);
          m = 0.88 + blotch * 0.2 + (r - 0.5) * 0.08;
          break;
        }
        case 'straw': {
          // strands lying across each other
          const strand = (x * 2 + y * 3 + Math.floor(rand(0, Math.floor(y / 2), seed) * 6)) % 5;
          m = strand === 0 ? 0.82 : strand === 1 ? 1.12 : 0.96 + r * 0.12;
          break;
        }
        case 'cloth': {
          // a weave: alternating warp and weft, very slight
          const weave = ((x >> 1) + (y >> 1)) % 2 === 0;
          m = (weave ? 1.03 : 0.95) + (r - 0.5) * 0.05;
          break;
        }
        case 'leaf': {
          const clump = rand(Math.floor(x / 3), Math.floor(y / 3), seed);
          m = 0.82 + clump * 0.34;
          if (r > 0.9) m *= 1.12;
          break;
        }
        case 'water': {
          const ripple = Math.sin((x + rand(0, y, seed) * 4) * 0.9) * 0.5 + 0.5;
          m = 0.92 + ripple * 0.16;
          break;
        }
        case 'skin':
          m = 0.97 + (r - 0.5) * 0.07;
          break;
        case 'metal': {
          const brushed = rand(x, Math.floor(y / 6), seed);
          m = 0.9 + brushed * 0.2;
          if (x === y || x === TILE - 1 - y) m *= 1.08;                  // a highlight
          break;
        }
        default:
          m = 0.97 + (r - 0.5) * 0.06;
      }
      put(x, y, m);
    }
  }
}

export interface Atlas {
  texture: THREE.DataTexture;
  /** Bottom-left UV of the tile for a colour, in atlas space. */
  uvOf(colour: number): [number, number];
  /** The width and height of one tile in UV space. */
  step: number;
  tiles: number;
}

let cached: Atlas | null = null;

/**
 * Builds the atlas once: one tile per palette entry, laid out in a square.
 * Nearest filtering and no mipmaps, because the whole point is that the
 * pixels stay pixels — a blurred block texture is just a flat colour again,
 * more expensively.
 */
export function buildAtlas(): Atlas {
  if (cached) return cached;
  const names = Object.keys(PALETTE);
  const side = Math.ceil(Math.sqrt(names.length));
  const atlasW = side * TILE;
  const data = new Uint8ClampedArray(atlasW * atlasW * 4);
  const index = new Map<number, number>();

  names.forEach((name, i) => {
    const colour = PALETTE[name]!;
    const ox = (i % side) * TILE, oy = Math.floor(i / side) * TILE;
    drawTile(data, atlasW, ox, oy, colour, patternFor(name), i + 1);
    // Several names can share a colour; the first one wins, which is fine —
    // they are the same material by definition.
    if (!index.has(colour)) index.set(colour, i);
  });

  const texture = new THREE.DataTexture(new Uint8Array(data.buffer), atlasW, atlasW);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  const step = 1 / side;
  // A half-pixel inset, or the filter samples the neighbouring tile along
  // every seam and each block gets a one-pixel border of the wrong material.
  const inset = 0.5 / atlasW;

  cached = {
    texture, step, tiles: names.length,
    uvOf(colour: number) {
      const i = index.get(colour) ?? 0;
      return [(i % side) * step + inset, Math.floor(i / side) * step + inset];
    },
  };
  return cached;
}

/** The usable size of a tile once both edges are inset. */
export const tileSpan = (a: Atlas) => a.step - 2 * (0.5 / (Math.ceil(Math.sqrt(a.tiles)) * TILE));
