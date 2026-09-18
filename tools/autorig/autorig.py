"""Rig a standing figure and give it a library of motions — locally, in Blender.

    blender -b --factory-startup --python tools/autorig/autorig.py -- \
        in.glb out.glb [--clips idle,walk,look,pray,speak,carry]

WHY THIS IS HOME-MADE. Rigging was the one step that still cost money: 8
credits a figure through the rigging service, and more per clip. Every figure
in this app stands the same way — upright, feet on the ground, arms down, in a
robe — so the problem is narrower than general rigging and can be solved by
measuring the mesh.

TWO DECISIONS THAT MAKE IT WORK FOR EVERY FIGURE AT ONCE.

  · ONE SKELETON. The 24 bones, their names and their hierarchy are those of
    the rig the paid service fitted to the traveller and the shepherd (Hips,
    Spine02 … LeftToeBase, Mixamo-style names). Keeping the names means any
    clip made for one figure plays on all of them, and on the two old ones.
    Only the joint POSITIONS are fitted, from landmarks measured on the mesh.

  · CLIPS ARE WRITTEN RELATIVE TO REST. A clip retargeted from another rig
    carries that rig's rest pose with it: the traveller's arms rest at forty-
    five degrees, ours hang straight, and the walk that looked right on him
    would swing ours through the torso. So the clips here are authored as
    rotations AWAY FROM REST about each bone's own axes, with every bone's roll
    set the same way, and they play correctly on whatever rest pose the mesh
    was generated in.

Heights are measured, not assumed: the landmarks come from the vertices, and
the skeleton's proportions are the template's only where a mesh gives nothing
to measure (the spine, which a robe hides).
"""
import bpy, bmesh, math, sys
from mathutils import Vector, Quaternion, Euler

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SRC, DST = argv[0], argv[1]
CLIPS = ["idle", "walk", "look", "pray", "speak", "carry"]
for i, a in enumerate(argv):
    if a == "--clips":
        CLIPS = argv[i + 1].split(",")

FPS = 30

# ── the template skeleton ────────────────────────────────────────────────
#
# Joint heads of the rig the service fitted to the traveller, as FRACTIONS of
# his standing height (1.66 m), x as a fraction of height too. Measured with
# Blender from traveller.glb; see the commit that added this file.
T = {  # name: (parent, x, y, z)   — y is forward-negative, as Blender sees it
    "Hips":          (None,           0.000, -0.037, 0.589),
    "Spine02":       ("Hips",         0.000, -0.035, 0.667),
    "Spine01":       ("Spine02",      0.000, -0.034, 0.745),
    "Spine":         ("Spine01",      0.000, -0.032, 0.823),
    "neck":          ("Spine",        0.000, -0.031, 0.881),
    "Head":          ("neck",         0.000, -0.030, 0.922),
    "head_end":      ("Head",         0.000, -0.080, 1.028),
    "headfront":     ("Head",         0.000, -0.128, 0.922),
    "LeftShoulder":  ("Spine",        0.018, -0.031, 0.837),
    "LeftArm":       ("LeftShoulder", 0.093, -0.029, 0.837),
    "LeftForeArm":   ("LeftArm",      0.158, -0.026, 0.706),
    "LeftHand":      ("LeftForeArm",  0.211, -0.073, 0.575),
    "RightShoulder": ("Spine",       -0.018, -0.031, 0.837),
    "RightArm":      ("RightShoulder",-0.093,-0.029, 0.837),
    "RightForeArm":  ("RightArm",    -0.158, -0.026, 0.706),
    "RightHand":     ("RightForeArm",-0.211, -0.073, 0.575),
    "LeftUpLeg":     ("Hips",         0.054, -0.042, 0.534),
    "LeftLeg":       ("LeftUpLeg",    0.078, -0.061, 0.316),
    "LeftFoot":      ("LeftLeg",      0.101, -0.011, 0.068),
    "LeftToeBase":   ("LeftFoot",     0.120, -0.063, 0.019),
    "RightUpLeg":    ("Hips",        -0.054, -0.039, 0.534),
    "RightLeg":      ("RightUpLeg",  -0.074, -0.049, 0.313),
    "RightFoot":     ("RightLeg",    -0.098, -0.011, 0.069),
    "RightToeBase":  ("RightFoot",   -0.119, -0.063, 0.019),
}
# Where each bone points, for the ones whose tail is not simply their child.
TAIL_CHILD = {
    "Hips": "Spine02", "Spine02": "Spine01", "Spine01": "Spine", "Spine": "neck",
    "neck": "Head", "Head": "head_end",
    "LeftShoulder": "LeftArm", "LeftArm": "LeftForeArm", "LeftForeArm": "LeftHand",
    "RightShoulder": "RightArm", "RightArm": "RightForeArm", "RightForeArm": "RightHand",
    "LeftUpLeg": "LeftLeg", "LeftLeg": "LeftFoot", "LeftFoot": "LeftToeBase",
    "RightUpLeg": "RightLeg", "RightLeg": "RightFoot", "RightFoot": "RightToeBase",
}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = FPS


def import_mesh(path):
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    # Join everything into one object: a figure made of a body, a sash and a
    # bonnet has to deform as one thing or the sash stays where it was.
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    # Unparent from any empty the importer made, keeping the transform, then
    # bake it into the vertices so the rig sees true positions.
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in list(bpy.context.scene.objects):
        if o.type == "EMPTY":
            bpy.data.objects.remove(o)
    # WELD THE SEAMS. A glTF mesh is cut open along every UV seam — each seam
    # vertex is two vertices in the same place — and the heat solve treats each
    # side as a separate piece. Two sides weighted separately part company the
    # moment anything bends: that is the white chips that flew off the robe even
    # in "idle", where only the head moves. Welding costs nothing here, because
    # Blender keeps UVs on the face corners, not the vertices, and the exporter
    # cuts the seams open again on the way out.
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    before = len(bm.verts)
    zs = [v.co.z for v in bm.verts]
    tol = (max(zs) - min(zs)) * 2e-5
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=tol)
    after = len(bm.verts)
    bm.to_mesh(ob.data)
    bm.free()
    ob["welded"] = before - after
    return ob


# ── measuring the mesh ───────────────────────────────────────────────────

def landmarks(ob):
    """Find the joints a robe cannot hide: the hands, the feet, the head."""
    vs = [ob.matrix_world @ v.co for v in ob.data.vertices]
    zmin = min(v.z for v in vs); zmax = max(v.z for v in vs)
    H = zmax - zmin
    cx = sum(v.x for v in vs) / len(vs)
    cy = sum(v.y for v in vs) / len(vs)
    L = {"H": H, "z0": zmin, "cx": cx, "cy": cy}

    def band(z0, z1):
        return [v for v in vs if zmin + z0 * H <= v.z <= zmin + z1 * H]

    # The torso's half-width at the chest, measured — anything further out at
    # hand height is a hand, not a hip.
    chest = band(0.70, 0.78)
    L["chest_half"] = (max(v.x for v in chest) - min(v.x for v in chest)) / 2

    # HANDS. At the height a hanging hand is (45–62 % of stature), the vertices
    # furthest from the centre line on each side. Their centroid is the hand;
    # the wrist is the top of that cluster.
    for side, sgn in (("Left", 1), ("Right", -1)):
        pts = [v for v in band(0.40, 0.66) if sgn * (v.x - cx) > 0]
        if not pts:
            continue
        far = max(sgn * (v.x - cx) for v in pts)
        hand = [v for v in pts if sgn * (v.x - cx) > far - 0.045 * H]
        c = sum(hand, Vector()) / len(hand)
        top = max(v.z for v in hand)
        L[side + "Hand"] = Vector((c.x, c.y, min(top, c.z + 0.04 * H)))

    # FEET. Lowest tenth of the figure, split by side.
    for side, sgn in (("Left", 1), ("Right", -1)):
        pts = [v for v in band(0.0, 0.08) if sgn * (v.x - cx) > 0]
        if pts:
            c = sum(pts, Vector()) / len(pts)
            L[side + "Foot"] = Vector((c.x, c.y, zmin + 0.065 * H))
            front = min(pts, key=lambda v: v.y)       # -y is forward
            L[side + "Toe"] = Vector((c.x, front.y * 0.5 + c.y * 0.5, zmin + 0.02 * H))

    # HEAD. The top of the figure, over the centre.
    L["top"] = zmax
    return L


def build_rig(ob):
    L = landmarks(ob)
    H, z0, cx, cy = L["H"], L["z0"], L["cx"], L["cy"]
    pos = {}
    for name, (_, x, y, z) in T.items():
        pos[name] = Vector((cx + x * H, cy + y * H * 0.5, z0 + z * H))

    # Put the measured joints where they were measured, and bend the chains to
    # reach them. The shoulder stays at template proportion (a robe hides it);
    # the elbow sits two-fifths of the way from shoulder to hand, pushed out a
    # little, which is where a hanging elbow is.
    for side in ("Left", "Right"):
        if side + "Hand" in L:
            hand = L[side + "Hand"]
            sh = pos[side + "Arm"]
            pos[side + "Hand"] = hand
            el = sh.lerp(hand, 0.47)
            out = 1 if side == "Left" else -1
            el.x += out * 0.012 * H
            el.y += 0.01 * H                         # elbows sit a little back
            pos[side + "ForeArm"] = el
        if side + "Foot" in L:
            ft = L[side + "Foot"]
            up = pos[side + "UpLeg"]
            pos[side + "Foot"] = ft
            kn = up.lerp(ft, 0.49)
            kn.y -= 0.012 * H                        # knees a little forward
            pos[side + "Leg"] = kn
            pos[side + "ToeBase"] = L[side + "Toe"]
    pos["head_end"].z = min(pos["head_end"].z, L["top"] - 0.005 * H)

    bpy.ops.object.armature_add(enter_editmode=True, location=(0, 0, 0))
    arm = bpy.context.object
    arm.name = "Armature"
    arm.data.name = "Armature"
    eb = arm.data.edit_bones
    eb.remove(eb[0])
    bones = {}
    for name, (parent, *_rest) in T.items():
        b = eb.new(name)
        b.head = pos[name]
        if name in TAIL_CHILD:
            b.tail = pos[TAIL_CHILD[name]]
        elif name.endswith("Hand"):
            d = (pos[name] - pos[name.replace("Hand", "ForeArm")]).normalized()
            b.tail = pos[name] + d * 0.09 * H
        elif name.endswith("ToeBase"):
            b.tail = pos[name] + Vector((0, -0.05 * H, 0))
        elif name == "head_end":
            b.tail = pos[name] + Vector((0, 0, 0.03 * H))
        elif name == "headfront":
            b.tail = pos[name] + Vector((0, -0.03 * H, 0))
        if (b.tail - b.head).length < 1e-4:
            b.tail = b.head + Vector((0, 0, 0.02 * H))
        bones[name] = b
    for name, (parent, *_rest) in T.items():
        if parent:
            bones[name].parent = bones[parent]
            bones[name].use_connect = False
    # ONE ROLL RULE FOR EVERY BONE, so "rotate about local X" means the same
    # thing on every figure: X points to the character's right for the spine
    # and legs, and forward for the arms. The clips below are written against
    # this and nothing else.
    for name, b in bones.items():
        if "Arm" in name or "Hand" in name or "Shoulder" in name:
            b.align_roll(Vector((0, -1, 0)))
        else:
            b.align_roll(Vector((0, -1, 0)))
    bpy.ops.object.mode_set(mode="OBJECT")

    # Skin it. Heat-diffusion weights, which is what "automatic weights" is.
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    guarded = guard_torso(ob, L)
    orphans = adopt_orphans(ob, arm)
    return arm, L, orphans + 0 * guarded


ARM_CHAIN = [f"{s}{b}" for s in ("Left", "Right") for b in ("Arm", "ForeArm", "Hand")]


def guard_torso(ob, L):
    """Take the arm bones off anything that is part of the body, not the arm.

    A hanging hand rests against the girdle, so the heat solve hands the
    girdle — and the side of the robe under it — partly to the forearm. Raise
    the arm to pray and the girdle rises with it, torn out of the robe. That is
    what the second contact sheet showed. So inside the width of the chest,
    below the shoulders, no vertex answers to an arm bone; its weight goes back
    to what is left, which is the spine and the hips."""
    H, z0, cx = L["H"], L["z0"], L["cx"]
    inner = L["chest_half"] * 0.82
    shoulder_z = z0 + 0.80 * H
    arm_ids = {ob.vertex_groups[n].index for n in ARM_CHAIN if n in ob.vertex_groups}
    n = 0
    for v in ob.data.vertices:
        p = ob.matrix_world @ v.co
        if abs(p.x - cx) > inner or p.z > shoulder_z:
            continue
        gone = [g for g in v.groups if g.group in arm_ids and g.weight > 0]
        if not gone:
            continue
        for g in gone:
            ob.vertex_groups[g.group].remove([v.index])
        rest = [g for g in v.groups if g.weight > 0]
        tot = sum(g.weight for g in rest)
        for g in rest:
            ob.vertex_groups[g.group].add([v.index], g.weight / tot if tot else 0, "REPLACE")
        n += 1
    ob["guarded"] = n
    return n


def adopt_orphans(ob, arm):
    """Give every vertex the heat solve left out to its nearest bone.

    Heat weights are solved per connected piece, and a piece that is not
    connected to the body — a sandal, a strap, a tassel — can come back with no
    weight at all. Such a vertex does not move: in the first walk the man
    strode off and left his sandals on the floor. So anything unweighted is
    bound, whole, to the bone it is closest to."""
    segs = []
    for b in arm.data.bones:
        if b.name in ("head_end", "headfront"):
            continue
        segs.append((b.name, arm.matrix_world @ b.head_local, arm.matrix_world @ b.tail_local))

    def near(p):
        best, who = 1e9, None
        for name, a, c in segs:
            ab = c - a
            t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
            d = (a + ab * t - p).length
            if d < best:
                best, who = d, name
        return who

    n = 0
    for v in ob.data.vertices:
        if any(g.weight > 1e-4 for g in v.groups):
            continue
        name = near(ob.matrix_world @ v.co)
        vg = ob.vertex_groups.get(name) or ob.vertex_groups.new(name=name)
        vg.add([v.index], 1.0, "REPLACE")
        n += 1
    return n


# ── the clips ────────────────────────────────────────────────────────────
#
# One library for every rig, in autorig_clips.py: clips are written in the
# figure's own terms (tip forward, turn, out) and turned into each bone's axes
# at keying time, so they no longer depend on the roll set above.
sys.path.insert(0, __file__.rsplit("/", 1)[0])
import autorig_clips as clips  # noqa: E402


def main():
    reset()
    ob = import_mesh(SRC)
    arm, L, orphans = build_rig(ob)
    for c in CLIPS:
        clips.make_clip(arm, c, clips.CLIP_DEFS[c], clips.SELF)
    # Every clip back to rest, so the exported bind pose is the rest pose.
    for pb in arm.pose.bones:
        pb.rotation_quaternion = Quaternion()
        pb.location = (0, 0, 0)
    bpy.ops.export_scene.gltf(
        filepath=DST, export_format="GLB",
        export_animations=True, export_animation_mode="NLA_TRACKS",
        export_skins=True, export_yup=True,
    )
    groups = len(ob.vertex_groups)
    weighted = sum(1 for v in ob.data.vertices if v.groups)
    print(f"AUTORIG height {L['H']:.3f} m, hands "
          f"{'found' if 'LeftHand' in L and 'RightHand' in L else 'MISSING'}, "
          f"feet {'found' if 'LeftFoot' in L and 'RightFoot' in L else 'MISSING'}, "
          f"{groups} groups, {weighted}/{len(ob.data.vertices)} vertices weighted "
          f"({orphans} adopted by their nearest bone), "
          f"{ob.get('welded', 0)} seam vertices welded, {ob.get('guarded', 0)} torso vertices kept off the arms, "
          f"clips {','.join(CLIPS)} -> {DST}")


main()
