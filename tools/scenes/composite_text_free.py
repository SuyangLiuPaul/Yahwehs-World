"""Composite an AI inpaint donor only into its declared transparent-mask regions."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("donor", type=Path)
    parser.add_argument("mask", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--feather", type=int, default=16)
    parser.add_argument("--protect-ellipse", type=int, nargs=4, metavar=("X0", "Y0", "X1", "Y1"))
    parser.add_argument("--protect-rect", type=int, nargs=4, action="append", metavar=("X0", "Y0", "X1", "Y1"))
    parser.add_argument("--protect-polygon", nargs="+", action="append", metavar="X,Y")
    args = parser.parse_args()

    paths = (args.source, args.donor, args.mask)
    if not all(path.is_file() for path in paths):
        raise SystemExit("source, donor, and mask must all exist")
    if args.output.exists() or args.output.resolve() in {path.resolve() for path in paths}:
        raise SystemExit("refusing to overwrite an input or existing output")
    if args.feather < 0 or args.feather > 64:
        raise SystemExit("feather must be between 0 and 64 pixels")

    with Image.open(args.source) as source_file, Image.open(args.donor) as donor_file, Image.open(args.mask) as mask_file:
        source = source_file.convert("RGB")
        donor = donor_file.convert("RGB")
        if source.size != donor.size or source.size != mask_file.size:
            raise SystemExit("source, donor, and mask dimensions must match")
        if mask_file.format != "PNG" or "A" not in mask_file.getbands():
            raise SystemExit("mask must be an RGBA PNG with alpha")

        core = mask_file.getchannel("A").point(lambda value: 255 if value == 0 else 0)
        if core.getbbox() is None:
            raise SystemExit("mask contains no fully transparent edit region")
        expanded = core if args.feather == 0 else core.filter(ImageFilter.MaxFilter(args.feather * 2 + 1))
        alpha = core if args.feather == 0 else ImageChops.multiply(
            ImageChops.lighter(core, core.filter(ImageFilter.GaussianBlur(args.feather))), expanded
        )
        protected_rectangles = []
        if args.protect_rect:
            protected = Image.new("L", source.size, 0)
            draw = ImageDraw.Draw(protected)
            for rectangle in args.protect_rect:
                x0, y0, x1, y1 = rectangle
                if not (0 <= x0 < x1 <= source.width and 0 <= y0 < y1 <= source.height):
                    raise SystemExit("protected rectangles must fit within the image")
                draw.rectangle(rectangle, fill=255)
                protected_rectangles.append(rectangle)
            expanded = ImageChops.subtract(expanded, protected)
            alpha = ImageChops.subtract(alpha, protected)
        protected_polygons = []
        if args.protect_polygon:
            protected = Image.new("L", source.size, 0)
            draw = ImageDraw.Draw(protected)
            for polygon in args.protect_polygon:
                try:
                    points = [tuple(map(int, point.split(","))) for point in polygon]
                except (TypeError, ValueError):
                    raise SystemExit("protected polygon points must be integer X,Y pairs")
                if len(points) < 3 or any(not (0 <= x < source.width and 0 <= y < source.height) for x, y in points):
                    raise SystemExit("protected polygons need at least three points within the image")
                draw.polygon(points, fill=255)
                protected_polygons.append(points)
            guard = protected if args.feather == 0 else protected.filter(ImageFilter.GaussianBlur(max(1, args.feather // 2)))
            alpha = ImageChops.multiply(alpha, ImageChops.invert(guard))
            alpha = ImageChops.subtract(alpha, protected)
        if args.protect_ellipse:
            x0, y0, x1, y1 = args.protect_ellipse
            if not (0 <= x0 < x1 <= source.width and 0 <= y0 < y1 <= source.height):
                raise SystemExit("protected ellipse must fit within the image")
            protected = Image.new("L", source.size, 0)
            ImageDraw.Draw(protected).ellipse(args.protect_ellipse, fill=255)
            expanded = ImageChops.subtract(expanded, protected)
            alpha = ImageChops.subtract(alpha, protected)
        result = Image.composite(donor, source, alpha)

        unchanged = ImageChops.difference(result, source)
        changed_pixels = int(np.any(np.asarray(unchanged), axis=2).sum())
        outside_support = ImageChops.multiply(
            unchanged.convert("L"), ImageChops.invert(expanded)
        ).getbbox()
        if outside_support is not None:
            raise SystemExit("composite changed pixels outside the expanded edit mask")

        args.output.parent.mkdir(parents=True, exist_ok=True)
        result.save(args.output, format="PNG", optimize=True)
        support_bbox = expanded.getbbox()
        evidence = {
            "source": str(args.source),
            "source_sha256": sha256(args.source),
            "donor": str(args.donor),
            "donor_sha256": sha256(args.donor),
            "mask": str(args.mask),
            "mask_sha256": sha256(args.mask),
            "output": str(args.output),
            "output_sha256": sha256(args.output),
            "dimensions": list(source.size),
            "feather_px": args.feather,
            "protected_ellipse_xyxy": args.protect_ellipse,
            "protected_rectangles_xyxy": protected_rectangles,
            "protected_polygons_xy": protected_polygons,
            "support_bbox_xyxy": list(support_bbox),
            "changed_pixels_within_support": changed_pixels,
            "changed_pixels_outside_support": 0,
        }
        evidence_path = args.output.with_suffix(".composite.json")
        evidence_path.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(evidence, ensure_ascii=False))


if __name__ == "__main__":
    main()
