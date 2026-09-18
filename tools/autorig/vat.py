"""A crowd copy of a figure: Vertex Animation Textures baked from its clips.

    blender -b --python tools/autorig/vat.py -- in-mocap.glb public/models/crowd/man \
        [--clips walk:24,idle:12] [--tris 3000,600] [--atlas 1024] [--drop eyelashes]

Writes, for the prefix given:

    man.json            what is in the files: vertex counts, texture layout,
                        where each clip starts and how many frames it has,
                        the rest-pose bounds, the measured walking speed
    man-atlas.png       one colour+alpha texture for the whole figure
    man-lod0.glb        the decimated mesh (positions, normals, atlas UVs,
                        NO skin) — ~3,000 triangles
    man-lod0-pos.exr    every vertex's position at every frame, half float
    man-lod0-nrm.png    every vertex's normal at every frame, 8 bit
    man-lod1.*          the same again at ~600 triangles

WHY THIS EXISTS. handoff/FIGURES.md needs 600,000 on foot at the exodus and
three thousand added at Pentecost, and "a crowd is one figure placed three
thousand times". Placed how? A skinned figure is 43,000 triangles and a
skeleton of 52 bones that the CPU poses every frame; three thousand of those
is 130 million triangles and three thousand skeleton updates, and a phone will
not draw it. The crowd needs a copy of the figure that costs almost nothing
per person, and this is it: a mesh a tenth the size, and its animation
turned into a TEXTURE — one texel per vertex per frame — so that the GPU can
play the clip for every person in one instanced draw, each at its own moment
in the cycle, with no bones anywhere. src/walk/crowd.ts is the reader.

WHAT IS BAKED, AND WHY NOT MORE. Two clips by default, walk and idle: a crowd
walks or it stands, and the other clips (look, speak, pray, carry) belong to
the few figures near enough to be seen doing them, which stay full skinned
copies (crowd.ts swaps the near ones). Idle is baked at 12 fps and walk at
24, because idle is slow and seven seconds long: sampling it at 24 would
double the texture for a difference nobody can see from fifteen metres.

WHY THE MESH IS REBUILT RATHER THAN EXPORTED. A vertex animation texture is
addressed by vertex index, so the order of vertices in the mesh and in the
texture must be the same to the vertex. Blender's glTF exporter reorders and
splits vertices as it pleases; so this script does not use it for the crowd
mesh. It builds the vertex list itself — one vertex per (Blender vertex, atlas
UV) pair — samples the animation into that list, and writes a minimal GLB
of the same list by hand. Nothing in between can reorder anything.

WHY ONE ATLAS. The figure arrives as ten meshes and eight materials (body,
robe, hair, beard, eyes, ...), some cut out by alpha. Eight materials would
mean eight instanced draws per crowd and eight textures bound; at a distance
none of that detail survives, so every material is baked — colour, then alpha
— into one 1024² atlas over a fresh UV layout, and the crowd mesh has one
material, alpha-tested. The bake is Cycles' EMIT pass with each material's
base-colour input rewired to an emission shader, which copies the texture
(and the robe's tint) exactly, with no lighting in it.

WHY HALF FLOAT FOR POSITIONS. A position is a length in metres between the
feet and the top of the head; half precision has ten bits of mantissa, so at
1–2 m the step is a millimetre. At fifteen metres a millimetre is a fiftieth
of a pixel. Normals go in an ordinary 8-bit PNG (n × 0.5 + 0.5), which is
half the bytes of a half-float texture and more than enough for shading.

THE WALKING SPEED IS MEASURED, NOT GUESSED. mocap.py exports the walk in
place, and a figure moved across the ground at the wrong speed slides on its
feet. So this reads it off the bake: on each frame the vertices touching the
ground are the planted foot, and the distance that foot moves backward
between frames, times the frame rate, is the speed the body would be moving
forward. crowd.ts moves each walker at exactly that (times its stride
variation) so the feet stay planted.
"""
import bpy, sys, os, json, math, struct
import numpy as np
from mathutils import Vector

HERE = __file__.rsplit("/", 1)[0]
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if len(argv) < 2:
    raise SystemExit(__doc__)
IN, PREFIX = argv[0], argv[1]
opt = {"clips": "walk:24,idle:12", "tris": "3000,600", "atlas": "1024", "drop": "eyelashes",
       "src-fps": "24", "margin": "4"}
for i, a in enumerate(argv[2:], 2):
    if a.startswith("--"):
        opt[a[2:]] = argv[i + 1]
SRC_FPS = float(opt["src-fps"])
ATLAS = int(opt["atlas"])
BUDGETS = [int(x) for x in opt["tris"].split(",")]
CLIPS = [(c.split(":")[0], float(c.split(":")[1]) if ":" in c else SRC_FPS) for c in opt["clips"].split(",")]
DROP = [d for d in opt["drop"].split(",") if d]

# How much of the triangle budget each part deserves, relative to its size.
# The hair and beard are thin cards that fall apart if cut too hard, so they
# keep more than their share; the eyes are two pixels at crowd distance. The
# body (what is left of it after cut_hidden: head, hands, feet) is the face,
# and takes its plain share.
WEIGHT = {"high-poly": 0.3, "short": 1.5, "beard": 1.5, "eyebrow": 1.5}


def weight(name):
    for k, w in WEIGHT.items():
        if k in name:
            return w
    return 1.0


def select(*obs):
    """Make `obs` the selection and the first of them active — for real. Object
    operators accept a context override; the edit-mode mesh operators and the
    bake do not, so the selection state is set rather than pretended."""
    for o in bpy.data.objects:
        o.select_set(False)
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]


# ---------------------------------------------------------------------------
# 1. Import, drop what a crowd cannot see, decimate each part to its share.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = int(SRC_FPS)
bpy.ops.import_scene.gltf(filepath=IN)
scene = bpy.context.scene
rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
parts = [o for o in bpy.data.objects if o.type == "MESH" and o.parent == rig]
for o in list(parts):
    if any(d in o.name for d in DROP):
        print(f"  dropped {o.name}")
        parts.remove(o)
        bpy.data.objects.remove(o)

# THE BODY UNDER THE ROBE IS CUT AWAY FIRST. Decimation moves every vertex a
# little, and it moves the body and the robe independently: thinned to a
# tenth, the torso and thighs poke through the cloth in orange patches all
# over the crowd. The robe is ankle-length with sleeves to the wrist, so the
# only skin that shows is what the head, neck, hands and feet bones own; a
# body face is kept only if one of its corners belongs to those.
SHOWN = ("Head", "Neck", "Hand", "Foot", "Toe")


def cut_hidden(o):
    names = {g.index: g.name for g in o.vertex_groups}
    keep_v = set()
    for v in o.data.vertices:
        top = max(v.groups, key=lambda g: g.weight, default=None)
        if top is not None and any(s in names[top.group] for s in SHOWN):
            keep_v.add(v.index)
    drop = [p.index for p in o.data.polygons if not any(i in keep_v for i in p.vertices)]
    if not drop:
        return
    import bmesh
    bm = bmesh.new(); bm.from_mesh(o.data)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.faces[i] for i in drop], context="FACES")
    bm.to_mesh(o.data); bm.free()


for o in parts:
    if o.name == "Human":
        before = len(o.data.polygons)
        cut_hidden(o)
        print(f"  {o.name}: {before} -> {len(o.data.polygons)} tris after cutting what the robe covers")

total_w = sum(len(o.data.polygons) * weight(o.name) for o in parts)
for o in parts:
    n = len(o.data.polygons)
    share = BUDGETS[0] * n * weight(o.name) / total_w
    ratio = min(1.0, share / n)
    if ratio < 1.0:
        m = o.modifiers.new("dec", "DECIMATE")
        m.ratio = ratio
        m.use_collapse_triangulate = True
        select(o)
        # ahead of the armature modifier, so the armature deforms the
        # decimated mesh rather than the decimation working on a pose
        bpy.ops.object.modifier_move_to_index(modifier="dec", index=0)
        bpy.ops.object.modifier_apply(modifier="dec")
    print(f"  {o.name}: {n} -> {len(o.data.polygons)} tris (ratio {ratio:.3f})")

# ---------------------------------------------------------------------------
# 2. One mesh. Join keeps the vertex groups by name, so the armature modifier
#    of the surviving object still drives every part.
body = max(parts, key=lambda o: len(o.data.polygons))
select(body, *[p for p in parts if p is not body])
bpy.ops.object.join()
ob = body
me = ob.data
select(ob)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.quads_convert_to_tris()
bpy.ops.object.mode_set(mode="OBJECT")
print(f"  joined: {len(me.vertices)} verts, {len(me.polygons)} tris, {len(me.materials)} materials")

# ---------------------------------------------------------------------------
# 3. A fresh UV layout for the atlas, and the bake into it.
atlas_uv = me.uv_layers.new(name="atlas")
me.uv_layers.active = atlas_uv
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004,
                         correct_aspect=True, scale_to_bounds=False)
bpy.ops.object.mode_set(mode="OBJECT")
for uv in me.uv_layers:
    uv.active_render = (uv.name == "atlas")

col_img = bpy.data.images.new("atlas_col", ATLAS, ATLAS, alpha=True)
alp_img = bpy.data.images.new("atlas_alp", ATLAS, ATLAS, alpha=True)
alp_img.colorspace_settings.name = "Non-Color"


def source(sock):
    """Where a Principled input gets its value: a socket to link, or a constant."""
    if sock.is_linked:
        return sock.links[0].from_socket, None
    v = sock.default_value
    return None, (tuple(v)[:3] if hasattr(v, "__len__") else (v, v, v))


rewire = []
for mat in me.materials:
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    # The source textures are read through the ORIGINAL UV map. Without an
    # explicit UV Map node they would follow the active-render layer, which is
    # about to be the atlas — and the bake would sample the skin with the
    # atlas's coordinates.
    uvn = nt.nodes.new("ShaderNodeUVMap")
    uvn.uv_map = "UVMap"
    for n in nt.nodes:
        if n.type == "TEX_IMAGE" and not n.inputs["Vector"].is_linked:
            nt.links.new(uvn.outputs["UV"], n.inputs["Vector"])
    emit = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    target = nt.nodes.new("ShaderNodeTexImage")
    target.image = col_img
    nt.nodes.active = target
    rewire.append((nt, bsdf, emit, target))

scene.render.engine = "CYCLES"
scene.cycles.samples = 1
scene.cycles.device = "CPU"
scene.render.bake.margin = int(opt["margin"])
scene.render.bake.use_clear = True
scene.render.bake.use_selected_to_active = False


def bake(which):
    for nt, bsdf, emit, target in rewire:
        for l in list(emit.inputs["Color"].links):
            nt.links.remove(l)
        sock, const = source(bsdf.inputs["Base Color" if which == "col" else "Alpha"])
        if sock is not None:
            nt.links.new(sock, emit.inputs["Color"])
        else:
            emit.inputs["Color"].default_value = (*const, 1.0)
        target.image = col_img if which == "col" else alp_img
    select(ob)
    bpy.ops.object.bake(type="EMIT")


bake("col")
bake("alp")
col = np.empty(ATLAS * ATLAS * 4, dtype=np.float32); col_img.pixels.foreach_get(col)
alp = np.empty(ATLAS * ATLAS * 4, dtype=np.float32); alp_img.pixels.foreach_get(alp)
col = col.reshape(-1, 4); alp = alp.reshape(-1, 4)
# Alpha is the material's alpha where it was baked, and the bake's own
# coverage (col alpha) outside every island, so the margin stays opaque and
# the seams do not show as cut-outs.
col[:, 3] = np.where(col[:, 3] > 0.5, alp[:, 0], 0.0)
atlas_img = bpy.data.images.new("atlas", ATLAS, ATLAS, alpha=True)
atlas_img.pixels.foreach_set(col.reshape(-1))
atlas_img.filepath_raw = PREFIX + "-atlas.png"
atlas_img.file_format = "PNG"
atlas_img.save()
print(f"  atlas {ATLAS}x{ATLAS}: {os.path.getsize(PREFIX + '-atlas.png') / 1e6:.2f} MB")

# ---------------------------------------------------------------------------
# 4. The rest pose. The importer leaves one clip assigned (the last one it
#    read), which would bake the "rest" as a frame of that clip.
ad = rig.animation_data
ad.action = None
for t in ad.nla_tracks:
    t.mute = True
for pb in rig.pose.bones:
    pb.rotation_mode = "QUATERNION"; pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)


def yup(a):
    """Blender's Z-up to glTF's Y-up: (x, y, z) -> (x, z, -y)."""
    return np.stack([a[:, 0], a[:, 2], -a[:, 1]], axis=1)


def evaluated():
    dg = bpy.context.evaluated_depsgraph_get()
    m = ob.evaluated_get(dg).data
    n = len(m.vertices)
    co = np.empty(n * 3, dtype=np.float32); m.vertices.foreach_get("co", co)
    nr = np.empty(n * 3, dtype=np.float32); m.vertex_normals.foreach_get("vector", nr)
    return yup(co.reshape(-1, 3)), yup(nr.reshape(-1, 3))


def set_clip(name):
    act = bpy.data.actions[name]
    ad.action = act
    if hasattr(ad, "action_slot") and getattr(act, "slots", None) and len(act.slots):
        ad.action_slot = act.slots[0]
    return act


def sample(act, fps):
    """The clip's frames at `fps`, as (F, V, 3) positions and normals."""
    f0, f1 = act.frame_range
    n = int(round((f1 - f0) / SRC_FPS * fps)) + 1
    P, N = [], []
    for k in range(n):
        sf = f0 + k / fps * SRC_FPS
        scene.frame_set(int(math.floor(sf)), subframe=sf - math.floor(sf))
        p, nr = evaluated()
        P.append(p); N.append(nr)
    return np.stack(P), np.stack(N)


def unique_vertices(m):
    """One crowd vertex per (Blender vertex, atlas UV) pair, and the triangle list over them.

    Corner normals are not a key: the texture carries a per-vertex normal per
    frame, smooth, which is what a figure at that distance needs."""
    uv = m.uv_layers["atlas"].data
    n_loops = len(m.loops)
    lv = np.empty(n_loops, dtype=np.int32); m.loops.foreach_get("vertex_index", lv)
    luv = np.empty(n_loops * 2, dtype=np.float32); uv.foreach_get("uv", luv)
    luv = luv.reshape(-1, 2)
    key = {}
    vmap, uvs, idx = [], [], np.empty(n_loops, dtype=np.uint32)
    for i in range(n_loops):
        k = (int(lv[i]), round(float(luv[i, 0]), 5), round(float(luv[i, 1]), 5))
        j = key.get(k)
        if j is None:
            j = len(vmap); key[k] = j
            vmap.append(k[0]); uvs.append((k[1], 1.0 - k[2]))   # glTF's V runs down
        idx[i] = j
    return np.array(vmap, dtype=np.int32), np.array(uvs, dtype=np.float32), idx


def write_glb(path, pos, nrm, uv, idx):
    """A GLB of exactly this vertex list, in this order, and nothing else."""
    parts, views, accs = [], [], []

    def blob(arr, target):
        b = arr.tobytes()
        off = sum(len(p) for p in parts)
        parts.append(b + b"\0" * (-len(b) % 4))
        views.append({"buffer": 0, "byteOffset": off, "byteLength": len(b), "target": target})
        return len(views) - 1

    idx_t = np.uint16 if len(pos) <= 65535 else np.uint32
    accs.append({"bufferView": blob(idx.astype(idx_t), 34963), "componentType": 5123 if idx_t is np.uint16 else 5125,
                 "count": int(len(idx)), "type": "SCALAR"})
    accs.append({"bufferView": blob(pos.astype(np.float32), 34962), "componentType": 5126, "count": int(len(pos)),
                 "type": "VEC3", "min": pos.min(0).tolist(), "max": pos.max(0).tolist()})
    accs.append({"bufferView": blob(nrm.astype(np.float32), 34962), "componentType": 5126, "count": int(len(nrm)), "type": "VEC3"})
    accs.append({"bufferView": blob(uv.astype(np.float32), 34962), "componentType": 5126, "count": int(len(uv)), "type": "VEC2"})
    bin_ = b"".join(parts)
    j = {"asset": {"version": "2.0", "generator": "yahwehs-globe tools/autorig/vat.py"},
         "buffers": [{"byteLength": len(bin_)}], "bufferViews": views, "accessors": accs,
         "meshes": [{"name": "crowd", "primitives": [{"attributes": {"POSITION": 1, "NORMAL": 2, "TEXCOORD_0": 3}, "indices": 0}]}],
         "nodes": [{"mesh": 0, "name": "crowd"}], "scenes": [{"nodes": [0]}], "scene": 0}
    js = json.dumps(j, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    total = 12 + 8 + len(js) + 8 + len(bin_)
    with open(path, "wb") as f:
        f.write(b"glTF" + struct.pack("<II", 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
        f.write(struct.pack("<II", len(bin_), 0x004E4942) + bin_)


def save_exr_half(img, path):
    """Half-float EXR through the scene's render settings, then read back to be sure.

    Image.save() writes 32-bit; save_render honours the 16-bit setting but is
    the "save as render" path, which can put a view transform on the pixels.
    The transform is set to Standard here and the file is re-read and compared
    against what was written, so a silent change of the numbers cannot get
    through."""
    s = scene.render.image_settings
    s.file_format = "OPEN_EXR"; s.color_depth = "16"; s.exr_codec = "ZIP"; s.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    img.save_render(path, scene=scene)
    back = bpy.data.images.load(path)
    a = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32); img.pixels.foreach_get(a)
    b = np.empty(a.shape, dtype=np.float32); back.pixels.foreach_get(b)
    err = float(np.abs(a - b).max())
    if err > 2e-3:
        raise SystemExit(f"EXR round trip lost {err:.4f} — the file is not the bake")
    return err


def measure_walk(P, fps, ground):
    """Speed of the planted foot, backward, in m/s — the speed to move the walker forward at."""
    speeds = []
    for k in range(len(P) - 1):
        a, b = P[k], P[k + 1]
        low = (a[:, 1] < ground + 0.03) & (b[:, 1] < ground + 0.03)
        if low.sum() < 8:
            continue
        d = (b[low] - a[low]).mean(0)
        speeds.append(math.hypot(d[0], d[2]) * fps)
    return float(np.median(speeds)) if speeds else 0.0


meta = {"source": os.path.basename(IN), "srcFps": SRC_FPS, "atlas": os.path.basename(PREFIX) + "-atlas.png",
        "facing": [0, 0, 1], "lods": [], "clips": {}}

# ---------------------------------------------------------------------------
# 5. Each LOD: the vertex list, the frames, the textures, the mesh.
for lod, budget in enumerate(BUDGETS):
    if lod > 0:
        m = ob.modifiers.new("dec", "DECIMATE")
        m.ratio = budget / len(me.polygons)
        m.use_collapse_triangulate = True
        select(ob)
        bpy.ops.object.modifier_move_to_index(modifier="dec", index=0)
        bpy.ops.object.modifier_apply(modifier="dec")
    vmap, uvs, idx = unique_vertices(me)
    V = len(vmap)
    ad.action = None
    scene.frame_set(0)
    rest_p, rest_n = evaluated()
    rest_p, rest_n = rest_p[vmap], rest_n[vmap]
    if lod == 0:
        # Stand the REST pose on y = 0, the same way loadFigure does; the
        # clips' own foot placement is relative to it (mocap.py step 3).
        ground = -float(rest_p[:, 1].min())
        meta["height"] = float(rest_p[:, 1].max() - rest_p[:, 1].min())
    rest_p[:, 1] += ground

    frames_p, frames_n, first = [], [], 0
    for name, fps in CLIPS:
        act = set_clip(name)
        P, N = sample(act, fps)
        P = P[:, vmap]; N = N[:, vmap]
        P[:, :, 1] += ground
        if lod == 0:
            c = {"first": first, "frames": int(len(P)), "fps": fps, "duration": (len(P) - 1) / fps,
                 "min": P.min((0, 1)).tolist(), "max": P.max((0, 1)).tolist()}
            if name == "walk":
                c["speed"] = measure_walk(P, fps, 0.0)
            meta["clips"][name] = c
        first += len(P)
        frames_p.append(P); frames_n.append(N)
        ad.action = None
    P = np.concatenate(frames_p); N = np.concatenate(frames_n)
    F = len(P)

    # Texture layout: a row of texels per frame, wrapped at W so a mesh of
    # more than one row still fits a phone's 2048-wide texture.
    W = min(2048, 1 << max(1, (V - 1).bit_length()))
    R = math.ceil(V / W)
    H = R * F
    texels = W * H
    pos = np.zeros((texels, 4), dtype=np.float32); pos[:, 3] = 1.0
    nrm = np.zeros((texels, 4), dtype=np.float32); nrm[:, 3] = 1.0
    for f in range(F):
        base = f * R * W
        pos[base:base + V, :3] = P[f]
        nrm[base:base + V, :3] = N[f] * 0.5 + 0.5
    pos_img = bpy.data.images.new(f"pos{lod}", W, H, alpha=True, float_buffer=True, is_data=True)
    pos_img.pixels.foreach_set(pos.reshape(-1))
    pos_path = f"{PREFIX}-lod{lod}-pos.exr"
    err = save_exr_half(pos_img, pos_path)
    nrm_img = bpy.data.images.new(f"nrm{lod}", W, H, alpha=True)
    nrm_img.colorspace_settings.name = "Non-Color"
    nrm_img.pixels.foreach_set(nrm.reshape(-1))
    nrm_path = f"{PREFIX}-lod{lod}-nrm.png"
    nrm_img.filepath_raw = nrm_path; nrm_img.file_format = "PNG"; nrm_img.save()
    glb_path = f"{PREFIX}-lod{lod}.glb"
    write_glb(glb_path, rest_p, rest_n, uvs, idx)
    meta["lods"].append({"mesh": os.path.basename(glb_path), "pos": os.path.basename(pos_path),
                         "nrm": os.path.basename(nrm_path), "verts": V, "tris": int(len(idx) // 3),
                         "texWidth": W, "texHeight": H, "rowsPerFrame": R, "frames": F,
                         "bounds": {"min": rest_p.min(0).tolist(), "max": rest_p.max(0).tolist()}})
    print(f"  lod{lod}: {len(idx) // 3} tris, {V} verts, {F} frames -> {W}x{H} texels; "
          f"pos {os.path.getsize(pos_path) / 1e6:.2f} MB (round trip err {err:.5f}), "
          f"nrm {os.path.getsize(nrm_path) / 1e6:.2f} MB, mesh {os.path.getsize(glb_path) / 1e3:.0f} KB")

json.dump(meta, open(PREFIX + ".json", "w"), indent=1)
print(f"VAT {PREFIX}: clips {[(n, c['frames'], c['fps']) for n, c in meta['clips'].items()]}, "
      f"height {meta['height']:.3f} m, walk {meta['clips'].get('walk', {}).get('speed', 0):.2f} m/s")
