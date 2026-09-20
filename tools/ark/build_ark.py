"""Noah's ark, built from scratch in Blender: bevelled planks, posts, wales, an eave.

    Blender -b --python tools/ark/build_ark.py -- out.blend [--length 36] [--render out.png]

WHY BLENDER. The concept picture the owner wants to match has a hull that is
100% SMOOTH, bevelled timber: every plank its own little piece with a rounded
edge and a seam of shadow between it and the next, iron bands with rivets, posts
standing proud. The voxel version of this scene could never get there — a voxel
is a cube, and no shader turns a cube wall into rounded planks. So the building
is modelled, and only the people and animals stay blocky.

HOW. Nothing here is placed by hand. The hull is a few numbers (length, breadth,
height in cubits, a plank's height and length) and a loop that lays courses of
planks, staggering the joints, nudging each plank a hair in and out and giving it
its own tint. Each plank is a box with its edges bevelled, which is what makes a
seam read as a seam. Change a number and the whole ark regenerates.

PROPORTIONS. Genesis 6:15: 300 x 50 x 30 cubits, at 0.445 m to the cubit. The
text gives a box and says nothing of a bow, so this is a box; the rounding is a
bevel on the corners, not a curve of the hull.
"""
import bpy, bmesh, sys, math, random
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if argv else "/tmp/ark.blend"


def opt(flag, default, cast=float):
    return cast(argv[argv.index(flag) + 1]) if flag in argv else default


CUBIT = 0.445
LENGTH = opt("--length", 300 * CUBIT)            # metres; the full ark is 133.5
BREADTH = 50 * CUBIT
HEIGHT = 30 * CUBIT
PLANK_H = opt("--plank-h", 0.30)                  # one course, in metres
PLANK_L = opt("--plank-l", 2.10)                  # one plank, in metres
RENDER = argv[argv.index("--render") + 1] if "--render" in argv else None
random.seed(11)

# ── palette: warm honey-brown timber, a darker pitch band, iron ─────────────
# MEASURED, not guessed. Sampled off the reference picture, its hull planks run
# from #523421 in shadow through #805437 to #d39861 in the sun — lighter, and
# LESS saturated than the palette this replaced (mid value 0.50 against 0.34,
# saturation 0.57 against 0.75). Those are the albedos that land there once lit.
WOODS = [(0.72, 0.57, 0.41), (0.66, 0.52, 0.37), (0.77, 0.61, 0.44), (0.61, 0.48, 0.34), (0.70, 0.55, 0.40)]
PITCH = (0.46, 0.33, 0.22)
IRON = (0.27, 0.24, 0.22)
POST = (0.55, 0.36, 0.20)
DARK = (0.33, 0.22, 0.14)      # the seam colour: was near-black, which made every seam a hole
ROPE = (0.78, 0.66, 0.44)
GLASS = (1.0, 0.72, 0.32)


def srgb(c):
    """Blender's vertex colours are linear; the palette above is sRGB."""
    f = lambda v: v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return (f(c[0]), f(c[1]), f(c[2]), 1.0)


def tint(c, k):
    """Brightness, plus a per-call drift of hue. Brightness alone gave a wall that
    was one colour in different lights; the reference's planks are visibly
    different woods — some golden, some grey-brown, some reddish."""
    d = random.uniform(-0.028, 0.028)
    r, g, b = c
    return tuple(max(0.0, min(1.0, v * k)) for v in (r + d, g + d * 0.35, b - d * 0.9))


class Mesh:
    """One bmesh that every plank is appended to, so the whole hull is a single
    object rather than six thousand. The colour layer carries each plank's own
    tint, which is baked into the export later."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.col = self.bm.loops.layers.color.new("Col")

    def box(self, centre, size, colour, bevel=0.012, segments=2, rot_z=0.0, rot_y=0.0, rot_x=0.0):
        cx, cy, cz = centre
        sx, sy, sz = size
        self.bm.faces.ensure_lookup_table()
        first = len(self.bm.faces)             # everything from here on is this plank
        ret = bmesh.ops.create_cube(self.bm, size=1.0)
        verts = ret["verts"]
        for v in verts:
            v.co.x *= sx; v.co.y *= sy; v.co.z *= sz
        if rot_x or rot_y or rot_z:
            M = Matrix.Rotation(rot_z, 3, "Z") @ Matrix.Rotation(rot_y, 3, "Y") @ Matrix.Rotation(rot_x, 3, "X")
            bmesh.ops.rotate(self.bm, verts=verts, cent=(0, 0, 0), matrix=M)
        bmesh.ops.translate(self.bm, verts=verts, vec=(cx, cy, cz))
        if bevel > 0:
            edges = list({e for v in verts for e in v.link_edges})
            # bevel DELETES the original vertices, so nothing above is used after this
            bmesh.ops.bevel(self.bm, geom=edges, offset=bevel, offset_type="OFFSET",
                            segments=segments, profile=0.55, affect="EDGES")
        self.bm.faces.ensure_lookup_table()
        col = srgb(colour)
        for f in self.bm.faces[first:]:
            for loop in f.loops:
                loop[self.col] = col
        return self

    def pillow(self, c, u, v, n, w, h, depth, bev, colour):
        """A plank with only the faces anyone can see: a flat front and a chamfer
        round it. c is the centre on the wall plane; u and v run along the plank's
        length and height, n points out of the wall. A closed bevelled box spends
        three quarters of its triangles on a back and sides that a dark backing wall
        hides — this is 10 triangles where the box was 44."""
        u = Vector(u).normalized(); v = Vector(v).normalized(); n = Vector(n).normalized()
        c = Vector(c)
        hw, hh = w / 2, h / 2
        bev = min(bev, hw * 0.45, hh * 0.45)
        def ring(dx, dy, dz):
            return [c + u * (sx * dx) + v * (sy * dy) + n * dz
                    for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        outer = [self.bm.verts.new(p) for p in ring(hw, hh, 0.0)]
        inner = [self.bm.verts.new(p) for p in ring(hw - bev, hh - bev, depth)]
        quads = [(inner[0], inner[1], inner[2], inner[3])]
        for i in range(4):
            j = (i + 1) % 4
            quads.append((outer[i], outer[j], inner[j], inner[i]))
        col = srgb(colour)
        for q in quads:
            f = self.bm.faces.new(q)
            # make every face point out of the wall, whatever order the corners came in
            nrm = (q[1].co - q[0].co).cross(q[2].co - q[1].co)
            if nrm.dot(n) < 0 and f.normal.dot(n) > -1e-9:
                f.normal_flip()
            elif f.normal.dot(n) < -0.0 and nrm.dot(n) >= 0:
                pass
            for loop in f.loops:
                loop[self.col] = col

    def ball(self, centre, r, colour):
        self.bm.faces.ensure_lookup_table()
        first = len(self.bm.faces)
        ret = bmesh.ops.create_icosphere(self.bm, subdivisions=1, radius=r)
        bmesh.ops.translate(self.bm, verts=ret["verts"], vec=centre)
        self.bm.faces.ensure_lookup_table()
        col = srgb(colour)
        for f in self.bm.faces[first:]:
            for loop in f.loops:
                loop[self.col] = col

    def commit(self, collection=None):
        me = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(me)
        self.bm.free()
        ob = bpy.data.objects.new(self.name, me)
        (collection or bpy.context.scene.collection).objects.link(ob)
        for p in me.polygons:
            p.use_smooth = False           # crisp chamfers: the facets are what catch the light
        return ob


LIFT = 1.15                                       # the ark stands on a cradle, so a ramp has somewhere to come down from
DOOR_X = opt("--door", 0.5 * LENGTH)
DOOR_W, DOOR_H = 2.7, 3.7                         # six cubits by eight and a bit


def in_hole(holes, a, b, z0, z1):
    for (hx0, hx1, hz0, hz1) in holes:
        if b > hx0 and a < hx1 and z1 > hz0 and z0 < hz1:
            return True
    return False


def clip(a, b, z0, z1, holes):
    """Cut the span a..b so it stops at the edge of any opening at this height,
    returning the pieces that remain. Whole planks used to be dropped, which left a
    ragged staircase round the door; cutting them gives the clean edge a carpenter would."""
    pieces = [(a, b)]
    for (hx0, hx1, hz0, hz1) in holes:
        if z1 <= hz0 or z0 >= hz1:
            continue
        nxt = []
        for (p0, p1) in pieces:
            if p1 <= hx0 or p0 >= hx1:
                nxt.append((p0, p1))
            else:
                if p0 < hx0: nxt.append((p0, hx0))
                if p1 > hx1: nxt.append((hx1, p1))
        pieces = nxt
    return [(p0, p1) for (p0, p1) in pieces if p1 - p0 > 0.12]


def wall(m, x0, x1, y, facing, holes=(), courses=None):
    """One long side of the hull, in courses of staggered planks, cut clean at the
    door and the windows. `facing` is +1 or -1: which way the plank face looks."""
    n = courses or int(round(HEIGHT / PLANK_H))
    for row in range(n):
        z = LIFT + PLANK_H * (row + 0.5)
        pitch = row < 4                                   # the lowest courses are pitch (Gen 6:14)
        x = x0 - PLANK_L * ((row * 0.37) % 1.0)           # every course starts elsewhere: joints never line up
        while x < x1:
            length = PLANK_L * random.uniform(0.82, 1.12)
            a, b = max(x, x0), min(x + length, x1)
            if b - a > 0.12:
                base = PITCH if pitch else random.choice(WOODS)
                k = random.uniform(0.92, 1.08)
                proud = random.uniform(-0.010, 0.016)     # a hair proud or sunk: the difference between timber and a slab
                for (p0, p1) in clip(a, b, z - PLANK_H / 2, z + PLANK_H / 2, holes):
                    m.pillow(((p0 + p1) / 2, y + facing * (proud - 0.02), z), (1, 0, 0), (0, 0, 1), (0, facing, 0),
                             (p1 - p0) - 0.018, PLANK_H - 0.020, 0.06, 0.028, tint(base, k))
            x += length


def end_wall(m, x, facing):
    """A bow or stern: planks running across the breadth."""
    n = int(round(HEIGHT / PLANK_H))
    for row in range(n):
        z = LIFT + PLANK_H * (row + 0.5)
        pitch = row < 4
        yy = -BREADTH / 2 - PLANK_L * ((row * 0.41) % 1.0)
        while yy < BREADTH / 2:
            length = PLANK_L * random.uniform(0.85, 1.15)
            a, b = max(yy, -BREADTH / 2), min(yy + length, BREADTH / 2)
            if b - a > 0.15:
                base = PITCH if pitch else random.choice(WOODS)
                m.pillow((x + facing * (random.uniform(-0.01, 0.016) - 0.02), (a + b) / 2, z), (0, 1, 0), (0, 0, 1), (facing, 0, 0),
                         (b - a) - 0.018, PLANK_H - 0.02, 0.06, 0.028, tint(base, random.uniform(0.92, 1.08)))
            yy += length


def build(m, glow):
    holes_by_side = {+1: [], -1: []}
    # the door, in the near side; windows on both, in a row under the eave
    holes_by_side[+1].append((DOOR_X - DOOR_W / 2, DOOR_X + DOOR_W / 2, LIFT + 0.02, LIFT + DOOR_H))
    post_gap = 3.30
    posts = [post_gap * i for i in range(1, int(LENGTH / post_gap))]
    win_z0, win_z1 = LIFT + HEIGHT - 1.55, LIFT + HEIGHT - 0.85
    for px in posts:
        for side in (+1, -1):
            wx0, wx1 = px + 0.45, px + post_gap - 0.45
            if not (side == +1 and wx0 < DOOR_X + 2 and wx1 > DOOR_X - 2):
                holes_by_side[side].append((wx0, wx1, win_z0, win_z1)) if False else None
    for px in posts:
        if px + post_gap * 0.5 < LENGTH - 1:
            for side in (+1, -1):
                holes_by_side[side].append((px + 0.85, px + 1.85, win_z0, win_z1))

    # a dark backing behind every wall, so a seam between planks reads as a
    # line of shadow and not as a slit of sky
    # (thinner than the hull, so the glow panels in the door and windows sit IN
    # FRONT of it — at first it filled the whole thickness and buried them)
    m.box((LENGTH / 2, 0, LIFT + HEIGHT / 2), (LENGTH - 0.05, BREADTH - 0.9, HEIGHT), DARK, bevel=0.0)
    wall(m, 0.0, LENGTH, BREADTH / 2, +1, holes_by_side[+1])
    wall(m, 0.0, LENGTH, -BREADTH / 2, -1, holes_by_side[-1])
    end_wall(m, 0.0, -1)
    end_wall(m, LENGTH, +1)

    # ribs: heavy posts standing PROUD of the planking, which is what puts a
    # line of shadow down the hull and makes it read as built, not painted
    for px in posts:
        for side in (+1, -1):
            if side == +1 and abs(px - DOOR_X) < DOOR_W / 2 + 0.3:
                continue
            m.box((px, side * (BREADTH / 2 + 0.11), LIFT + HEIGHT / 2), (0.24, 0.20, HEIGHT + 0.10), POST, bevel=0.04, segments=2)
            for zb in (LIFT + 2.0, LIFT + 6.1, LIFT + 10.2):         # iron straps with rivets
                m.box((px, side * (BREADTH / 2 + 0.215), zb), (0.34, 0.03, 0.13), IRON, bevel=0.008, segments=1)
                for dx in (-0.09, 0.09):
                    m.ball((px + dx, side * (BREADTH / 2 + 0.24), zb), 0.022, IRON)
    # wales: two long beams that run the length of the hull
    for zw in (LIFT + 4.1, LIFT + 8.3):
        for side in (+1, -1):
            m.box((LENGTH / 2, side * (BREADTH / 2 + 0.085), zw), (LENGTH + 0.3, 0.15, 0.34), POST, bevel=0.04, segments=2)

    # the door frame, and the warm interior showing through it
    fx = DOOR_X
    for sx in (-1, 1):
        m.box((fx + sx * (DOOR_W / 2 + 0.16), BREADTH / 2 + 0.10, LIFT + DOOR_H / 2 + 0.1), (0.30, 0.22, DOOR_H + 0.3), POST, bevel=0.045, segments=2)
    m.box((fx, BREADTH / 2 + 0.10, LIFT + DOOR_H + 0.2), (DOOR_W + 0.85, 0.22, 0.36), POST, bevel=0.045, segments=2)
    # the glow sits IN the opening, just behind the frame — the first version put
    # a dark slab in front of it and the doorway rendered as a black hole
    glow.box((fx, BREADTH / 2 - 0.22, LIFT + DOOR_H / 2), (DOOR_W - 0.05, 0.05, DOOR_H), GLASS, bevel=0.0)
    m.box((fx, BREADTH / 2 - 0.30, LIFT + 0.16), (DOOR_W, 1.0, 0.16), WOODS[0], bevel=0.02)          # the sill
    # the window frames, and their glow
    for side in (+1, -1):
        for (hx0, hx1, hz0, hz1) in holes_by_side[side][1 if side == +1 else 0:]:
            cx, cz = (hx0 + hx1) / 2, (hz0 + hz1) / 2
            w, h = hx1 - hx0, hz1 - hz0
            yy = side * (BREADTH / 2 + 0.05)
            m.box((cx, yy, hz1 + 0.05), (w + 0.30, 0.16, 0.10), POST, bevel=0.03, segments=2)
            m.box((cx, yy, hz0 - 0.05), (w + 0.30, 0.16, 0.10), POST, bevel=0.03, segments=2)
            for sx in (-1, 1):
                m.box((cx + sx * (w / 2 + 0.05), yy, cz), (0.10, 0.16, h + 0.2), POST, bevel=0.03, segments=2)
            glow.box((cx, side * (BREADTH / 2 - 0.16), cz), (w - 0.02, 0.04, h - 0.02), GLASS, bevel=0.0)

    # the ramp: planks with a cleat every half-metre, and a rail down each side
    rl = 6.2
    for i in range(int(rl / 0.32)):
        t = i * 0.32
        zz = LIFT + 0.10 - (LIFT + 0.10) * (t / rl)
        m.box((fx, BREADTH / 2 + 0.6 + t, zz), (DOOR_W - 0.1, 0.30, 0.08), tint(random.choice(WOODS), 1.05), bevel=0.014, segments=1)
        if i % 2 == 0:
            m.box((fx, BREADTH / 2 + 0.6 + t, zz + 0.07), (DOOR_W - 0.1, 0.06, 0.06), POST, bevel=0.012, segments=1)
    for sx in (-1, 1):
        m.box((fx + sx * (DOOR_W / 2 + 0.05), BREADTH / 2 + 0.6 + rl / 2, LIFT * 0.5 + 0.55), (0.10, rl, 0.10), POST, bevel=0.02, segments=1, rot_x=-math.atan2(LIFT, rl) * 0.0)
        for i in range(0, int(rl / 1.1)):
            t = i * 1.1
            zz = LIFT + 0.1 - (LIFT + 0.1) * (t / rl)
            m.box((fx + sx * (DOOR_W / 2 + 0.05), BREADTH / 2 + 0.6 + t, zz + 0.5), (0.09, 0.09, 1.0), POST, bevel=0.02, segments=1)

    # the cradle the ark is built on
    for i in range(int(LENGTH / 2.6) + 1):
        for sy in (-1, 1):
            m.box((i * 2.6, sy * BREADTH * 0.32, LIFT / 2), (0.55, 0.9, LIFT), tint(POST, 0.9), bevel=0.05, segments=2)

    roof_and_rail(m)
    lanterns(m, glow, posts)
    scaffold(m, DOOR_X + 9.0)


def roof_and_rail(m):
    """The roof, a plank deck with a two-cubit eave, rafter ends under it, a
    ridge, and a low railing all round with a post every couple of metres."""
    zt = LIFT + HEIGHT
    yy = -BREADTH / 2 - 0.95
    row = 0
    while yy < BREADTH / 2 + 0.95:
        x = -0.9 - PLANK_L * ((row * 0.43) % 1.0)
        while x < LENGTH + 0.9:
            length = PLANK_L * random.uniform(0.9, 1.15)
            a, b = max(x, -0.9), min(x + length, LENGTH + 0.9)
            if b - a > 0.15:
                m.pillow(((a + b) / 2, yy + 0.15, zt), (1, 0, 0), (0, 1, 0), (0, 0, 1),
                         (b - a) - 0.02, 0.28, 0.07, 0.024, tint(random.choice(WOODS), random.uniform(0.9, 1.06)))
            x += length
        yy += 0.30; row += 1
    for i in range(int((LENGTH + 1.8) / 1.1)):                # rafter ends showing under the eave
        for sy in (-1, 1):
            m.box((-0.9 + i * 1.1, sy * (BREADTH / 2 + 0.75), zt - 0.12), (0.16, 0.5, 0.20), POST, bevel=0.03, segments=1)
    m.box((LENGTH / 2, 0, zt + 0.22), (LENGTH + 1.6, 0.30, 0.22), POST, bevel=0.05, segments=2)   # the ridge
    # railing
    for sy in (-1, 1):
        ry = sy * (BREADTH / 2 + 0.75)
        for i in range(int(LENGTH / 2.2) + 1):
            m.box((i * 2.2, ry, zt + 0.55), (0.14, 0.14, 1.0), POST, bevel=0.03, segments=1)
        m.box((LENGTH / 2, ry, zt + 1.02), (LENGTH + 0.2, 0.12, 0.12), POST, bevel=0.03, segments=1)
        m.box((LENGTH / 2, ry, zt + 0.62), (LENGTH + 0.2, 0.08, 0.08), POST, bevel=0.02, segments=1)
    for ex in (-0.9, LENGTH + 0.9):
        m.box((ex, 0, zt + 1.02), (0.12, BREADTH + 1.7, 0.12), POST, bevel=0.03, segments=1)


def lanterns(m, glow, posts):
    """A lantern on a bracket beside the door and on every fourth rib."""
    spots = [(DOOR_X - DOOR_W / 2 - 0.55, +1), (DOOR_X + DOOR_W / 2 + 0.55, +1)]
    spots += [(px, +1) for i, px in enumerate(posts) if i % 4 == 1 and abs(px - DOOR_X) > 3]
    for (x, side) in spots:
        y = side * (BREADTH / 2 + 0.45)
        z = LIFT + 4.6
        m.box((x, side * (BREADTH / 2 + 0.30), z + 0.30), (0.06, 0.34, 0.06), IRON, bevel=0.01, segments=1)       # bracket
        m.box((x, y, z + 0.13), (0.22, 0.22, 0.04), IRON, bevel=0.008, segments=1)                                 # cap
        m.box((x, y, z - 0.12), (0.20, 0.20, 0.30), DARK, bevel=0.015, segments=1)                                 # frame
        glow.box((x, y, z - 0.12), (0.15, 0.15, 0.24), GLASS, bevel=0.01, segments=1)                               # the glass


def scaffold(m, x0):
    """A working stage against the hull: uprights, ledgers, braces, two boarded lifts and a ladder."""
    y0 = BREADTH / 2 + 0.6
    bay, bays = 2.4, 4
    top = LIFT + 8.6
    for i in range(bays + 1):
        for dy in (0.0, 1.5):
            m.box((x0 + i * bay, y0 + dy, top / 2), (0.14, 0.14, top), POST, bevel=0.03, segments=1)
    for z in (LIFT + 2.6, LIFT + 5.6, LIFT + 8.4):
        for dy in (0.0, 1.5):
            m.box((x0 + bay * bays / 2, y0 + dy, z), (bay * bays + 0.3, 0.12, 0.12), POST, bevel=0.025, segments=1)
        for i in range(bays + 1):
            m.box((x0 + i * bay, y0 + 0.75, z), (0.12, 1.6, 0.12), POST, bevel=0.025, segments=1)
    for z in (LIFT + 2.6, LIFT + 5.6):                          # the boarded lifts
        for i in range(int(bay * bays / 0.30)):
            m.box((x0 + 0.15 + i * 0.30, y0 + 0.75, z + 0.08), (0.28, 1.7, 0.07), tint(random.choice(WOODS), 1.0), bevel=0.01, segments=1)
    for i in range(bays):                                       # diagonal cross-bracing, alternating
        for (za, zb) in ((0.0, LIFT + 2.6), (LIFT + 2.6, LIFT + 5.6)):
            zc = (za + zb) / 2 if za else zb / 2
            hh = zb - za if za else zb
            ang = math.atan2(hh, bay) * (1 if i % 2 == 0 else -1)
            m.box((x0 + (i + 0.5) * bay, y0 + 1.5, zc), (math.hypot(bay, hh) - 0.1, 0.09, 0.09), POST, bevel=0.02, segments=1, rot_y=-ang)
    for i in range(int((LIFT + 5.6) / 0.34)):                   # a ladder up the end
        m.box((x0 - 0.5, y0 + 0.4, 0.2 + i * 0.34), (0.05, 0.40, 0.06), POST, bevel=0.01, segments=1)
    for dy in (0.2, 0.6):
        m.box((x0 - 0.5, y0 + dy, (LIFT + 5.6) / 2), (0.06, 0.06, LIFT + 5.7), POST, bevel=0.015, segments=1)
    # a crate and a barrel on the lower lift, so it looks worked on
    m.box((x0 + 1.4, y0 + 0.75, LIFT + 2.6 + 0.4), (0.7, 0.7, 0.7), tint(WOODS[1], 0.9), bevel=0.03, segments=2)
    m.box((x0 + 2.4, y0 + 0.75, LIFT + 2.6 + 0.35), (0.5, 0.5, 0.6), tint(WOODS[3], 0.85), bevel=0.05, segments=2)


def main():
    if "--rerender" in argv:
        # geometry already built and saved: just open it and render, in seconds
        bpy.ops.wm.open_mainfile(filepath=OUT)
        render(RENDER, bpy.data.objects["hull"], bpy.data.objects["glow"])
        return
    bpy.ops.wm.read_factory_settings(use_empty=True)
    hull, glow = Mesh("hull"), Mesh("glow")
    build(hull, glow)
    ho = hull.commit(); go = glow.commit()
    print(f"ARK hull: {len(ho.data.polygons):,} faces  glow: {len(go.data.polygons):,} faces")
    if "--export" in argv:
        export_glb(argv[argv.index("--export") + 1], ho, go)
    bpy.ops.wm.save_as_mainfile(filepath=OUT)
    if RENDER:
        render(RENDER, ho, go)


def assign_materials(ho, go):
    """The timber reads the per-plank tint from the Col attribute; the glow is a
    plain emission. Kept apart from render() because the glTF export needs them too."""
    mat = bpy.data.materials.new("timber"); mat.use_nodes = True
    n = mat.node_tree
    attr = n.nodes.new("ShaderNodeVertexColor"); attr.layer_name = "Col"
    bsdf = n.nodes["Principled BSDF"]
    n.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.85
    mat.use_backface_culling = True
    ho.data.materials.clear(); ho.data.materials.append(mat)
    gmat = bpy.data.materials.new("glow"); gmat.use_nodes = True
    gn = gmat.node_tree
    for nd in list(gn.nodes):
        gn.nodes.remove(nd)
    em = gn.nodes.new("ShaderNodeEmission"); em.inputs["Color"].default_value = (1.0, 0.52, 0.16, 1); em.inputs["Strength"].default_value = 2.2
    out = gn.nodes.new("ShaderNodeOutputMaterial"); gn.links.new(em.outputs[0], out.inputs[0])
    go.data.materials.clear(); go.data.materials.append(gmat)


def export_glb(path, ho, go):
    assign_materials(ho, go)
    bpy.ops.object.select_all(action="DESELECT")
    ho.select_set(True); go.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True,
                              export_apply=True, export_vertex_color="MATERIAL",
                              export_cameras=False, export_lights=False)
    print("EXPORT", path)


def matte(name, rgb, rough=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1); b.inputs["Roughness"].default_value = rough
    return m


def landscape(sc):
    """Blue-green hills on the horizon and a scatter of low-poly trees. Nothing here
    is Scripture; it is what makes a building look like it stands somewhere, and it
    is most of the colour in the picture the owner is matching."""
    rnd = random.Random(5)
    # distant hills go BLUE-GREY and pale with distance, not mint: aerial perspective
    hill_mats = [matte("h1", (0.05, 0.11, 0.08)), matte("h2", (0.07, 0.14, 0.13)), matte("h3", (0.10, 0.17, 0.19))]
    for i in range(14):
        a = rnd.uniform(-0.9, 0.9)
        d = rnd.uniform(160, 300)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1, location=(LENGTH * 0.5 + math.sin(a) * d * 1.6, -d - 60, -4))
        ob = bpy.context.active_object
        ob.scale = (rnd.uniform(40, 90), rnd.uniform(30, 60), rnd.uniform(14, 44))
        ob.data.materials.append(hill_mats[i % 3])
    leaf = [matte("t1", (0.05, 0.13, 0.04)), matte("t2", (0.09, 0.17, 0.04)), matte("t3", (0.16, 0.19, 0.04))]
    trunk = matte("trunk", (0.18, 0.11, 0.06))
    for i in range(46):
        x = rnd.uniform(-30, LENGTH + 30)
        y = rnd.choice([-1, 1]) * rnd.uniform(BREADTH / 2 + 8, 70)
        if y > 0 and abs(x - DOOR_X) < 26:
            continue                                     # keep the door's yard clear
        h = rnd.uniform(5.0, 9.5)
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.28, depth=h * 0.45, location=(x, y, h * 0.22))
        bpy.context.active_object.data.materials.append(trunk)
        if rnd.random() < 0.5:                           # a conifer
            bpy.ops.mesh.primitive_cone_add(vertices=7, radius1=h * 0.30, depth=h * 0.85, location=(x, y, h * 0.62))
        else:                                            # a broadleaf
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=h * 0.34, location=(x, y, h * 0.62))
            bpy.context.active_object.scale = (1.0, 1.0, 0.85)
        bpy.context.active_object.data.materials.append(leaf[i % 3])


def render(path, ho, go):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 64
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = 1600, 900
    sc.render.filepath = path
    # STANDARD, not AgX/Filmic: the filmic curves desaturate and darken timber, and
    # the first render read as brick for exactly that reason
    sc.view_settings.view_transform = "Khronos PBR Neutral"; sc.view_settings.exposure = -0.25    # the same operator the Three.js viewer uses

    world = bpy.data.worlds.new("w"); sc.world = world; world.use_nodes = True
    nt = world.node_tree
    bg = nt.nodes["Background"]
    # a plain two-tone sky. The physical (Nishita/multi-scattering) sky put a
    # blazing sun disc in frame and turned the whole picture white.
    tc = nt.nodes.new("ShaderNodeTexCoord"); sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    nt.links.new(tc.outputs["Window"], sep.inputs[0])
    nt.links.new(sep.outputs["Y"], ramp.inputs["Fac"])
    ramp.color_ramp.elements[0].color = (0.92, 0.94, 0.95, 1); ramp.color_ramp.elements[0].position = 0.30
    ramp.color_ramp.elements[1].color = (0.20, 0.52, 0.96, 1); ramp.color_ramp.elements[1].position = 0.78
    # soft cumulus: noise stretched along x, thresholded, laid over the blue
    cn = nt.nodes.new("ShaderNodeTexNoise"); cn.inputs["Scale"].default_value = 3.2; cn.inputs["Detail"].default_value = 6.0
    mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (1.0, 2.4, 1.0)
    nt.links.new(tc.outputs["Window"], mp.inputs[0]); nt.links.new(mp.outputs[0], cn.inputs["Vector"])
    cr = nt.nodes.new("ShaderNodeMapRange"); cr.inputs["From Min"].default_value = 0.52; cr.inputs["From Max"].default_value = 0.72
    nt.links.new(cn.outputs["Fac"], cr.inputs["Value"])
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"
    nt.links.new(cr.outputs[0], mix.inputs["Factor"])
    nt.links.new(ramp.outputs[0], mix.inputs["A"]); mix.inputs["B"].default_value = (1.0, 0.99, 0.97, 1)
    nt.links.new(mix.outputs["Result"], bg.inputs[0]); bg.inputs[1].default_value = 2.8
    sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 5.0; sun.angle = math.radians(5); sun.color = (1.0, 0.91, 0.78)
    so = bpy.data.objects.new("sun", sun); sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(50), math.radians(0), math.radians(215))

    assign_materials(ho, go)

    bpy.ops.mesh.primitive_plane_add(size=600, location=(LENGTH / 2, 0, 0))
    gd = bpy.context.active_object
    gm = bpy.data.materials.new("grass"); gm.use_nodes = True
    gt = gm.node_tree
    gb = gt.nodes["Principled BSDF"]; gb.inputs["Roughness"].default_value = 1.0
    gtc = gt.nodes.new("ShaderNodeTexCoord")
    n1 = gt.nodes.new("ShaderNodeTexNoise"); n1.inputs["Scale"].default_value = 0.16; n1.inputs["Detail"].default_value = 5.0
    n2 = gt.nodes.new("ShaderNodeTexNoise"); n2.inputs["Scale"].default_value = 1.6; n2.inputs["Detail"].default_value = 8.0
    gt.links.new(gtc.outputs["Object"], n1.inputs["Vector"]); gt.links.new(gtc.outputs["Object"], n2.inputs["Vector"])
    ramp2 = gt.nodes.new("ShaderNodeValToRGB")
    e = ramp2.color_ramp.elements
    e[0].position = 0.36; e[0].color = (0.10, 0.14, 0.04, 1)       # deep olive
    e[1].position = 0.66; e[1].color = (0.30, 0.26, 0.07, 1)       # sunlit gold
    e.new(0.50).color = (0.17, 0.19, 0.05, 1)
    mixn = gt.nodes.new("ShaderNodeMath"); mixn.operation = "ADD"
    sc1 = gt.nodes.new("ShaderNodeMath"); sc1.operation = "MULTIPLY"; sc1.inputs[1].default_value = 0.75
    sc2 = gt.nodes.new("ShaderNodeMath"); sc2.operation = "MULTIPLY"; sc2.inputs[1].default_value = 0.25
    gt.links.new(n1.outputs["Fac"], sc1.inputs[0]); gt.links.new(n2.outputs["Fac"], sc2.inputs[0])
    gt.links.new(sc1.outputs[0], mixn.inputs[0]); gt.links.new(sc2.outputs[0], mixn.inputs[1])
    gt.links.new(mixn.outputs[0], ramp2.inputs["Fac"])
    gt.links.new(ramp2.outputs[0], gb.inputs["Base Color"])
    gd.data.materials.append(gm)

    landscape(sc)

    cam = bpy.data.cameras.new("cam"); cam.lens = 40
    co = bpy.data.objects.new("cam", cam); sc.collection.objects.link(co); sc.camera = co
    which = argv[argv.index("--cam") + 1] if "--cam" in argv else "door"
    if which == "wide":
        tgt = Vector((LENGTH * 0.42, BREADTH / 2, LIFT + 6.0)); co.location = tgt + Vector((-58.0, 96.0, 16.0)); cam.lens = 34
    elif which == "bow":
        tgt = Vector((4.0, 3.0, LIFT + 6.0)); co.location = Vector((-22.0, 34.0, 5.0))
    else:
        tgt = Vector((DOOR_X + 1.5, BREADTH / 2, LIFT + 5.0)); co.location = tgt + Vector((-24.0, 44.0, 2.0))
    co.rotation_euler = (tgt - co.location).normalized().to_track_quat("-Z", "Y").to_euler()
    bpy.ops.render.render(write_still=True)
    print("RENDER", path)


main()
