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
    nm = nt.nodes.new("ShaderNodeNormalMap"); nm.inputs["Strength"].default_value = 0.6
    nt.links.new(nrm.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Specular IOR Level"].default_value = 0.2
    m["tile_m"] = tile_m
    return m


def make_draped_robe(body, rig, fabric="Fabric036", tint=(0.93, 0.89, 0.80), hem=0.045,
                     frames=40, pad=0.018):
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
    upper = [v for v in allv if v.z > z0 + 0.72 * H and abs(v.x - cx0) <= arm_x + 0.012]
    rings, prev = [], None
    for i, z in enumerate(zs):
        ang = [-math.pi + (k + .5) * 2 * math.pi / N for k in range(N)]
        if z >= hips_z:
            src = upper if z > z0 + 0.74 * H else trunk
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
    me = bpy.data.meshes.new("Robe"); me.from_pydata([tuple(v) for v in verts], [], faces); me.update()
    robe = bpy.data.objects.new("Robe", me); bpy.context.collection.objects.link(robe)

    # UVs: round the body and down it, in metres of cloth, so the weave is the
    # size of a real weave wherever it falls.
    tile = 0.22
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
    for side in ("Left", "Right"):
        cl = rig.data.bones.get(f"mixamorig:{side}Shoulder")
        up = rig.data.bones.get(f"mixamorig:{side}Arm"); lo = rig.data.bones.get(f"mixamorig:{side}ForeArm")
        W = rig.matrix_world
        # From half-way along the collar bone — the first robe left the top of
        # each shoulder bare, because the sleeve began at the arm joint.
        s0 = (W @ cl.head_local).lerp(W @ cl.tail_local, 0.80)     # tucked under the robe's shoulder
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
        for _ in range(3):
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

    mat = _material("Robe", fabric, tint, tile)
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
