"""Colour a generated shape with the photograph it was generated from.

    blender -b --python tools/autorig/project_photo.py -- shape.glb front.png out.glb [back.png]

The shape (Hunyuan, local) is excellent and colourless; every texturing
model tried here guessed the colour and got it wrong or blurred. But the
colour is not unknown — it is in the reference photograph, pixel for pixel,
face and beard and the stripes of the girdle. So it is projected: the figure
is lined up with its own silhouette in the photograph, and every surface
facing the camera takes the photograph's pixel straight in front of it.

What faces away takes a back view if one is given; otherwise a heavily
blurred copy of the front, which reads as "the same cloth" without printing a
face on the back of the head.

Alignment is measured, not assumed: the photograph's figure is found by its
difference from the plain background, and the shape is fitted to that box —
facing -Y or +Y and mirrored or not, whichever silhouette overlaps best.
"""
import bpy, sys, math
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SHAPE, FRONT, OUT = argv[0], argv[1], argv[2]
BACK = argv[3] if len(argv) > 3 else None


def load_rgba(path):
    img = bpy.data.images.load(path, check_existing=True)
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32); img.pixels.foreach_get(px)
    return img, px.reshape(h, w, 4)          # row 0 = BOTTOM of the picture


def figure_box(px):
    """Where the figure is in the photograph: pixels unlike the background."""
    h, w, _ = px.shape
    corners = np.concatenate([px[:20, :20, :3].reshape(-1, 3), px[:20, -20:, :3].reshape(-1, 3),
                              px[-20:, :20, :3].reshape(-1, 3), px[-20:, -20:, :3].reshape(-1, 3)])
    bg = np.median(corners, axis=0)
    diff = np.abs(px[..., :3] - bg).sum(-1)
    mask = diff > 0.12
    # tidy the mask: drop isolated specks by requiring a filled neighbourhood
    ys, xs = np.nonzero(mask)
    return mask, xs.min(), xs.max(), ys.min(), ys.max()


def bleed(px, mask, rounds=40):
    """Spread the figure's own colours out over the background. The shape and
    the photograph never line up to the pixel, and wherever the shape reached
    past the figure it took the studio grey — a pale halo down both arms. With
    the figure's edge colours bled outward, a slightly generous shape takes
    robe where it would have taken backdrop."""
    out = px.copy(); m = mask.copy()
    for _ in range(rounds):
        acc = np.zeros_like(out[..., :3]); cnt = np.zeros(m.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sh = np.roll(np.roll(out[..., :3] * m[..., None], dy, 0), dx, 1)
            sm = np.roll(np.roll(m, dy, 0), dx, 1)
            acc += sh; cnt += sm
        grow = (~m) & (cnt > 0)
        out[grow, :3] = acc[grow] / cnt[grow][:, None]
        m = m | grow
    return out


def fit(V, mask, box, lo, hi):
    """Nudge the shape's projection until its silhouette sits on the figure's:
    a small search over scale and offset, scored by how many projected points
    land on the figure and how much of the figure they cover."""
    h, w = mask.shape
    x0, x1, y0, y1 = box
    samp = V[:: max(1, len(V) // 6000)]
    best = (-1, 1.0, 1.0, 0.0, 0.0)
    for sx in (0.94, 0.97, 1.0, 1.03):
        for sz in (0.96, 0.98, 1.0, 1.02):
            for ox in (-0.02, -0.01, 0, 0.01, 0.02):
                for oz in (-0.02, -0.01, 0, 0.01, 0.02):
                    u = ((samp[:, 0] - lo[0]) / (hi[0] - lo[0]) - 0.5) * sx + 0.5 + ox
                    v = ((samp[:, 2] - lo[2]) / (hi[2] - lo[2]) - 0.5) * sz + 0.5 + oz
                    px_ = (x0 + u * (x1 - x0)).astype(int); py_ = (y0 + v * (y1 - y0)).astype(int)
                    ok = (px_ >= 0) & (px_ < w) & (py_ >= 0) & (py_ < h)
                    score = mask[py_[ok], px_[ok]].mean() * ok.mean()
                    if score > best[0]:
                        best = (score, sx, sz, ox, oz)
    return best


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SHAPE)
    obs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in obs: o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    if len(obs) > 1: bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    me = ob.data

    fimg, fpx = load_rgba(FRONT)
    fh, fw, _ = fpx.shape
    fmask, fx0, fx1, fy0, fy1 = figure_box(fpx)
    fpx = bleed(fpx, fmask)

    V = np.array([v.co[:] for v in me.vertices])
    lo, hi = V.min(0), V.max(0)

    fitted = fit(V, fmask, (fx0, fx1, fy0, fy1), lo, hi)
    _, SX, SZ, OX, OZ = fitted

    def to_px(x, z, flip):
        u = ((x - lo[0]) / (hi[0] - lo[0]) - 0.5) * SX + 0.5 + OX
        if flip: u = 1 - u
        v = ((z - lo[2]) / (hi[2] - lo[2]) - 0.5) * SZ + 0.5 + OZ
        return fx0 + u * (fx1 - fx0), fy0 + v * (fy1 - fy0)

    # Which way round? Silhouette overlap of the shape (seen along Y) with the
    # photograph's mask, unmirrored and mirrored.
    best = None
    sample = V[:: max(1, len(V) // 4000)]
    for flip in (False, True):
        px_, py_ = to_px(sample[:, 0], sample[:, 2], flip)
        hit = fmask[np.clip(py_.astype(int), 0, fh - 1), np.clip(px_.astype(int), 0, fw - 1)].mean()
        if best is None or hit > best[0]:
            best = (hit, flip)
    flip = best[1]
    # Toward the camera is the side the face is on: the nose is the vertex that
    # reaches furthest along ±Y at eye height.
    # Hunyuan exports its figure facing +Z in glTF, which Blender imports as
    # facing -Y. (A nose test chose +Y for the priest — his bonnet sticks out
    # further behind than his nose does in front — and printed the blurred back
    # on his front.) Seen from -Y, screen-right is +X: no mirror.
    face_dir = -1.0
    flip = False
    cam = Vector((0, face_dir, 0))           # direction from the figure TOWARD the camera

    # Back view: given, or a blur of the front.
    if BACK:
        bimg, bpx = load_rgba(BACK)
        bmask, bx0, bx1, by0, by1 = figure_box(bpx)
    else:
        k = 25
        blur = fpx.copy()
        for axis in (0, 1):
            c = np.cumsum(np.pad(blur, [(k, k) if a == axis else (0, 0) for a in range(3)], mode="edge"), axis=axis)
            blur = (np.take(c, range(2 * k, c.shape[axis]), axis=axis) - np.take(c, range(0, c.shape[axis] - 2 * k), axis=axis)) / (2 * k)
        bpx, bx0, bx1, by0, by1 = blur, fx0, fx1, fy0, fy1

    # One atlas, front on the left half, back on the right.
    atlas = np.concatenate([fpx, bpx[:fh, :fw]], axis=1)
    A = bpy.data.images.new("photo_atlas", width=fw * 2, height=fh, alpha=False)
    A.pixels.foreach_set(atlas.astype(np.float32).ravel())
    A.filepath_raw = OUT.replace(".glb", "_atlas.png"); A.file_format = "PNG"; A.save()

    uv = me.uv_layers.new(name="photo")
    me.uv_layers.active = uv
    faced = 0
    for poly in me.polygons:
        n = poly.normal
        # Only surfaces that FACE the camera take the sharp photograph. A single
        # front view dragged across a surface seen edge-on smears into stripes
        # (the side of the robe, the side of the head); those take the soft
        # copy instead, which reads as the same cloth.
        front = n.dot(cam) > 0.40
        faced += front
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            if front:
                x, y = to_px(co.x, co.z, flip)
                uv.data[li].uv = (x / fw * 0.5, y / fh)
            elif n.dot(cam) > -0.05 and not BACK:
                # a side: the soft copy, at the same place as the front
                x, y = to_px(co.x, co.z, flip)
                uv.data[li].uv = (0.5 + x / fw * 0.5, y / fh)
            else:
                # seen from behind, left and right swap
                u = (co.x - lo[0]) / (hi[0] - lo[0]); u = u if flip else 1 - u
                v = (co.z - lo[2]) / (hi[2] - lo[2])
                x = bx0 + u * (bx1 - bx0); y = by0 + v * (by1 - by0)
                uv.data[li].uv = (0.5 + x / fw * 0.5, y / fh)
    for l in list(me.uv_layers):
        if l.name != "photo":
            me.uv_layers.remove(l)

    mat = bpy.data.materials.new("Photo"); mat.use_nodes = True
    nt = mat.node_tree; bsdf = next(nd for nd in nt.nodes if nd.type == "BSDF_PRINCIPLED")
    t = nt.nodes.new("ShaderNodeTexImage"); t.image = A
    nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.85
    bsdf.inputs["Specular IOR Level"].default_value = 0.15
    me.materials.clear(); me.materials.append(mat)
    for p in me.polygons: p.use_smooth = True
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_image_format="JPEG", export_jpeg_quality=90)
    print(f"PROJECT {OUT}: {faced}/{len(me.polygons)} faces take the front photograph; "
          f"silhouette overlap {best[0]:.2f}{' (mirrored)' if flip else ''}; face toward {'-Y' if face_dir < 0 else '+Y'}; "
          f"back from {'a back view' if BACK else 'a blurred front'}; fit scale {SX},{SZ} offset {OX},{OZ} score {fitted[0]:.3f}")


main()
