#!/usr/bin/env python3
"""Derive install icons solely from public/logo.png (Pillow + stdlib).

public/pwa/icon-{192,512}.png are transparent, general-purpose PWA icons;
shortcut-96.png is their shortcut-sized counterpart. maskable-{192,512}.png
are opaque Android icons with the emblem at 78% (inside the 80% safe circle of a\nmask). apple-touch-{180,167,152,120}.png are opaque iOS icons, the emblem full size\nwith its four transparent corners filled from its own edge colour (iOS paints\ntransparent pixels black and rounds the corners itself). Margins and corners are\nfilled by normalised convolution of the emblem's own edge pixels (needs numpy).
public/apple-touch-icon.png is an exact copy of apple-touch-180.png.
monochrome-512.png is black with a luminance-modulated foreground alpha mask
for system tinting, excluding the source sky and pale halo/rays.

All paths resolve relative to this script; reruns replace the same files.
"""

from pathlib import Path
import shutil

import numpy as np
from PIL import Image, ImageChops, ImageFilter


PUBLIC = Path(__file__).resolve().parent.parent / "public"
OUTPUT = PUBLIC / "pwa"
LANCZOS = Image.Resampling.LANCZOS


def report(path: Path, image: Image.Image) -> None:
    print(f"{path.relative_to(PUBLIC.parent)}: {path.stat().st_size} bytes, "
          f"{image.width}x{image.height}")


def save(image: Image.Image, name: str) -> None:
    path = OUTPUT / name
    image.save(path, optimize=True)
    report(path, image)


def extend(canvas: Image.Image) -> Image.Image:
    """RGBA with transparent margins -> RGB whose margins continue the picture's own edge colours smoothly.

    Normalised convolution: each Gaussian radius gives, wherever some opaque pixel is near, the average colour of the
    opaque pixels around it; small radii win close to the picture, large ones fill what is left. No colour is invented:
    every margin pixel is an average of the emblem's own sky-blue edge.
    """
    alpha = canvas.getchannel("A")
    pre = Image.merge("RGB", [ImageChops.multiply(c, alpha) for c in canvas.split()[:3]])
    out = np.zeros((canvas.height, canvas.width, 3), dtype=np.float64)
    done = np.zeros((canvas.height, canvas.width), dtype=bool)
    for radius in (2, 4, 8, 16, 32, 64, 128, 256):
        weight = np.asarray(alpha.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float64) / 255.0
        colour = np.asarray(pre.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float64)
        take = (~done) & (weight > 0.12)
        out[take] = colour[take] / weight[take][:, None]
        done |= take
    if not done.all():
        out[~done] = out[done].mean(axis=0)
    ground = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")
    ground.paste(canvas.convert("RGB"), mask=alpha)
    return ground


RIM = 15  # px at 512: the emblem's pale edge stroke, dropped before the margins are continued from the sky inside it


def full_bleed(source: Image.Image, size: int, scale: float) -> Image.Image:
    source = source.copy()
    source.putalpha(source.getchannel("A").filter(ImageFilter.MinFilter(2 * RIM + 1)))
    side = round(size * scale)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(source.resize((side, side), LANCZOS), ((size - side) // 2, (size - side) // 2))
    return extend(canvas)


def monochrome(source: Image.Image) -> Image.Image:
    rgb = source.convert("RGB")
    hsv = rgb.convert("HSV")
    mask = Image.new("L", source.size)
    source_alpha = source.getchannel("A")
    # Measured sky samples: HSV hue 140..148 (~198..209 degrees), S 75..204.
    # Broader hue bounds remove cyan halo/sky transitions as well. Pale rays
    # above 38% height have V > 210, low saturation or yellow hues; the lamb
    # below that boundary must retain its bright, low-saturation pixels.
    for y in range(source.height):
        lower = y >= round(source.height * 0.38)
        for x in range(source.width):
            h, s, v = hsv.getpixel((x, y))
            degrees = h * 360 / 255
            sky = 165 <= degrees <= 240 and s > 45
            pale = s < 65 or (38 <= degrees <= 170 and s < 150)
            halo = not lower and v > 210 and pale
            foreground = not sky and not halo and (s >= 65 or
                                                   (lower and v > 180))
            if foreground:
                mask.putpixel((x, y), 255)
    mask = mask.filter(ImageFilter.MedianFilter(5))
    mask = ImageChops.multiply(mask, source_alpha)
    # 0.40 + 0.60 * normalised luminance, encoded directly as an 8-bit alpha.
    detail = rgb.convert("L").point([round(102 + 0.60 * v) for v in range(256)])
    alpha = ImageChops.multiply(mask, detail)
    bounds = mask.getbbox()
    if bounds is None:
        raise ValueError("Foreground mask is empty")
    cropped = alpha.crop(bounds)
    fit = 512 * 0.76 / max(cropped.size)
    scaled = cropped.resize(tuple(round(n * fit) for n in cropped.size), LANCZOS)
    centred = Image.new("L", (512, 512))
    centred.paste(scaled, ((512 - scaled.width) // 2, (512 - scaled.height) // 2))
    result = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    result.putalpha(centred)
    fraction = sum(centred.histogram()[129:]) / (512 * 512)
    print(f"Monochrome alpha > 128 fraction: {fraction:.6f}")
    return result


def main() -> None:
    with Image.open(PUBLIC / "logo.png") as original:
        source = original.convert("RGBA")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        save(source.resize((size, size), LANCZOS), f"icon-{size}.png")
    maskable = full_bleed(source, 1024, 0.78)
    for size in (192, 512):
        save(maskable.resize((size, size), LANCZOS), f"maskable-{size}.png")
    apple = full_bleed(source, 1024, 1.0)
    for size in (180, 167, 152, 120):
        save(apple.resize((size, size), LANCZOS), f"apple-touch-{size}.png")
    destination = PUBLIC / "apple-touch-icon.png"
    shutil.copyfile(OUTPUT / "apple-touch-180.png", destination)
    report(destination, apple.resize((180, 180), LANCZOS))
    save(monochrome(source), "monochrome-512.png")
    save(source.resize((96, 96), LANCZOS), "shortcut-96.png")


if __name__ == "__main__":
    main()
