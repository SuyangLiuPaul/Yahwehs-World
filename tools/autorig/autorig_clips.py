"""The motion library — one definition of "walk" and "pray" for every rig.

A clip here is written in the FIGURE'S terms, not a skeleton's:

    (fwd, turn, out)  degrees

  fwd   swing the bone's tip toward the way the figure faces (legs, arms, spine
        forward; a knee bending is its shin swinging BACK, so negative)
  turn  about the vertical — a head or a spine turning left (+) or right
  out   swing the tip away from the centre line (an arm lifting sideways)

At keying time each of those is turned into an axis from the bone's own rest
direction — `tip x forward`, `vertical`, `tip x outward` — and expressed in
that bone's local frame. So a clip does not depend on how a rig happens to
roll its bones, which is what broke the first auto-rig (arms swung behind the
head, knees bent backwards) and would have broken again on every new skeleton.

Bone names are canonical (this project's own rig, Mixamo-style) and mapped to
each skeleton by the tables below.
"""
import math
import bpy
from mathutils import Vector, Quaternion

CANON = ["Hips", "Spine02", "Spine01", "Spine", "neck", "Head",
         "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand",
         "RightShoulder", "RightArm", "RightForeArm", "RightHand",
         "LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase",
         "RightUpLeg", "RightLeg", "RightFoot", "RightToeBase"]

SELF = {n: n for n in CANON}
MIXAMO = {n: "mixamorig:" + n for n in CANON}
MIXAMO.update({"Spine02": "mixamorig:Spine", "Spine01": "mixamorig:Spine1",
               "Spine": "mixamorig:Spine2", "neck": "mixamorig:Neck"})
CMU = {n: n for n in CANON}
CMU.update({"Spine02": "LowerBack", "Spine01": "Spine", "Spine": "Spine1",
            "neck": "Neck", "Head": "Head"})

FORWARD = Vector((0, -1, 0))     # every figure in this project faces -Y in Blender
UP = Vector((0, 0, 1))


def R(fwd=0, turn=0, out=0):
    return (fwd, turn, out)


CLIP_DEFS = {
    # Standing, breathing. The slowest thing on screen and the one a reader
    # sees most, so it is small: a chest that lifts, a head that settles.
    "idle": dict(length=120, keys=[
        (0,   {"Spine01": R(0), "Spine": R(0), "neck": R(0), "Head": R(0)}),
        (60,  {"Spine01": R(-1.2), "Spine": R(-1.5), "neck": R(1.0), "Head": R(1.2, 1.5)}),
        (120, {"Spine01": R(0), "Spine": R(0), "neck": R(0), "Head": R(0)}),
    ]),
    # A walking pace — about a stride a second. Small, because a robe covers
    # the legs and a long stride tears it.
    "walk": dict(length=32, lift=0.008, keys=[
        (0,  {"LeftUpLeg": R(15), "RightUpLeg": R(-13), "LeftLeg": R(-6), "RightLeg": R(-14),
              "LeftArm": R(-10), "RightArm": R(9), "LeftForeArm": R(6), "RightForeArm": R(9),
              "Spine": R(0, 3), "Hips": R(0, -3)}),
        (8,  {"LeftUpLeg": R(3), "RightUpLeg": R(-2), "LeftLeg": R(-3), "RightLeg": R(-26),
              "LeftArm": R(-2), "RightArm": R(2), "LeftForeArm": R(4), "RightForeArm": R(4),
              "Spine": R(0), "Hips": R(0)}),
        (16, {"LeftUpLeg": R(-13), "RightUpLeg": R(15), "LeftLeg": R(-14), "RightLeg": R(-6),
              "LeftArm": R(9), "RightArm": R(-10), "LeftForeArm": R(9), "RightForeArm": R(6),
              "Spine": R(0, -3), "Hips": R(0, 3)}),
        (24, {"LeftUpLeg": R(-2), "RightUpLeg": R(3), "LeftLeg": R(-26), "RightLeg": R(-3),
              "LeftArm": R(2), "RightArm": R(-2), "LeftForeArm": R(4), "RightForeArm": R(4),
              "Spine": R(0), "Hips": R(0)}),
        (32, {"LeftUpLeg": R(15), "RightUpLeg": R(-13), "LeftLeg": R(-6), "RightLeg": R(-14),
              "LeftArm": R(-10), "RightArm": R(9), "LeftForeArm": R(6), "RightForeArm": R(9),
              "Spine": R(0, 3), "Hips": R(0, -3)}),
    ]),
    # Turning to look — at something on the deck, across the court.
    "look": dict(length=150, keys=[
        (0,   {"neck": R(0), "Head": R(0), "Spine": R(0)}),
        (40,  {"neck": R(0, 22), "Head": R(-3, 18), "Spine": R(0, 6)}),
        (80,  {"neck": R(0, 22), "Head": R(-3, 18), "Spine": R(0, 6)}),
        (115, {"neck": R(0, -16), "Head": R(3, -14), "Spine": R(0, -4)}),
        (150, {"neck": R(0), "Head": R(0), "Spine": R(0)}),
    ]),
    # Hands lifted up — the posture of prayer the text describes again and
    # again (1 Kgs 8:22; Ps 28:2; 1 Tim 2:8), standing, not kneeling. Upper
    # arms forward, forearms raised, the head a little lifted.
    "pray": dict(length=120, keys=[
        (0,   {"LeftArm": R(0), "RightArm": R(0), "LeftForeArm": R(0), "RightForeArm": R(0),
               "Head": R(0), "neck": R(0)}),
        (45,  {"LeftArm": R(38, 0, 8), "RightArm": R(38, 0, 8), "LeftForeArm": R(62),
               "RightForeArm": R(62), "Head": R(-10), "neck": R(-6)}),
        (120, {"LeftArm": R(40, 0, 9), "RightArm": R(40, 0, 9), "LeftForeArm": R(66),
               "RightForeArm": R(66), "Head": R(-12), "neck": R(-7)}),
    ]),
    # Speaking to others: one hand forward and open, a turn of the head.
    "speak": dict(length=120, keys=[
        (0,   {"RightArm": R(18, 0, 4), "RightForeArm": R(38), "Head": R(0), "neck": R(0)}),
        (30,  {"RightArm": R(28, 0, 8), "RightForeArm": R(50), "Head": R(2, 6), "neck": R(0, 4)}),
        (60,  {"RightArm": R(18, 0, 4), "RightForeArm": R(36), "Head": R(-2, -4), "neck": R(0, -3)}),
        (90,  {"RightArm": R(26, 0, 10), "RightForeArm": R(46), "Head": R(1, 3), "neck": R(0, 2)}),
        (120, {"RightArm": R(18, 0, 4), "RightForeArm": R(38), "Head": R(0), "neck": R(0)}),
    ]),
    # Carrying something before him in both arms — a lamb, a vessel, a load.
    "carry": dict(length=60, keys=[
        (0,  {"LeftArm": R(20, 0, 4), "RightArm": R(20, 0, 4), "LeftForeArm": R(70),
              "RightForeArm": R(70), "Spine": R(-3)}),
        (30, {"LeftArm": R(22, 0, 4), "RightArm": R(22, 0, 4), "LeftForeArm": R(72),
              "RightForeArm": R(72), "Spine": R(-4)}),
        (60, {"LeftArm": R(20, 0, 4), "RightArm": R(20, 0, 4), "LeftForeArm": R(70),
              "RightForeArm": R(70), "Spine": R(-3)}),
    ]),
}


def _frames(rig, bmap):
    """For each canonical bone present: its rest orientation and its three axes.

    FORWARD and UP are the RIG'S, carried through its own rotation — not the
    world's. A rig that had been turned to fit a figure put "forward" out of
    its side, and every arm in "pray" swung behind the man's back."""
    W = rig.matrix_world.to_3x3().normalized()
    fwd_axis = (W @ FORWARD).normalized()
    up_axis = (W @ UP).normalized()
    # The figure's LEFT (MakeHuman puts it at +X when facing -Y): up x forward.
    # forward x up is the right, which flipped every "out" in the first try.
    left_axis = up_axis.cross(fwd_axis).normalized()
    out = {}
    for canon, real in bmap.items():
        b = rig.data.bones.get(real)
        if b is None:
            continue
        M = (W @ b.matrix_local.to_3x3()).normalized()
        tip = (M @ Vector((0, 1, 0))).normalized()
        fwd = tip.cross(fwd_axis)
        if fwd.length < 1e-3:
            fwd = left_axis.copy()
        side = 1 if canon.startswith("Left") else -1 if canon.startswith("Right") else 1
        outv = tip.cross(left_axis * side)
        if outv.length < 1e-3:
            outv = fwd_axis.copy()
        out[canon] = (real, M, fwd.normalized(), outv.normalized(), up_axis)
    return out


def make_clip(rig, name, spec, bmap=SELF):
    """Key one clip onto `rig` as its own action on its own NLA track."""
    fr = _frames(rig, bmap)
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    rig.animation_data_create()
    rig.animation_data.action = act
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="POSE")
    used = sorted({b for _, keys in spec["keys"] for b in keys if b in fr})
    for frame, keys in spec["keys"]:
        for canon in used:
            real, M, fwd, outv, up = fr[canon]
            f, t, o = keys.get(canon, (0, 0, 0))
            # The rotation in the figure's frame, then carried into the bone's.
            qw = (Quaternion(fwd, math.radians(f)) @ Quaternion(up, math.radians(t))
                  @ Quaternion(outv, math.radians(o)))
            Mq = M.to_quaternion()
            pb = rig.pose.bones[real]
            pb.rotation_mode = "QUATERNION"
            pb.rotation_quaternion = Mq.inverted() @ qw @ Mq
            pb.keyframe_insert("rotation_quaternion", frame=frame)
        if spec.get("lift") and "Hips" in fr:
            real, M, _, _, up = fr["Hips"]
            n = frame / spec["length"]
            lift = spec["lift"] * abs(math.sin(n * 2 * math.pi))
            # Scale out of the armature's own scale so the lift is in metres.
            s = rig.matrix_world.to_scale().z or 1.0
            pb = rig.pose.bones[real]
            pb.location = M.inverted() @ (up * (lift / s))
            pb.keyframe_insert("location", frame=frame)
    bpy.ops.object.mode_set(mode="OBJECT")
    tr = rig.animation_data.nla_tracks.new()
    tr.name = name
    tr.strips.new(name, 0, act)
    rig.animation_data.action = None
    return act
