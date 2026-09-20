"""An elephant built from scratch in Blender, in the chamfered-block style of the concept picture.

    Blender -b --python tools/ark/build_elephant.py -- out.blend [--render out.png] [--cam hero|side|back]
                                                      [--export out.glb] [--rerender]

HOW. Same method as build_ark.py: nothing placed by hand in a GUI, everything a few
numbers and a loop. Every part is a `solid` — eight corner points, six faces, its
edges chamfered once, which is what gives the picture's elephants their cut-gem
look (a voxel cube can't do a sloped forehead; a chamfered block can). Legs are
tapered blocks on a darker slab; the trunk is a stack of blocks around a dark core
so the gaps read as creases; tusks are a chain of thinning beams.

SIZE. An African bull is about 3 m at the shoulder; this one is 3.1 m at the crown,
with the picture's short legs and big head. Chosen proportions, not measurements.
"""
import bpy, bmesh, sys, math, random
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else "/tmp/elephant.blend"
RENDER = argv[argv.index("--render") + 1] if "--render" in argv else None
CAM = argv[argv.index("--cam") + 1] if "--cam" in argv else "hero"
random.seed(4)


def opt(flag, default):
    return float(argv[argv.index(flag) + 1]) if flag in argv else default


# ── palette. Measured off the picture's elephants: a warm, slightly lilac grey ──
GREY = (0.665, 0.635, 0.635)
GREY_L = (0.75, 0.72, 0.72)      # forehead, upper ear
GREY_D = (0.47, 0.445, 0.46)       # feet, trunk core, underside
EAR_IN = (0.58, 0.55, 0.56)
TUSK = (0.97, 0.95, 0.88)
NAIL = (0.86, 0.80, 0.70)
EYE = (0.03, 0.03, 0.04)
GLINT = (1.0, 1.0, 1.0)


def srgb(c):
    f = lambda v: v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (f(c[0]), f(c[1]), f(c[2]), 1.0)


class Mesh:
    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.col = self.bm.loops.layers.color.new("Col")
        self.done = self.bm.faces.layers.int.new("done")

    def solid(self, pts, colour, bev=0.05, jitter=0.03):
        """pts: four bottom corners then four top corners, each ring going round the
        same way. One closed block, chamfered, every face its own faint brightness so
        the facets read the way the picture's do."""
        bm = self.bm
        v = [bm.verts.new(p) for p in pts]
        quads = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
        faces = [bm.faces.new([v[i] for i in q]) for q in quads]
        bmesh.ops.recalc_face_normals(bm, faces=faces)
        if bev > 0:
            edges = list({e for vv in v for e in vv.link_edges})
            bmesh.ops.bevel(bm, geom=edges, offset=bev, offset_type="OFFSET", segments=1, profile=0.5, affect="EDGES")
        for f in bm.faces:
            if f[self.done]:
                continue
            f[self.done] = 1
            k = 1 + random.uniform(-jitter, jitter)
            col = srgb(tuple(min(1.0, c * k) for c in colour))
            for loop in f.loops:
                loop[self.col] = col

    def commit(self):
        me = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(me)
        self.bm.free()
        ob = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(ob)
        for p in me.polygons:
            p.use_smooth = False
        return ob


def box_pts(c, s, top=(1.0, 1.0), bot=(1.0, 1.0), shift=(0.0, 0.0)):
    """A block centred on c with size s; the top can be narrower or shifted, which is
    how a leg tapers and a forehead slopes."""
    cx, cy, cz = c
    sx, sy, sz = s

    def ring(z, k, sh):
        hx, hy = sx / 2 * k[0], sy / 2 * k[1]
        return [Vector((cx + sh[0] + a * hx, cy + sh[1] + b * hy, z)) for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))]

    return ring(cz - sz / 2, bot, (0, 0)) + ring(cz + sz / 2, top, shift)


def beam_pts(p0, p1, r0, r1):
    p0, p1 = Vector(p0), Vector(p1)
    d = (p1 - p0).normalized()
    up = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
    a = d.cross(up).normalized()
    b = d.cross(a).normalized()
    ring = lambda p, r: [p + a * sa * r + b * sb * r for sa, sb in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    return ring(p0, r0) + ring(p1, r1)


def rotate(pts, pivot, angle, axis="Z"):
    M = Matrix.Rotation(angle, 3, axis)
    pv = Vector(pivot)
    return [pv + M @ (Vector(p) - pv) for p in pts]


def build(m):
    # ── legs: a tapered pillar on a darker slab, front pair a little forward ──
    for x, tag in ((0.78, "f"), (-0.72, "r")):
        for s in (-1, 1):
            y = s * 0.52
            m.solid(box_pts((x, y, 0.13 + 0.62 / 2 + 0.03), (0.68, 0.68, 0.62), top=(0.94, 0.94)), GREY, 0.045)
            m.solid(box_pts((x, y, 0.75 + 0.70 / 2), (0.74, 0.74, 0.70), bot=(0.90, 0.90)), GREY, 0.06)
            m.solid(box_pts((x + 0.02, y, 0.07), (0.80, 0.82, 0.14), top=(0.96, 0.96)), GREY_D, 0.03)
            if tag == "f":
                for k in (-1, 0, 1):
                    m.solid(box_pts((x + 0.37, y + k * 0.2, 0.09), (0.05, 0.11, 0.09)), NAIL, 0.008, 0.02)

    # ── body: a wide chamfered block with a narrower back, and a lower rump ──
    m.solid(box_pts((-0.08, 0, 2.02), (2.10, 1.62, 1.50), top=(0.90, 0.80)), GREY, 0.14)
    m.solid(box_pts((-1.10, 0, 1.96), (0.62, 1.38, 1.34), top=(0.90, 0.80), shift=(-0.03, 0)), GREY, 0.12)
    m.solid(box_pts((-0.15, 0, 1.36), (1.9, 1.24, 0.22), bot=(0.85, 0.8)), GREY_D, 0.05)     # belly, in shade
    # tail
    m.solid(beam_pts((-1.40, 0, 2.30), (-1.50, 0, 1.30), 0.07, 0.05), GREY_D, 0.01, 0.02)
    m.solid(box_pts((-1.50, 0, 1.16), (0.16, 0.14, 0.24)), GREY_D, 0.02)

    # ── head: a big block with the forehead sloping back, and a dome above ──
    m.solid(box_pts((1.62, 0, 2.15), (1.30, 1.42, 1.62), top=(0.86, 0.80), shift=(-0.14, 0)), GREY, 0.13)
    m.solid(box_pts((1.44, 0, 3.05), (1.00, 1.08, 0.32), top=(0.68, 0.72), shift=(-0.04, 0)), GREY_L, 0.09)
    for s in (-1, 1):
        m.solid(box_pts((2.20, s * 0.47, 2.60), (0.13, 0.26, 0.08)), GREY_D, 0.02)              # brow
        m.solid(box_pts((2.265, s * 0.47, 2.45), (0.04, 0.09, 0.13)), EYE, 0.0, 0.0)
        m.solid(box_pts((2.29, s * 0.47 + s * 0.012, 2.50), (0.02, 0.035, 0.04)), GLINT, 0.0, 0.0)

    # ── ears: hinged at the front edge, the rear swung out, so the broad face turns toward the viewer ──
    for s in (-1, 1):
        ang = -s * 0.40
        pivot = (1.75, s * 0.76, 2.45)
        ear = box_pts((1.25, s * 0.80, 2.45), (1.10, 0.14, 1.45), bot=(0.70, 1.0))
        m.solid(rotate(ear, pivot, ang), GREY, 0.05)
        up = box_pts((1.22, s * 0.875, 2.82), (0.80, 0.08, 0.62), bot=(0.8, 1.0))
        m.solid(rotate(up, pivot, ang), GREY_L, 0.035)
        low = box_pts((1.12, s * 0.865, 2.08), (0.60, 0.07, 0.52), bot=(0.5, 1.0))
        m.solid(rotate(low, pivot, ang), EAR_IN, 0.03)

    # ── trunk: a stack of blocks with no gaps, so the chamfers make the creases; the tip curls forward ──
    n = 6
    pitch = 0.33
    z0 = 2.42
    for i in range(n):
        t = i / (n - 1)
        w = 0.80 - 0.34 * t
        cx = 2.36 + 0.08 * t + 0.10 * t ** 3
        cz = z0 - (i + 0.5) * pitch
        m.solid(box_pts((cx, 0, cz), (w, w * 1.04, pitch), top=(0.96, 0.96)), (0.64, 0.62, 0.635) if i % 2 else GREY, 0.045, 0.025)
    m.solid(box_pts((2.70, 0, 0.26), (0.44, 0.46, 0.26), top=(1.0, 1.0)), GREY, 0.05)

    # ── tusks: cream, a chain of thinning beams that leave beside the trunk root, sweep out and curl up ──
    for s in (-1, 1):
        prev = None
        segs = 8
        for i in range(segs + 1):
            t = i / segs
            p = Vector((2.14 + 0.60 * t, s * (0.50 + 0.24 * t), 1.66 - 0.08 * t + 0.66 * t ** 2.4))
            if prev is not None:
                r0 = 0.125 - 0.080 * ((i - 1) / segs)
                r1 = 0.125 - 0.080 * (i / segs)
                m.solid(beam_pts(prev, p, r0, r1), TUSK, 0.012, 0.02)
            prev = p


def assign_materials(ob):
    mat = bpy.data.materials.new("hide")
    mat.use_nodes = True
    nt = mat.node_tree
    attr = nt.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Col"
    bsdf = nt.nodes["Principled BSDF"]
    nt.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.85
    ob.data.materials.clear()
    ob.data.materials.append(mat)


def matte(name, rgb, rough=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    return m


def render(path, ob):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = int(opt('--samples', 96))
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = int(opt('--w', 1400)), int(opt('--h', 900))
    sc.render.filepath = path
    sc.view_settings.view_transform = "Khronos PBR Neutral"
    sc.view_settings.exposure = opt("--exposure", -0.25)

    world = bpy.data.worlds.new("w")
    sc.world = world
    world.use_nodes = True
    nt = world.node_tree
    bg = nt.nodes["Background"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    nt.links.new(tc.outputs["Window"], sep.inputs[0])
    nt.links.new(sep.outputs["Y"], ramp.inputs["Fac"])
    ramp.color_ramp.elements[0].color = (0.92, 0.94, 0.95, 1)
    ramp.color_ramp.elements[0].position = 0.30
    ramp.color_ramp.elements[1].color = (0.20, 0.52, 0.96, 1)
    ramp.color_ramp.elements[1].position = 0.78
    nt.links.new(ramp.outputs[0], bg.inputs[0])
    bg.inputs[1].default_value = 2.8
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 5.0
    sun.angle = math.radians(5)
    sun.color = (1.0, 0.91, 0.78)
    so = bpy.data.objects.new("sun", sun)
    sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(opt('--sun-el', 52)), 0, math.radians(opt('--sun-az', 55)))

    assign_materials(ob)

    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, 0))
    gd = bpy.context.active_object
    gm = bpy.data.materials.new("grass")
    gm.use_nodes = True
    gt = gm.node_tree
    gb = gt.nodes["Principled BSDF"]
    gb.inputs["Roughness"].default_value = 1.0
    gtc = gt.nodes.new("ShaderNodeTexCoord")
    n1 = gt.nodes.new("ShaderNodeTexNoise"); n1.inputs["Scale"].default_value = 0.5; n1.inputs["Detail"].default_value = 5.0
    n2 = gt.nodes.new("ShaderNodeTexNoise"); n2.inputs["Scale"].default_value = 5.0; n2.inputs["Detail"].default_value = 8.0
    gt.links.new(gtc.outputs["Object"], n1.inputs["Vector"]); gt.links.new(gtc.outputs["Object"], n2.inputs["Vector"])
    ramp2 = gt.nodes.new("ShaderNodeValToRGB")
    e = ramp2.color_ramp.elements
    e[0].position = 0.36; e[0].color = (0.10, 0.14, 0.04, 1)
    e[1].position = 0.66; e[1].color = (0.30, 0.26, 0.07, 1)
    e.new(0.50).color = (0.17, 0.19, 0.05, 1)
    add = gt.nodes.new("ShaderNodeMath"); add.operation = "ADD"
    a1 = gt.nodes.new("ShaderNodeMath"); a1.operation = "MULTIPLY"; a1.inputs[1].default_value = 0.75
    a2 = gt.nodes.new("ShaderNodeMath"); a2.operation = "MULTIPLY"; a2.inputs[1].default_value = 0.25
    gt.links.new(n1.outputs["Fac"], a1.inputs[0]); gt.links.new(n2.outputs["Fac"], a2.inputs[0])
    gt.links.new(a1.outputs[0], add.inputs[0]); gt.links.new(a2.outputs[0], add.inputs[1])
    gt.links.new(add.outputs[0], ramp2.inputs["Fac"])
    gt.links.new(ramp2.outputs[0], gb.inputs["Base Color"])
    gd.data.materials.append(gm)

    cam = bpy.data.cameras.new("cam")
    co = bpy.data.objects.new("cam", cam)
    sc.collection.objects.link(co)
    sc.camera = co
    tgt = Vector((0.4, 0, 1.45))
    if CAM == "side":
        co.location = Vector((0.4, -10.5, 2.0)); cam.lens = 55
    elif CAM == "back":
        co.location = Vector((-6.5, 5.0, 3.3)); cam.lens = 45
    else:
        co.location = Vector((6.4, -5.2, 3.5)); cam.lens = 45
    co.rotation_euler = (tgt - co.location).normalized().to_track_quat("-Z", "Y").to_euler()
    bpy.ops.render.render(write_still=True)
    print("RENDER", path)


def main():
    if "--rerender" in argv:
        bpy.ops.wm.open_mainfile(filepath=OUT)
        render(RENDER, bpy.data.objects["elephant"])
        return
    bpy.ops.wm.read_factory_settings(use_empty=True)
    m = Mesh("elephant")
    build(m)
    ob = m.commit()
    print(f"ELEPHANT: {len(ob.data.polygons):,} faces, {len(ob.data.vertices):,} verts")
    if "--export" in argv:
        assign_materials(ob)
        bpy.ops.object.select_all(action="DESELECT")
        ob.select_set(True)
        bpy.ops.export_scene.gltf(filepath=argv[argv.index("--export") + 1], export_format="GLB", use_selection=True,
                                  export_apply=True, export_vertex_color="MATERIAL", export_cameras=False, export_lights=False)
    bpy.ops.wm.save_as_mainfile(filepath=OUT)
    if RENDER:
        render(RENDER, ob)


main()
