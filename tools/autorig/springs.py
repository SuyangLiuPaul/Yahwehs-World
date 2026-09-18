"""Spring bones: the cloth that SWAYS.

The robe, the girdle's ends, a head-cloth and a beard are skinned to the body's
own skeleton, so each patch of cloth moves exactly as the bone under it moves
and not a millimetre more: the hem is a rigid skirt, the girdle's ends are
nailed to the thigh, a veil turns with the head as one piece. And because the
skirt follows the LEGS, a stride puts a knee straight through the cloth — see
the walk row of any clip sheet before this existed.

This adds what a cloth rig in a game has: chains of extra bones under the
cloth — "spring" or "jiggle" bones — that the app swings at run time
(src/walk/springs.ts). Each bone's tip is a point with a little mass, pulled
back toward where it rests, damped, and kept off the body by capsule
colliders on the legs, hips, chest and head. The cloth's vertices are
weighted to those chains instead of to the legs, so the legs PUSH the hem
rather than carry it.

WHY BONES AND NOT CLOTH. A real cloth simulation on a robe is thousands of
points and their collisions every frame; a crowd of three hundred cannot pay
that. Fifty bones per figure, each one a point, is what a browser can swing
for a crowd, and a skirt of eight columns reads as cloth at any distance a
reader sees a figure from.

WHAT IS ADDED, per figure, when person.py runs with --springs 1 (the default):
  spring_hem_{col}_{seg}     8 columns round the skirt, hip to hem, 5 segments
  spring_girdle_{k}_{seg}    each hanging end of the girdle, 3 segments
  spring_veil_{col}_{seg}    5 columns round the back of a head-cloth or veil
  spring_beard_00_{seg}      the beard below the chin, 2 segments

HOW IT IS CARRIED. Every spring bone has a custom property `spring` — a JSON
string, exported as the glTF node's extras — giving its chain, its segment
number and its rest tail IN ITS OWN FRAME, so the runtime never has to guess
the exporter's bone convention. The chain's first bone also carries the
chain's parameters (stiffness, drag, gravity, radius, the angle it may swing
through, and which colliders it answers to). The armature object carries
`springColliders`: capsules measured from the body itself, each in the frame
of the bone it rides — a thigh, a shin, the hips, the chest, the neck, the
head, the collar bones and the upper arms.

WEIGHTS. Nothing is repainted by hand. For a vertex of the cloth, a fraction
s rises from 0 at the top of the swaying part (the hips, the nape, the chin)
to 1 a little below it; the vertex keeps (1 - s) of every body weight it had
and gives s to the chains — split between the two nearest columns by angle
round the figure, and along the column between the segment it lies beside
and the next, so the skin is smooth from the body into the spring and along
it. Above the top of the swaying part the cloth is exactly as it was.
"""
import bpy, math, json
from mathutils import Vector
from mathutils.kdtree import KDTree

ARMISH = ("arm", "hand", "shoulder", "clavicle", "thumb", "index", "middle", "ring", "pinky", "finger")
PRE = "mixamorig:"


# ---------------------------------------------------------------------------
# measuring the body

def _world(o):
    return [o.matrix_world @ v.co for v in o.data.vertices]


def _body_tree(body):
    vs = _world(body)
    kd = KDTree(len(vs))
    for i, p in enumerate(vs):
        kd.insert(p, i)
    kd.balance()
    return vs, kd


def _dominant_bone(body, kd, p, allow_arms=False):
    """The bone the body is most weighted to at the point nearest `p` — the
    natural parent for a chain that hangs from there."""
    _, i, _ = kd.find(p)
    v = body.data.vertices[i]
    best, bw = None, -1.0
    for g in v.groups:
        name = body.vertex_groups[g.group].name
        if not name.startswith(PRE):
            continue
        if not allow_arms and any(a in name.lower() for a in ARMISH):
            continue
        if g.weight > bw:
            best, bw = name, g.weight
    return best or PRE + "Hips"


def _percentile(xs, q):
    if not xs:
        return 0.0
    xs = sorted(xs)
    k = min(len(xs) - 1, max(0, int(round(q * (len(xs) - 1)))))
    return xs[k]


def _group_verts(body, vs, bone_name, minw=0.4):
    g = body.vertex_groups.get(bone_name)
    if g is None:
        return []
    out = []
    for v, p in zip(body.data.vertices, vs):
        for gg in v.groups:
            if gg.group == g.index and gg.weight >= minw:
                out.append(p); break
    return out


def _bone_local(rig, bone_name, p_world):
    """A world point in the frame of a bone at rest — the frame the glTF node
    for that bone has, so the runtime can carry it with the bone's matrixWorld."""
    b = rig.data.bones[bone_name]
    return (rig.matrix_world @ b.matrix_local).inverted() @ p_world


def _capsule(rig, body, vs, name, bone_name, a_world, b_world, q=0.75, extra=0.0, verts=None):
    """A capsule from a_world to b_world riding `bone_name`, its radius the
    q-th percentile of the distance of the bone's own vertices from that
    axis, plus `extra` for the cloth's own stand-off from the skin.

    RE-CENTRED FIRST. A bone does not run down the middle of the flesh it
    moves: the spine is at the back of the chest, the hip joint at the side
    of the thigh. A capsule on the bone's own line that reaches the belly
    sticks out twenty centimetres behind the back, and one round the thigh
    bone reaches past the outer thigh by half. So the axis is first moved,
    sideways, to the centroid of the bone's vertices, and the radius is
    measured from there — the flesh as a sausage, not the bone as one."""
    pts = verts if verts is not None else _group_verts(body, vs, bone_name)
    axis = b_world - a_world
    L = axis.length
    if L > 1e-6:
        axis = axis / L
        mid = []
        for p in pts:
            u = (p - a_world).dot(axis)
            if 0.2 * L <= u <= 0.8 * L or L < 0.06:
                mid.append((p - a_world) - axis * u)
        if not mid:
            mid = [(p - a_world) - axis * (p - a_world).dot(axis) for p in pts]
        shift = sum(mid, Vector()) / len(mid) if mid else Vector()
        a_world = a_world + shift; b_world = b_world + shift
        ds = [(m - shift).length for m in mid]
    else:
        c = sum(pts, Vector()) / len(pts) if pts else a_world
        a_world = b_world = c
        ds = [(p - c).length for p in pts]
    r = _percentile(ds, q) if ds else 0.06
    return {"name": name, "bone": bone_name,
            "a": [round(c, 5) for c in _bone_local(rig, bone_name, a_world)],
            "b": [round(c, 5) for c in _bone_local(rig, bone_name, b_world)],
            "radius": round(r + extra, 4)}


def measure_colliders(rig, body):
    """The body as a handful of capsules, in the frames of the bones they ride.

    Measured, not assumed: MakeHuman's thigh at weight 0.5 is not the same
    width on the old man as on the young one. The stand-off added to each is
    about what the robe was cut off the skin (robe.py pad=0.018) so the cloth
    is kept where it hangs, not pressed to the leg."""
    vs, _ = _body_tree(body)
    W = rig.matrix_world
    bones = rig.data.bones

    def head(n): return W @ bones[PRE + n].head_local
    def tail(n): return W @ bones[PRE + n].tail_local

    out = []
    for S, s in (("Left", "L"), ("Right", "R")):
        out.append(_capsule(rig, body, vs, "thigh" + s, PRE + S + "UpLeg", head(S + "UpLeg"), tail(S + "UpLeg"), extra=0.02))
        out.append(_capsule(rig, body, vs, "shin" + s, PRE + S + "Leg", head(S + "Leg"), tail(S + "Leg"), extra=0.02))
        out.append(_capsule(rig, body, vs, "shoulder" + s, PRE + S + "Shoulder", head(S + "Shoulder"), tail(S + "Shoulder"), q=0.7, extra=0.01))
        out.append(_capsule(rig, body, vs, "arm" + s, PRE + S + "Arm", head(S + "Arm"), tail(S + "Arm"), extra=0.01))
    # the hips: across the pelvis from hip joint to hip joint, thick as the pelvis
    hip_v = _group_verts(body, vs, PRE + "Hips", 0.3)
    out.append(_capsule(rig, body, vs, "hips", PRE + "Hips", head("LeftUpLeg"), head("RightUpLeg"), q=0.75, extra=0.01, verts=hip_v))
    # the chest and the neck, along their bones. The chest stops short of the
    # collar bones: run to the top of Spine2 it reached the chin, and a
    # beard chain that touched it was flung out sideways.
    chest_v = _group_verts(body, vs, PRE + "Spine2", 0.3) + _group_verts(body, vs, PRE + "Spine1", 0.3)
    out.append(_capsule(rig, body, vs, "chest", PRE + "Spine2", head("Spine1"), head("Spine2").lerp(tail("Spine2"), 0.6),
                        q=0.65, extra=0.01, verts=chest_v))
    out.append(_capsule(rig, body, vs, "neck", PRE + "Neck", head("Neck"), tail("Neck"), q=0.8, extra=0.01))
    # the head: one sphere at its centre, sized to the skull (a beard chain
    # starts at the chin, outside it, and a veil's columns at the ears)
    head_v = _group_verts(body, vs, PRE + "Head", 0.5)
    top = max(p.z for p in head_v)
    skull = [p for p in head_v if p.z > top - 0.12]
    c = sum(skull, Vector()) / len(skull)
    r = _percentile([(p - c).length for p in skull], 0.85)
    out.append({"name": "head", "bone": PRE + "Head",
                "a": [round(x, 5) for x in _bone_local(rig, PRE + "Head", c)],
                "b": [round(x, 5) for x in _bone_local(rig, PRE + "Head", c)], "radius": round(r + 0.005, 4)})
    return out


# ---------------------------------------------------------------------------
# chains

def _sector_mean(pts, centre, ang, half, z, band):
    """The mean of the points within `half` of angle `ang` round `centre`
    and within `band` of height z — where the cloth actually is there."""
    acc, n = Vector(), 0
    for p in pts:
        if abs(p.z - z) > band:
            continue
        a = math.atan2(p.y - centre.y, p.x - centre.x)
        d = (a - ang + math.pi) % (2 * math.pi) - math.pi
        if abs(d) <= half:
            acc += p; n += 1
    return (acc / n) if n else None


def _column_points(cloth_pts, centre, ang, half, zs, band=0.03):
    """A chain's points down one angular sector, at the heights zs, each at
    the cloth's own mean position there; a level with no cloth in the sector
    takes the level above, moved down."""
    out, prev = [], None
    for z in zs:
        m = _sector_mean(cloth_pts, centre, ang, half, z, band)
        if m is None:
            m = Vector((prev.x, prev.y, z)) if prev is not None else Vector((centre.x, centre.y, z))
        else:
            m = Vector((m.x, m.y, z))
        out.append(m); prev = m
    return out


def add_chains(rig, chains):
    """Create the bones. `chains`: dicts of name, parent (bone name),
    points (world, root head first) and params; each gets its bone names."""
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    Wi = rig.matrix_world.inverted()
    eb = rig.data.edit_bones
    for ch in chains:
        prev = eb[ch["parent"]]
        pts = [Wi @ p for p in ch["points"]]
        ch["bones"] = []
        for i in range(len(pts) - 1):
            b = eb.new(f"spring_{ch['name']}_{i}")
            b.head = pts[i]; b.tail = pts[i + 1]
            b.parent = prev
            b.use_connect = i > 0
            b.use_deform = True
            prev = b
            ch["bones"].append(b.name)
    bpy.ops.object.mode_set(mode="OBJECT")
    for ch in chains:
        for i, name in enumerate(ch["bones"]):
            bone = rig.data.bones[name]
            tail = bone.matrix_local.inverted() @ bone.tail_local       # (0, length, 0)
            d = {"chain": ch["name"], "seg": i, "tail": [round(c, 5) for c in tail]}
            if i == 0:
                d.update(ch["params"])
            bone["spring"] = json.dumps(d, separators=(",", ":"))


# ---------------------------------------------------------------------------
# weights

def _smooth(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def weight_to_chains(obj, chains, coord, z_top, z_full, closed=True):
    """Move a fraction of each vertex's weight from the body to the chains.

    s(z) is 0 at z_top, 1 at z_full and below (smoothly); the vertex keeps
    (1 - s) of its body weights and gives s to the chains — the two nearest
    columns by `coord` (the angle round the figure for a skirt or a veil, the
    x offset for the girdle's pair of ends; each chain's own value is its
    "angle"), interpolated between them, wrapped round if `closed` and
    clamped to the end columns if not; and within a column to the segment
    beside the vertex and the next, by height."""
    names = [n for ch in chains for n in ch["bones"]]
    for n in names:
        if n not in obj.vertex_groups:
            obj.vertex_groups.new(name=n)
    angs = [ch["angle"] for ch in chains]
    order = sorted(range(len(chains)), key=lambda i: angs[i])
    W = obj.matrix_world
    touched = 0
    for v in obj.data.vertices:
        p = W @ v.co
        s = _smooth((z_top - p.z) / max(z_top - z_full, 1e-6))
        if s <= 0.0:
            continue
        touched += 1
        # which columns
        a = coord(p)
        if len(chains) == 1:
            cols = [(0, 1.0)]
        else:
            if closed:
                # the two columns either side of the angle, wrapping
                k = 0
                for j in range(len(order)):
                    if angs[order[j]] <= a:
                        k = j
                i0, i1 = order[k], order[(k + 1) % len(order)]
                a0, a1 = angs[i0], angs[i1]
                span = (a1 - a0) % (2 * math.pi) or 2 * math.pi
                t = ((a - a0) % (2 * math.pi)) / span
            else:
                if a <= angs[order[0]]:
                    i0 = i1 = order[0]; t = 0.0
                elif a >= angs[order[-1]]:
                    i0 = i1 = order[-1]; t = 0.0
                else:
                    k = max(j for j in range(len(order)) if angs[order[j]] <= a)
                    i0, i1 = order[k], order[k + 1]
                    t = (a - angs[i0]) / max(angs[i1] - angs[i0], 1e-6)
            cols = [(i0, 1 - t), (i1, t)] if i0 != i1 else [(i0, 1.0)]
        # scale the body's weights down
        for g in v.groups:
            if g.weight > 0:
                obj.vertex_groups[g.group].add([v.index], g.weight * (1 - s), "REPLACE")
        # and give the rest to the chains
        for ci, cw in cols:
            if cw <= 1e-4:
                continue
            ch = chains[ci]
            pts = ch["points"]
            nseg = len(pts) - 1
            if p.z >= pts[0].z:
                segw = [(0, 1.0)]
            elif p.z <= pts[-1].z:
                segw = [(nseg - 1, 1.0)]
            else:
                i = max(j for j in range(nseg) if pts[j].z >= p.z)
                f = (pts[i].z - p.z) / max(pts[i].z - pts[i + 1].z, 1e-6)
                segw = [(i, 1 - f), (i + 1, f)] if i + 1 < nseg else [(i, 1.0)]
            for si, sw in segw:
                w = s * cw * sw
                if w > 1e-4:
                    obj.vertex_groups[ch["bones"][si]].add([v.index], w, "ADD")
    return touched


# ---------------------------------------------------------------------------
# the four kinds of chain

# The parameters (see src/walk/springs.ts for what each does). Stiffness is
# in 1/s²; with gravity over a 20 cm segment adding about 50 more, a hem at
# 80 swings at ~1.8 Hz — above a stride, so a walk does not pump it — and a
# drag of 0.15 per 1/60 s is a damping ratio near 0.4: it settles in a swing
# or two, as heavy linen does. A beard is nearly rigid; a girdle's end is
# light and free.
# `ring` chains are a closed ring round the figure in name order, and
# `lateral` is how much each tip is drawn toward its two neighbours' every
# step: a leg that pushes one column then pushes the cloth beside it too,
# instead of tenting the skirt over a single pole.
HEM = dict(stiffness=80.0, drag=0.15, gravity=9.8, radius=0.025, maxAngle=35, ring=True, lateral=0.35,
           colliders=["thighL", "thighR", "shinL", "shinR"])
GIRDLE = dict(stiffness=40.0, drag=0.10, gravity=9.8, radius=0.012, maxAngle=60,
              colliders=["hips", "thighL", "thighR"])
# A VEIL IS A DRAPE, NOT A PENDULUM. Its rest shape is where gravity and the
# body left it (robe.make_headcloth let it fall): lying on the head, a
# centimetre off the nape, over the shoulders, down the back. So it gets
#   · no gravity — the rest already is the gravity solution; with gravity
#     added the side columns (resting 25° out over the shoulders) were pulled
#     toward vertical and folded the shoulder cloth up into a shelf;
#   · no colliders — every capsule sits at skin radius, and cloth that rests
#     a centimetre off the skin is inside all of them: the neck alone pushed
#     every first segment 20° out of its drape (measured, not guessed: the
#     lean was read off the running page with window.__rig). The stiffness
#     alone returns it to the drape;
#   · its rest in the frame of the CHEST (restBone) though it hangs from the
#     head: the back of a veil is held by the shoulders, and when the head
#     turns the cloth slides over them rather than turning with the head —
#     turned with the head, the whole back fanned up over one shoulder.
VEIL = dict(stiffness=60.0, drag=0.15, gravity=0.0, radius=0.01, maxAngle=50, lateral=0.25,
            colliders=[], restBone=PRE + "Spine2")
BEARD = dict(stiffness=200.0, drag=0.25, gravity=9.8, radius=0.008, maxAngle=25,
             colliders=["neck"])


def hem_chains(robe, body, kd, z0, H, cols=8, segs=5):
    """Eight columns round the skirt, from the hips to the hem. The columns
    stand where the cloth is — measured from the draped robe, not from a
    cylinder — so a rotation about a column's root moves the cloth beside it
    and not cloth a hand's breadth away. Five segments, about sixteen
    centimetres each: with four, a lifted heel put the calf through the
    straight run of cloth between two tips."""
    pts = _world(robe)
    z_hip = z0 + 0.50 * H
    z_hem = min(p.z for p in pts) + 0.01
    hip_ring = [p for p in pts if abs(p.z - z_hip) < 0.03]
    centre = sum(hip_ring, Vector()) / len(hip_ring)
    zs = [z_hip - (z_hip - z_hem) * i / segs for i in range(segs + 1)]
    chains = []
    for c in range(cols):
        ang = -math.pi + (c + 0.5) * 2 * math.pi / cols
        p = _column_points(pts, centre, ang, math.pi / cols, zs)
        chains.append(dict(name=f"hem_{c:02d}", parent=PRE + "Hips", points=p, angle=ang, params=dict(HEM)))
    return chains, centre, z_hip


def girdle_chains(girdle, body, kd, z0, H, segs=3):
    """The girdle's two hanging ends, from the knot. Each end is its own
    chain, one a little stiffer than the other, so the pair does not swing as
    one board."""
    pts = _world(girdle)
    zc = z0 + 0.585 * H
    tails = [p for p in pts if p.z < zc - 0.032]
    if len(tails) < 8:
        return [], None, None
    fx = sum(p.x for p in tails) / len(tails)
    fy = sum(p.y for p in tails) / len(tails)
    z_bot = min(p.z for p in tails)
    chains = []
    for k, off in enumerate((-0.018, 0.018)):
        side = [p for p in tails if (p.x - fx) * off > 0]
        zs = [zc - (zc - z_bot) * i / segs for i in range(segs + 1)]
        p = []
        for z in zs:
            band = [q for q in side if abs(q.z - z) < 0.03] or [q for q in tails if abs(q.z - z) < 0.03]
            m = (sum(band, Vector()) / len(band)) if band else Vector((fx + off, fy, z))
            p.append(Vector((m.x, m.y, z)))
        params = dict(GIRDLE)
        params["stiffness"] *= (1.0 if k == 0 else 1.3)
        chains.append(dict(name=f"girdle_{k:02d}", parent=_dominant_bone(body, kd, Vector((fx, fy, zc))),
                           points=p, angle=float(off), params=params))
    # the two ends are told apart by their x offset from the knot, which is
    # what "angle" holds for these two
    centre = Vector((fx, fy, zc))
    return chains, centre, zc


def veil_chains(veil, body, kd, k_, top, cols=5, seg_len=0.13):
    """Five columns round the back of the head, ear to ear over the nape,
    from just below the ear down to wherever that part of the cloth ends —
    the sides on the shoulders, the back down the back. A column takes as
    many segments as its length asks at about `seg_len` each: a veil to the
    waist in three segments was three rods of a quarter metre, and cloth
    does not bend in quarter metres."""
    pts = _world(veil)
    head = [p for p in pts if p.z > top - 0.10 * k_]
    centre = sum(head, Vector()) / len(head)
    z_ear = top - 0.11 * k_
    chains = []
    for c in range(cols):
        ang = math.pi * c / (cols - 1)                  # +X (the figure's left) round the back (+Y) to -X
        sector = [p for p in pts if p.z < z_ear and
                  abs((math.atan2(p.y - centre.y, p.x - centre.x) - ang + math.pi) % (2 * math.pi) - math.pi) < math.pi / 6]
        z_bot = (min(p.z for p in sector) if sector else z_ear - 0.2) + 0.01
        if z_ear - z_bot < 0.06:
            continue
        segs = max(2, int(round((z_ear - z_bot) / (seg_len * k_))))
        zs = [z_ear - (z_ear - z_bot) * i / segs for i in range(segs + 1)]
        p = _column_points(pts, centre, ang, math.pi / 6, zs, band=0.04)
        chains.append(dict(name=f"veil_{c:02d}", parent=PRE + "Head", points=p, angle=ang, params=dict(VEIL)))
    return chains, centre, z_ear


def beard_chain(beard, body, kd, segs=2):
    """One chain down the beard below the chin."""
    pts = _world(beard)
    zmax, zmin = max(p.z for p in pts), min(p.z for p in pts)
    span = zmax - zmin
    if span < 0.03:
        return [], None, None
    cy = sum(p.y for p in pts) / len(pts)
    z_top = zmin + 0.45 * span
    zs = [z_top - (z_top - zmin) * i / segs for i in range(segs + 1)]
    p = []
    for z in zs:
        band = [q for q in pts if abs(q.z - z) < 0.012 and q.y < cy] or [q for q in pts if abs(q.z - z) < 0.02]
        m = sum(band, Vector()) / len(band)
        p.append(Vector((m.x, m.y, z)))
    centre = Vector((p[0].x, p[0].y, z_top))
    return [dict(name="beard_00", parent=PRE + "Head", points=p, angle=0.0, params=dict(BEARD))], centre, z_top


# ---------------------------------------------------------------------------

def add_springs(body, rig, robe=None, girdle=None, veil=None, beard=None):
    """Add every chain the figure's parts call for, weight the parts to them,
    and hang the colliders on the armature. Called with the rig in its final
    rest pose (after lower_arms) and before the clips are keyed."""
    vs, kd = _body_tree(body)
    z0 = min(p.z for p in vs); H = max(p.z for p in vs) - z0
    k_ = H / 1.73

    def around(centre):
        return lambda p: math.atan2(p.y - centre.y, p.x - centre.x)

    plan = []           # (object, chains, coord, z_top, z_full, closed)
    if robe is not None:
        ch, centre, z_top = hem_chains(robe, body, kd, z0, H)
        plan.append((robe, ch, around(centre), z_top, z_top - 0.10 * H, True))
    if girdle is not None:
        ch, centre, zc = girdle_chains(girdle, body, kd, z0, H)
        if ch:
            plan.append((girdle, ch, lambda p: p.x - centre.x, zc - 0.02, zc - 0.07, False))
    if veil is not None:
        ch, centre, z_ear = veil_chains(veil, body, kd, k_, z0 + H)
        if ch:
            # a veil is held by its own weight where it lies on the shoulders;
            # only what hangs below the shoulder line swings freely, so the
            # blend runs from the ear down past the shoulders to the upper arm
            plan.append((veil, ch, around(centre), z_ear, z_ear - 0.22 * k_, False))
    if beard is not None:
        ch, centre, z_top = beard_chain(beard, body, kd)
        if ch:
            plan.append((beard, ch, lambda p: 0.0, z_top, z_top - 0.02, False))
    if not plan:
        return 0
    add_chains(rig, [c for _, chs, *_ in plan for c in chs])
    n = 0
    for obj, chs, coord, z_top, z_full, closed in plan:
        touched = weight_to_chains(obj, chs, coord, z_top, z_full, closed)
        n += len(chs)
        print(f"SPRINGS {obj.name}: {len(chs)} chains, {sum(len(c['bones']) for c in chs)} bones, "
              f"{touched} vertices weighted")
    rig["springColliders"] = json.dumps(measure_colliders(rig, body), separators=(",", ":"))
    return n
