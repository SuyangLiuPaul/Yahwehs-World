"""Animals built from scratch in Blender, in the chamfered-block style of the concept picture.

    Blender -b --python tools/ark/build_animals.py -- out.blend [--animal elephant|giraffe|both]
        [--render out.png] [--cam hero|side|back|zoo] [--export-dir dir] [--rerender]

HOW. Same method as build_ark.py: everything is a few numbers and a loop. Every part is a
`solid` -- eight corner points, six faces, its edges chamfered -- which is what gives the
picture's animals their cut-gem look (a voxel cube cannot do a sloped forehead; a chamfered
block can). Legs are tapered blocks, an elephant's trunk a stack of blocks, a giraffe's neck
a leaning stack with a mane block on each course, tusks and ossicones thinning beams.

PAINT. The picture's animals look hand-painted, not flat-shaded. Two cheap things get most
of the way: every corner of every face carries its own small brightness (so faces shade in
soft blotches, not uniform tiles) and a slow position-based ripple, and everything darkens
a little toward the ground so feet sit in contact shadow.

SIZE. Chosen proportions, not measurements: an elephant 3.1 m to the crown, a giraffe 6.1 m
to the ossicone tips. A giraffe's patches are thin blocks scattered on a grid, each on the
surface it sits on, so they read as raised tiles the way the picture's do.
"""
import bpy, bmesh, sys, math, random
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else "/tmp/animals.blend"
RENDER = argv[argv.index("--render") + 1] if "--render" in argv else None
CAM = argv[argv.index("--cam") + 1] if "--cam" in argv else "hero"
WHICH = argv[argv.index("--animal") + 1] if "--animal" in argv else "both"


def opt(flag, default):
    return float(argv[argv.index(flag) + 1]) if flag in argv else default


# ── palette (sRGB albedo; what lands on screen is lit and tone-mapped) ──
GREY = (0.665, 0.635, 0.645)
GREY_L = (0.76, 0.72, 0.73)
GREY_D = (0.47, 0.445, 0.46)
FOOT = (0.62, 0.61, 0.70)
TOE = (0.70, 0.69, 0.78)
EAR_IN = (0.60, 0.56, 0.57)
TUSK = (0.97, 0.95, 0.88)
EYE = (0.03, 0.03, 0.04)
GLINT = (1.0, 1.0, 1.0)

GIR = (0.96, 0.80, 0.40)
GIR_L = (0.98, 0.86, 0.54)
PATCH = (0.60, 0.36, 0.18)
MANE = (0.30, 0.17, 0.09)
MUZZLE = (0.98, 0.84, 0.56)
HOOF = (0.10, 0.09, 0.09)

WOOD = (0.55, 0.38, 0.22)
STRAW = (0.86, 0.68, 0.30)


def srgb(c):
    f = lambda v: v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (f(c[0]), f(c[1]), f(c[2]), 1.0)


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


class Mesh:
    def __init__(self, name, origin=(0, 0, 0)):
        self.name = name
        self.origin = Vector(origin)
        self.bm = bmesh.new()
        self.col = self.bm.loops.layers.color.new("Col")
        self.done = self.bm.faces.layers.int.new("done")
        self.rng = random.Random(name)

    def solid(self, pts, colour, bev=0.05, jitter=0.03, seg=1, blotch=0.05):
        """pts: four bottom corners then four top corners. One closed block, chamfered.
        Each face gets a faint overall brightness; each CORNER of each face a little more
        plus a slow ripple in world position, so the faces read as brushed, not tiled."""
        bm = self.bm
        v = [bm.verts.new(Vector(p) + self.origin) for p in pts]
        quads = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
        faces = [bm.faces.new([v[i] for i in q]) for q in quads]
        bmesh.ops.recalc_face_normals(bm, faces=faces)
        if bev > 0:
            edges = list({e for vv in v for e in vv.link_edges})
            bmesh.ops.bevel(bm, geom=edges, offset=bev, offset_type="OFFSET", segments=seg, profile=0.5, affect="EDGES")
        r = self.rng
        for f in bm.faces:
            if f[self.done]:
                continue
            f[self.done] = 1
            k = 1 + r.uniform(-jitter, jitter)
            for loop in f.loops:
                co = loop.vert.co - self.origin
                ripple = 0.5 * math.sin(2.9 * co.x + 1.3 * co.y) * math.cos(2.1 * co.z - 0.7 * co.x)
                ground = 0.80 + 0.20 * smooth(co.z / 0.7)
                kk = k * (1 + blotch * ripple + r.uniform(-blotch, blotch) * 0.6) * ground
                loop[self.col] = srgb(tuple(min(1.0, c * kk) for c in colour))

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


# ═════════════════════════════ the elephant ═════════════════════════════
def build_elephant(m):
    # legs: thick tapered pillars on a bluish foot pad with four toe blocks
    for x in (0.85, -0.95):
        for s in (-1, 1):
            y = s * 0.52
            m.solid(box_pts((x, y, 0.80), (0.72, 0.72, 1.50), top=(1.0, 1.0), bot=(0.84, 0.84)), GREY, 0.07, seg=2)
            m.solid(box_pts((x + 0.02, y, 0.07), (0.80, 0.82, 0.14), top=(0.96, 0.96)), FOOT, 0.03)
            for k in (-1.5, -0.5, 0.5, 1.5):
                m.solid(box_pts((x + 0.34, y + k * 0.19, 0.08), (0.13, 0.16, 0.16), top=(0.95, 0.95)), TOE, 0.02)

    # body: a faceted barrel, big rounded chamfers
    m.solid(box_pts((-0.20, 0, 2.20), (2.50, 1.70, 1.60), top=(0.90, 0.78), bot=(0.94, 0.84)), GREY, 0.38, seg=3)
    m.solid(box_pts((-1.36, 0, 2.12), (0.60, 1.40, 1.40), top=(0.90, 0.78), shift=(-0.03, 0)), GREY, 0.20, seg=2)
    m.solid(box_pts((-0.25, 0, 1.44), (1.9, 1.10, 0.20), bot=(0.85, 0.8)), GREY_D, 0.05)
    m.solid(beam_pts((-1.66, 0, 2.50), (-1.76, 0, 1.40), 0.07, 0.05), GREY_D, 0.01, 0.02)
    m.solid(box_pts((-1.76, 0, 1.26), (0.16, 0.14, 0.26)), GREY_D, 0.02)

    # head: a big block, the forehead sloping back to a rounded dome
    m.solid(box_pts((1.62, 0, 2.32), (1.32, 1.50, 1.66), top=(0.88, 0.80), shift=(-0.14, 0)), GREY, 0.20, seg=2)
    m.solid(box_pts((1.42, 0, 3.22), (1.06, 1.16, 0.34), top=(0.68, 0.72), shift=(-0.04, 0)), GREY_L, 0.14, seg=2)
    for s in (-1, 1):
        m.solid(box_pts((2.22, s * 0.50, 2.65), (0.05, 0.10, 0.14)), EYE, 0.0, 0.0)
        m.solid(box_pts((2.245, s * 0.50 + s * 0.012, 2.70), (0.02, 0.035, 0.04)), GLINT, 0.0, 0.0)

    # ears: one big, broad, rounded flap hinged at the front edge, the rear swung out
    for s in (-1, 1):
        ang = -s * 0.30
        pivot = (1.90, s * 0.80, 2.65)
        ear = box_pts((1.28, s * 0.88, 2.58), (1.36, 0.16, 1.45), top=(0.92, 1.0), bot=(0.78, 1.0))
        m.solid(rotate(ear, pivot, ang), (0.68, 0.645, 0.66), 0.13, seg=1)

    # trunk: a stack of fine courses that thins as it falls, curving forward, tip clear of the ground
    n, pitch, z0 = 9, 0.235, 2.60
    for i in range(n):
        t = i / (n - 1)
        w = 0.86 - 0.42 * t
        cx = 2.38 + 0.035 * i
        cz = z0 - (i + 0.5) * pitch
        pts = box_pts((cx, 0, cz), (w, w * 1.04, pitch + 0.02), top=(0.97, 0.97))
        m.solid(pts, (0.60, 0.575, 0.62) if i % 2 else GREY, 0.035, 0.03)

    # tusks: cream, thick at the root, sweeping out and curling up
    for s in (-1, 1):
        prev = None
        segs = 8
        for i in range(segs + 1):
            t = i / segs
            p = Vector((2.14 + 0.62 * t, s * (0.54 + 0.30 * t), 1.72 - 0.06 * t + 0.64 * t ** 2.4))
            if prev is not None:
                r0 = 0.15 - 0.085 * ((i - 1) / segs)
                r1 = 0.15 - 0.085 * (i / segs)
                m.solid(beam_pts(prev, p, r0, r1), TUSK, 0.012, 0.02)
            prev = p


# ═════════════════════════════ the giraffe ═════════════════════════════
def patches_on(m, rng, face, along, up, fixed, sign, cell, skip=0.30, size=(0.10, 0.20), depth=0.05, margin=0.08):
    """Scatter raised brown tiles over one flat face. face='y' means the face sits at y=fixed*sign
    and is spanned by x (along) and z (up); face='x' the reverse."""
    a0, a1 = along
    u0, u1 = up
    a = a0 + margin
    while a < a1 - margin:
        u = u0 + margin
        while u < u1 - margin:
            if rng.random() > skip:
                w = rng.uniform(*size)
                h = rng.uniform(*size) * rng.choice((0.8, 1.0, 1.25))
                ca = a + rng.uniform(-0.02, 0.02)
                cu = u + rng.uniform(-0.02, 0.02)
                if face == "y":
                    pts = box_pts((ca, sign * fixed, cu), (w, depth * 2, h))
                else:
                    pts = box_pts((fixed, ca, cu), (depth * 2, w, h))
                m.solid(pts, PATCH, 0.012, 0.05)
                if rng.random() < 0.55:      # a second tile pushed against the first: an L or a step, like the picture's
                    da = rng.choice((-1, 1)) * w * 0.55
                    du = rng.choice((-1, 1)) * h * 0.55
                    if face == 'y':
                        p2 = box_pts((ca + da, sign * fixed, cu + du), (w * 0.6, depth * 2, h * 0.6))
                    else:
                        p2 = box_pts((fixed, ca + da, cu + du), (depth * 2, w * 0.6, h * 0.6))
                    m.solid(p2, PATCH, 0.01, 0.05)
            u += cell
        a += cell


def build_giraffe(m):
    rng = random.Random(9)
    body_top, body_bot = 3.25, 2.05
    # legs: an upper pillar, a knee step, a thinner lower pillar, a black hoof
    for x in (0.72, -0.72):
        for s in (-1, 1):
            y = s * 0.30
            m.solid(box_pts((x, y, 1.60), (0.40, 0.40, 1.00), top=(1.0, 1.0), bot=(0.86, 0.86)), GIR, 0.04, blotch=0.04)
            m.solid(box_pts((x, y, 0.625), (0.34, 0.34, 0.95), bot=(0.86, 0.86)), GIR, 0.04, blotch=0.04)
            m.solid(box_pts((x, y, 0.07), (0.36, 0.38, 0.16)), HOOF, 0.02, 0.02)
            for zc in (1.95, 1.45, 0.90, 0.45):
                if rng.random() < 0.75:
                    m.solid(box_pts((x + rng.uniform(-0.04, 0.04), y + s * 0.20, zc), (0.16, 0.035, 0.22)), PATCH, 0.01, 0.05)

    # torso: a slim block that dips a little to the rump, with a hump at the shoulder
    m.solid(box_pts((0.0, 0, (body_top + body_bot) / 2), (2.20, 0.98, body_top - body_bot), top=(0.92, 0.86)), GIR, 0.10, seg=1)
    m.solid(box_pts((0.65, 0, body_top + 0.02), (0.85, 0.78, 0.22), top=(0.85, 0.8)), GIR, 0.07)
    m.solid(box_pts((0.0, 0, body_bot + 0.05), (1.8, 0.76, 0.16)), (0.80, 0.62, 0.30), 0.04)
    for s in (-1, 1):
        patches_on(m, rng, "y", (-1.00, 1.10), (2.10, 3.18), 0.49 * 0.97, s, 0.36, skip=0.08, size=(0.16, 0.28), depth=0.03, margin=0.14)
    # tail
    m.solid(beam_pts((-1.12, 0, 3.05), (-1.20, 0, 1.75), 0.05, 0.04), GIR, 0.01, 0.02)
    m.solid(box_pts((-1.20, 0, 1.62), (0.14, 0.12, 0.28)), MANE, 0.02)

    # neck: a leaning stack. Each course is a little further forward and a little narrower.
    n = 7
    pitch = 0.50
    z0 = body_top - 0.05
    cxs = []
    for i in range(n):
        t = i / (n - 1)
        wy = 0.72 - 0.30 * t
        wx = 0.84 - 0.40 * t
        cx = 0.80 + 0.62 * t
        cz = z0 + (i + 0.5) * pitch
        cxs.append((cx, cz, wx, wy))
        m.solid(box_pts((cx, 0, cz), (wx, wy, pitch + 0.02), top=(0.97, 0.97), shift=(0.03, 0)), GIR, 0.055, blotch=0.04)
        # the mane: a dark block on the back of each course
        m.solid(box_pts((cx - wx / 2 - 0.02, 0, cz), (0.10, 0.10, pitch * 0.82)), MANE if i % 2 else (0.36, 0.21, 0.11), 0.02, 0.05)
        # patches on both flanks and on the front
        for s in (-1, 1):
            if rng.random() < 0.9:
                m.solid(box_pts((cx + rng.uniform(-0.06, 0.06), s * (wy / 2 + 0.006), cz + rng.uniform(-0.1, 0.1)),
                                (rng.uniform(0.16, 0.26), 0.04, rng.uniform(0.20, 0.32))), PATCH, 0.01, 0.05)
        m.solid(box_pts((cx + wx / 2 + 0.008 + 0.015, rng.uniform(-0.05, 0.05), cz + rng.uniform(-0.08, 0.08)),
                        (0.04, rng.uniform(0.16, 0.24), rng.uniform(0.20, 0.30))), PATCH, 0.01, 0.05)

    # head: a box, a muzzle that sticks out, a black eye each side, ossicones with dark tips, ears
    hx, hz = cxs[-1][0] + 0.18, cxs[-1][1] + pitch / 2 + 0.22
    m.solid(box_pts((hx, 0, hz), (0.74, 0.52, 0.44), top=(0.95, 0.92)), GIR, 0.06)
    m.solid(box_pts((hx + 0.52, 0, hz - 0.07), (0.44, 0.38, 0.32)), MUZZLE, 0.05)
    for s in (-1, 1):
        m.solid(box_pts((hx + 0.74, s * 0.10, hz - 0.03), (0.02, 0.08, 0.07)), HOOF, 0.0, 0.0)          # nostril
        m.solid(box_pts((hx + 0.22, s * 0.265, hz + 0.07), (0.11, 0.03, 0.12)), EYE, 0.0, 0.0)
        m.solid(box_pts((hx + 0.24, s * 0.28, hz + 0.11), (0.035, 0.02, 0.035)), GLINT, 0.0, 0.0)
        m.solid(beam_pts((hx - 0.10, s * 0.14, hz + 0.20), (hx - 0.12, s * 0.14, hz + 0.52), 0.06, 0.055), GIR, 0.01, 0.02)
        m.solid(box_pts((hx - 0.12, s * 0.14, hz + 0.58), (0.15, 0.15, 0.13)), MANE, 0.02)               # the dark tip
        ear = box_pts((hx - 0.20, s * 0.38, hz + 0.12), (0.26, 0.24, 0.10), top=(0.9, 0.9))
        m.solid(rotate(ear, (hx - 0.20, s * 0.26, hz + 0.12), s * -0.3, "X"), GIR_L, 0.02)
    m.solid(box_pts((hx - 0.02, 0, hz + 0.20), (0.42, 0.30, 0.06)), MANE, 0.02)                         # a forelock


# ═════════════════════════════ set dressing (render only) ═════════════════════════════
def build_props(m, span=8.0, y=3.6):
    rng = random.Random(3)
    x = -span
    while x <= span:
        m.solid(box_pts((x, y, 0.55), (0.20, 0.20, 1.10), top=(0.9, 0.9)), WOOD, 0.03)
        if x < span:
            for zc in (0.40, 0.82):
                m.solid(box_pts((x + 0.85, y, zc), (1.7, 0.08, 0.16)), (0.60, 0.42, 0.25), 0.02)
        x += 1.7
    for bx, by in ((-3.4, 2.2), (3.6, 2.4)):
        for k in range(3):
            m.solid(box_pts((bx, by, 0.22 + k * 0.42), (1.1 - k * 0.1, 0.72, 0.44)), STRAW if k % 2 else (0.90, 0.72, 0.34), 0.06, 0.06, blotch=0.08)


# ═════════════════════════════ scene ═════════════════════════════
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


CAMS = {
    # name: (location, target, lens, width, height)
    "hero": ((8.6, -7.0, 4.2), (0.4, 0, 1.6), 45, 1200, 780),
    "side": ((0.4, -10.5, 2.0), (0.4, 0, 1.45), 55, 1200, 780),
    "back": ((-6.5, 5.0, 3.3), (0.4, 0, 1.45), 45, 1200, 780),
    "giraffe": ((13.0, -10.0, 3.8), (0.9, 0, 3.15), 46, 900, 1100),
    "giraffe-side": ((1.0, -19.0, 3.4), (1.0, 0, 3.1), 46, 900, 1100),
    "zoo": ((6.0, -21.0, 5.8), (0.0, 0, 2.6), 38, 1700, 900),
}


def render(path, obs):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = int(opt("--samples", 96))
    sc.cycles.use_denoising = True
    loc, tgt, lens, w, h = CAMS[CAM]
    sc.render.resolution_x, sc.render.resolution_y = int(opt("--w", w)), int(opt("--h", h))
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
    so.rotation_euler = (math.radians(opt("--sun-el", 52)), 0, math.radians(opt("--sun-az", 55)))

    for ob in obs:
        assign_materials(ob)

    bpy.ops.mesh.primitive_plane_add(size=300, location=(0, 0, 0))
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
    co.location = Vector(loc)
    cam.lens = lens
    co.rotation_euler = (Vector(tgt) - co.location).normalized().to_track_quat("-Z", "Y").to_euler()
    bpy.ops.render.render(write_still=True)
    print("RENDER", path)


def export(ob, path):
    assign_materials(ob)
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True,
                              export_vertex_color="MATERIAL", export_cameras=False, export_lights=False)
    print("EXPORT", path)


def main():
    if "--rerender" in argv:
        bpy.ops.wm.open_mainfile(filepath=OUT)
        render(RENDER, [o for o in bpy.data.objects if o.type == "MESH" and o.name in ("elephant", "giraffe", "props")])
        return
    bpy.ops.wm.read_factory_settings(use_empty=True)
    zoo = CAM == "zoo"
    spec = []
    if WHICH in ("elephant", "both"):
        spec.append(("elephant", build_elephant, (-4.2, 0, 0) if zoo else (0, 0, 0)))
    if WHICH in ("giraffe", "both"):
        spec.append(("giraffe", build_giraffe, (3.4, -0.4, 0) if zoo else (0, 0, 0)))
    obs = []
    for name, fn, origin in spec:
        m = Mesh(name, origin)
        fn(m)
        ob = m.commit()
        print(f"{name.upper()}: {len(ob.data.polygons):,} faces")
        obs.append(ob)
    if "--export-dir" in argv:
        d = argv[argv.index("--export-dir") + 1]
        for ob in obs:
            export(ob, f"{d}/{ob.name}.glb")
    if RENDER:
        pm = Mesh("props")
        build_props(pm, span=7.0, y=4.2)
        obs.append(pm.commit())
    bpy.ops.wm.save_as_mainfile(filepath=OUT)
    if RENDER:
        render(RENDER, obs)


main()
