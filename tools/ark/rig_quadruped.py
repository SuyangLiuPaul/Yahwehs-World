"""Give a block-style quadruped a skeleton and a set of animations, in Blender.

    Blender -b --python tools/ark/rig_quadruped.py -- in.glb out.glb --kind elephant|giraffe [--render-dir dir]

WHY THIS AND NOT A SERVICE. The generators (Tripo, Meshy, Higgsfield) hand back one
static mesh. Their rigging is either humanoid-only or a paid extra, and either way
returns a skeleton we did not choose. A block animal is easy to rig by hand: the legs
are four pillars, the neck a leaning stack, the trunk a column. So the skeleton is
written here as a few landmark coordinates, the weights fall out of distance to a
bone (inside a bone's radius the weight is 1, and it fades outside), and every
animation is a small function of time. The same script takes my Blender-built animals
today and a generated mesh tomorrow: the landmarks are given in the model's own
proportions (bounding box), so they scale with it.

FACING. The model must face +x, stand on z=0 and be about y-symmetric, as the
generated meshes are after `--forward`. Bones are listed head-to-tail in that frame.

ANIMATIONS (all loop): walk (diagonal gait), idle (breathing, trunk and ears), and one
extra per kind: elephant "trumpet" (trunk up), giraffe "graze" (neck down to the grass).
"""
import bpy, sys, math
from mathutils import Vector, Quaternion

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SRC, DST = argv[0], argv[1]
KIND = argv[argv.index("--kind") + 1]
FPS = 24

# Reference frame of the landmarks below = my Blender-built models: x forward, z up.
# xmin and height let a differently sized model be mapped onto the same skeleton.
REF = {"elephant": dict(xmin=-1.84, h=3.39), "giraffe": dict(xmin=-1.27, h=7.565)}

# name: (parent, head, tail, radius, sigma, weight-bias)  — coordinates in the reference frame
def bones_for(kind):
    if kind == "elephant":
        B = {
            "root":  (None, (0, 0, 0), (0, 0, 0.3), 0, 1, 0),
            "spine": ("root", (-1.5, 0, 2.4), (1.4, 0, 2.4), 0.95, 0.35, 0.5),
            "head":  ("spine", (1.4, 0, 2.4), (2.3, 0, 2.5), 0.80, 0.30, 1.0),
            "trunk1": ("head", (2.38, 0, 2.5), (2.5, 0, 1.75), 0.42, 0.25, 1.4),
            "trunk2": ("trunk1", (2.5, 0, 1.75), (2.62, 0, 1.05), 0.36, 0.25, 1.4),
            "trunk3": ("trunk2", (2.62, 0, 1.05), (2.78, 0, 0.2), 0.34, 0.25, 1.4),
            "ear.L": ("head", (1.85, 0.80, 2.6), (0.75, 1.0, 2.55), 0.80, 0.25, 1.4),
            "ear.R": ("head", (1.85, -0.80, 2.6), (0.75, -1.0, 2.55), 0.80, 0.25, 1.4),
            "tail":  ("spine", (-1.66, 0, 2.5), (-1.76, 0, 1.2), 0.22, 0.2, 1.4),
        }
        for tag, x in (("F", 0.85), ("R", -0.95)):
            for side, y in (("L", 0.52), ("R", -0.52)):
                B[f"leg.{tag}.{side}"] = ("spine", (x, y, 1.2), (x, y, 0.08), 0.46, 0.22, 1.2)
        return B
    B = {
        "root":  (None, (0, 0, 0), (0, 0, 0.3), 0, 1, 0),
        "spine": ("root", (-1.05, 0, 2.7), (1.0, 0, 2.7), 0.72, 0.30, 0.5),
        "neck1": ("spine", (0.83, 0, 3.2), (0.98, 0, 4.1), 0.46, 0.22, 1.2),
        "neck2": ("neck1", (0.98, 0, 4.1), (1.13, 0, 5.0), 0.40, 0.22, 1.2),
        "neck3": ("neck2", (1.13, 0, 5.0), (1.28, 0, 5.9), 0.36, 0.22, 1.2),
        "neck4": ("neck3", (1.28, 0, 5.9), (1.42, 0, 6.75), 0.34, 0.22, 1.2),
        "head":  ("neck4", (1.42, 0, 6.75), (2.3, 0, 6.95), 0.55, 0.20, 1.4),
        "tail":  ("spine", (-1.12, 0, 3.05), (-1.2, 0, 1.6), 0.16, 0.15, 1.4),
    }
    for tag, x in (("F", 0.72), ("R", -0.72)):
        for side, y in (("L", 0.30), ("R", -0.30)):
            B[f"leg.{tag}.{side}"] = ("spine", (x, y, 2.05), (x, y, 0.12), 0.30, 0.20, 1.2)
    return B


def seg_dist(p, a, b):
    ab = b - a
    t = 0.0 if ab.length_squared == 0 else max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
for o in bpy.data.objects:
    if o.type != "MESH":
        o.select_set(False)
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
for o in meshes:
    o.parent = None
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
if len(meshes) > 1:
    bpy.ops.object.join()
mesh = bpy.context.view_layer.objects.active
mesh.name = KIND
for o in list(bpy.data.objects):
    if o is not mesh:
        bpy.data.objects.remove(o)

pts = [v.co.copy() for v in mesh.data.vertices]
xmin = min(p.x for p in pts); ymid = 0.0; zmin = min(p.z for p in pts)
H = max(p.z for p in pts) - zmin
ref = REF[KIND]
S = H / ref["h"]


def A(p):
    return Vector((xmin + (p[0] - ref["xmin"]) * S, ymid + p[1] * S, zmin + p[2] * S))


BONES = bones_for(KIND)

# ── armature ──
arm_data = bpy.data.armatures.new(KIND + "_rig")
arm = bpy.data.objects.new(KIND + "_rig", arm_data)
bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
for name, (parent, head, tail, r, sg, bias) in BONES.items():
    b = arm_data.edit_bones.new(name)
    b.head, b.tail = A(head), A(tail)
    if (b.tail - b.head).length < 1e-4:
        b.tail = b.head + Vector((0, 0, 0.1))
    if parent:
        b.parent = arm_data.edit_bones[parent]
bpy.ops.object.mode_set(mode="OBJECT")

# ── weights: 1 inside a bone's radius, fading with distance outside it ──
for name in BONES:
    if name != "root":
        mesh.vertex_groups.new(name=name)
deform = {n: (A(h), A(t), r * S, sg * S, bias) for n, (_, h, t, r, sg, bias) in BONES.items() if n != "root"}
for v in mesh.data.vertices:
    ws = {}
    for n, (h, t, r, sg, bias) in deform.items():
        d = max(0.0, seg_dist(v.co, h, t) - r)
        w = math.exp(-((d / sg) ** 2)) ** 2 * bias
        if w > 1e-3:
            ws[n] = w
    top = sorted(ws.items(), key=lambda kv: -kv[1])[:4]
    tot = sum(w for _, w in top) or 1.0
    for n, w in top:
        mesh.vertex_groups[n].add([v.index], w / tot, "REPLACE")
mesh.parent = arm
mod = mesh.modifiers.new("rig", "ARMATURE")
mod.object = arm

# ── animation ──
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")
P = arm.pose.bones
for pb in P:
    pb.rotation_mode = "QUATERNION"
AX = {"y": Vector((0, 1, 0)), "z": Vector((0, 0, 1)), "x": Vector((1, 0, 0))}


def rot(name, axis, ang):
    """Rotate a bone by `ang` about a WORLD axis; the pose channel wants it in the bone's own frame."""
    pb = P.get(name)
    if pb is None:
        return
    loc = pb.bone.matrix_local.to_3x3().inverted() @ AX[axis]
    pb.rotation_quaternion = Quaternion(loc.normalized(), ang) @ pb.rotation_quaternion


def reset():
    for pb in P:
        pb.rotation_quaternion = Quaternion((1, 0, 0, 0))
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)


def make(name, frames, fn):
    act = bpy.data.actions.new(name)
    arm.animation_data_create()
    arm.animation_data.action = act
    for f in range(frames + 1):
        reset()
        fn(f / frames * 2 * math.pi, f / frames)
        for pb in P:
            pb.keyframe_insert("rotation_quaternion", frame=f + 1)
            pb.keyframe_insert("location", frame=f + 1)
            pb.keyframe_insert("scale", frame=f + 1)
    for fc in getattr(act, "fcurves", []):
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"
    tr = arm.animation_data.nla_tracks.new()
    tr.name = name
    tr.strips.new(name, 1, act)
    arm.animation_data.action = None


LEG = 0.30 if KIND == "elephant" else 0.30


def walk(ph, t):
    for tag in ("F", "R"):
        for side in ("L", "R"):
            # diagonal pairs move together: front-left with rear-right
            off = 0.0 if (tag == "F") == (side == "L") else math.pi
            rot(f"leg.{tag}.{side}", "y", LEG * math.sin(ph + off))
    P["root"].location.z = 0.03 * S * math.sin(2 * ph)
    rot("spine", "z", 0.03 * math.sin(ph))
    rot("tail", "z", 0.35 * math.sin(ph + 1.0))
    if KIND == "elephant":
        rot("head", "y", 0.05 * math.sin(2 * ph))
        for i, n in enumerate(("trunk1", "trunk2", "trunk3")):
            rot(n, "y", 0.16 * math.sin(ph - 0.7 * i + 0.5))
        rot("ear.L", "z", -0.16 * math.sin(2 * ph)); rot("ear.R", "z", 0.16 * math.sin(2 * ph))
    else:
        for i, n in enumerate(("neck1", "neck2", "neck3", "neck4")):
            rot(n, "y", 0.07 * math.sin(2 * ph - 0.5 * i))
        rot("head", "y", 0.06 * math.sin(2 * ph - 2.0))


def idle(ph, t):
    P["spine"].scale = (1, 1, 1 + 0.012 * math.sin(ph))
    rot("tail", "z", 0.4 * math.sin(ph + 1.0))
    if KIND == "elephant":
        for i, n in enumerate(("trunk1", "trunk2", "trunk3")):
            rot(n, "y", 0.18 * math.sin(ph - 0.9 * i))
        rot("head", "y", 0.05 * math.sin(ph))
        rot("ear.L", "z", -0.22 * math.sin(2 * ph)); rot("ear.R", "z", 0.22 * math.sin(2 * ph))
    else:
        for i, n in enumerate(("neck1", "neck2", "neck3", "neck4")):
            rot(n, "y", 0.05 * math.sin(ph - 0.4 * i))
        rot("head", "y", 0.08 * math.sin(ph - 1.5))


def trumpet(ph, t):
    up = math.sin(min(1.0, t * 1.0) * math.pi) ** 0.7        # 0 -> 1 -> 0 over the loop
    for n in ("trunk1", "trunk2", "trunk3"):
        rot(n, "y", -0.75 * up)
    rot("head", "y", -0.22 * up)
    rot("spine", "y", -0.06 * up)
    rot("ear.L", "z", -0.35 * up); rot("ear.R", "z", 0.35 * up)
    rot("tail", "z", 0.5 * math.sin(4 * ph))


def graze(ph, t):
    down = math.sin(min(1.0, t) * math.pi) ** 0.6
    for n in ("neck1", "neck2", "neck3", "neck4"):
        rot(n, "y", 0.50 * down)
    rot("head", "y", 0.55 * down)
    for tag in ("F",):
        for side in ("L", "R"):
            rot(f"leg.{tag}.{side}", "y", -0.12 * down)
    rot("tail", "z", 0.4 * math.sin(3 * ph))


make("walk", 48, walk)
make("idle", 72, idle)
make("trumpet" if KIND == "elephant" else "graze", 72, trumpet if KIND == "elephant" else graze)
bpy.ops.object.mode_set(mode="OBJECT")
reset()

bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True); mesh.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(filepath=DST, export_format="GLB", use_selection=True, export_apply=False,
                          export_vertex_color="MATERIAL", export_animations=True, export_animation_mode="ACTIONS",
                          export_skins=True, export_cameras=False, export_lights=False)
print("RIGGED", KIND, DST, "bones", len(BONES), "verts", len(mesh.data.vertices), "actions", [a.name for a in bpy.data.actions])
