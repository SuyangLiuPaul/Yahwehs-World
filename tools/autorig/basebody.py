"""Build a base figure in Blender: a MakeHuman body, its own rig and weights,
and a robe fitted to it — no generated mesh anywhere.

    blender -b --python tools/autorig/basebody.py -- out.glb \
        [--gender 1.0] [--age 0.6] [--height 0.5] [--weight 0.5] [--muscle 0.5] \
        [--robe ankle|knee|none] [--rig mixamo|cmu_mb] [--clips idle,walk,...]

WHY. Every generated mesh is a different shape, so every one has to be rigged
from scratch, and heat weights on a robed figure tear the cloth. The owner's
suggestion was to turn it round: build the BODIES once, correctly, and let a
model add only the likeness. This is that body.

  · THE BODY is MakeHuman's base mesh through MPFB — CC0, parametric in
    gender, age, height, weight and proportion. A boy, an old woman and a man
    of forty are the same mesh with different numbers.
  · THE RIG AND WEIGHTS are MPFB's own, painted by hand for that mesh. Nothing
    is solved by heat, so nothing tears. `mixamo` keeps the bone names every
    clip in this project is keyed to; `cmu_mb` is the skeleton of the CMU
    motion-capture library, two thousand clips free for any use.
  · THE ROBE is made from the body: a surface swept through horizontal
    sections of the figure from the shoulders to the ankle, widened at the hem
    as cloth falls, and weighted by copying the weights of the body surface
    nearest to it — which is how MPFB fits clothing too. It is a long tunic,
    what a man in any passage of this app wears.
"""
import bpy, bmesh, math, sys, importlib
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0]
opt = {"gender": 1.0, "age": 0.6, "height": 0.5, "weight": 0.5, "muscle": 0.5,
       "proportions": 0.5, "robe": "ankle", "rig": "mixamo", "clips": "idle,walk,look,pray,speak,carry"}
for i, a in enumerate(argv[1:], 1):
    if a.startswith("--"):
        k = a[2:]
        v = argv[i + 1]
        opt[k] = v if k in ("robe", "rig", "clips") else float(v)

BASE = "bl_ext.blender_org.mpfb"
HS = importlib.import_module(BASE + ".services.humanservice").HumanService
TS = importlib.import_module(BASE + ".services.targetservice").TargetService


def make_body(keep_helpers=False, face=None):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    macro = TS.get_default_macro_info_dict()
    for k in ("gender", "age", "height", "weight", "muscle", "proportions"):
        macro[k] = opt[k]
    # A population of the Near East, not an average of the world.
    macro["race"] = {"asian": 0.15, "caucasian": 0.7, "african": 0.15}
    body = HS.create_human(scale=0.1, feet_on_ground=True, macro_detail_dict=macro)
    # A FACE OF ITS OWN. MakeHuman's targets — nose hump, cheekbones, chin,
    # brow, the set of the eyes, the age of the head — loaded before the rig is
    # fitted, so a face that changes the skull still gets joints that fit it.
    # `face` is {target_file_stem: weight 0..1}; set_target_value alone silently
    # does nothing until a target has been loaded, so they are loaded by path.
    for stem, w in (face or {}).items():
        path = TS.target_full_path(stem)
        if path is None:
            print(f"BASEBODY no face target called {stem}")
            continue
        TS.load_target(body, path, weight=float(w))
    rig = HS.add_builtin_rig(body, opt["rig"], import_weights=True)
    # Bake the shape keys: the exported mesh must be the body with the targets
    # applied, not the neutral base with sliders.
    bpy.context.view_layer.objects.active = body
    if body.data.shape_keys:
        body.shape_key_add(name="__baked", from_mix=True)
        keys = body.data.shape_keys.key_blocks
        for kb in list(keys):
            if kb.name != "__baked":
                body.shape_key_remove(kb)
        body.shape_key_remove(body.data.shape_keys.key_blocks["__baked"])
    if not keep_helpers:
        drop_helpers(body)
    return body, rig


ARMISH = ("arm", "hand", "shoulder", "clavicle", "thumb", "index", "middle", "ring", "pinky", "finger")


def trunk_vertices(body):
    """The body without its arms, by weight: a vertex that is more than a
    quarter arm is not part of the trunk. Measuring a section at hip height
    with the arms in it took the hanging hands as the width of the waist, and
    the first robe came out with a table-top round its middle."""
    arm_ids = {g.index for g in body.vertex_groups if any(a in g.name.lower() for a in ARMISH)}
    allv = [body.matrix_world @ v.co for v in body.data.vertices]
    z0 = min(v.z for v in allv); H = max(v.z for v in allv) - z0
    # …and by WIDTH, because weight alone does not do it: MakeHuman weights the
    # fingernails through a material group, not a bone, so a nail carries no arm
    # weight at all and was counted as the hip. The hips are measured where no
    # arm can reach (42-48 % of stature, below the hanging hands) and nothing
    # wider than that, above it, is trunk.
    hips = [v for v in allv if z0 + 0.42 * H <= v.z <= z0 + 0.48 * H]
    cx = sum(v.x for v in hips) / len(hips)
    half = max(abs(v.x - cx) for v in hips) * 1.12
    out = []
    for v, p in zip(body.data.vertices, allv):
        w = sum(g.weight for g in v.groups if g.group in arm_ids)
        if w >= 0.25:
            continue
        if p.z > z0 + 0.48 * H and abs(p.x - cx) > half:
            continue
        out.append(p)
    return out


def drop_helpers(body):
    """MPFB's helper geometry — the tights, the skirt, the hair and eye proxies
    it fits clothes to — must not be exported as if it were the body. It must
    also still be there while anything is being FITTED: hair, brows and eyes
    are placed by reference to it, and the first attempt to add them after it
    was gone failed with an index past the end of the mesh."""
    helpers = [g for g in body.vertex_groups if g.name.startswith("HelperGeometry")
               or g.name.startswith("helper-") or g.name == "JointCubes"]
    if helpers:
        bm = bmesh.new(); bm.from_mesh(body.data)
        dl = bm.verts.layers.deform.active
        ids = {g.index for g in helpers}
        kill = [v for v in bm.verts if dl and any(i in v[dl] and v[dl][i] > 0.5 for i in ids)]
        bmesh.ops.delete(bm, geom=kill, context="VERTS")
        bm.to_mesh(body.data); bm.free()


def sections(body, zs):
    """Horizontal sections of the trunk: per height, the outline as a ring of
    points at fixed angles, taking the furthest trunk vertex in each sector."""
    vs = trunk_vertices(body)
    rings = []
    N = 32
    for z in zs:
        band = [v for v in vs if abs(v.z - z) < 0.02]
        if not band:
            rings.append(None); continue
        cx = sum(v.x for v in band) / len(band)
        cy = sum(v.y for v in band) / len(band)
        r = [0.0] * N
        for v in band:
            a = math.atan2(v.y - cy, v.x - cx)
            k = int(((a + math.pi) / (2 * math.pi)) * N) % N
            d = math.hypot(v.x - cx, v.y - cy)
            r[k] = max(r[k], d)
        # fill empty sectors from neighbours
        for _ in range(3):
            r = [x if x > 0 else max(r[(i - 1) % N], r[(i + 1) % N]) for i, x in enumerate(r)]
        rings.append((cx, cy, r))
    return rings, N


def make_robe(body, rig):
    if opt["robe"] == "none":
        return None
    vs = [body.matrix_world @ v.co for v in body.data.vertices]
    z0 = min(v.z for v in vs); H = max(v.z for v in vs) - z0
    # The neckline: the base of the neck, so the robe covers the shoulders
    # and meets the sleeves instead of leaving a band of bare skin between.
    top = z0 + 0.845 * H
    bottom = z0 + (0.06 if opt["robe"] == "ankle" else 0.30) * H
    steps = 28
    zs = [top - (top - bottom) * i / (steps - 1) for i in range(steps)]
    rings, N = sections(body, zs)
    # A robe does not follow the legs: below the hips each ring is the hull of
    # the rings above it, and it widens toward the hem as falling cloth does.
    hip_i = min(range(steps), key=lambda i: abs(zs[i] - (z0 + 0.50 * H)))
    verts, faces = [], []
    prev = None
    for i, (z, ring) in enumerate(zip(zs, rings)):
        if ring is None:
            ring = prev
        cx, cy, r = ring
        if i > hip_i:
            hr = rings[hip_i][2]
            t = (i - hip_i) / (steps - 1 - hip_i)
            r = [max(a, b) * (1.0 + 0.22 * t) for a, b in zip(r, hr)]
            cx, cy = rings[hip_i][0], rings[hip_i][1]
        pad = 0.012 + 0.004 * (i / steps)  # cloth stands off the body
        for k in range(N):
            a = -math.pi + (k + 0.5) * 2 * math.pi / N
            verts.append(Vector((cx + (r[k] + pad) * math.cos(a), cy + (r[k] + pad) * math.sin(a), z)))
        prev = (cx, cy, r)
        if i:
            b0, b1 = (i - 1) * N, i * N
            for k in range(N):
                faces.append((b0 + k, b0 + (k + 1) % N, b1 + (k + 1) % N, b1 + k))
    me = bpy.data.meshes.new("Robe")
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    robe = bpy.data.objects.new("Robe", me)
    bpy.context.collection.objects.link(robe)
    # Smooth it and give it thickness, so it reads as cloth and not a tube.
    bpy.context.view_layer.objects.active = robe
    sub = robe.modifiers.new("sub", "SUBSURF"); sub.levels = 1
    bpy.ops.object.modifier_apply(modifier="sub")
    sol = robe.modifiers.new("sol", "SOLIDIFY"); sol.thickness = 0.006
    bpy.ops.object.modifier_apply(modifier="sol")
    mat = bpy.data.materials.new("Linen"); mat.diffuse_color = (0.86, 0.83, 0.76, 1)
    robe.data.materials.append(mat)
    # Weights from the nearest body surface — how MPFB fits a garment.
    robe.parent = rig
    arm_mod = robe.modifiers.new("Armature", "ARMATURE"); arm_mod.object = rig
    for g in body.vertex_groups:
        robe.vertex_groups.new(name=g.name)
    dt = robe.modifiers.new("dt", "DATA_TRANSFER")
    dt.object = body
    dt.use_vert_data = True
    dt.data_types_verts = {"VGROUP_WEIGHTS"}
    dt.vert_mapping = "POLYINTERP_NEAREST"
    dt.layers_vgroup_select_src = "ALL"
    dt.layers_vgroup_select_dst = "NAME"
    bpy.ops.object.modifier_move_to_index(modifier="dt", index=0)
    bpy.ops.object.modifier_apply(modifier="dt")
    # A robe is not an arm: the cloth below the chest follows the body only.
    arms = [n for n in (g.name for g in robe.vertex_groups)
            if any(s in n.lower() for s in ("arm", "hand", "shoulder", "clavicle"))]
    for n in arms:
        g = robe.vertex_groups[n]
        idx = [v.index for v in robe.data.vertices
               if (robe.matrix_world @ v.co).z < z0 + 0.70 * H]
        g.remove(idx)
    return robe


def lower_arms(body, rig, degrees=36.0):
    """Bring the arms down from MakeHuman's A-pose and make that the rest pose.

    MakeHuman builds every body with the arms held out at forty-five degrees,
    which is the right pose to rig in and the wrong one to stand in: "idle"
    came out as a man holding his arms away from his sides for ever. So the
    arms are lowered, the body is baked in that pose, and the pose becomes the
    rest pose — the weights are untouched, only where "zero" is has moved. Every
    clip is relative to rest, so every clip now starts from arms at the sides."""
    import autorig_clips as ac
    bmap = ac.MIXAMO if opt["rig"] == "mixamo" else ac.CMU
    fr = ac._frames(rig, bmap)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="POSE")
    from mathutils import Quaternion
    for side in ("Left", "Right"):
        real, M, _fwd, outv, _up = fr[side + "Arm"]
        qw = Quaternion(outv, math.radians(-degrees))
        Mq = M.to_quaternion()
        pb = rig.pose.bones[real]
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = Mq.inverted() @ qw @ Mq
    bpy.ops.object.mode_set(mode="OBJECT")
    # Bake the pose into every mesh the rig moves — the body and the robe —
    # then make that pose the rest pose and re-attach them.
    skinned = [o for o in bpy.context.scene.objects
               if o.type == "MESH" and any(m.type == "ARMATURE" and m.object == rig for m in o.modifiers)]
    for o in skinned:
        bpy.context.view_layer.objects.active = o
        mod = next(m for m in o.modifiers if m.type == "ARMATURE" and m.object == rig)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    for o in skinned:
        m = o.modifiers.new("Armature", "ARMATURE")
        m.object = rig


def make_sleeves(body, rig):
    """Two sleeves, each a tube round the arm from the shoulder to the wrist,
    weighted to the arm — the long-sleeved inner coat of the period."""
    arm_bones = []
    for side in ("Left", "Right"):
        up = rig.data.bones.get(f"mixamorig:{side}Arm") or rig.data.bones.get(f"{side}Arm")
        lo = rig.data.bones.get(f"mixamorig:{side}ForeArm") or rig.data.bones.get(f"{side}ForeArm")
        arm_bones.append((up, lo))
    W = rig.matrix_world
    vs = [body.matrix_world @ v.co for v in body.data.vertices]
    verts, faces = [], []
    N, RINGS = 14, 16
    for up, lo in arm_bones:
        a = W @ up.head_local
        b = W @ lo.head_local
        c = W @ lo.tail_local
        pts = [a.lerp(b, t / (RINGS // 2)) for t in range(RINGS // 2)] + \
              [b.lerp(c, t / (RINGS // 2 - 1)) for t in range(RINGS // 2)]
        base = len(verts)
        for i, ctr in enumerate(pts):
            nxt = pts[min(i + 1, len(pts) - 1)] if i < len(pts) - 1 else ctr + (ctr - pts[i - 1])
            d = (nxt - ctr).normalized()
            # arm radius here: the body vertices close to this point of the arm
            near = [v for v in vs if (v - ctr).length < 0.075]
            r = max([((v - ctr) - d * (v - ctr).dot(d)).length for v in near] or [0.045])
            r = min(r, 0.075) + 0.012 + 0.012 * (i / len(pts))   # the cuff is looser
            u = d.orthogonal().normalized(); w = d.cross(u).normalized()
            for k in range(N):
                ang = 2 * math.pi * k / N
                verts.append(ctr + (u * math.cos(ang) + w * math.sin(ang)) * r)
            if i:
                b0, b1 = base + (i - 1) * N, base + i * N
                for k in range(N):
                    faces.append((b0 + k, b0 + (k + 1) % N, b1 + (k + 1) % N, b1 + k))
    me = bpy.data.meshes.new("Sleeves")
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    sl = bpy.data.objects.new("Sleeves", me)
    bpy.context.collection.objects.link(sl)
    bpy.context.view_layer.objects.active = sl
    sub = sl.modifiers.new("sub", "SUBSURF"); sub.levels = 1
    bpy.ops.object.modifier_apply(modifier="sub")
    sol = sl.modifiers.new("sol", "SOLIDIFY"); sol.thickness = 0.005
    bpy.ops.object.modifier_apply(modifier="sol")
    for g in body.vertex_groups:
        sl.vertex_groups.new(name=g.name)
    dt = sl.modifiers.new("dt", "DATA_TRANSFER")
    dt.object = body; dt.use_vert_data = True
    dt.data_types_verts = {"VGROUP_WEIGHTS"}; dt.vert_mapping = "POLYINTERP_NEAREST"
    dt.layers_vgroup_select_src = "ALL"; dt.layers_vgroup_select_dst = "NAME"
    bpy.ops.object.modifier_apply(modifier="dt")
    sl.parent = rig
    m = sl.modifiers.new("Armature", "ARMATURE"); m.object = rig
    return sl


def main():
    body, rig = make_body()
    sys.path.insert(0, __file__.rsplit("/", 1)[0])
    # ORDER MATTERS. The robe is measured while the arms are still held out,
    # because with the arms down the hands hang exactly at hip height and are
    # taken for the hips — which put a shelf round the robe a second time. The
    # sleeves are made after, round arms that are where they will rest.
    robe = make_robe(body, rig)
    lower_arms(body, rig)
    sleeves = make_sleeves(body, rig) if robe is not None else None
    if sleeves is not None:
        mat = robe.data.materials[0]
        sleeves.data.materials.append(mat)
    # Clips: the same library the auto-rig writes, keyed by name. Imported
    # from autorig.py so there is one definition of what "pray" is.
    sys.path.insert(0, __file__.rsplit("/", 1)[0])
    ar = importlib.import_module("autorig_clips")
    for name in opt["clips"].split(","):
        ar.make_clip(rig, name, ar.CLIP_DEFS[name], ar.MIXAMO if opt["rig"] == "mixamo" else ar.CMU)
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
    bpy.ops.object.select_all(action="DESELECT")
    for o in (body, rig, robe, sleeves):
        if o:
            o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True,
                              export_animations=True, export_animation_mode="NLA_TRACKS",
                              export_skins=True, export_yup=True)
    vs = [body.matrix_world @ v.co for v in body.data.vertices]
    H = max(v.z for v in vs) - min(v.z for v in vs)
    print(f"BASEBODY {OUT}: height {H:.3f} m, body {len(body.data.polygons):,} faces, "
          f"robe {len(robe.data.polygons) if robe else 0:,} faces, "
          f"sleeves {len(sleeves.data.polygons) if sleeves else 0:,} faces, rig {opt['rig']} "
          f"({len(rig.data.bones)} bones), clips {opt['clips']}")


main()
