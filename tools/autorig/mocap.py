"""Real motion, retargeted: CMU motion capture onto a person's Mixamo rig.

    blender -b --python tools/autorig/mocap.py -- in_rigged.glb out.glb \
        [--clips idle=140_07.bvh:120:720:loop,walk=02_01.bvh:40:170:loop,...] \
        [--bvh-dir tools/autorig/mocap] [--fps 24] [--trim-to DIR]

With no --clips it reads tools/autorig/mocap/clips.txt, one
`name=file:start:end[:loop][:cut][:legs=0.7][:arms=0.8]` per line (see
parse_clips for the flags), and the BVH files beside it. Every clip named
replaces the animation of that name in the GLB; every clip NOT named (pray,
say) is left as person.py keyed it. The output is the input GLB with only its
animations changed — the meshes, skins, textures and material flags are the
same bytes. `--trim-to DIR` also writes a cut-down copy of each BVH (the
T-pose frame and the frames used, at 60 fps) and a clips.txt addressing them,
which is how the files in mocap/ were made from the full takes.

WHY THIS EXISTS. The clips in autorig_clips.py are keyed by hand — five poses
and a curve between them — and a hand-keyed walk looks like one: the weight
never shifts, nothing settles, the arms swing like pendulums. Motion capture
of a real person walking, standing, looking round, has all the small things a
hand cannot key. The CMU Graphics Lab database is free for any use (see
mocap/SOURCES.md) and Bruce Hahne's BVH conversion of it loads straight into
Blender, so this takes a few of its clips and puts them on our figure.

HOW THE RETARGET WORKS, and why it is not a rotation copy. The two skeletons
are different in every way that matters: bone lengths, the number of spine
bones, which way each bone's local axes point, and — the one that breaks a
naive copy — the REST POSE. The BVH's reference is a T-pose (Hahne adds one as
frame 0); our rig's rest has the arms lowered to the sides (basebody.lower_arms)
with the elbows a little bent. Copying local rotations would swing every arm
ninety degrees into the ground. So:

  1. A REFERENCE POSE is built for OUR rig that matches the BVH's T-pose,
     joint by joint, top-down: each bone is first carried by its parent's
     reference rotation, then turned by the SMALLEST rotation that points it
     the way the BVH bone points at frame 0. Smallest, per joint, in order,
     is how a person raises an arm — shoulder out, then elbow straight — so
     the twist that comes with it is the natural one, and the palm faces down
     in the T-pose as a real palm does. Bones where the two skeletons agree
     that "reference" means "standing upright" (hips, spine, neck, head,
     collar bones, toes) are not turned at all: they keep their own rest and
     take only the change.
  2. Then each frame is a WORLD-SPACE DELTA: how far the BVH bone has turned
     from its frame-0 orientation, applied to our bone's reference
     orientation. That makes our bone point exactly where the captured bone
     points at every frame, whatever either skeleton's local axes are. Every
     mapped bone is solved from its own source bone, so nothing accumulates
     down a chain, and the bones that have no counterpart (fingers, the
     eyes) just ride along.
  3. The hips' TRANSLATION is taken vertically only, scaled by hip height —
     a walk is exported in place, the app moves the figure — and then the
     FEET ARE PUT ON THE FLOOR: at each frame the whole figure is lifted or
     lowered so the lowest point of either foot sits where it sits at rest.
     Our legs are not the captured subject's legs, so without this the
     planted foot floats or sinks by the difference.
  4. The clip is turned to FACE -Y (the way every figure in this project
     faces) by the mean facing of the hips across the clip, then LOOPED: the
     end frame is moved (within a quarter second) to the frame most like the
     start, and what mismatch is left is spread across the whole clip, so the
     last frame is the first and there is no pop on repeat.

The output is spliced into the input GLB at the JSON level (only the
`animations` change, plus the buffer bytes they need), because a round trip
through Blender's importer and exporter would re-encode textures and lose
the alpha modes person.py writes by hand.
"""
import bpy, sys, os, math, json, struct
from mathutils import Vector, Matrix, Quaternion

HERE = __file__.rsplit("/", 1)[0]
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if len(argv) < 2:
    raise SystemExit(__doc__)
IN, OUT = argv[0], argv[1]
opt = {"clips": None, "bvh-dir": HERE + "/mocap", "fps": 24, "trim-to": None, "trim-fps": 60,
       "bvh-scale": 0.056444}   # CMU asf units → metres (their FAQ: (1/0.45)*2.54/100)
for i, a in enumerate(argv[2:], 2):
    if a.startswith("--"):
        opt[a[2:]] = argv[i + 1]
FPS = int(opt["fps"])

# ---------------------------------------------------------------------------
# WHICH BONE IS WHICH. target (ours, Mixamo names) ← source (Hahne's CMU BVH).
#   dir:  how our bone is turned to build the reference pose:
#         None ........... not at all: keep our rest, take only the change.
#         "SrcBone" ...... turn our bone to point the way SrcBone points at
#                          frame 0 (a zero-length BVH joint — the hands — names
#                          the child that has length).
#         ("chain", src_end, tgt_end) ... turn so the run from our bone's head
#                          to tgt_end's tail points the way the run from the
#                          source bone's head to src_end's tail does; the bones
#                          after it in the chain just ride along. Used for the
#                          spine, which MakeHuman builds with a kink (Spine1
#                          leans back, Spine2 forward) that the mesh is
#                          weighted for: matching each bone on its own would
#                          straighten the kink and bend the belly.
# The head and neck ARE matched bone by bone. Hahne's T-pose guesses their
# angles (Neck -16°, Neck1 +21°, Head +11°) to look upright, and the real
# frames sit some 24° from that guess — taking the change alone had every
# figure walking with its face to the sky.
MAP = [  # (target, source, dir)
    ("Hips", "Hips", None),
    ("Spine", "LowerBack", ("chain", "Spine1", "Spine2")), ("Spine1", "Spine", None), ("Spine2", "Spine1", None),
    ("Neck", "Neck1", "Neck1"), ("Head", "Head", "Head"),
]
for S in ("Left", "Right"):
    MAP += [
        (f"{S}Shoulder", f"{S}Shoulder", None),
        (f"{S}Arm", f"{S}Arm", f"{S}Arm"), (f"{S}ForeArm", f"{S}ForeArm", f"{S}ForeArm"),
        (f"{S}Hand", f"{S}Hand", f"{S}FingerBase"),
        (f"{S}UpLeg", f"{S}UpLeg", f"{S}UpLeg"), (f"{S}Leg", f"{S}Leg", f"{S}Leg"),
        (f"{S}Foot", f"{S}Foot", f"{S}Foot"), (f"{S}ToeBase", f"{S}ToeBase", None),
    ]
LEGS = {"UpLeg", "Leg", "Foot", "ToeBase"}
ARMS = {"Shoulder", "Arm", "ForeArm", "Hand"}
FORWARD = Vector((0, -1, 0))      # every figure faces -Y in Blender; so does Hahne's T-pose once imported
UP = Vector((0, 0, 1))


def parse_clips(spec):
    """'idle=140_07.bvh:120:720:loop,...' → [(name, file, start, end, flags)]

    Flags after the frame range, any order:
      loop      move the end to the frame most like the start before blending
      cut       do not blend the end into the start at all
      legs=0.7  scale the legs' motion (a robe tears on a full stride)
      arms=0.8  scale the arms' motion"""
    out = []
    for item in spec.replace("\n", ",").split(","):
        item = item.strip()
        if not item or item.startswith("#"):
            continue
        name, rest = item.split("=", 1)
        parts = rest.split(":")
        f, s, e = parts[0], int(parts[1]), int(parts[2])
        # soft: seconds of smoothing each joint gets over time (captured motion
        #   carries every twitch of the performer; a figure in a scene should not)
        # calm: how much of the captured movement is kept, all joints alike —
        #   0.85 keeps the character of the motion and loses its excess
        flags = {"loop": False, "cut": False, "legs": 1.0, "arms": 1.0, "soft": 0.14, "calm": 0.85}
        for p in parts[3:]:
            k, _, v = p.partition("=")
            flags[k] = float(v) if v else True
        out.append((name.strip(), f, s, e, flags))
    return out


def bvh_frame_time(path):
    with open(path, errors="ignore") as fh:
        for line in fh:
            if line.startswith("Frame Time:"):
                return float(line.split(":")[1])
    return 1 / 120


def minrot(a, b):
    """The smallest rotation taking direction a to direction b."""
    a = a.normalized(); b = b.normalized()
    return a.rotation_difference(b)


# ---------------------------------------------------------------------------
# 1. Sample the source: one BVH, world-space, at the output frame rate.
def sample_bvh(path, start, end, loop):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    before = set(bpy.data.objects)
    # frame_start=1: the importer refuses 0. So BVH frame k is scene frame 1+k,
    # and frame 1 is Hahne's T-pose.
    bpy.ops.import_anim.bvh(filepath=path, global_scale=float(opt["bvh-scale"]), frame_start=1,
                            use_fps_scale=False, update_scene_fps=False, update_scene_duration=False)
    src = next(o for o in set(bpy.data.objects) - before if o.type == "ARMATURE")
    ft = bvh_frame_time(path)
    sfps = 1.0 / ft
    sc = bpy.context.scene
    A = src.matrix_world
    names = {s for _, s, _ in MAP} | {d for _, _, d in MAP if isinstance(d, str)} \
        | {d[1] for _, _, d in MAP if isinstance(d, tuple)} | {"LeftToeBase", "RightToeBase"}
    names = [n for n in names if n in src.pose.bones]

    def pose_at(frame):
        sc.frame_set(int(math.floor(frame)), subframe=frame - math.floor(frame))
        R = {n: (A @ src.pose.bones[n].matrix).to_3x3() for n in names}
        P = {n: (A @ src.pose.bones[n].head, A @ src.pose.bones[n].tail) for n in names}
        return R, P

    R0, P0 = pose_at(1)
    # LOOP: within a quarter second either side of the asked end, the frame
    # whose pose is most like the start frame — summed joint angles.
    def dist(Ra, Rb):
        # .angle can come back as 2π-θ (q and -q are the same turn); take the short way
        angs = [Ra[n].to_quaternion().rotation_difference(Rb[n].to_quaternion()).angle
                for n in names if n != "Hips"]
        return sum(min(a, 2 * math.pi - a) for a in angs)
    if loop:
        Rs, _ = pose_at(1 + start)
        w = int(0.25 * sfps)
        cands = {e: dist(Rs, pose_at(1 + e)[0]) for e in range(max(start + w, end - w), end + w + 1)}
        best = min(cands, key=cands.get)
        print(f"  loop: end {end} → {best} (pose {math.degrees(cands[best]):.0f}° from frame {start}, "
              f"asked end was {math.degrees(cands.get(end, cands[best])):.0f}°)")
        end = best
    n = int(round((end - start) / sfps * FPS))
    frames = []
    for i in range(n + 1):
        f = 1 + start + (end - start) * i / n
        R, P = pose_at(f)
        frames.append([R, P["Hips"][0].copy()])
    # FACING: the hips' forward, averaged over the clip, becomes -Y. Frame 0
    # faces -Y by construction (Hahne's T-pose faces +Z, and the importer's
    # Y-up → Z-up turn brings that to -Y), so each frame's facing is the hips'
    # delta from frame 0 applied to -Y.
    fsum = Vector((0, 0, 0))
    for R, _ in frames:
        v = (R["Hips"] @ R0["Hips"].inverted()) @ FORWARD
        v.z = 0
        if v.length > 1e-6:
            fsum += v.normalized()
    yaw = FORWARD.to_2d().angle_signed(fsum.to_2d()) if fsum.length > 1e-6 else 0.0
    Rz = Matrix.Rotation(yaw, 3, UP)
    hip0 = P0["Hips"][0]
    for fr in frames:
        R = fr[0]
        for k in R:
            R[k] = Rz @ R[k]
        fr[1] = Rz @ (fr[1] - hip0)        # relative to the T-pose hips, and turned
    # the source's hip height above its floor, for scaling the bob
    floor_s = min(P0[b][1].z for b in ("LeftToeBase", "RightToeBase", "LeftFoot", "RightFoot") if b in P0)
    ref = {"R": R0, "P": P0, "hip_h": hip0.z - floor_s}
    bpy.data.objects.remove(src, do_unlink=True)
    return ref, frames, end


# ---------------------------------------------------------------------------
# 2. Solve the target.
def solve(rig, ref, frames, flags):
    """→ per frame: {bone: local quaternion}, and the hips' local location."""
    Ai = rig.matrix_world.inverted()
    Ar = Ai.to_3x3()
    bones = rig.data.bones
    pre = "mixamorig:" if "mixamorig:Hips" in bones else ""
    tmap = {}
    for t, s, d in MAP:
        if pre + t in bones and s in ref["R"]:
            tmap[pre + t] = (s, d)
    order = [b.name for b in bones]          # bpy gives them parent-first
    B = {b.name: b.matrix_local.copy() for b in bones}
    parent = {b.name: (b.parent.name if b.parent else None) for b in bones}
    refP = ref["P"]

    def tail_rest(n):
        return B[n] @ Vector((0, bones[n].length, 0))

    # The reference pose (world rotation Q applied to each bone's rest).
    Q = {}
    Rref_t, Rref_s = {}, {}
    for n in order:
        p = parent[n]
        q = Q[p].copy() if p else Quaternion()
        if n in tmap:
            s, d = tmap[n]
            if isinstance(d, tuple):
                _, se, te = d
                d_src = Ar @ (refP[se][1] - refP[s][0])
                d_rest = tail_rest(pre + te) - B[n].translation
            elif d:
                d_src = Ar @ (refP[d][1] - refP[d][0])
                d_rest = B[n].to_3x3() @ Vector((0, 1, 0))
            if d:
                q = minrot(q @ d_rest, d_src) @ q
            Rref_t[n] = q.to_matrix() @ B[n].to_3x3()
            Rref_s[n] = Ar @ ref["R"][s]
        Q[n] = q
    # per-bone constant: source frame → target frame
    C = {n: Rref_s[n].inverted() @ Rref_t[n] for n in Rref_t}
    # how much of the motion each bone takes (legs=0.7 keeps a robe whole)
    gain = {}
    for n in tmap:
        short = n[len(pre):].replace("Left", "").replace("Right", "")
        # Arms are NOT scaled here: this scales toward the capture's reference
        # pose, a T-pose with the arms level, so "less arm" lifted the arms —
        # speak at arms=0.55 held them straight out. Arm damping is done in
        # soften(), toward our own rest with the arms down. The legs' reference
        # hangs straight like our rest, so they are safe to scale here.
        gain[n] = flags["legs"] if short in LEGS else 1.0

    hips = pre + "Hips"
    hip_h_t = B[hips].translation.z          # rest hips above the origin (feet on the ground at rest)
    scale = hip_h_t / ref["hip_h"] if ref["hip_h"] > 0.1 else 1.0

    # Foot points for the floor: ankle, ball, toe tip, and a heel — the point
    # straight below the ankle at rest, fixed to the foot bone so it swings
    # with it. Whichever is lowest each frame is set to its rest height.
    foot_pts = []
    for S in ("Left", "Right"):
        f, t = pre + S + "Foot", pre + S + "ToeBase"
        if f not in B:
            continue
        ankle = B[f].translation
        heel = Vector((ankle.x, ankle.y, 0.0))
        foot_pts.append((f, B[f].inverted() @ heel))
        foot_pts.append((f, Vector((0, bones[f].length, 0))))
        if t in B:
            foot_pts.append((t, Vector((0, bones[t].length, 0))))
    rest_floor = min((B[b] @ v).z for b, v in foot_pts) if foot_pts else 0.0

    out = []
    for R, hp in frames:
        P = {}
        for n in order:
            p = parent[n]
            local_rest = (B[p].inverted() @ B[n]) if p else B[n]
            Pn = (P[p] @ local_rest) if p else local_rest.copy()
            if n in tmap:
                Rw = (Ar @ R[tmap[n][0]]) @ C[n]
                if gain[n] != 1.0:
                    delta = (Rw @ Rref_t[n].inverted()).to_quaternion()
                    Rw = Quaternion().slerp(delta, gain[n]).to_matrix() @ Rref_t[n]
                t = Pn.translation.copy()
                Pn = Rw.to_4x4()
                Pn.translation = t
            if n == hips:
                Pn.translation = B[hips].translation + Vector((0, 0, hp.z * scale))
            P[n] = Pn
        # floor
        if foot_pts:
            low = min((P[b] @ v).z for b, v in foot_pts)
            dz = rest_floor - low
            for n in P:
                P[n].translation = P[n].translation + Vector((0, 0, dz))
        # to local
        loc = {}
        for n in order:
            p = parent[n]
            L = B[n].inverted() @ ((B[p] @ P[p].inverted() @ P[n]) if p else P[n])
            loc[n] = (L.to_quaternion(), L.translation.copy() if n == hips else None)
        out.append(loc)

    # LOOP BLEND: whatever still separates last from first is spread across
    # the clip as a slow drift nobody sees, so the last frame IS the first.
    if not flags["cut"] and len(out) > 2:
        n = len(out) - 1
        first, last = out[0], out[n]
        for i, loc in enumerate(out):
            t = i / n
            for b, (q, tr) in loc.items():
                D = first[b][0] @ last[b][0].inverted()
                q2 = Quaternion().slerp(D, t) @ q
                tr2 = tr + (first[b][1] - last[b][1]) * t if tr is not None else None
                loc[b] = (q2, tr2)
    return soften(out, flags, not flags["cut"])


FPS_SOLVE = 24


def soften(out, flags, wrap):
    """Smooth every joint over time, then scale it back toward rest.

    Both act on LOCAL rotations, where rest is the identity, so "less" means
    "nearer to standing still" for every bone at once and nothing drifts."""
    n = len(out)
    if n < 3:
        return out
    r = max(0, int(round(flags["soft"] * FPS_SOLVE)))
    calm = flags["calm"]
    if r == 0 and calm == 1.0 and flags["arms"] == 1.0:
        return out
    import math
    w = [math.exp(-0.5 * (k / max(r / 2, 1e-6)) ** 2) for k in range(-r, r + 1)] if r else [1.0]
    bones = list(out[0].keys())
    new = [dict(f) for f in out]
    for b in bones:
        short = b.split(":")[-1].replace("Left", "").replace("Right", "")
        k_b = calm * (flags["arms"] if short in ARMS else 1.0)
        qs = [out[i][b][0].copy() for i in range(n)]
        for i in range(1, n):                       # one hemisphere, or the average flips
            if qs[i].dot(qs[i - 1]) < 0:
                qs[i].negate()
        trs = [out[i][b][1] for i in range(n)]
        for i in range(n):
            acc = Quaternion((0, 0, 0, 0)); tacc = None; wsum = 0.0
            for k, wk in zip(range(-r, r + 1), w):
                j = i + k
                j = j % n if wrap else min(max(j, 0), n - 1)
                q = qs[j]
                if q.dot(qs[i]) < 0:
                    q = -q
                acc = Quaternion((acc.w + wk * q.w, acc.x + wk * q.x, acc.y + wk * q.y, acc.z + wk * q.z))
                if trs[j] is not None:
                    tacc = trs[j] * wk if tacc is None else tacc + trs[j] * wk
                wsum += wk
            acc.normalize()
            q = Quaternion().slerp(acc, k_b) if k_b != 1.0 else acc
            tr = None
            if tacc is not None:
                tr = tacc / wsum
            new[i][b] = (q, tr)
    return new


def key_clip(rig, name, poses):
    """One action, one NLA track, the same shape autorig_clips.make_clip makes."""
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    rig.animation_data_create()
    rig.animation_data.action = act
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="POSE")
    for i, loc in enumerate(poses):
        for b, (q, tr) in loc.items():
            pb = rig.pose.bones[b]
            pb.rotation_mode = "QUATERNION"
            pb.rotation_quaternion = q
            pb.keyframe_insert("rotation_quaternion", frame=i)
            if tr is not None:
                pb.location = tr
                pb.keyframe_insert("location", frame=i)
    bpy.ops.object.mode_set(mode="OBJECT")
    tr = rig.animation_data.nla_tracks.new()
    tr.name = name
    tr.strips.new(name, 0, act)
    rig.animation_data.action = None
    return act


# ---------------------------------------------------------------------------
# 3. Splice the new animations into the input GLB, byte for byte otherwise.
def read_glb(path):
    b = open(path, "rb").read()
    assert b[:4] == b"glTF"
    off, j, binary = 12, None, b""
    while off < len(b):
        ln, typ = struct.unpack_from("<II", b, off)
        chunk = b[off + 8: off + 8 + ln]
        if typ == 0x4E4F534A:
            j = json.loads(chunk)
        elif typ == 0x004E4942:
            binary = chunk
        off += 8 + ln
    return j, binary


def write_glb(path, j, binary):
    js = json.dumps(j, separators=(",", ":")).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    binary = bytes(binary) + b"\0" * ((4 - len(binary) % 4) % 4)
    j_chunk = struct.pack("<II", len(js), 0x4E4F534A) + js
    b_chunk = struct.pack("<II", len(binary), 0x004E4942) + binary
    total = 12 + len(j_chunk) + len(b_chunk)
    open(path, "wb").write(b"glTF" + struct.pack("<II", 2, total) + j_chunk + b_chunk)


def splice(in_path, anim_path, out_path, replaced):
    j, binary = read_glb(in_path)
    aj, abin = read_glb(anim_path)
    node_of = {n.get("name"): i for i, n in enumerate(j["nodes"])}
    anims = [a for a in j.get("animations", []) if a["name"] not in replaced]
    binary = bytearray(binary)
    for a in aj.get("animations", []):
        if a["name"] not in replaced:
            continue
        acc_map = {}
        def port(ai):
            if ai in acc_map:
                return acc_map[ai]
            acc = dict(aj["accessors"][ai])
            bv = aj["bufferViews"][acc["bufferView"]]
            s, ln = bv.get("byteOffset", 0), bv["byteLength"]
            binary.extend(b"\0" * ((4 - len(binary) % 4) % 4))
            j["bufferViews"].append({"buffer": 0, "byteOffset": len(binary), "byteLength": ln})
            binary.extend(abin[s: s + ln])
            acc["bufferView"] = len(j["bufferViews"]) - 1
            acc.pop("byteOffset", None)
            j["accessors"].append(acc)
            acc_map[ai] = len(j["accessors"]) - 1
            return acc_map[ai]
        samplers = [{"input": port(sm["input"]), "output": port(sm["output"]),
                     "interpolation": sm.get("interpolation", "LINEAR")} for sm in a["samplers"]]
        channels = []
        for ch in a["channels"]:
            nm = aj["nodes"][ch["target"]["node"]].get("name")
            if nm not in node_of:
                continue
            channels.append({"sampler": ch["sampler"],
                             "target": {"node": node_of[nm], "path": ch["target"]["path"]}})
        anims.append({"name": a["name"], "samplers": samplers, "channels": channels})
    j["animations"] = anims
    # COMPACT: the old clips' accessors and buffer views are now orphans; drop
    # them and repack the binary so the file does not carry dead weight.
    used_acc = set()
    for m in j.get("meshes", []):
        for p in m["primitives"]:
            used_acc.update(p["attributes"].values())
            if "indices" in p:
                used_acc.add(p["indices"])
            for tg in p.get("targets", []):
                used_acc.update(tg.values())
    for s in j.get("skins", []):
        if "inverseBindMatrices" in s:
            used_acc.add(s["inverseBindMatrices"])
    for a in j["animations"]:
        for sm in a["samplers"]:
            used_acc.update((sm["input"], sm["output"]))
    acc_new = {old: i for i, old in enumerate(sorted(used_acc))}
    used_bv = {j["accessors"][a]["bufferView"] for a in used_acc if "bufferView" in j["accessors"][a]}
    used_bv |= {im["bufferView"] for im in j.get("images", []) if "bufferView" in im}
    bv_new, nb = {}, bytearray()
    new_views = []
    for old in sorted(used_bv):
        bv = dict(j["bufferViews"][old])
        s, ln = bv.get("byteOffset", 0), bv["byteLength"]
        nb.extend(b"\0" * ((4 - len(nb) % 4) % 4))
        bv["byteOffset"] = len(nb); bv["buffer"] = 0
        nb.extend(binary[s: s + ln])
        bv_new[old] = len(new_views); new_views.append(bv)
    accs = []
    for old in sorted(used_acc):
        a = dict(j["accessors"][old])
        if "bufferView" in a:
            a["bufferView"] = bv_new[a["bufferView"]]
        accs.append(a)

    def remap_acc(x):
        return acc_new[x]
    for m in j.get("meshes", []):
        for p in m["primitives"]:
            p["attributes"] = {k: remap_acc(v) for k, v in p["attributes"].items()}
            if "indices" in p:
                p["indices"] = remap_acc(p["indices"])
            if "targets" in p:
                p["targets"] = [{k: remap_acc(v) for k, v in tg.items()} for tg in p["targets"]]
    for s in j.get("skins", []):
        if "inverseBindMatrices" in s:
            s["inverseBindMatrices"] = remap_acc(s["inverseBindMatrices"])
    for a in j["animations"]:
        for sm in a["samplers"]:
            sm["input"] = remap_acc(sm["input"]); sm["output"] = remap_acc(sm["output"])
    for im in j.get("images", []):
        if "bufferView" in im:
            im["bufferView"] = bv_new[im["bufferView"]]
    j["accessors"], j["bufferViews"] = accs, new_views
    j["buffers"] = [{"byteLength": len(nb)}]
    write_glb(out_path, j, nb)


# ---------------------------------------------------------------------------
def trim_bvh(src, dst, start, end, stride):
    """A copy of the BVH with only frame 0 (the T-pose) and frames start..end,
    every `stride`th — enough to keep in the repo without the whole take."""
    lines = open(src, errors="ignore").read().splitlines()
    k = next(i for i, l in enumerate(lines) if l.startswith("Frame Time:"))
    ft = float(lines[k].split(":")[1])
    data = lines[k + 1:]
    keep = [data[0]] + data[1 + start: 1 + end + 1: stride]
    head = lines[:k - 1]      # up to and including MOTION
    out = head + [f"Frames: {len(keep)}", f"Frame Time: {ft * stride:.7f}"] + keep
    open(dst, "w").write("\n".join(out) + "\n")
    return len(keep)


def main():
    spec = opt["clips"] or open(opt["bvh-dir"] + "/clips.txt").read()
    clips = parse_clips(spec)
    sampled = []
    for name, f, s, e, flags in clips:
        path = f if os.path.isabs(f) else os.path.join(opt["bvh-dir"], f)
        print(f"CLIP {name}: {os.path.basename(path)} frames {s}-{e} {flags}")
        ref, frames, e2 = sample_bvh(path, s, e, flags["loop"])
        sampled.append((name, path, s, e2, flags, ref, frames))
    if opt["trim-to"]:
        os.makedirs(opt["trim-to"], exist_ok=True)
        rows = []
        for name, path, s, e, flags, _, _ in sampled:
            stride = max(1, int(round(1 / bvh_frame_time(path) / int(opt["trim-fps"]))))
            dst = os.path.join(opt["trim-to"], os.path.basename(path))
            n = trim_bvh(path, dst, s, e, stride)
            # the loop end was already found, so the trimmed clip is `cut`:
            # no second search over a range that is now the whole file
            fl = [k for k in ("cut",) if flags[k]] + [f"{k}={flags[k]}" for k in ("legs", "arms", "soft", "calm") if flags[k] != 1.0]
            rows.append(f"{name}={os.path.basename(path)}:1:{n - 1}" + "".join(":" + x for x in fl))
            print(f"  trimmed {os.path.basename(path)}: {n} frames at 1/{stride} rate → {dst}")
        open(os.path.join(opt["trim-to"], "clips.txt"), "w").write("\n".join(rows) + "\n")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = FPS
    bpy.ops.import_scene.gltf(filepath=IN)
    rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    rig.animation_data_clear()
    for a in list(bpy.data.actions):
        bpy.data.actions.remove(a)
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"; pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
    names = []
    for name, path, s, e, flags, ref, frames in sampled:
        poses = solve(rig, ref, frames, flags)
        key_clip(rig, name, poses)
        names.append(name)
        print(f"  {name}: {len(poses)} frames at {FPS} fps = {(len(poses) - 1) / FPS:.2f} s")
    for pb in rig.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
    tmp = OUT + ".anim.glb"
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    for o in bpy.context.scene.objects:
        if o.type == "MESH" and o.parent == rig:
            o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=tmp, export_format="GLB", use_selection=True,
                              export_animations=True, export_animation_mode="NLA_TRACKS",
                              export_skins=True, export_yup=True, export_image_format="NONE",
                              export_materials="NONE")
    splice(IN, tmp, OUT, set(names))
    os.remove(tmp)
    j, _ = read_glb(OUT)
    print(f"MOCAP {OUT}: animations {[a['name'] for a in j['animations']]}, "
          f"{os.path.getsize(OUT) / 1e6:.2f} MB (input {os.path.getsize(IN) / 1e6:.2f} MB)")


main()
