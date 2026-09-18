"""A photograph's face on the MakeHuman head.

Used from person.py:

    blender -b --python tools/autorig/person.py -- out.glb --preset man \
        --face-photo ref.png [--face-fit 1.0] [--face-feather 0.06]

Or, for the worker half alone (under the venv Python that has mediapipe):

    python tools/autorig/photoface.py --worker job.json

WHY THIS, AND NOT THE OTHER TWO THINGS WE TRIED.

The MakeHuman head is the right head: it has eyes and eyelids, a mouth that
closes, ears, proper topology, finger bones — and its face is painted from a
generic skin, so every man looks like the same game character with a different
beard. The Hunyuan head projected from the photograph (project_photo.py) has
the right FACE and the wrong head: a blobby shell where one photograph's
pixels are dragged across whatever geometry happens to be under them, and in
close-up the eyes and mouth ghost. What is wanted is the photograph's face on
the MakeHuman head, and the two can be married because both have LANDMARKS —
the same 468 points a face detector finds on any face, on the photograph and
on a front render of the head. Point for point, the photograph is warped so
its landmarks land on the head's, and written into the skin texture where the
head's landmarks are in UV space. Nothing is guessed; the correspondence is
measured twice and the warp is exact at every landmark.

HOW. Two halves, in two Pythons, because Blender's Python has neither a face
detector nor OpenCV and the venv that has them has no Blender:

  · IN BLENDER (this file, imported by person.py): an orthographic camera in
    front of the bare head (hair and beard hidden), an Eevee render of it, and
    a per-pixel map of that render to the body's UV coordinates, rasterised
    here from the mesh itself — so a pixel of the render is a known pixel of
    the skin texture. The render, the map and the texture go to a worker.
  · THE WORKER (this same file, run with --worker under the venv Python):
    MediaPipe FaceMesh on the photograph and on the render; the render's
    landmarks looked up in the UV map, which puts the photograph's landmarks in
    texture space; a Delaunay triangulation over them and a piecewise-affine
    warp of the photograph into the texture; the eye openings inpainted first
    (the eyeballs are their own mesh — the lids must not carry an iris); a soft
    mask inside the face oval; and the whole skin texture shifted in Lab so the
    neck, hands and ears are the colour of the photographed face. The finished
    texture goes back to Blender, and everything after — hairline, hair, beard,
    export — runs as before, on top of it.

  · OPTIONALLY (--face-fit), the head's SHAPE is nudged toward the photograph
    first: the same landmarks give ratios (face height to width, nose width,
    jaw width, mouth width, chin height, eye size, brow height), the render's
    ratios are compared with the photograph's, and the difference becomes
    MakeHuman targets — loaded, as every face target is, before the rig is
    fitted, which means the body is built twice (0.2 s each; it is the assets
    that cost). This is a nudge, capped, not a reconstruction: a frontal
    photograph says nothing about the profile.

WHAT IT CANNOT DO. The reference photographs are full-length at 688 x 1024,
which leaves the face about 75 pixels wide; upscaled four times before
detection it is soft, and it stays soft on the head. A head-and-shoulders
reference of the same person would fix that and nothing else here would
change. The photograph's beard and brows are painted on the skin under the
beard and brow cards — which reads as a fuller beard, not a second one. The
sides and back of the head keep the MakeHuman skin (colour-matched): a
frontal photograph has no more to say about them.
"""
import json
import math
import os
import subprocess
import sys
import tempfile

# The Python that has mediapipe, opencv and scipy. Blender's own does not.
WORKER_PY = os.environ.get("PHOTOFACE_PYTHON",
                           "/Users/pliu0036/Documents/CodingProject/hunyuan3d/.venv/bin/python")

# MediaPipe FaceMesh landmark rings, in drawing order. The library ships these
# as unordered edge sets; a polygon needs the order.
FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377,
             152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
LEFT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
RIGHT_EYE = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466]
LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185]
LEFT_BROW = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46]
RIGHT_BROW = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276]
N_MESH = 468            # 468 mesh points; 10 more are the irises, which sit on the eyeball, not the skin


# ─────────────────────────────── in Blender ───────────────────────────────

def _head_frame(body):
    """Where the head is: centre x, centre z and the size of a square that
    holds it with margin, in world units."""
    vs = [body.matrix_world @ v.co for v in body.data.vertices]
    z0 = min(v.z for v in vs); z1 = max(v.z for v in vs); H = z1 - z0
    head = [v for v in vs if v.z > z0 + 0.86 * H]
    x0, x1 = min(v.x for v in head), max(v.x for v in head)
    hz0 = min(v.z for v in head)
    # 0.86 of stature is about the chin; the frame reaches a little below it
    # so the jaw's landmarks are not on the edge of the picture
    return (x0 + x1) / 2, (hz0 + z1) / 2 - 0.03 * (z1 - hz0), 1.5 * (z1 - hz0)


def render_front(body, out_png, hide=(), size=1024):
    """An orthographic front view of the head — the figure faces -Y, so the
    camera stands on -Y looking along +Y — lit flat, on a plain grey ground, in
    Eevee. Returns the camera frame (cx, cz, scale) the raster below uses."""
    import bpy
    cx, cz, scale = _head_frame(body)
    sc = bpy.context.scene
    cam_d = bpy.data.cameras.new("photoface_cam"); cam_d.type = "ORTHO"; cam_d.ortho_scale = scale
    cam = bpy.data.objects.new("photoface_cam", cam_d); bpy.context.collection.objects.link(cam)
    cam.location = (cx, -2.0, cz); cam.rotation_euler = (math.pi / 2, 0, 0)
    sun_d = bpy.data.lights.new("photoface_sun", "SUN"); sun_d.energy = 3.0
    sun = bpy.data.objects.new("photoface_sun", sun_d); bpy.context.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(55), 0, math.radians(15))
    world = bpy.data.worlds.new("photoface_world"); world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.55, 0.55, 0.55, 1); bg.inputs[1].default_value = 1.0
    keep = dict(camera=sc.camera, world=sc.world, engine=sc.render.engine,
                res=(sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage),
                path=sc.render.filepath, vt=sc.view_settings.view_transform)
    hidden = [(o, o.hide_render) for o in hide if o is not None]
    for o, _ in hidden:
        o.hide_render = True
    try:
        sc.camera = cam; sc.world = world; sc.render.engine = "BLENDER_EEVEE"
        sc.render.resolution_x = sc.render.resolution_y = size; sc.render.resolution_percentage = 100
        sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGB"
        sc.view_settings.view_transform = "Standard"
        sc.render.filepath = out_png
        bpy.ops.render.render(write_still=True)
    finally:
        for o, was in hidden:
            o.hide_render = was
        sc.camera = keep["camera"]; sc.world = keep["world"]; sc.render.engine = keep["engine"]
        sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = keep["res"]
        sc.render.filepath = keep["path"]; sc.view_settings.view_transform = keep["vt"]
        for o in (cam, sun):
            bpy.data.objects.remove(o)
    return cx, cz, scale


def raster_uv(body, cx, cz, scale, size=1024):
    """The render's pixels as UV coordinates: every head triangle projected
    with the same orthographic camera and rasterised with a depth test, each
    pixel taking the UV interpolated across the triangle in front. -1 where
    there is no head. Done here, from the mesh, rather than with a render pass,
    because then the map is exact to the pixel and needs no engine."""
    import numpy as np
    me = body.data
    M = body.matrix_world
    V = np.array([tuple(M @ v.co) for v in me.vertices], dtype=np.float64)
    zmin, zmax = V[:, 2].min(), V[:, 2].max()
    zlim = zmin + 0.80 * (zmax - zmin)
    uvl = me.uv_layers.active.data
    px = (V[:, 0] - cx) / scale * size + size / 2       # column
    py = size / 2 - (V[:, 2] - cz) / scale * size       # row, 0 at the top
    depth = V[:, 1]                                     # the camera is on -Y: smaller is nearer
    out = np.full((size, size, 2), -1.0, dtype=np.float32)
    zb = np.full((size, size), np.inf, dtype=np.float64)
    tris = 0
    for poly in me.polygons:
        vids = [me.loops[li].vertex_index for li in poly.loop_indices]
        if V[vids, 2].max() < zlim:
            continue
        uvs = [tuple(uvl[li].uv) for li in poly.loop_indices]
        for t in range(1, len(vids) - 1):
            ids = [vids[0], vids[t], vids[t + 1]]
            xs, ys, ds = px[ids], py[ids], depth[ids]
            x0, x1 = int(max(0, math.floor(xs.min()))), int(min(size - 1, math.ceil(xs.max())))
            y0, y1 = int(max(0, math.floor(ys.min()))), int(min(size - 1, math.ceil(ys.max())))
            if x1 < x0 or y1 < y0:
                continue
            X, Y = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
            d = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
            if abs(d) < 1e-12:
                continue
            l0 = ((ys[1] - ys[2]) * (X - xs[2]) + (xs[2] - xs[1]) * (Y - ys[2])) / d
            l1 = ((ys[2] - ys[0]) * (X - xs[2]) + (xs[0] - xs[2]) * (Y - ys[2])) / d
            l2 = 1 - l0 - l1
            inside = (l0 >= -1e-6) & (l1 >= -1e-6) & (l2 >= -1e-6)
            if not inside.any():
                continue
            dep = l0 * ds[0] + l1 * ds[1] + l2 * ds[2]
            sub = zb[y0:y1 + 1, x0:x1 + 1]
            win = inside & (dep < sub)
            if not win.any():
                continue
            sub[win] = dep[win]
            u = l0 * uvs[0][0] + l1 * uvs[1][0] + l2 * uvs[2][0]
            v = l0 * uvs[0][1] + l1 * uvs[1][1] + l2 * uvs[2][1]
            o = out[y0:y1 + 1, x0:x1 + 1]
            o[..., 0][win] = u[win]; o[..., 1][win] = v[win]
            tris += 1
    return out, tris


def _skin_image(body):
    return next((n.image for m in body.data.materials if m and m.use_nodes
                 for n in m.node_tree.nodes if n.type == "TEX_IMAGE" and n.image), None)


def _run_worker(job):
    """The other half, in the other Python. Its answer is the last line of
    stdout that starts with PHOTOFACE-JSON; everything else it prints is
    mediapipe's chatter."""
    jd = tempfile.mkdtemp(prefix="photoface-")
    jp = os.path.join(jd, "job.json")
    job["work_dir"] = jd
    with open(jp, "w") as f:
        json.dump(job, f)
    if not os.path.exists(WORKER_PY):
        raise SystemExit(f"photoface: no worker Python at {WORKER_PY} (set PHOTOFACE_PYTHON)")
    r = subprocess.run([WORKER_PY, os.path.abspath(__file__), "--worker", jp],
                       capture_output=True, text=True)
    ans = [ln for ln in r.stdout.splitlines() if ln.startswith("PHOTOFACE-JSON ")]
    if r.returncode != 0 or not ans:
        tail = "\n".join((r.stderr or "").splitlines()[-25:])
        raise SystemExit(f"photoface worker failed (rc {r.returncode}):\n{tail}")
    return json.loads(ans[-1][len("PHOTOFACE-JSON "):])


def _prepare(body, photo, hide, work_dir, size=1024):
    import numpy as np
    os.makedirs(work_dir, exist_ok=True)
    render = os.path.join(work_dir, "render.png")
    cx, cz, scale = render_front(body, render, hide=hide, size=size)
    uvmap, tris = raster_uv(body, cx, cz, scale, size=size)
    uvp = os.path.join(work_dir, "uvmap.npy")
    np.save(uvp, uvmap)
    return dict(photo=os.path.abspath(photo), render=render, uvmap=uvp, tris=tris, size=size)


def _add_target(face, name, w):
    """Add weight to a face target, cancelling against its opposite first: a
    chin already 0.4 taller that now wants 0.1 shorter is 0.3 taller, not
    both loaded at once pulling against each other."""
    opp = None
    for incr, decr in RATIO_TARGETS.values():
        if name in incr:
            opp = decr[incr.index(name)]
        elif name in decr:
            opp = incr[decr.index(name)]
    if opp and face.get(opp, 0) > 0:
        take = min(face[opp], w)
        face[opp] -= take; w -= take
        if face[opp] <= 1e-6:
            del face[opp]
    if w > 1e-6:
        face[name] = min(1.0, face.get(name, 0.0) + w)


def fit_shape(rebuild, photo, face, strength=1.0, passes=2, work_dir=None):
    """Face targets that move the head's proportions toward the photograph's.

    `rebuild(face)` makes a fresh body with those targets and its skin on;
    the head is rendered and measured, the difference becomes targets, and
    the body is made again. TWICE, because the targets are coupled — a
    taller chin lengthens the whole face, and the first pass, alone,
    overshot face height by as much as it had been short — so the second
    pass, at a lower gain, takes back what the first overdid. Returns the
    face dict with the nudges folded in."""
    face = dict(face)
    work_dir = work_dir or tempfile.mkdtemp(prefix="photoface-fit-")
    for p in range(passes):
        body = rebuild(face)
        job = _prepare(body, photo, (), os.path.join(work_dir, f"pass{p}"))
        job.update(mode="measure", strength=float(strength) * (1.0 if p == 0 else 0.6))
        res = _run_worker(job)
        for k, v in res["targets"].items():
            _add_target(face, k, v)
        gap = {k: round(res["render"][k] - res["photo"][k], 3) for k in res["photo"]}
        print(f"PHOTOFACE fit pass {p + 1}: head minus photo {gap}\n"
              f"              nudges {res['targets']}")
    print(f"PHOTOFACE fit: face targets now {face}")
    return face


def apply(body, photo, hide=(), feather=0.06, sharpen=0.6, work_dir=None, debug_png=None):
    """Write the photograph's face into the body's skin texture. Returns the
    worker's report (landmark counts, colour shift, mask area)."""
    import bpy
    img = _skin_image(body)
    if img is None:
        raise SystemExit("photoface: the body has no image texture to paint into")
    work_dir = work_dir or tempfile.mkdtemp(prefix="photoface-apply-")
    # The texture as it is NOW, not as it is on disk: a caller may have
    # painted on it already, and the worker must build on that.
    skin_in = os.path.join(work_dir, "skin_in.png")
    save = bpy.data.images.new("photoface_skin_copy", img.size[0], img.size[1], alpha=False)
    import numpy as np
    px = np.empty(len(img.pixels), dtype=np.float32); img.pixels.foreach_get(px)
    save.pixels.foreach_set(px); save.filepath_raw = skin_in; save.file_format = "PNG"; save.save()
    bpy.data.images.remove(save)
    job = _prepare(body, photo, hide, work_dir)
    job.update(mode="warp", skin_in=skin_in, skin_out=os.path.join(work_dir, "skin_out.png"),
               feather=float(feather), sharpen=float(sharpen), debug_png=debug_png)
    res = _run_worker(job)
    # Put the finished texture where the material already looks: same image
    # datablock, new pixels, so nothing downstream has to be re-wired.
    new = bpy.data.images.load(job["skin_out"], check_existing=False)
    if tuple(new.size) != tuple(img.size):
        raise SystemExit(f"photoface: worker returned {tuple(new.size)}, texture is {tuple(img.size)}")
    px = np.empty(len(new.pixels), dtype=np.float32); new.pixels.foreach_get(px)
    img.pixels.foreach_set(px); img.update()
    bpy.data.images.remove(new)
    print(f"PHOTOFACE {os.path.basename(photo)}: {res['photo_landmarks']} photo / {res['render_landmarks']} render "
          f"landmarks, {res['used']} in the warp, face {res['face_px']} px wide in the photo, "
          f"mask {res['mask_area']:,} texture px, skin shifted Lab {res['lab_shift']}, "
          f"raster {job['tris']} triangles")
    # How far the head is from the photograph, ratio by ratio, AFTER any fit —
    # the check that a nudge went the right way.
    gap = {k: round(res['head_ratios'][k] - res['face_ratios'][k], 3) for k in res['face_ratios']}
    print(f"PHOTOFACE head minus photo, by ratio: {gap}")
    return res


# ─────────────────────────────── the worker ───────────────────────────────

def _detect(fm, rgb):
    import numpy as np
    res = fm.process(np.ascontiguousarray(rgb))
    if not res.multi_face_landmarks:
        return None
    h, w = rgb.shape[:2]
    return np.array([(p.x * w, p.y * h) for p in res.multi_face_landmarks[0].landmark], dtype=np.float64)


def _find_face(fm, rgb):
    """The face in a full-length photograph, at working resolution. A 75-pixel
    face is below what the detector likes, so: find it coarsely (on the whole
    picture, else on the upper middle where a standing figure's head is,
    enlarged), then crop round it with margin and enlarge that crop to a face
    ~600 px wide, and detect again there. Returns (crop_rgb, landmarks, face_w)."""
    import cv2, numpy as np
    h, w = rgb.shape[:2]
    lm = _detect(fm, rgb)
    ox = oy = 0; k = 1.0
    if lm is None:
        ox, oy, k = int(w * 0.2), 0, 4.0
        sub = rgb[: int(h * 0.30), ox: int(w * 0.8)]
        sub = cv2.resize(sub, None, fx=k, fy=k, interpolation=cv2.INTER_LANCZOS4)
        lm = _detect(fm, sub)
        if lm is None:
            raise SystemExit("photoface: no face found in the photograph")
    lm = lm / k + (ox, oy)
    x0, y0 = lm.min(0); x1, y1 = lm.max(0)
    fw = x1 - x0
    m = 0.6 * fw
    cx0, cy0 = int(max(0, x0 - m)), int(max(0, y0 - m))
    cx1, cy1 = int(min(w, x1 + m)), int(min(h, y1 + m))
    crop = rgb[cy0:cy1, cx0:cx1]
    k = max(1.0, 600.0 / fw)
    crop = cv2.resize(crop, None, fx=k, fy=k, interpolation=cv2.INTER_LANCZOS4)
    lm2 = _detect(fm, crop)
    if lm2 is None:
        lm2 = (lm - (cx0, cy0)) * k
    return crop, lm2, fw


def _poly_mask(shape, pts, dilate=0):
    import cv2, numpy as np
    m = np.zeros(shape[:2], np.uint8)
    cv2.fillPoly(m, [np.round(pts).astype(np.int32)], 255)
    if dilate > 0:
        m = cv2.dilate(m, np.ones((2 * dilate + 1, 2 * dilate + 1), np.uint8))
    return m


def _ratios(L):
    """Proportions of a face from its landmarks, each a ratio so that scale
    and resolution drop out. Widths are relative to the cheek width (234-454);
    heights to the face height (10-152); the eyes and nose to the distance
    between the outer eye corners (33-263)."""
    import numpy as np
    d = lambda a, b: float(np.linalg.norm(L[a] - L[b]))
    cheek = d(234, 454); face_h = d(10, 152); eye = d(33, 263)
    nose_l = np.mean([L[i] for i in (48, 64, 98, 129)], 0); nose_r = np.mean([L[i] for i in (278, 294, 327, 358)], 0)
    jaw = float(np.linalg.norm(np.mean([L[i] for i in (172, 136, 150)], 0) - np.mean([L[i] for i in (397, 365, 379)], 0)))
    brow = float(np.mean([np.linalg.norm(L[a] - L[b]) for a, b in ((105, 159), (334, 386))]))
    return {
        "face_h": face_h / cheek,                    # long face vs broad face
        "cheek_w": cheek / eye,                      # cheekbones wide for the eyes
        "jaw_w": jaw / cheek,                        # square jaw vs tapering
        "chin_w": d(148, 377) / cheek,
        "nose_w": float(np.linalg.norm(nose_l - nose_r)) / eye,
        "nose_h": d(168, 2) / face_h,
        "mouth_w": d(61, 291) / cheek,
        "chin_h": d(17, 152) / face_h,
        "eye_w": (d(33, 133) + d(263, 362)) / 2 / eye,
        "brow_h": brow / eye,                        # brows high above the eyes
    }


# Which MakeHuman target answers each ratio, when the photograph's is larger
# (incr) or smaller (decr). Gain: a 10 % difference is a target weight of 0.3.
RATIO_TARGETS = {
    "face_h": (["head-scale-vert-incr"], ["head-scale-vert-decr"]),
    "cheek_w": (["l-cheek-bones-incr", "r-cheek-bones-incr"], ["l-cheek-bones-decr", "r-cheek-bones-decr"]),
    "jaw_w": (["head-square"], ["head-oval"]),
    "chin_w": (["chin-width-incr"], ["chin-width-decr"]),
    "nose_w": (["nose-scale-horiz-incr"], ["nose-scale-horiz-decr"]),
    "nose_h": (["nose-scale-vert-incr"], ["nose-scale-vert-decr"]),
    "mouth_w": (["mouth-scale-horiz-incr"], ["mouth-scale-horiz-decr"]),
    "chin_h": (["chin-height-incr"], ["chin-height-decr"]),
    "eye_w": (["l-eye-scale-incr", "r-eye-scale-incr"], ["l-eye-scale-decr", "r-eye-scale-decr"]),
    "brow_h": (["eyebrows-trans-up"], ["eyebrows-trans-down"]),
}
GAIN, CAP = 2.5, 0.6


def _targets(photo_r, render_r, strength):
    out = {}
    for k, (incr, decr) in RATIO_TARGETS.items():
        delta = (photo_r[k] - render_r[k]) / render_r[k]
        w = max(-CAP, min(CAP, GAIN * delta)) * strength
        if abs(w) < 0.03:
            continue
        for t in (incr if w > 0 else decr):
            out[t] = round(abs(w), 3)
    return out


def worker(job):
    import cv2, numpy as np
    import mediapipe as mp
    fm = mp.solutions.face_mesh.FaceMesh(static_image_mode=True, max_num_faces=1,
                                         refine_landmarks=True, min_detection_confidence=0.2)
    photo = cv2.cvtColor(cv2.imread(job["photo"]), cv2.COLOR_BGR2RGB)
    P, LP, face_px = _find_face(fm, photo)
    R = cv2.cvtColor(cv2.imread(job["render"]), cv2.COLOR_BGR2RGB)
    LR = _detect(fm, R)
    if LR is None:
        raise SystemExit("photoface: no face found in the head render")

    if job["mode"] == "measure":
        pr, rr = _ratios(LP), _ratios(LR)
        return dict(photo={k: round(v, 3) for k, v in pr.items()}, render={k: round(v, 3) for k, v in rr.items()},
                    targets=_targets(pr, rr, job["strength"]))

    # ── render landmarks → texture pixels, through the UV map ──
    U = np.load(job["uvmap"])                       # (size, size, 2), -1 where no head
    tex = cv2.cvtColor(cv2.imread(job["skin_in"]), cv2.COLOR_BGR2RGB).astype(np.float32)
    TH, TW = tex.shape[:2]
    S = U.shape[0]

    def uv_at(p):
        x, y = int(round(p[0])), int(round(p[1]))
        win = U[max(0, y - 1): y + 2, max(0, x - 1): x + 2].reshape(-1, 2)
        ok = win[:, 0] >= 0
        if not ok.any():
            return None
        u, v = win[ok].mean(0)
        return np.array([u * TW, (1 - v) * TH])      # image rows run top-down; Blender's V runs bottom-up

    # Ring points beyond the oval, so the warp is defined out to the mask's
    # feathered edge — in both pictures, the oval pushed out from its centre.
    def ring(L, k=1.30):
        c = L[FACE_OVAL].mean(0)
        return c + k * (L[FACE_OVAL] - c)

    src, dst, used = [], [], 0
    for i in range(N_MESH):
        t = uv_at(LR[i])
        if t is not None:
            src.append(LP[i]); dst.append(t); used += 1
    for rp, pp in zip(ring(LR), ring(LP)):
        t = uv_at(rp)
        if t is not None:
            src.append(pp); dst.append(t)
    src, dst = np.array(src), np.array(dst)

    # ── the photograph, prepared: eye openings inpainted, a little sharpened ──
    Pw = P.copy()
    ew = int(0.02 * (LP[FACE_OVAL][:, 0].max() - LP[FACE_OVAL][:, 0].min()))
    eyes = _poly_mask(P.shape, LP[LEFT_EYE], ew) | _poly_mask(P.shape, LP[RIGHT_EYE], ew)
    Pw = cv2.inpaint(Pw, eyes, 3 * ew + 3, cv2.INPAINT_TELEA)
    if job.get("sharpen", 0) > 0:
        blur = cv2.GaussianBlur(Pw, (0, 0), 2.0)
        Pw = np.clip(Pw.astype(np.float32) + job["sharpen"] * (Pw.astype(np.float32) - blur), 0, 255).astype(np.uint8)

    # ── piecewise-affine warp: for every texture pixel in the face, which
    #    triangle it is in, and its barycentric position in that triangle
    #    carried over to the photograph ──
    from scipy.spatial import Delaunay
    tri = Delaunay(dst)
    x0, y0 = np.floor(dst.min(0)).astype(int); x1, y1 = np.ceil(dst.max(0)).astype(int)
    x0, y0 = max(0, x0), max(0, y0); x1, y1 = min(TW - 1, x1), min(TH - 1, y1)
    X, Y = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
    pts = np.stack([X.ravel(), Y.ravel()], 1).astype(np.float64)
    simp = tri.find_simplex(pts)
    inside = simp >= 0
    T = tri.transform[simp[inside]]                     # (n, 3, 2): affine to barycentric
    b = np.einsum("nij,nj->ni", T[:, :2], pts[inside] - T[:, 2])
    bary = np.column_stack([b, 1 - b.sum(1)])
    verts = tri.simplices[simp[inside]]                 # (n, 3) indices into src/dst
    ppos = np.einsum("ni,nij->nj", bary, src[verts])     # photograph coordinates
    map_x = np.full(X.shape, -1, np.float32); map_y = np.full(X.shape, -1, np.float32)
    map_x.ravel()[inside] = ppos[:, 0]; map_y.ravel()[inside] = ppos[:, 1]
    warped = cv2.remap(Pw, map_x, map_y, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE).astype(np.float32)

    # ── the mask: inside the face oval in texture space, pulled in and
    #    feathered so the fade lies wholly on the face, never on hair or ground ──
    oval_pts = []
    for i in FACE_OVAL:
        t = uv_at(LR[i])
        if t is not None:
            oval_pts.append(t)
    oval_pts = np.array(oval_pts)
    fw_t = oval_pts[:, 0].max() - oval_pts[:, 0].min()
    fh_t = oval_pts[:, 1].max() - oval_pts[:, 1].min()
    fe = max(3, int(job["feather"] * max(fw_t, fh_t)))
    m = _poly_mask((TH, TW), oval_pts).astype(np.float32) / 255.0
    m = cv2.erode(m, np.ones((fe + 1, fe + 1), np.uint8))
    m = cv2.GaussianBlur(m, (0, 0), fe / 2.0)
    sub = m[y0:y1 + 1, x0:x1 + 1]
    sub[~inside.reshape(X.shape)] = 0
    m[y0:y1 + 1, x0:x1 + 1] = sub

    # ── colour: the whole skin shifted in Lab so that where it will meet the
    #    photograph it already is the photograph's colour ──
    lab_p = cv2.cvtColor(Pw, cv2.COLOR_RGB2LAB).astype(np.float32)
    # skin sample in the photograph: forehead, nose and upper cheeks — above
    # the nose base (beards live below it), clear of the eyes and brows
    ov = _poly_mask(P.shape, LP[FACE_OVAL]).astype(bool)
    er = int(0.10 * (LP[FACE_OVAL][:, 0].max() - LP[FACE_OVAL][:, 0].min()))
    ov = cv2.erode(ov.astype(np.uint8), np.ones((2 * er + 1, 2 * er + 1), np.uint8)).astype(bool)
    excl = (_poly_mask(P.shape, LP[LEFT_EYE], 3 * ew) | _poly_mask(P.shape, LP[RIGHT_EYE], 3 * ew)
            | _poly_mask(P.shape, LP[LEFT_BROW], 2 * ew) | _poly_mask(P.shape, LP[RIGHT_BROW], 2 * ew)).astype(bool)
    rows = np.arange(P.shape[0])[:, None]
    sample_p = ov & ~excl & (rows < LP[2][1])
    if sample_p.sum() < 50:
        sample_p = ov & ~excl
    med_p = np.median(lab_p[sample_p], 0)
    # the same places on the texture, through the map
    samp_t = cv2.remap(sample_p.astype(np.uint8) * 255, map_x, map_y, cv2.INTER_NEAREST, borderValue=0) > 127
    sel_t = samp_t & (sub > 0.5)
    lab_t = cv2.cvtColor(np.clip(tex, 0, 255).astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32)
    med_t = np.median(lab_t[y0:y1 + 1, x0:x1 + 1][sel_t], 0) if sel_t.sum() > 50 else np.median(lab_t[m > 0.5], 0)
    shift = med_p - med_t
    lab_t += shift
    lab_t[..., 0] = np.clip(lab_t[..., 0], 0, 255); lab_t[..., 1:] = np.clip(lab_t[..., 1:], 0, 255)
    tex2 = cv2.cvtColor(lab_t.astype(np.uint8), cv2.COLOR_LAB2RGB).astype(np.float32)

    # ── composite ──
    out = tex2.copy()
    reg = out[y0:y1 + 1, x0:x1 + 1]
    a = sub[..., None]
    reg[:] = reg * (1 - a) + warped * a
    cv2.imwrite(job["skin_out"], cv2.cvtColor(np.clip(out, 0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR))

    if job.get("debug_png"):
        def dots(img, L, col):
            v = img.copy()
            for x, y in L[:N_MESH]:
                cv2.circle(v, (int(x), int(y)), 2, col, -1)
            return v
        def fit(img, h=512):
            k = h / img.shape[0]
            return cv2.resize(img, (int(img.shape[1] * k), h), interpolation=cv2.INTER_AREA)
        pad = 40
        cx0, cy0 = max(0, x0 - pad), max(0, y0 - pad); cx1, cy1 = min(TW, x1 + pad), min(TH, y1 + pad)
        before = tex[cy0:cy1, cx0:cx1].astype(np.uint8); after = out[cy0:cy1, cx0:cx1].astype(np.uint8)
        mk = (np.dstack([m[cy0:cy1, cx0:cx1]] * 3) * 255).astype(np.uint8)
        sheet = cv2.hconcat([fit(dots(P, LP, (0, 255, 0))), fit(dots(R, LR, (0, 255, 0))), fit(before), fit(after), fit(mk)])
        cv2.imwrite(job["debug_png"], cv2.cvtColor(sheet, cv2.COLOR_RGB2BGR))

    return dict(photo_landmarks=len(LP), render_landmarks=len(LR), used=used, face_px=int(face_px),
                mask_area=int((m > 0.5).sum()), lab_shift=[round(float(s), 1) for s in shift],
                face_ratios=_ratios(LP), head_ratios=_ratios(LR))


if __name__ == "__main__" and "--worker" in sys.argv:
    with open(sys.argv[sys.argv.index("--worker") + 1]) as f:
        job = json.load(f)
    print("PHOTOFACE-JSON " + json.dumps(worker(job)))
