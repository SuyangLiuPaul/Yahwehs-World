"""A robe that HANGS: cut a size too big, pinned at the shoulders, and let fall.

The first robe was swept through sections of the body, and it looked it — it
followed the legs below the hips and came out as a column of lumps. Cloth does
not follow legs; it hangs from the shoulders and falls straight past them,
folding where it gathers. So the shape is only a starting cut, and the folds
come out of a cloth simulation with the body as the thing it falls against.

  · THE CUT: a tunic that follows the chest and back above the hips and is a
    plain, flaring ellipse below them, a few centimetres off the body all
    round, from the base of the neck to just above the ankle. Long sleeves,
    widening to the cuff, along the arms while they are still held out.
  · THE FALL: pinned at the neckline and the shoulders, the pin fading out
    down to the chest; forty frames of gravity at linen's stiffness; the body
    is the collider. What is left at the last frame is the robe.
  · THE CLOTH: a CC0 woven fabric from ambientCG (Fabric036 by default), its
    colour, roughness and normal map, tiled at the scale of real cloth.

Called with the body in MakeHuman's A-pose, before the arms are lowered; the
sleeves then follow the arms down by skinning.
"""
import bpy, bmesh, math
from mathutils import Vector

FABRIC = "/Users/pliu0036/Documents/CodingProject/assets-makehuman/fabric"


def _trunk(body):
    """(z0, H, trunk vertices) — the body without its arms, as basebody does."""
    import importlib
    vs = [body.matrix_world @ v.co for v in body.data.vertices]
    z0 = min(v.z for v in vs); H = max(v.z for v in vs) - z0
    ARM = ("arm", "hand", "shoulder", "clavicle", "thumb", "index", "middle", "ring", "pinky", "finger")
    arm_ids = {g.index for g in body.vertex_groups if any(a in g.name.lower() for a in ARM)}
    hips = [v for v in vs if z0 + 0.42 * H <= v.z <= z0 + 0.48 * H]
    cx = sum(v.x for v in hips) / len(hips)
    half = max(abs(v.x - cx) for v in hips) * 1.12
    out = []
    for v, p in zip(body.data.vertices, vs):
        if sum(g.weight for g in v.groups if g.group in arm_ids) >= 0.25:
            continue
        if p.z > z0 + 0.48 * H and abs(p.x - cx) > half:
            continue
        out.append(p)
    return z0, H, out


def _ring(trunk, z, N, band=0.015):
    pts = [v for v in trunk if abs(v.z - z) < band]
    if len(pts) < 6:
        return None
    cx = sum(v.x for v in pts) / len(pts); cy = sum(v.y for v in pts) / len(pts)
    r = [0.0] * N
    for v in pts:
        k = int(((math.atan2(v.y - cy, v.x - cx) + math.pi) / (2 * math.pi)) * N) % N
        r[k] = max(r[k], math.hypot(v.x - cx, v.y - cy))
    for _ in range(6):
        r = [x if x > 0 else max(r[(i - 1) % N], r[(i + 1) % N]) for i, x in enumerate(r)]
    # smooth the outline: cloth does not follow every dip of the body
    for _ in range(3):
        r = [(r[(i - 1) % N] + 2 * r[i] + r[(i + 1) % N]) / 4 for i in range(N)]
    return cx, cy, r


def _tube(rings_pts, N, closed_top=False):
    verts, faces = [], []
    for i, ring in enumerate(rings_pts):
        verts.extend(ring)
        if i:
            b0, b1 = (i - 1) * N, i * N
            for k in range(N):
                faces.append((b0 + k, b0 + (k + 1) % N, b1 + (k + 1) % N, b1 + k))
    return verts, faces


def _material(name, fabric, tint, tile_m):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    base = f"{FABRIC}/{fabric}/{fabric}_1K-JPG"
    def img(suffix, colour):
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = bpy.data.images.load(f"{base}_{suffix}.jpg", check_existing=True)
        if not colour:
            n.image.colorspace_settings.name = "Non-Color"
        return n
    col = img("Color", True)
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    mix.inputs[7].default_value = (*tint, 1.0)
    nt.links.new(col.outputs["Color"], mix.inputs[6])
    nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    rough = img("Roughness", False)
    nt.links.new(rough.outputs["Color"], bsdf.inputs["Roughness"])
    nrm = img("NormalGL", False)
    nm = nt.nodes.new("ShaderNodeNormalMap"); nm.inputs["Strength"].default_value = 0.3
    nt.links.new(nrm.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Specular IOR Level"].default_value = 0.2
    m["tile_m"] = tile_m
    return m


def make_draped_robe(body, rig, fabric="Fabric036", tint=(0.93, 0.89, 0.80), hem=0.045,
                     frames=40, pad=0.018, sleeves=True, name="Robe"):
    z0, H, trunk = _trunk(body)
    N = 48
    top, bottom = z0 + 0.845 * H, z0 + hem * H
    hips_z = z0 + 0.50 * H
    steps = max(24, int((top - bottom) / 0.022))
    zs = [top - (top - bottom) * i / (steps - 1) for i in range(steps)]
    hip = _ring(trunk, hips_z, N)
    hcx, hcy, hr = hip
    ax = max(hr[k] * abs(math.cos(-math.pi + (k + .5) * 2 * math.pi / N)) for k in range(N))
    ay = max(hr[k] * abs(math.sin(-math.pi + (k + .5) * 2 * math.pi / N)) for k in range(N))
    # THE SHOULDERS. Above the armpit the robe must cover the shoulder cap, and
    # the trunk (which excludes anything weighted to an arm) stops short of it,
    # leaving a band of bare skin between robe and sleeve. So up there every
    # body vertex counts, out to the arm joint and no further.
    W = rig.matrix_world
    arm_x = max(abs((W @ rig.data.bones[f"mixamorig:{sd}Arm"].head_local).x) for sd in ("Left", "Right"))
    allv = [body.matrix_world @ v.co for v in body.data.vertices]
    cx0 = sum(v.x for v in trunk) / len(trunk)
    upper = [v for v in allv if v.z > z0 + 0.72 * H and abs(v.x - cx0) <= arm_x + 0.045 * H / 1.73]
    rings, prev = [], None
    for i, z in enumerate(zs):
        ang = [-math.pi + (k + .5) * 2 * math.pi / N for k in range(N)]
        if z >= hips_z:
            src = upper if z > z0 + 0.70 * H else trunk
            rg = _ring(src, z, N) or prev
            cx, cy, r = rg
            prev = rg
            pts = [Vector((cx + (r[k] + pad) * math.cos(a), cy + (r[k] + pad) * math.sin(a), z))
                   for k, a in enumerate(ang)]
        else:
            # below the hips: a plain ellipse that widens toward the hem
            t = (hips_z - z) / (hips_z - bottom)
            fl = 1.0 + 0.30 * t
            pts = [Vector((hcx + (ax * fl + pad) * math.cos(a), hcy + (ay * fl + pad) * math.sin(a), z))
                   for a in ang]
        rings.append(pts)
    verts, faces = _tube(rings, N)
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
    robe = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(robe)

    # UVs: round the body and down it, in metres of cloth, so the weave is the
    # size of a real weave wherever it falls.
    tile = 0.55
    uv = me.uv_layers.new(name="UVMap")
    perim = 2 * math.pi * (ax + ay) / 2
    for poly in me.polygons:
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            k = vi % N; i = vi // N
            if k == 0 and any(me.loops[l].vertex_index % N == N - 1 for l in poly.loop_indices):
                k = N
            uv.data[li].uv = (k / N * perim / tile, (top - zs[i]) / tile)

    # Pin: the neckline and shoulders hold, fading out down to the chest.
    pin = robe.vertex_groups.new(name="pin")
    for vi, v in enumerate(me.vertices):
        z = v.co.z
        w = 1.0 if z > z0 + 0.80 * H else max(0.0, (z - (z0 + 0.70 * H)) / (0.10 * H))
        if w > 0:
            pin.add([vi], w, "REPLACE")

    # Sleeves along the outstretched arms, widening to the cuff.
    sl_objs = []
    for side in (("Left", "Right") if sleeves else ()):
        cl = rig.data.bones.get(f"mixamorig:{side}Shoulder")
        up = rig.data.bones.get(f"mixamorig:{side}Arm"); lo = rig.data.bones.get(f"mixamorig:{side}ForeArm")
        W = rig.matrix_world
        # From half-way along the collar bone — the first robe left the top of
        # each shoulder bare, because the sleeve began at the arm joint.
        # at the arm joint: the robe's own top now covers the shoulder cap, and a
        # sleeve starting further in stood up off the shoulder like an epaulette
        s0 = (W @ cl.head_local).lerp(W @ cl.tail_local, 0.85)
        a, b, c = W @ up.head_local, W @ lo.head_local, W @ lo.tail_local
        path = [s0.lerp(a, t / 3) for t in range(3)] + [a.lerp(b, t / 6) for t in range(6)] \
            + [b.lerp(c, t / 6) for t in range(7)]
        SN = 20
        srings = []
        # only this arm's own vertices: the first measurement took in the side
        # of the chest near the shoulder and blew the sleeve up like a lantern
        ids = {g.index for g in body.vertex_groups
               if g.name in (f"mixamorig:{side}Arm", f"mixamorig:{side}ForeArm", f"mixamorig:{side}Shoulder")}
        bodyv = [body.matrix_world @ v.co for v in body.data.vertices
                 if sum(g.weight for g in v.groups if g.group in ids) > 0.5]
        k_ = H / 1.73
        for i, p in enumerate(path):
            d = ((path[i + 1] if i + 1 < len(path) else p + (p - path[i - 1])) - p).normalized()
            u = d.orthogonal().normalized(); w = d.cross(u).normalized()
            # MEASURED, not assumed: the widest the arm (or the shoulder over it)
            # is here, plus room for the cloth. A fixed radius was narrower than
            # MakeHuman's deltoid, and the shoulder showed through between
            # robe and sleeve on both sides.
            near = [q for q in bodyv if (q - p).length < 0.11 * k_ and abs((q - p).dot(d)) < 0.02 * k_]
            meas = max([((q - p) - d * (q - p).dot(d)).length for q in near] or [0.05 * k_])
            flare = 0.030 * k_ * max(0, i - 3) / (len(path) - 4)       # the cuff hangs wide
            rad = min(max(meas + 0.014 * k_, 0.045 * k_), 0.085 * k_) + flare
            srings.append((p, u, w, rad))
        # a sleeve is a smooth tube: even out the measured radii along it
        rads = [r[3] for r in srings]
        for _ in range(10):
            rads = [rads[0]] + [(rads[i - 1] + 2 * rads[i] + rads[i + 1]) / 4 for i in range(1, len(rads) - 1)] + [rads[-1]]
        srings = [[p + (u * math.cos(2 * math.pi * k / SN) + w * math.sin(2 * math.pi * k / SN)) * r
                   for k in range(SN)] for (p, u, w, _), r in zip(srings, rads)]
        sv, sf = _tube(srings, SN)
        sm = bpy.data.meshes.new(f"Sleeve{side}"); sm.from_pydata([tuple(v) for v in sv], [], sf); sm.update()
        so = bpy.data.objects.new(f"Sleeve{side}", sm); bpy.context.collection.objects.link(so)
        suv = sm.uv_layers.new(name="UVMap")
        for poly in sm.polygons:
            for li in poly.loop_indices:
                vi = sm.loops[li].vertex_index
                suv.data[li].uv = ((vi % SN) / SN * 0.5 / tile, (vi // SN) * 0.05 / tile)
        sl_objs.append(so)

    # THE FALL.
    col = body.modifiers.new("collide", "COLLISION")
    body.collision.thickness_outer = 0.004
    body.collision.cloth_friction = 5.0
    bpy.context.view_layer.objects.active = robe
    sub = robe.modifiers.new("sub", "SUBSURF"); sub.levels = 1
    bpy.ops.object.modifier_apply(modifier="sub")
    cloth = robe.modifiers.new("cloth", "CLOTH")
    s = cloth.settings
    s.quality = 6; s.mass = 0.25; s.air_damping = 1.0
    s.tension_stiffness = 12; s.compression_stiffness = 12; s.shear_stiffness = 5
    s.bending_stiffness = 0.15
    s.vertex_group_mass = "pin"; s.pin_stiffness = 1.0
    cloth.collision_settings.distance_min = 0.004
    cloth.collision_settings.use_self_collision = False
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, frames
    cloth.point_cache.frame_start, cloth.point_cache.frame_end = 1, frames
    for f in range(1, frames + 1):
        sc.frame_set(f)
    bpy.ops.object.modifier_apply(modifier="cloth")
    sc.frame_set(1)
    body.modifiers.remove(col)
    # SIZE. Simulated fine, shipped coarse: the folds are kept by collapsing
    # the flat parts, and the cloth is one surface drawn from both sides rather
    # than given a thickness, which doubled every triangle. The first dressed
    # man was 24 MB; the robe alone was 48,000 triangles.
    dec = robe.modifiers.new("dec", "DECIMATE"); dec.ratio = 0.35
    bpy.ops.object.modifier_apply(modifier="dec")

    mat = _material(name, fabric, tint, tile)
    mat.use_backface_culling = False          # one surface, seen from both sides
    for o in [robe] + sl_objs:
        o.data.materials.append(mat)
        for p in o.data.polygons:
            p.use_smooth = True

    # Weights from the body under the cloth; the robe below the chest answers
    # to the trunk and legs only, the sleeves to the arms.
    def transfer(o, arm_ok):
        for g in body.vertex_groups:
            if g.name.startswith("mixamorig:") and g.name not in o.vertex_groups:
                o.vertex_groups.new(name=g.name)
        bpy.context.view_layer.objects.active = o
        dt = o.modifiers.new("dt", "DATA_TRANSFER"); dt.object = body; dt.use_vert_data = True
        dt.data_types_verts = {"VGROUP_WEIGHTS"}; dt.vert_mapping = "POLYINTERP_NEAREST"
        dt.layers_vgroup_select_src = "ALL"; dt.layers_vgroup_select_dst = "NAME"
        bpy.ops.object.modifier_apply(modifier="dt")
        if not arm_ok:
            arms = [g for g in o.vertex_groups if any(a in g.name for a in ("Arm", "Hand", "Shoulder"))]
            low = [v.index for v in o.data.vertices if (o.matrix_world @ v.co).z < z0 + 0.74 * H]
            for g in arms:
                g.remove(low)
            bpy.ops.object.mode_set(mode="WEIGHT_PAINT")
            for g in list(o.vertex_groups):
                if any(k in g.name for k in ("UpLeg", "Leg", "Hips", "Spine")):
                    o.vertex_groups.active_index = g.index
                    bpy.ops.object.vertex_group_smooth(group_select_mode="ACTIVE", factor=0.5, repeat=8)
            bpy.ops.object.vertex_group_normalize_all(lock_active=False)
            bpy.ops.object.mode_set(mode="OBJECT")
        if "pin" in o.vertex_groups:
            o.vertex_groups.remove(o.vertex_groups["pin"])
        o.parent = rig
        o.matrix_parent_inverse = rig.matrix_world.inverted()
        m = o.modifiers.new("Armature", "ARMATURE"); m.object = rig

    transfer(robe, arm_ok=False)
    for so in sl_objs:
        transfer(so, arm_ok=True)
    return robe, sl_objs


def make_girdle(body, rig, fabric="Fabric036", tint=(0.42, 0.30, 0.20), width=0.055, tail=0.34):
    """A girdle of wool at the waist, tied, with its ends hanging — what every
    man in the text is girded with, from the priest (Ex 28:39) to Elijah's of
    leather (2 Kgs 1:8). A band round the robe's waist and two hanging ends."""
    import robe as _self
    z0, H, trunk = _trunk(body)
    zc = z0 + 0.585 * H
    N = 40
    rg = _ring(trunk, zc, N, band=0.02)
    cx, cy, r = rg
    rings = []
    for dz in (-width / 2, 0, width / 2):
        rings.append([Vector((cx + (r[k] + 0.028) * math.cos(-math.pi + (k + .5) * 2 * math.pi / N),
                              cy + (r[k] + 0.028) * math.sin(-math.pi + (k + .5) * 2 * math.pi / N),
                              zc + dz)) for k in range(N)])
    v, f = _tube(rings, N)
    # two ends hanging from the knot at the front-left
    k0 = int(N * 0.30)
    front = rings[1][k0]
    for off in (-0.018, 0.018):
        base = len(v)
        for j in range(8):
            z = zc - j * tail / 7
            v += [Vector((front.x + off - 0.02, front.y - 0.004, z)), Vector((front.x + off + 0.02, front.y - 0.004, z))]
            if j:
                a = base + (j - 1) * 2
                f.append((a, a + 1, a + 3, a + 2))
    me = bpy.data.meshes.new("Girdle"); me.from_pydata([tuple(x) for x in v], [], f); me.update()
    g = bpy.data.objects.new("Girdle", me); bpy.context.collection.objects.link(g)
    uv = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = (math.atan2(co.y - cy, co.x - cx) * 2.0, co.z * 8.0)
    bpy.context.view_layer.objects.active = g

    g.data.materials.append(_material("Girdle", fabric, tint, 0.1))
    for p in g.data.polygons:
        p.use_smooth = True
    for grp in body.vertex_groups:
        if grp.name.startswith("mixamorig:"):
            g.vertex_groups.new(name=grp.name)
    dt = g.modifiers.new("dt", "DATA_TRANSFER"); dt.object = body; dt.use_vert_data = True
    dt.data_types_verts = {"VGROUP_WEIGHTS"}; dt.vert_mapping = "POLYINTERP_NEAREST"
    dt.layers_vgroup_select_src = "ALL"; dt.layers_vgroup_select_dst = "NAME"
    bpy.ops.object.modifier_apply(modifier="dt")
    arms = [x for x in g.vertex_groups if any(a in x.name for a in ("Arm", "Hand", "Shoulder"))]
    for x in arms:
        x.remove([vv.index for vv in g.data.vertices])
    bpy.ops.object.mode_set(mode="WEIGHT_PAINT")
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    g.parent = rig; g.matrix_parent_inverse = rig.matrix_world.inverted()
    m = g.modifiers.new("Armature", "ARMATURE"); m.object = rig
    return g


def make_headcloth(body, rig, size=1.05, fabric="Fabric036", tint=(0.86, 0.80, 0.70), frames=45,
                   crown_pin=0.075, name="Headcloth", brow=0.055):
    """A square of cloth laid on the head and let fall — a woman's veil
    (1 Cor 11:5-6) or a man's head-cloth. Pinned in a small circle at the
    crown, it drapes over the head and down onto the shoulders against the body.
    It also ends the hairline problem: a head that is covered has no hairline."""
    z0, H, _ = _trunk(body)
    vs = [body.matrix_world @ v.co for v in body.data.vertices]
    top = max(v.z for v in vs)
    head = [v for v in vs if v.z > top - 0.12 * H / 1.73]
    cx = sum(v.x for v in head) / len(head); cy = sum(v.y for v in head) / len(head)
    k_ = H / 1.73
    S = size * k_
    n = 44
    verts, faces = [], []
    # WORN, NOT DROPPED. A square centred on the crown fell evenly all round
    # and covered the face — a ghost, not a veil. A head-cloth is laid with its
    # front edge on the brow, framing the face, and the rest of it falls to the
    # sides and down the back. So the square starts at the hairline (the figure
    # faces -Y) and runs backward.
    front = min(v.y for v in head)                    # the face
    y0 = front + brow * k_                            # the brow line, a little behind the face
    for j in range(n + 1):
        for i in range(n + 1):
            x = cx - S / 2 + S * i / n
            y = y0 + S * 0.92 * j / n
            r = math.hypot(x - cx, y - cy)
            verts.append(Vector((x, y, top + 0.012 * k_ - 0.25 * r * r / k_)))
    for j in range(n):
        for i in range(n):
            a = j * (n + 1) + i
            faces.append((a, a + 1, a + n + 2, a + n + 1))
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    uv = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = ((co.x - cx) / 0.22, (co.y - cy) / 0.22)
    # pinned where a head-cloth is held: across the brow and over the crown
    # LAID ON THE HEAD, not held over it. Pinning the front edge at crown
    # height made a flat brim five centimetres over the forehead; from the front
    # you looked under it and saw a bald scalp. So every point of the cloth that
    # lies over the head is first lowered onto it (a ray down to the scalp, plus
    # the cloth's thickness) and pinned there; only what hangs beyond the head
    # is left to fall.
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get()
    tree = BVHTree.FromObject(body, dg)
    inv = body.matrix_world.inverted()
    pin = ob.vertex_groups.new(name="pin")
    # 1.6 cm, not 8 mm: the body's collision shell and the cloth's own margin
    # add to 12 mm, and cloth that starts inside that is pushed THROUGH the head
    # — the front half of the first laid veil vanished into the scalp that way.
    lifted = 0.016 * k_
    hairline = top - 0.055 * k_
    cut = set()
    for vi, v in enumerate(me.vertices):
        origin = inv @ Vector((v.co.x, v.co.y, top + 0.2 * k_))
        hit, _n, _i, _d = tree.ray_cast(origin, Vector((0, 0, -1)))
        if hit is None:
            continue
        hz = (body.matrix_world @ hit).z
        if hz < top - 0.13 * k_:               # below the head: the shoulders, let it fall there
            continue
        if v.co.y < cy and hz < hairline:      # the forehead and face: no cloth here
            cut.add(vi)
            continue
        v.co.z = hz + lifted
        pin.add([vi], 1.0, "REPLACE")          # the whole cap holds; only what is beyond the head falls
    me.update()
    # Cut the cloth away over the face, so the front edge runs along the hairline
    # and frames the face instead of being a straight hem across the crown.
    if cut:
        import bmesh as _bm
        bm = _bm.new(); bm.from_mesh(me)
        bm.verts.ensure_lookup_table()
        _bm.ops.delete(bm, geom=[bm.verts[i] for i in cut], context="VERTS")
        bm.to_mesh(me); bm.free()
        me.update()
    col = body.modifiers.new("collide", "COLLISION")
    body.collision.thickness_outer = 0.006
    body.collision.cloth_friction = 8.0
    bpy.context.view_layer.objects.active = ob
    cloth = ob.modifiers.new("cloth", "CLOTH")
    s = cloth.settings
    s.quality = 8; s.mass = 0.15; s.air_damping = 1.5
    s.tension_stiffness = 10; s.compression_stiffness = 10; s.shear_stiffness = 4
    s.bending_stiffness = 0.05
    s.vertex_group_mass = "pin"; s.pin_stiffness = 1.0
    cloth.collision_settings.distance_min = 0.006
    cloth.collision_settings.use_self_collision = True
    cloth.collision_settings.self_distance_min = 0.004
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, frames
    cloth.point_cache.frame_start, cloth.point_cache.frame_end = 1, frames
    for f in range(1, frames + 1):
        sc.frame_set(f)
    bpy.ops.object.modifier_apply(modifier="cloth")
    sc.frame_set(1)
    body.modifiers.remove(col)
    # THE CAP, from the scalp itself. However it was laid, the simulated square
    # left the crown bare from the front (every cloth point measured OUTSIDE the
    # scalp, and still the scalp showed: the square's coarse cells bridged the
    # curve and cutting at the hairline took whole rows of faces with it). A cap
    # made from the head's own faces, pushed out along their normals, covers the
    # crown exactly and cannot miss; the simulated cloth only has to hang.
    cap = _scalp_cap(body, top, cy, k_)
    if cap is not None:
        bpy.ops.object.select_all(action="DESELECT")
        cap.select_set(True); ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.join()
    mat = _material(name, fabric, tint, 0.22)
    mat.use_backface_culling = False
    ob.data.materials.append(mat)
    for p in ob.data.polygons:
        p.use_smooth = True
    # the head and the shoulders it rests on carry it
    for g in body.vertex_groups:
        if g.name.startswith("mixamorig:"):
            ob.vertex_groups.new(name=g.name)
    dt = ob.modifiers.new("dt", "DATA_TRANSFER"); dt.object = body; dt.use_vert_data = True
    dt.data_types_verts = {"VGROUP_WEIGHTS"}; dt.vert_mapping = "POLYINTERP_NEAREST"
    dt.layers_vgroup_select_src = "ALL"; dt.layers_vgroup_select_dst = "NAME"
    bpy.ops.object.modifier_apply(modifier="dt")
    arms = [g for g in ob.vertex_groups if any(a in g.name for a in ("Arm", "Hand"))]
    for g in arms:
        g.remove([v.index for v in ob.data.vertices])
    bpy.ops.object.mode_set(mode="WEIGHT_PAINT")
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    ob.vertex_groups.remove(ob.vertex_groups["pin"])
    ob.parent = rig; ob.matrix_parent_inverse = rig.matrix_world.inverted()
    m = ob.modifiers.new("Armature", "ARMATURE"); m.object = rig
    return ob


def _scalp_cap(body, top, cy, k_, out=0.012):
    """The body's faces above the hairline (and down the back of the head to
    the nape), copied and pushed outward — a close-fitting cap of cloth."""
    import bmesh as _bm
    bm = _bm.new(); bm.from_mesh(body.data)
    bm.transform(body.matrix_world)
    # finer first, so the cut edge steps in millimetres, not in whole faces
    head_edges = [e for e in bm.edges if all(v.co.z > top - 0.17 * k_ for v in e.verts)]
    _bm.ops.subdivide_edges(bm, edges=head_edges, cuts=2, use_grid_fill=True)
    bm.normal_update()
    hairline = top - 0.050 * k_
    nape = top - 0.140 * k_
    keep = []
    for f in bm.faces:
        ok = True
        for v in f.verts:
            z, y = v.co.z, v.co.y
            front = y < cy - 0.02 * k_
            if front and z < hairline: ok = False; break
            if not front and z < nape: ok = False; break
        if ok:
            keep.append(f)
    if not keep:
        bm.free(); return None
    ks = set(keep)
    kill = [f for f in bm.faces if f not in ks]
    _bm.ops.delete(bm, geom=kill, context="FACES")
    _bm.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context="VERTS")
    bm.normal_update()
    for v in bm.verts:
        v.co += v.normal * out * k_
    # SMOOTH THE EDGE: the boundary is walked a few times, each point pulled
    # toward the average of its two neighbours along it, so the cut reads as a
    # hem following an arc round the face and not as a staircase.
    for _ in range(12):
        moves = {}
        for v in bm.verts:
            if not v.is_boundary:
                continue
            nb = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
            if len(nb) == 2:
                moves[v] = (nb[0].co + nb[1].co) / 2
        for v, c in moves.items():
            v.co = v.co.lerp(c, 0.5)
    # PLAIN vertices and faces only. Written out with bm.to_mesh the cap kept
    # the body's weight layer, whose groups it did not have, and the next step
    # that read it brought Blender down (SIGBUS) — every time.
    bm.verts.index_update()
    verts = [tuple(v.co) for v in bm.verts]
    faces = [tuple(v.index for v in f.verts) for f in bm.faces]
    bm.free()
    me = bpy.data.meshes.new("Cap"); me.from_pydata(verts, [], faces); me.update()
    me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            me.uv_layers[0].data[li].uv = (co.x / 0.22, (co.y + co.z) / 0.22)
    cap = bpy.data.objects.new("Cap", me)
    bpy.context.collection.objects.link(cap)
    return cap


def make_mantle(body, rig, fabric="Fabric019", tint=(0.38, 0.30, 0.22), frames=40):
    """A mantle — Elijah's, the one that fell to Elisha (2 Kgs 2:13) — a
    rough wide cloth over the shoulders and down the back. The same laying-on
    as the head-cloth, but its cap is the shoulders, not the head."""
    z0, H, trunk = _trunk(body)
    k_ = H / 1.73
    vs = [body.matrix_world @ v.co for v in body.data.vertices]
    sh = [v for v in vs if z0 + 0.78 * H < v.z < z0 + 0.84 * H]
    cx = sum(v.x for v in sh) / len(sh); cy = sum(v.y for v in sh) / len(sh)
    ztop = z0 + 0.86 * H
    Wd, Dp, n = 0.78 * k_, 0.95 * k_, 30
    from mathutils.bvhtree import BVHTree
    dg = bpy.context.evaluated_depsgraph_get()
    tree = BVHTree.FromObject(body, dg); inv = body.matrix_world.inverted()
    verts, faces = [], []
    front = min(v.y for v in sh)
    for j in range(n + 1):
        for i in range(n + 1):
            x = cx - Wd / 2 + Wd * i / n
            y = front + 0.03 * k_ + Dp * 0.35 * j / n       # over the shoulders, toward the back
            verts.append(Vector((x, y, ztop + 0.05 * k_)))
    for j in range(n):
        for i in range(n):
            a = j * (n + 1) + i
            faces.append((a, a + 1, a + n + 2, a + n + 1))
    # the far half of the square hangs down the back from the start
    for v in verts:
        if v.y > cy + 0.12 * k_:
            d = v.y - (cy + 0.12 * k_)
            v.y = cy + 0.12 * k_ + 0.02 * k_
            v.z -= d
    me = bpy.data.meshes.new("Mantle"); me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
    ob = bpy.data.objects.new("Mantle", me); bpy.context.collection.objects.link(ob)
    uv = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = (co.x / 0.34, (co.y - co.z) / 0.34)
    pin = ob.vertex_groups.new(name="pin")
    for vi, v in enumerate(me.vertices):
        hit, _n, _i, _d = tree.ray_cast(inv @ Vector((v.co.x, v.co.y, ztop + 0.3 * k_)), Vector((0, 0, -1)))
        if hit is None:
            continue
        hz = (body.matrix_world @ hit).z
        if hz > z0 + 0.79 * H and abs(v.co.x - cx) < 0.20 * k_:   # on the shoulders, not the head
            if hz > z0 + 0.88 * H:
                continue
            v.co.z = hz + 0.02 * k_
            pin.add([vi], 1.0, "REPLACE")
    me.update()
    col = body.modifiers.new("collide", "COLLISION")
    body.collision.thickness_outer = 0.008; body.collision.cloth_friction = 8.0
    bpy.context.view_layer.objects.active = ob
    cloth = ob.modifiers.new("cloth", "CLOTH"); st = cloth.settings
    st.quality = 8; st.mass = 0.35; st.air_damping = 1.5
    st.tension_stiffness = 15; st.compression_stiffness = 15; st.bending_stiffness = 0.5
    st.vertex_group_mass = "pin"; st.pin_stiffness = 1.0
    cloth.collision_settings.distance_min = 0.008
    sc = bpy.context.scene; sc.frame_start, sc.frame_end = 1, frames
    cloth.point_cache.frame_start, cloth.point_cache.frame_end = 1, frames
    for f in range(1, frames + 1):
        sc.frame_set(f)
    bpy.ops.object.modifier_apply(modifier="cloth"); sc.frame_set(1)
    body.modifiers.remove(col)
    mat = _material("Mantle", fabric, tint, 0.34); mat.use_backface_culling = False
    ob.data.materials.append(mat)
    for p_ in ob.data.polygons:
        p_.use_smooth = True
    for g in body.vertex_groups:
        if g.name.startswith("mixamorig:"):
            ob.vertex_groups.new(name=g.name)
    dt = ob.modifiers.new("dt", "DATA_TRANSFER"); dt.object = body; dt.use_vert_data = True
    dt.data_types_verts = {"VGROUP_WEIGHTS"}; dt.vert_mapping = "POLYINTERP_NEAREST"
    dt.layers_vgroup_select_src = "ALL"; dt.layers_vgroup_select_dst = "NAME"
    bpy.ops.object.modifier_apply(modifier="dt")
    for g in [g for g in ob.vertex_groups if any(a in g.name for a in ("ForeArm", "Hand"))]:
        g.remove([v.index for v in ob.data.vertices])
    bpy.ops.object.mode_set(mode="WEIGHT_PAINT")
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    ob.vertex_groups.remove(ob.vertex_groups["pin"])
    ob.parent = rig; ob.matrix_parent_inverse = rig.matrix_world.inverted()
    m = ob.modifiers.new("Armature", "ARMATURE"); m.object = rig
    return ob
