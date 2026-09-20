"""Turn a real 3D model into blocks.

    blender -b --python tools/voxel/voxelise.py -- in.glb out.json --height 28 [--name sheep]

WHY THIS EXISTS. The block world's creatures were being typed out by hand, a
box at a time, which gets you a sheep about ten blocks long that reads as a
lump. The reference the owner is matching has animals four times that, with
ears, markings and a tail. Nobody is going to hand-place four thousand blocks
per animal.

But we already own the animals. The CC0 packs downloaded in the asset search
(Quaternius: bull, cow, donkey, horse, sheep, pig, eagle, wolf) are proper
modelled creatures, free for commercial use. Voxelising one takes a second and
gives a blocky animal with the real animal's proportions — which is the part
that was wrong, not the blockiness.

HOW. Surface voxelisation, not solid: every triangle is sampled finely enough
that no block is missed, and each sample paints the block it lands in. The
renderer only ever draws faces with nothing in front of them, so a hollow
shell and a solid lump look identical on screen and the shell is a tenth of
the blocks.

COLOUR comes from the model itself — vertex colours if it has them (Quaternius
does), otherwise the base-colour texture sampled at the triangle's UV,
otherwise the material's flat base colour. The output is a JSON block list in
the app's own grid units, so `src/voxel/vox.ts` can stamp it straight in.
"""
import bpy, bmesh, sys, json, os
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]


def arg(flag, default=None, cast=str):
    return cast(argv[argv.index(flag) + 1]) if flag in argv else default


HEIGHT = arg("--height", 28, int)      # how many blocks tall the result should be
NAME = arg("--name", os.path.splitext(os.path.basename(SRC))[0].lower())
UPRIGHT = "--no-upright" not in argv


def load():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    ext = os.path.splitext(SRC)[1].lower()
    if ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=SRC)
    elif ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=SRC)
    elif ext == ".obj":
        bpy.ops.wm.obj_import(filepath=SRC)
    else:
        raise SystemExit(f"voxelise: don't know how to read {ext}")

    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not meshes:
        raise SystemExit("voxelise: no mesh in that file")

    # An animated model arrives posed by its rest pose; the armature is of no
    # use to a block, so the modifiers are applied and the armature dropped.
    for o in meshes:
        bpy.context.view_layer.objects.active = o
        for m in list(o.modifiers):
            try:
                bpy.ops.object.modifier_apply(modifier=m.name)
            except RuntimeError:
                o.modifiers.remove(m)

    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return ob


def image_sampler(mat):
    """The material's base-colour image, as a function of (u, v) -> rgb."""
    if not mat or not mat.use_nodes:
        return None
    bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if not bsdf:
        return None
    link = next((l for l in mat.node_tree.links
                 if l.to_node == bsdf and l.to_socket.name == "Base Color"), None)
    if not link or link.from_node.type != "TEX_IMAGE":
        return None
    img = link.from_node.image
    if not img or not img.pixels:
        return None
    w, h = img.size
    px = list(img.pixels)          # a copy: indexing img.pixels directly is glacial

    def sample(u, v):
        x = min(w - 1, max(0, int(u % 1.0 * w)))
        y = min(h - 1, max(0, int(v % 1.0 * h)))
        i = (y * w + x) * 4
        return (px[i], px[i + 1], px[i + 2])
    return sample


def flat_colour(mat):
    if mat and mat.use_nodes:
        bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if bsdf:
            c = bsdf.inputs["Base Color"].default_value
            return (c[0], c[1], c[2])
    if mat:
        c = mat.diffuse_color
        return (c[0], c[1], c[2])
    return (0.72, 0.68, 0.62)


def main():
    ob = load()
    me = ob.data
    me.calc_loop_triangles()

    # Upright and facing: glTF hands us Y-up, Blender works Z-up, and the app's
    # grid is Y-up again. The import already rotated it, so "up" here is +Z and
    # the block grid's Y is Blender's Z.
    lo = Vector((min(v.co.x for v in me.vertices), min(v.co.y for v in me.vertices), min(v.co.z for v in me.vertices)))
    hi = Vector((max(v.co.x for v in me.vertices), max(v.co.y for v in me.vertices), max(v.co.z for v in me.vertices)))
    span = hi - lo
    tall = span.z if UPRIGHT else max(span)
    if tall <= 0:
        raise SystemExit("voxelise: that model has no height")
    step = tall / HEIGHT                       # one block, in the model's own units

    colours = me.color_attributes.active_color
    vcol = None
    if colours is not None:
        vcol = [tuple(colours.data[i].color[:3]) for i in range(len(colours.data))]
        by_loop = colours.domain == "CORNER"
    samplers = {i: image_sampler(m) for i, m in enumerate(me.materials)} if me.materials else {}
    flats = {i: flat_colour(m) for i, m in enumerate(me.materials)} if me.materials else {}
    uv = me.uv_layers.active.data if me.uv_layers.active else None

    cells = {}

    def paint(p, rgb):
        key = (int((p.x - lo.x) / step), int((p.z - lo.z) / step), int((p.y - lo.y) / step))
        cells[key] = rgb

    for tri in me.loop_triangles:
        vs = [me.vertices[i].co for i in tri.vertices]
        # sample the triangle densely enough that no block between its corners
        # is skipped: the longest edge, in blocks, sets the sampling rate
        longest = max((vs[0] - vs[1]).length, (vs[1] - vs[2]).length, (vs[2] - vs[0]).length)
        n = max(1, int(longest / step * 1.6) + 1)
        sampler = samplers.get(tri.material_index)
        flat = flats.get(tri.material_index, (0.72, 0.68, 0.62))
        for a in range(n + 1):
            for b in range(n + 1 - a):
                wa, wb = a / n, b / n
                wc = 1.0 - wa - wb
                p = vs[0] * wa + vs[1] * wb + vs[2] * wc
                if vcol is not None:
                    idx = tri.loops if by_loop else tri.vertices
                    c0, c1, c2 = (vcol[i] for i in idx)
                    rgb = (c0[0] * wa + c1[0] * wb + c2[0] * wc,
                           c0[1] * wa + c1[1] * wb + c2[1] * wc,
                           c0[2] * wa + c1[2] * wb + c2[2] * wc)
                elif sampler is not None and uv is not None:
                    u0, u1, u2 = (uv[i].uv for i in tri.loops)
                    rgb = sampler(u0.x * wa + u1.x * wb + u2.x * wc,
                                  u0.y * wa + u1.y * wb + u2.y * wc)
                else:
                    rgb = flat
                paint(p, rgb)

    # glTF colours are linear; the app paints in sRGB
    def hex_of(rgb):
        out = 0
        for c in rgb:
            c = max(0.0, min(1.0, c))
            s = 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055
            out = (out << 8) | int(round(s * 255))
        return out

    blocks = [[x, y, z, hex_of(rgb)] for (x, y, z), rgb in cells.items()]
    w = max(b[0] for b in blocks) + 1
    h = max(b[1] for b in blocks) + 1
    d = max(b[2] for b in blocks) + 1
    data = {"name": NAME, "size": [w, h, d], "source": os.path.basename(SRC), "blocks": blocks}
    with open(OUT, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    print(f"VOXELISE {NAME}: {len(blocks)} blocks, {w}×{h}×{d}, "
          f"from {len(me.loop_triangles)} triangles -> {OUT} "
          f"({os.path.getsize(OUT) / 1024:.0f} kB)")


main()
