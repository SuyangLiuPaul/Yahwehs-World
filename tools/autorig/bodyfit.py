"""Rig any standing figure by fitting a MakeHuman body inside it.

    blender -b --python tools/autorig/bodyfit.py -- figure.glb out.glb \
        [--gender 1.0] [--age 0.6] [--clips idle,walk,look,pray,speak,carry]

THE OWNER'S IDEA, and the reason it works where heat weights did not. A
generated figure is a shell of cloth; solving weights over that shell cannot
know where the body inside it is, so the robe beside the hand goes with the
hand and the girdle goes with the arm. Here the body is SUPPLIED: a MakeHuman
body of the same height, arms lowered to hang the way a generated figure's
hang, placed inside the figure — and its hand-painted weights are carried out
to the shell, each point of the cloth taking the weights of the part of the
body under it. The MakeHuman mesh is then thrown away; its skeleton stays.

Every figure rigged this way has the SAME skeleton (MakeHuman's Mixamo rig),
so the clip library in autorig_clips.py plays on all of them.
"""
import bpy, math, sys, importlib
from mathutils import Vector, Matrix
from mathutils.kdtree import KDTree

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
opt = {"gender": 1.0, "age": 0.6, "clips": "idle,walk,look,pray,speak,carry", "smooth": 6.0, "apose": -1.0}
for i, a in enumerate(argv[2:], 2):
    if a.startswith("--"):
        k = a[2:]; v = argv[i + 1]
        opt[k] = v if k == "clips" else float(v)

HERE = __file__.rsplit("/", 1)[0]
sys.path.insert(0, HERE)
import autorig_clips as ac  # noqa: E402
bb = {}
exec(compile(open(HERE + "/basebody.py").read().split("\ndef main():")[0]
             .replace("argv = sys.argv", "argv = ['x.glb'] or sys.argv"), "basebody", "exec"), bb)
HS = bb["HS"]; TS = bb["TS"]


def bounds(vs):
    lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    return lo, hi


def import_figure(path):
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.context.scene.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in new:
        if o.type == "EMPTY" and o.name in bpy.data.objects:
            bpy.data.objects.remove(o)
    # weld the UV seams so weights are continuous across them (see autorig.py)
    import bmesh
    bm = bmesh.new(); bm.from_mesh(ob.data)
    zs = [v.co.z for v in bm.verts]
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=(max(zs) - min(zs)) * 2e-5)
    bm.to_mesh(ob.data); bm.free()
    return ob


def main():
    # The body FIRST: making it resets the scene, so anything imported before
    # it would be wiped (the first run lost the figure that way).
    bb["opt"].update({"gender": opt["gender"], "age": opt["age"], "rig": "mixamo",
                      "height": 0.5, "weight": 0.5, "muscle": 0.5, "proportions": 0.5})
    body, rig = bb["make_body"]()

    fig = import_figure(SRC)
    fv = [fig.matrix_world @ v.co for v in fig.data.vertices]
    flo, fhi = bounds(fv)
    fH = fhi.z - flo.z
    fc = (flo + fhi) / 2

    # ARMS OUT OR ARMS DOWN? A figure generated in A-pose — arms held away from
    # the robe — is what makes clean rigging possible, and it is fitted by a body
    # in the SAME pose: MakeHuman's own A-pose, untouched. Only a figure whose
    # arms already hang is fitted by a body whose arms are lowered to match.
    # Measured: at hand height, how far out does the figure reach compared with
    # its hips? Arms hanging reach a little past the hips; arms out, twice as far.
    def reach_x(lo, hi):
        band = [v for v in fv if flo.z + lo * fH <= v.z <= flo.z + hi * fH]
        return max(max(v.x for v in band) - min(v.x for v in band),
                   max(v.y for v in band) - min(v.y for v in band))
    apose = opt["apose"] > 0 if opt["apose"] >= 0 else reach_x(0.50, 0.66) > 1.9 * reach_x(0.40, 0.46)
    if not apose:
        bb["lower_arms"](body, rig, degrees=38.0)

    # Same height, same place. Scale the rig (the body follows it), then
    # stand both on the ground with their centres over each other.
    bv = [body.matrix_world @ v.co for v in body.data.vertices]
    blo, bhi = bounds(bv)
    s = fH / (bhi.z - blo.z)
    rig.scale = rig.scale * s
    bpy.context.view_layer.update()
    bv = [body.matrix_world @ v.co for v in body.data.vertices]
    blo, bhi = bounds(bv)
    bc = (blo + bhi) / 2
    rig.location += Vector((fc.x - bc.x, fc.y - bc.y, flo.z - blo.z))
    bpy.context.view_layer.update()

    # WHICH WAY DOES THE FIGURE FACE? From its feet: toes point forward. The
    # first version chose among four quarter turns by how snugly the body sat
    # inside the figure, and a robe wider than it is deep made a man facing the
    # camera fit best turned sideways. Figures made from a reference photograph
    # face the camera or away from it, never sideways, so only those two are
    # considered, and the toes decide.
    # By EXTREMES, not averages: a sole averages to the middle of the foot, so
    # the first toe test called a man facing the camera backwards. Toes reach
    # ~15 cm in front of the ankle and a heel ~5 cm behind it; a nose and a
    # beard reach further forward than the back of the head reaches back.
    DIRS = {0: Vector((0, -1, 0)), 1: Vector((1, 0, 0)), 2: Vector((0, 1, 0)), 3: Vector((-1, 0, 0))}

    def reach(band_lo, band_hi, ref_lo, ref_hi):
        band = [v for v in fv if flo.z + band_lo * fH <= v.z <= flo.z + band_hi * fH]
        ref = [v for v in fv if flo.z + ref_lo * fH <= v.z <= flo.z + ref_hi * fH]
        c = sum(ref, Vector()) / max(len(ref), 1)
        return {k: max(((v - c).dot(d) for v in band), default=0) for k, d in DIRS.items()}

    feet = reach(0.0, 0.035, 0.05, 0.09)          # toes vs ankles
    face = reach(0.86, 0.94, 0.86, 0.94)          # nose/beard vs the head's own centre
    # FIRST THE SHOULDER LINE. "Never sideways" was wrong: Tripo exported the
    # man with his shoulders along Y — 0.447 m deep and 0.208 m wide — and a
    # front-or-back choice put the body in at right angles to him. A man is
    # wider across the shoulders than he is deep, so the longer horizontal
    # extent at the chest is the line from hand to hand, and forward is square
    # to it.
    chest = [v for v in fv if flo.z + 0.70 * fH <= v.z <= flo.z + 0.80 * fH]
    ext_x = max(v.x for v in chest) - min(v.x for v in chest)
    ext_y = max(v.y for v in chest) - min(v.y for v in chest)
    only = (0, 2) if ext_x >= ext_y else (1, 3)
    by_feet = max(only, key=lambda k: feet[k])
    by_face = max(only, key=lambda k: face[k])
    turn = by_feet if by_feet == by_face else by_feet
    toe_y, ankle_y = feet[0], feet[2]
    best = (abs(toe_y - ankle_y), turn)
    if turn:
        # Turn the FIGURE, not the skeleton. A rotated rig has to carry its own
        # idea of forward into every clip and every guard, and each place that
        # forgot was a bug (arms behind the back, one arm frozen). Turned once
        # here, the figure faces -Y like every other model and nothing
        # downstream has to know it ever faced anywhere else.
        # facing DIRS[turn] -> facing -Y is a turn of MINUS turn quarter-turns
        R = Matrix.Translation((fc.x, fc.y, 0)) @ Matrix.Rotation(-turn * math.pi / 2, 4, "Z") \
            @ Matrix.Translation((-fc.x, -fc.y, 0))
        fig.data.transform(R)
        fig.data.update()
        fv = [fig.matrix_world @ v.co for v in fig.data.vertices]
        flo, fhi = bounds(fv)
        fc = (flo + fhi) / 2
        bv = [body.matrix_world @ v.co for v in body.data.vertices]
        blo, bhi = bounds(bv)
        bc = (blo + bhi) / 2
        rig.location += Vector((fc.x - bc.x, fc.y - bc.y, flo.z - blo.z))
        bpy.context.view_layer.update()

    # Carry the weights out from the body to the figure.
    for g in body.vertex_groups:
        if g.name.startswith("mixamorig:"):
            fig.vertex_groups.new(name=g.name)
    bpy.context.view_layer.objects.active = fig
    dt = fig.modifiers.new("dt", "DATA_TRANSFER")
    dt.object = body
    dt.use_vert_data = True
    dt.data_types_verts = {"VGROUP_WEIGHTS"}
    dt.vert_mapping = "POLYINTERP_NEAREST"
    dt.layers_vgroup_select_src = "ALL"
    dt.layers_vgroup_select_dst = "NAME"
    bpy.ops.object.modifier_apply(modifier="dt")
    # Cloth between the legs belongs to both legs; smooth the weights so a
    # robe does not split down the middle when a man takes a step.
    # ONLY THE LEGS. Smoothing every group blurred each arm into the torso, so a
    # whole panel of tunic carried a little arm weight and the forearm stretched
    # between the two like a sock.
    bpy.ops.object.mode_set(mode="WEIGHT_PAINT")
    for g in list(fig.vertex_groups):
        if any(k in g.name for k in ("UpLeg", "Leg", "Hips")) and "Foot" not in g.name:
            fig.vertex_groups.active_index = g.index
            bpy.ops.object.vertex_group_smooth(group_select_mode="ACTIVE", factor=0.5,
                                               repeat=int(opt["smooth"]))
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    bpy.ops.object.mode_set(mode="OBJECT")

    # WHICH CLOTH IS ARM? Lift the body's arms and look again.
    #
    # Width could not tell: this man's arms hang inside the width of his hips,
    # so a width test stripped the arms of their own weights (the census showed
    # 22 vertices left on the left upper arm, 4 on the right). What separates
    # an arm from the girdle beside the hand is WHY each was near the body:
    # an arm vertex was near only because the body's arm was there — lift the
    # arm and the nearest body surface is suddenly far; a girdle vertex sits on
    # the waist, and is just as near with the arms up. So only cloth that the
    # lifted arms take away from keeps arm weights.
    def body_points():
        dg = bpy.context.evaluated_depsgraph_get()
        ev = body.evaluated_get(dg)
        me = ev.to_mesh()
        pts = [body.matrix_world @ v.co for v in me.vertices]
        ev.to_mesh_clear()
        return pts

    def tree(pts):
        t = KDTree(len(pts))
        for i, q in enumerate(pts): t.insert(q, i)
        t.balance(); return t

    down = tree(body_points())
    fr = ac._frames(rig, ac.MIXAMO)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="POSE")
    from mathutils import Quaternion
    for side in ("Left", "Right"):
        real, M, _f, outv, _u = fr[side + "Arm"]
        Mq = M.to_quaternion()
        pb = rig.pose.bones[real]
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = Mq.inverted() @ Quaternion(outv, math.radians(80)) @ Mq
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.update()
    up = tree(body_points())
    bpy.ops.object.mode_set(mode="POSE")
    for pb in rig.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0)
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.update()

    ARM = ("Arm", "Hand", "Shoulder")
    arm_ids = {g.index for g in fig.vertex_groups if any(a in g.name for a in ARM)}
    margin = 0.03 * fH
    # …and BELOW THE ARMPIT, only what lies close round the arm BONE. Loose cloth
    # hanging over the arm passes the lift test too (lifting the arm takes the
    # body away from it as well) and was carried up as a whole panel. A bare
    # forearm is ~2 % of stature from its bone; the cloth beside it is several
    # times that.
    W = rig.matrix_world
    segs = []
    for side in ("Left", "Right"):
        for part in ("Arm", "ForeArm", "Hand"):
            b = rig.data.bones.get(f"mixamorig:{side}{part}")
            if b:
                segs.append((W @ b.head_local, W @ b.tail_local))

    def to_arm_bone(q):
        best = 1e9
        for a, c in segs:
            ab = c - a
            t = max(0.0, min(1.0, (q - a).dot(ab) / max(ab.length_squared, 1e-12)))
            best = min(best, (a + ab * t - q).length)
        return best

    armpit = flo.z + 0.72 * fH
    close = 0.032 * fH
    guarded = 0
    # An A-pose figure has its arms apart from its robe already — that is the
    # whole point of generating it that way — and the guard below was written
    # for arms that hang against the body. On an A-pose priest it stripped the
    # wide cuffs (below the armpit, far from the bone) of half their weight,
    # and lowering the arms shredded the sleeves into slats.
    for v, p in ([] if apose else zip(fig.data.vertices, fv)):
        dL = down.find(p)[2]
        dA = up.find(p)[2]
        if dA > dL + margin and (p.z > armpit or to_arm_bone(p) < close):
            continue                    # arm: the lifted arm left it, and it is on the arm
        gone = [g for g in v.groups if g.group in arm_ids and g.weight > 0]
        if not gone:
            continue
        for g in gone:
            fig.vertex_groups[g.group].remove([v.index])
        rest = [g for g in v.groups if g.weight > 0]
        tot = sum(g.weight for g in rest) or 1
        for g in rest:
            fig.vertex_groups[g.group].add([v.index], g.weight / tot, "REPLACE")
        guarded += 1

    # The body has done its work: the figure is the only mesh that ships.
    bpy.data.objects.remove(body)
    fig.parent = rig
    fig.matrix_parent_inverse = rig.matrix_world.inverted()
    m = fig.modifiers.new("Armature", "ARMATURE"); m.object = rig
    if apose:
        # Rigged while the arms were out; now bring them down to the sides, bake
        # the figure there, and make that the rest pose — so "idle" is a man
        # standing, not a man holding his arms out, and every clip starts there.
        bb["lower_arms"](fig, rig, degrees=38.0)

    for name in opt["clips"].split(","):
        ac.make_clip(rig, name, ac.CLIP_DEFS[name], ac.MIXAMO)
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"; pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)

    bpy.ops.object.select_all(action="DESELECT")
    fig.select_set(True); rig.select_set(True)
    bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True,
                              export_animations=True, export_animation_mode="NLA_TRACKS",
                              export_skins=True, export_yup=True)
    weighted = sum(1 for v in fig.data.vertices if v.groups)
    def census(prefix):
        ids = {g.index for g in fig.vertex_groups if g.name.startswith("mixamorig:" + prefix)}
        return sum(1 for v in fig.data.vertices if sum(g.weight for g in v.groups if g.group in ids) > 0.5)
    arms = {k: census(k) for k in ("LeftArm", "LeftForeArm", "LeftHand", "RightArm", "RightForeArm", "RightHand",
                                    "LeftFoot", "RightFoot")}
    print(f"BODYFIT {OUT}: {'A-pose' if apose else 'arms down'}, figure {fH:.3f} m, body scaled x{s:.3f}, facing turn {best[1]} "
          f"(shoulders along {'X' if only == (0, 2) else 'Y'}; feet say {by_feet}, face says {by_face}), "
          f"{weighted}/{len(fig.data.vertices)} vertices weighted, {guarded} torso vertices kept off the arms, "
          f"clips {opt['clips']}\n  per-part vertices (>50% weight): {arms}")


main()
