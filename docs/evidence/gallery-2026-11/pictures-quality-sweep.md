# Picture quality rule and the 300 MB cap (2026-11-03, branch gallery/integrate-1)

## Problem

With all 1,443 squares passing the gate, `dist/` measured **308.3 MB** (MiB, the unit every earlier report in this folder uses):
pictures 267.9 MB (thumbs 48.9 + full 219.0) + Bible text for the eight editions 37.6 MB + share stubs 1.8 MB + pages 0.9 MB.
The plan's cap is 300 MB, and the owner has not accepted raising it. Two things cannot be cut: the Bible text (Words' bytes, pinned by SHA-256,
eight editions by the owner's decision) and the number of pictures (all 1,443). The only lever that does not remove content is the WebP encoding of the full-size pictures.

## Rule (in `scripts/lib/pictures_convert.py`)

> One quality for both sizes: **WebP quality 76, encoder method 6.** Thumb 480 px wide, full 1344 px wide, Lanczos resize, never cropped, never enlarged.
> The full size was 78 until now; the thumbs were already 76.

## Measurement (`scripts/pictures-quality-sweep.py`, 40 random squares, seed 7, against the resized original)

Full size, 1344 px wide:

| WebP q | mean KB | vs q78 | mean SSIM | min SSIM | PSNR dB |
|---|---|---|---|---|---|
| 78 (before) | 151.0 | 1.000 | 0.9561 | 0.9320 | 34.96 |
| **76 (rule)** | **140.5** | **0.931** | **0.9523** | **0.9274** | **34.47** |
| 74 | 134.5 | 0.891 | 0.9497 | 0.9240 | 34.17 |
| 72 | 131.6 | 0.872 | 0.9485 | 0.9216 | 34.03 |
| 70 | 128.1 | 0.849 | 0.9470 | 0.9206 | 33.85 |
| 64 | 120.3 | 0.797 | 0.9429 | 0.9162 | 33.42 |

The curve is flat: going from 78 to 76 costs 0.004 SSIM (0.5 dB) and saves 6.9 % of the full files; the visible grain, edges and the dark gradients the squares are
made of do not change at that step. Below 72 the saving per step is under 1 % while the quality loss per step stays the same, so 76 is chosen as the point where the gain is
still large; 74 would give another 4 % and was not needed. Thumbs (480 px) at q76 were not changed (q78 there costs 7 % more for 0.004 SSIM, not worth it).

## Result (all 1,443 served, 0 placeholders; real bytes, MiB)

| | before (q78 full) | after (q76 full) |
|---|---|---|
| `public/pictures` | 267.9 MB (thumbs 48.9 + full 219.0) | **253.0 MB** (thumbs 48.9 + full 204.1) |
| `dist/` | 308.3 MB | **293.3 MB** (pictures 253.0, reader data 37.6, share stubs 1.8, pages 0.9) |

In decimal megabytes (1 MB = 1,000,000 bytes) the same `dist/` is 307.6 MB. The plan's 300 MB and every earlier number here are binary (MiB: 302.0 was MiB, and `verify-gallery.mjs` divides by 1,048,576).
If the owner means decimal, the next step is full-size q74 (about -8.7 MB more, 284.6 MiB = 298.4 MB decimal). `verify-gallery.mjs` now fails above 300 MiB (it allowed 320 while the
owner had not decided).

`du -sk dist` reads 312,580 KB (305 MiB) on this volume: it counts whole disk blocks for about 5,200 small files, not bytes, so it is 12 MiB above the byte count. The tools that matter (Netlify's upload, `verify-gallery.mjs`) count bytes.
