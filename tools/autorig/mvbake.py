"""Bake photographs of a figure, taken from known directions, into one UV atlas.

    python mvbake.py bake mesh.npz atlas.png --view front.png@0 --view left.png@90 \
        --view back.png@180 --view right.png@270 [--size 2048] [--power 8]
    python mvbake.py split sheet.png outdir --names left,back,right
    python mvbake.py cull mesh.npz interior.npy

This is the image half of project_multiview.py; the Blender half makes the
mesh and the UV layout and exports the result. It is a separate program
because Blender's own Python has numpy and nothing else — no PIL, no OpenCV —
and the Hunyuan venv beside this repo has all three, so the bake runs there.

WHY MORE THAN ONE PHOTOGRAPH. project_photo.py projects a single front photo:
the front of the figure is photographic, the sides are that photo dragged
across a surface seen edge-on (stripes), and the back is a purple blur. A
photograph taken from each side fixes the sides and back the same way the
front was fixed: every surface takes the picture that was looking at it.

HOW A TEXEL CHOOSES ITS PICTURE. Each texel of the atlas is a point on the
surface with a normal n. For every view with camera direction v (from the
figure toward the camera) the texel's weight is max(0, n·v)^k — the more
squarely the picture saw this surface, the more it counts — and zero if the
point was hidden behind another part of the figure in that view (a depth
buffer, rendered from the mesh itself, decides), or if the point projects
outside the photographed figure. Because n·v varies smoothly over the
surface, so does the blend: the front photo fades into the side photo across
the cheek rather than switching at a line. Below a grazing angle a view is
not trusted at all (a nose seen from the side is one pixel wide; stretched
across the front it is the streak we are removing).

WHAT NO PICTURE SAW — armpits, under the chin, the top of the head, the
insides of the sleeves — is filled from its neighbours on the same UV
island, growing the coloured region inward one texel at a time, and softened
so the fill does not carry the ragged edge of the last seen texel. Cheap, and
for the plain linen this figure wears it is enough; an SDXL inpainting model
(7 GB) would invent cloth texture where a soft average already reads as
cloth. See project_multiview.py for that decision.

ALIGNMENT is measured, as in project_photo.py: the figure is found in each
photo by its difference from the plain backdrop, the mesh's silhouette from
that direction is fitted to it by a small search over scale and offset, and
the fit's score is printed so a wrong yaw is visible in the log.

Conventions: the mesh is in Blender space, Z up, the figure facing -Y. Yaw
0 is the camera in front of the figure (at -Y); yaw increases anticlockwise
seen from above, so yaw 90 is the camera at +X, which is the figure's LEFT
side (facing -Y with Z up, his right hand is at -X). Image rows run top down.
"""
import argparse, json, math, os, sys, time
import numpy as np
from PIL import Image


# ---------------------------------------------------------------- pictures

def load_rgb(path):
    """float32 RGB in [0,1], row 0 = top of the picture."""
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.float32) / 255.0


def save_rgb(path, a):
    Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)).save(path)


def figure_mask(px, thresh=0.10):
    """Pixels unlike the backdrop. The backdrop colour is the median of the
    four corners; a plain studio grey, in every photograph used here."""
    h, w, _ = px.shape
    k = max(8, min(h, w) // 40)
    corners = np.concatenate([px[:k, :k].reshape(-1, 3), px[:k, -k:].reshape(-1, 3),
                              px[-k:, :k].reshape(-1, 3), px[-k:, -k:].reshape(-1, 3)])
    bg = np.median(corners, axis=0)
    mask = np.abs(px - bg).sum(-1) > thresh * 3
    # drop the specks: a stray dust pixel in a corner would stretch the
    # fitted box. NOT "keep the biggest blob only" — the back view's head was
    # joined to its body by a neck one pixel wide in the mask, and that rule
    # threw the head away and squashed the whole figure into the body's box.
    return big_blobs(mask)


def big_blobs(mask, keep=0.02):
    try:
        from scipy import ndimage
        lab, n = ndimage.label(mask)
        if n <= 1:
            return mask
        sizes = np.asarray(ndimage.sum(mask, lab, range(1, n + 1)))
        ok = np.concatenate([[False], sizes >= keep * sizes.max()])
        return ok[lab]
    except ImportError:
        return mask


def bbox(mask):
    ys, xs = np.nonzero(mask)
    return int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())


def grow(mask, rounds):
    m = mask.copy()
    for _ in range(rounds):
        m = m | np.roll(m, 1, 0) | np.roll(m, -1, 0) | np.roll(m, 1, 1) | np.roll(m, -1, 1)
    return m


def bleed(px, mask, rounds):
    """Spread the figure's own colours outward over the backdrop, so a mesh a
    little wider than the photographed figure takes robe, not studio grey
    (the pale halo project_photo.py first had down both arms)."""
    out = px.copy(); m = mask.copy()
    for _ in range(rounds):
        acc = np.zeros_like(out); cnt = np.zeros(m.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            acc += np.roll(np.roll(out * m[..., None], dy, 0), dx, 1)
            cnt += np.roll(np.roll(m, dy, 0), dx, 1)
        new = (~m) & (cnt > 0)
        out[new] = acc[new] / cnt[new][:, None]
        m = m | new
    return out


def bilinear(img, x, y):
    """Sample img (H,W,C) at float pixel coords; outside = clamped edge."""
    h, w = img.shape[:2]
    x = np.clip(x, 0, w - 1.001); y = np.clip(y, 0, h - 1.001)
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int)
    fx = (x - x0)[:, None]; fy = (y - y0)[:, None]
    return ((img[y0, x0] * (1 - fx) + img[y0, x0 + 1] * fx) * (1 - fy)
            + (img[y0 + 1, x0] * (1 - fx) + img[y0 + 1, x0 + 1] * fx) * fy)


def linen_median(px, mask):
    """The colour of the white cloth in this picture: the median of the bright
    figure pixels. Used to bring every view to the front photo's exposure, so
    the side of the coat is the same white as its front and the blend across
    the shoulder does not show a step."""
    lum = px.mean(-1)
    sel = mask & (lum > np.percentile(lum[mask], 60))
    return np.median(px[sel], axis=0)


# ---------------------------------------------------------------- geometry

def cam_dir(yaw_deg):
    a = math.radians(yaw_deg)
    return np.array([math.sin(a), -math.cos(a), 0.0])           # yaw 0 -> (0,-1,0)


def screen_axes(yaw_deg):
    """(right, up, toward-camera) for an orthographic camera at cam_dir."""
    a = math.radians(yaw_deg)
    return np.array([math.cos(a), math.sin(a), 0.0]), np.array([0.0, 0.0, 1.0]), cam_dir(yaw_deg)


def raster_setup(p0, p1, p2, expand):
    """Edge functions of a screen-space triangle over its pixel box. Returns
    (ys, xs, bary) for the pixels within `expand` px of the triangle, or None.
    Conservative on purpose: a texel whose centre falls just outside every
    triangle would otherwise be a crack in the atlas."""
    xs_ = np.array([p0[0], p1[0], p2[0]]); ys_ = np.array([p0[1], p1[1], p2[1]])
    x0 = int(math.floor(xs_.min() - expand)); x1 = int(math.ceil(xs_.max() + expand))
    y0 = int(math.floor(ys_.min() - expand)); y1 = int(math.ceil(ys_.max() + expand))
    if x1 < x0 or y1 < y0:
        return None
    area = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1])
    if abs(area) < 1e-12:
        return None
    gy, gx = np.mgrid[y0:y1 + 1, x0:x1 + 1]
    cx = gx + 0.5; cy = gy + 0.5
    # edge functions, each divided by its edge length = signed distance in px
    def edge(a, b):
        e = (b[0] - a[0]) * (cy - a[1]) - (b[1] - a[1]) * (cx - a[0])
        L = math.hypot(b[0] - a[0], b[1] - a[1]) or 1.0
        return e, e / L
    s = 1.0 if area > 0 else -1.0
    e0, d0 = edge(p1, p2); e1, d1 = edge(p2, p0); e2, d2 = edge(p0, p1)
    inside = (s * d0 >= -expand) & (s * d1 >= -expand) & (s * d2 >= -expand)
    if not inside.any():
        return None
    b = np.stack([e0[inside], e1[inside], e2[inside]], -1) / area
    b = np.clip(b, 0, 1); b /= b.sum(-1, keepdims=True)
    return gy[inside], gx[inside], b


def depth_map(V, F, right, up, toward, to_px, shape, tol_px=0.5):
    """Nearest surface per pixel, seen from this view. `to_px` maps (u,v)
    screen coords to pixel (x,y). Depth = distance toward the camera, so the
    largest value is the visible one."""
    u = V @ right; v = V @ up; d = V @ toward
    x, y = to_px(u, v)
    D = np.full(shape, -np.inf, np.float32)
    P = np.stack([x, y], -1)
    for f in F:
        r = raster_setup(P[f[0]], P[f[1]], P[f[2]], tol_px)
        if r is None:
            continue
        ys, xs, b = r
        ok = (ys >= 0) & (ys < shape[0]) & (xs >= 0) & (xs < shape[1])
        if not ok.any():
            continue
        ys, xs, b = ys[ok], xs[ok], b[ok]
        dz = b @ d[f]
        cur = D[ys, xs]
        upd = dz > cur
        D[ys[upd], xs[upd]] = dz[upd]
    return D


def fit_view(V, mask, box, right, up, sample=6000):
    """Scale and offset that put the mesh's silhouette on the photographed
    figure's, by a small search scored on overlap and coverage."""
    h, w = mask.shape
    x0, x1, y0, y1 = box
    u = V @ right; v = V @ up
    ulo, uhi = u.min(), u.max(); vlo, vhi = v.min(), v.max()
    step = max(1, len(V) // sample)
    us, vs = u[::step], v[::step]
    best = (-1, 1.0, 1.0, 0.0, 0.0)
    for sx in (0.92, 0.95, 0.98, 1.0, 1.02, 1.05):
        for sz in (0.96, 0.98, 1.0, 1.02):
            for ox in (-0.03, -0.02, -0.01, 0, 0.01, 0.02, 0.03):
                for oz in (-0.02, -0.01, 0, 0.01, 0.02):
                    fu = ((us - ulo) / (uhi - ulo) - 0.5) * sx + 0.5 + ox
                    fv = ((vs - vlo) / (vhi - vlo) - 0.5) * sz + 0.5 + oz
                    px_ = (x0 + fu * (x1 - x0)).astype(int)
                    py_ = (y1 - fv * (y1 - y0)).astype(int)        # v up, rows down
                    ok = (px_ >= 0) & (px_ < w) & (py_ >= 0) & (py_ < h)
                    hit = mask[py_[ok], px_[ok]].mean() if ok.any() else 0
                    score = hit * ok.mean()
                    if score > best[0]:
                        best = (score, sx, sz, ox, oz)
    score, sx, sz, ox, oz = best

    def to_px(u_, v_):
        fu = ((u_ - ulo) / (uhi - ulo) - 0.5) * sx + 0.5 + ox
        fv = ((v_ - vlo) / (vhi - vlo) - 0.5) * sz + 0.5 + oz
        return x0 + fu * (x1 - x0), y1 - fv * (y1 - y0)
    return best, to_px


# ---------------------------------------------------------------- the bake

def vertex_normals(V, F):
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])   # area-weighted
    vn = np.zeros_like(V)
    for i in range(3):
        np.add.at(vn, F[:, i], fn)
    n = np.linalg.norm(vn, axis=1, keepdims=True); n[n == 0] = 1
    return vn / n, fn / np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-12)


def atlas_map(UV, F, size):
    """For every texel: which triangle covers it and where in it. Texels no
    triangle covers keep tri = -1 (the gutters between islands)."""
    tri = np.full((size, size), -1, np.int32)
    bary = np.zeros((size, size, 3), np.float32)
    for i, (f, uv) in enumerate(zip(F, UV)):
        p = [(uv[k, 0] * size, (1 - uv[k, 1]) * size) for k in range(3)]   # v up in UV, rows down in the image
        r = raster_setup(p[0], p[1], p[2], 0.6)
        if r is None:
            continue
        ys, xs, b = r
        ok = (ys >= 0) & (ys < size) & (xs >= 0) & (xs < size)
        ys, xs, b = ys[ok], xs[ok], b[ok]
        # a texel already claimed by a triangle whose centre it truly contains
        # is not stolen by a neighbour's conservative border
        strict = (b.min(-1) > 1e-4)
        free = tri[ys, xs] < 0
        take = strict | free
        tri[ys[take], xs[take]] = i
        bary[ys[take], xs[take]] = b[take]
    return tri, bary


def surface_colours(V, F, t, b, col, w, max_rounds=600):
    """A colour per VERTEX from the seen texels, spread over the mesh to the
    vertices no picture reached. This is how the unseen is filled: on the
    surface, not in the atlas. The first version grew colour inward within
    each UV island, and an island that no view saw at all — the top of a
    sleeve, cut out by the smart projection as its own island because all its
    normals point up — stayed black. Neighbours on the mesh are the right
    neighbours: across a UV seam, the underside of the chin is next to the
    beard, and it takes the beard's colour."""
    n = len(V)
    acc = np.zeros((n, 3)); cnt = np.zeros(n)
    for k in range(3):
        np.add.at(acc, F[t, k], col * (w * b[:, k])[:, None])
        np.add.at(cnt, F[t, k], w * b[:, k])
    have = cnt > 0
    VC = np.zeros((n, 3)); VC[have] = acc[have] / cnt[have, None]
    # edges, both ways
    e = np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]])
    src = np.concatenate([e[:, 0], e[:, 1]]); dst = np.concatenate([e[:, 1], e[:, 0]])
    rounds = 0
    while not have.all() and rounds < max_rounds:
        ok = have[src]
        acc = np.zeros((n, 3)); cnt = np.zeros(n)
        np.add.at(acc, dst[ok], VC[src[ok]]); np.add.at(cnt, dst[ok], 1)
        new = (~have) & (cnt > 0)
        VC[new] = acc[new] / cnt[new, None]
        have |= new
        rounds += 1
    # a scrap of mesh with no seen vertex to spread from (a sliver the cull
    # left, out of everyone's sight) takes the figure's median colour rather
    # than black
    if not have.all():
        VC[~have] = np.median(VC[have], axis=0)
    return VC, rounds


def smooth_on_surface(V, F, t, b, values, weights, rounds):
    """A per-texel quantity averaged onto the vertices, smoothed a few rounds
    over the mesh's edges, and read back per texel. This is how a decision
    that is noisy texel by texel becomes a decision about a region."""
    n = len(V)
    acc = np.zeros(n); cnt = np.zeros(n)
    for k in range(3):
        np.add.at(acc, F[t, k], values * weights * b[:, k])
        np.add.at(cnt, F[t, k], weights * b[:, k])
    vals = np.where(cnt > 0, acc / np.maximum(cnt, 1e-12), 0.0)
    have = (cnt > 0).astype(float)
    e = np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]])
    src = np.concatenate([e[:, 0], e[:, 1]]); dst = np.concatenate([e[:, 1], e[:, 0]])
    for _ in range(rounds):
        acc = np.zeros(n); cnt = np.zeros(n)
        np.add.at(acc, dst, vals[src] * have[src]); np.add.at(cnt, dst, have[src])
        nb = np.where(cnt > 0, acc / np.maximum(cnt, 1e-12), vals)
        vals = np.where(have > 0, 0.5 * vals + 0.5 * nb, nb)
        have = np.maximum(have, (cnt > 0).astype(float))
    return vals[F[t, 0]] * b[:, 0] + vals[F[t, 1]] * b[:, 1] + vals[F[t, 2]] * b[:, 2]


def box_blur(a, k):
    """Separable box blur of an (H,W,C) array, edge-padded."""
    for axis in (0, 1):
        pad = [(k, k) if ax == axis else (0, 0) for ax in range(a.ndim)]
        c = np.cumsum(np.pad(a, pad, mode="edge"), axis=axis)
        a = (np.take(c, range(2 * k, c.shape[axis]), axis=axis)
             - np.take(c, range(0, c.shape[axis] - 2 * k), axis=axis)) / (2 * k)
    return a


def masked_blur(a, m, k):
    """Box blur that averages only the texels in m: a blur that looked past
    the edge of an island took the black of the gutter in, and every island
    got a grey rim."""
    num = box_blur(a * m[..., None].astype(np.float32), k)
    den = box_blur(m[..., None].astype(np.float32), k)
    return num / np.maximum(den, 1e-6)


def bake(args):
    t0 = time.time()
    mesh = np.load(args.mesh)
    V = mesh["V"].astype(np.float64); F = mesh["F"].astype(np.int64); UV = mesh["UV"].astype(np.float64)
    H = V[:, 2].max() - V[:, 2].min()
    VN, FN = vertex_normals(V, F)
    size = args.size
    outdir = os.path.dirname(os.path.abspath(args.atlas))
    stem = os.path.splitext(os.path.basename(args.atlas))[0]
    report = {"views": [], "size": size, "power": args.power}

    # Atlas geometry: where every texel is on the figure and which way it faces.
    tri, bary = atlas_map(UV, F, size)
    covered = tri >= 0
    ty, tx = np.nonzero(covered)
    t = tri[ty, tx]; b = bary[ty, tx]
    P = (V[F[t, 0]] * b[:, :1] + V[F[t, 1]] * b[:, 1:2] + V[F[t, 2]] * b[:, 2:3])
    N = (VN[F[t, 0]] * b[:, :1] + VN[F[t, 1]] * b[:, 1:2] + VN[F[t, 2]] * b[:, 2:3])
    N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)
    print(f"atlas {size}px: {covered.mean() * 100:.1f}% covered by {len(F):,} triangles "
          f"({time.time() - t0:.1f}s)", flush=True)

    # PASS 1 — every view, looked up per texel: how squarely it saw the point
    # (n·v), what colour it saw there, whether the point was in front of the
    # rest of the figure from there, and whether it landed on the photographed
    # figure at all.
    views = []
    front_linen = None
    for vi, spec in enumerate(args.view):
        path, yaw = spec.rsplit("@", 1); yaw = float(yaw)
        # HOW FAR TO TRUST THIS VIEW. Front and back photos of an A-pose figure
        # show the arms where the mesh has them. A profile photo does not: the
        # near arm comes toward the camera and lands on the torso, the far arm
        # is hidden, and the girdle's tails hang where the mesh's sleeve is —
        # the first bake printed blue stripes on the tops of both sleeves,
        # surfaces the side camera saw at 60° and nothing else saw at all. So a
        # side view paints only what faces it squarely.
        squarely = yaw % 180 == 0
        min_cos = args.min_cos if squarely else args.side_min_cos
        px = load_rgb(path)
        mask = figure_mask(px)
        box = bbox(mask)
        right, up, toward = screen_axes(yaw)
        fit, to_px = fit_view(V, mask, box, right, up)
        # exposure: every view's linen matched to the first view's
        med = linen_median(px, mask)
        if front_linen is None:
            front_linen = med; gain = np.ones(3)
        else:
            gain = np.clip(front_linen / np.maximum(med, 1e-3), 0.7, 1.4)
        px = np.clip(px * gain, 0, 1)
        # who is in front of whom, from here
        D = depth_map(V, F, right, up, toward, to_px, mask.shape)
        blob = grow(mask, 3)
        px_b = bleed(px, mask, args.bleed)

        cos = N @ toward
        x, y = to_px(P @ right, P @ up)
        xi = np.clip(np.round(x).astype(int), 0, mask.shape[1] - 1)
        yi = np.clip(np.round(y).astype(int), 0, mask.shape[0] - 1)
        depth = P @ toward
        visible = depth >= D[yi, xi] - args.depth_tol * H
        inside = blob[yi, xi] & (x >= 0) & (x < mask.shape[1]) & (y >= 0) & (y < mask.shape[0])
        views.append({"name": os.path.basename(path), "yaw": yaw, "squarely": squarely, "min_cos": min_cos,
                      "cos": cos.astype(np.float32), "col": bilinear(px_b, x, y).astype(np.float32),
                      "ok": visible & inside, "fit": fit, "gain": gain})
        print(f"view {os.path.basename(path)} yaw {yaw:g}: figure box {box}, fit score {fit[0]:.3f} "
              f"scale {fit[1]},{fit[2]} offset {fit[3]},{fit[4]}, gain {[round(float(g), 3) for g in gain]}, "
              f"trusted above n·v {min_cos} ({time.time() - t0:.1f}s)", flush=True)
        if args.debug:
            # the fitted silhouette drawn over the photo: the test of alignment
            dbg = px.copy()
            sil = np.isfinite(D)
            edge = sil & ~(np.roll(sil, 1, 0) & np.roll(sil, -1, 0) & np.roll(sil, 1, 1) & np.roll(sil, -1, 1))
            dbg[edge] = (1, 0, 0)
            save_rgb(os.path.join(outdir, f"{stem}_fit{vi}.png"), dbg)

    # THE REFERENCE. The front view is the photograph the shape was generated
    # from, so it and the mesh agree about where everything is. The other
    # views are a character sheet drawn to match it, and they match in
    # identity and dress but not in geometry — the drawn profile's eye sits
    # deeper in its head than the mesh's eye does, its near hand hangs behind
    # the body where the mesh's hand is out to the side. The back view is a
    # drawing too, but it is the only view that sees the back and it is
    # square to the figure like the front, so it is the reference where the
    # front sees nothing. Per texel the reference is whichever square view
    # saw the point best, and for the side views:
    # (1) where the reference sees the surface reasonably squarely they fade
    #     out; only where it is at a grazing angle do they take over (the
    #     ear, the side of the skirt);
    # (2) where the reference sees the surface at all, a side colour that
    #     disagrees with it — blue girdle where the reference has white
    #     linen, skin where it has cloth, an eye where it has cheek — is a
    #     misplacement and is dropped, and the texel takes the reference's
    #     own pixel instead: stretched, but the right cloth in the right
    #     place. That is what the single-view projection did everywhere;
    #     here it is the fallback, not the rule.
    ref_cos = np.full(len(P), -1.0, np.float32); ref_col = np.zeros((len(P), 3), np.float32)
    for v in views:
        if not v["squarely"]:
            continue
        c = np.where(v["ok"], v["cos"], -1.0)
        better = c > ref_cos
        ref_cos[better] = c[better]; ref_col[better] = v["col"][better]
    ref_seen = ref_cos > 0.1

    # PASS 2 — the weights.
    acc = np.zeros((len(P), 3), np.float64); wsum = np.zeros(len(P), np.float64)
    best_w = np.zeros(len(P)); best_view = np.full(len(P), -1, np.int8)
    diag = {"cos": np.zeros(len(P), bool), "visible": np.zeros(len(P), bool)}
    dropped = np.zeros(len(P), bool)
    for vi, v in enumerate(views):
        cos, col = v["cos"], v["col"]
        w = np.where((cos > v["min_cos"]) & v["ok"], np.clip(cos, 0, 1) ** args.power, 0.0)
        diag["cos"] |= cos > v["min_cos"]; diag["visible"] |= (cos > v["min_cos"]) & v["ok"]
        if not v["squarely"]:
            fade = np.clip((args.ref_fade_hi - ref_cos) / (args.ref_fade_hi - args.ref_fade_lo), 0, 1)
            w *= fade
            # chroma (r-g, b-g) is what tells cloth from girdle and skin from
            # linen, and is not much moved by a fold's shadow or by exposure
            chroma = np.abs((col[:, 0] - col[:, 1]) - (ref_col[:, 0] - ref_col[:, 1])) \
                + np.abs((col[:, 2] - col[:, 1]) - (ref_col[:, 2] - ref_col[:, 1]))
            lum = np.abs(col - ref_col).mean(1)
            checked = ref_seen & (ref_cos > args.ref_check_cos) & (w > 0)
            contradicts = checked & ((chroma > args.chroma_tol) | (lum > 0.3))
            # BY REGION, NOT BY TEXEL. Dropping each contradicting texel on its
            # own gave the side of the head a patchwork: side-photo hair where
            # it happened to agree with the stretched front, front skin where it
            # did not, in fragments the size of a fingernail. What is wrong is
            # the side photo's placement over a whole region — its eye is on
            # the mesh's cheek — so the disagreement is measured, smoothed
            # over the surface, and the side view is faded out wherever the
            # region disagrees, not where the texel does.
            dis = smooth_on_surface(V, F, t, b, contradicts.astype(float), checked.astype(float), rounds=6)
            w *= np.clip(1.0 - 2.5 * dis, 0, 1)
            dropped |= contradicts
        acc += col * w[:, None]; wsum += w
        better = w > best_w
        best_w[better] = w[better]; best_view[better] = vi
        report["views"].append({"view": v["name"], "yaw": v["yaw"], "fit_score": round(float(v["fit"][0]), 3),
                                "fit": [float(f) for f in v["fit"][1:]], "gain": [round(float(g), 3) for g in v["gain"]],
                                "min_cos": v["min_cos"], "texels_seen": int((w > 0).sum()), "share_best": 0.0})
    # the fallback: a texel no trusted view painted takes the reference's
    # stretched pixel, if the reference saw it at all
    stretched = (wsum == 0) & ref_seen
    acc[stretched] = ref_col[stretched]; wsum[stretched] = 1.0
    best_view[stretched] = -2

    seen = wsum > 0
    atlas = np.zeros((size, size, 3), np.float32)
    have = np.zeros((size, size), bool)
    atlas[ty[seen], tx[seen]] = (acc[seen] / wsum[seen, None])
    have[ty[seen], tx[seen]] = True
    # soften the stretched fallback: a grazing view's pixels smear into
    # streaks along the surface, and a small blur turns streaks into shading
    st = np.zeros((size, size), bool); st[ty[stretched], tx[stretched]] = True
    soft = masked_blur(atlas, have, 3)
    atlas[st] = soft[st]
    for vi, info in enumerate(report["views"]):
        info["share_best"] = round(float((best_view == vi).mean()), 3)
    unseen = covered & ~have
    report["unseen_texels"] = int(unseen.sum()); report["covered_texels"] = int(covered.sum())
    report["stretched_texels"] = int(stretched.sum()); report["dropped_samples"] = int(dropped.sum())
    print(f"blend: {have.sum():,} texels seen, of which {stretched.sum():,} ({stretched.mean() * 100:.1f}%) are the "
          f"reference stretched over a grazing surface; {dropped.sum():,} side samples dropped as contradicting the "
          f"reference; {unseen.sum():,} unseen ({unseen.sum() / covered.sum() * 100:.1f}% of the surface) — filled over the surface", flush=True)
    print(f"  of {len(P):,} surface texels: {diag['cos'].mean() * 100:.1f}% face some view above its threshold, "
          f"{diag['visible'].mean() * 100:.1f}% of those also unoccluded and on the figure", flush=True)

    # Fill what no picture saw from the surface around it, then soften the
    # filled region so it reads as a shaded patch of the same cloth and not
    # as a faceted one.
    blended = np.where(seen[:, None], acc / np.maximum(wsum, 1e-12)[:, None], 0)
    VC, rounds = surface_colours(V, F, t, b, blended, wsum)
    filled = atlas.copy()
    fill_col = (VC[F[t, 0]] * b[:, :1] + VC[F[t, 1]] * b[:, 1:2] + VC[F[t, 2]] * b[:, 2:3])
    filled[ty[~seen], tx[~seen]] = fill_col[~seen]
    soft = masked_blur(filled, covered, 4)
    fillmask = grow(unseen, 2) & covered
    filled[fillmask] = soft[fillmask]
    report["fill_rounds"] = rounds
    print(f"fill: vertex colours spread in {rounds} rounds", flush=True)

    # Gutters: bleed the islands outward so a texture lookup that falls just
    # off an island (bilinear filtering, mip levels) reads cloth, not black.
    final = bleed(filled, covered, args.gutter)
    save_rgb(args.atlas, final)
    if args.debug:
        # which view each texel took, as colour: front red, then green, blue,
        # yellow; the stretched fallback white, the surface fill dark grey
        pal = np.array([(1, .2, .2), (.2, 1, .2), (.3, .4, 1), (1, .9, .2), (1, .4, 1), (.4, 1, 1)])
        who = np.zeros((size, size, 3), np.float32)
        who[ty, tx] = np.where(best_view[:, None] >= 0, pal[np.maximum(best_view, 0) % len(pal)],
                               np.where(best_view[:, None] == -2, 1.0, 0.15))
        save_rgb(os.path.join(outdir, f"{stem}_who.png"), who)
    with open(os.path.join(outdir, f"{stem}_bake.json"), "w") as f:
        json.dump(report, f, indent=1)
    print(f"wrote {args.atlas} in {time.time() - t0:.0f}s", flush=True)


# ---------------------------------------------------------------- the cull

def cull(args):
    """Which faces can no camera see? Hunyuan's priest is watertight and
    one piece, and 14 % of its faces — 17 % of its area — are the legs and
    the inside of the skirt, real geometry inside the robe that no view of
    the figure ever shows. Left in, they take a sixth of the atlas, are
    'unseen' by every photograph and get filled with invented colour, and
    are dead weight for the rig. Seen from none of 26 directions (the six
    axes, the twelve edges and the eight corners of a cube, each a depth
    buffer of the whole figure) means seen by nobody."""
    mesh = np.load(args.mesh)
    V = mesh["V"].astype(np.float64); F = mesh["F"].astype(np.int64)
    H = V[:, 2].max() - V[:, 2].min()
    C = V[F].mean(1)
    _, FN = vertex_normals(V, F)
    seen = np.zeros(len(F), bool)
    R = args.res
    dirs = [np.array(d, float) for d in [(x, y, z) for x in (-1, 0, 1) for y in (-1, 0, 1) for z in (-1, 0, 1)] if any(d)]
    for d in dirs:
        toward = d / np.linalg.norm(d)
        up = np.array([0, 0, 1.0]) if abs(toward[2]) < 0.9 else np.array([1.0, 0, 0])
        right = np.cross(-toward, up); right /= np.linalg.norm(right); up = np.cross(right, -toward)
        u = V @ right; v = V @ up
        ulo, uhi, vlo, vhi = u.min(), u.max(), v.min(), v.max()
        s = (R - 2) / max(uhi - ulo, vhi - vlo)

        def to_px(u_, v_):
            return 1 + (u_ - ulo) * s, R - 1 - (v_ - vlo) * s
        D = depth_map(V, F, right, up, toward, to_px, (R, R))
        x, y = to_px(C @ right, C @ up)
        xi = np.clip(np.round(x).astype(int), 0, R - 1); yi = np.clip(np.round(y).astype(int), 0, R - 1)
        seen |= (C @ toward >= D[yi, xi] - 0.01 * H) & (FN @ toward > 0.05)
    area = 0.5 * np.linalg.norm(np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]]), axis=1)
    np.save(args.out, np.nonzero(~seen)[0].astype(np.int32))
    print(f"cull: {(~seen).sum():,} of {len(F):,} faces ({(~seen).mean() * 100:.1f}%, "
          f"{area[~seen].sum() / area.sum() * 100:.1f}% of the area) seen from none of {len(dirs)} directions -> {args.out}",
          flush=True)


# ---------------------------------------------------------------- the sheet

def split(args):
    """Cut a character sheet — several views of one figure in a row on a plain
    ground — into one picture per view, left to right."""
    px = load_rgb(args.sheet)
    h, w, _ = px.shape
    k = max(8, min(h, w) // 40)
    corners = np.concatenate([px[:k, :k].reshape(-1, 3), px[:k, -k:].reshape(-1, 3),
                              px[-k:, :k].reshape(-1, 3), px[-k:, -k:].reshape(-1, 3)])
    bg = np.median(corners, axis=0)
    mask = np.abs(px - bg).sum(-1) > 0.30
    col = mask.sum(0) > max(3, h * 0.01)
    runs = []; start = None
    for x in range(w + 1):
        on = x < w and col[x]
        if on and start is None: start = x
        if not on and start is not None:
            runs.append([start, x - 1]); start = None
    # close small gaps (a hand held away from the body is a separate run)
    merged = []
    for r in runs:
        if merged and r[0] - merged[-1][1] < w * 0.03:
            merged[-1][1] = r[1]
        else:
            merged.append(r)
    merged = sorted(sorted(merged, key=lambda r: r[1] - r[0])[-len(args.names.split(",")):])
    os.makedirs(args.outdir, exist_ok=True)
    out = []
    for name, (x0, x1) in zip(args.names.split(","), merged):
        m = mask[:, x0:x1 + 1]
        ys = np.nonzero(m.any(1))[0]
        y0, y1 = ys.min(), ys.max()
        pad = int(0.04 * (y1 - y0))
        crop = px[max(0, y0 - pad):min(h, y1 + pad), max(0, x0 - pad):min(w, x1 + pad)]
        p = os.path.join(args.outdir, f"{name}.png"); save_rgb(p, crop); out.append(p)
        print(f"{name}: columns {x0}-{x1}, rows {y0}-{y1} -> {p} {crop.shape[1]}x{crop.shape[0]}")
    return out


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("bake")
    b.add_argument("mesh"); b.add_argument("atlas")
    b.add_argument("--view", action="append", required=True, help="picture.png@yaw")
    b.add_argument("--size", type=int, default=2048)
    b.add_argument("--power", type=float, default=8.0, help="k in max(0,n·v)^k")
    b.add_argument("--min-cos", type=float, default=0.25, help="front/back views are not trusted below this n·v")
    b.add_argument("--side-min-cos", type=float, default=0.5, help="side views are not trusted below this n·v")
    b.add_argument("--ref-fade-lo", type=float, default=0.25, help="other views are full below this reference n·v")
    b.add_argument("--ref-fade-hi", type=float, default=0.45, help="...and gone above this")
    b.add_argument("--chroma-tol", type=float, default=0.15, help="chroma disagreement with the reference that drops a sample")
    b.add_argument("--ref-check-cos", type=float, default=0.2, help="the reference is consulted for disagreement above this n·v")
    b.add_argument("--depth-tol", type=float, default=0.015, help="occlusion tolerance, fraction of height")
    b.add_argument("--bleed", type=int, default=40, help="px the photo is spread past the figure's edge")
    b.add_argument("--gutter", type=int, default=12, help="px the islands are spread into the gutters")
    b.add_argument("--debug", action="store_true")
    s = sub.add_parser("split")
    s.add_argument("sheet"); s.add_argument("outdir")
    s.add_argument("--names", default="left,back,right")
    c = sub.add_parser("cull")
    c.add_argument("mesh"); c.add_argument("out")
    c.add_argument("--res", type=int, default=400)
    a = ap.parse_args()
    {"bake": bake, "split": split, "cull": cull}[a.cmd](a)


if __name__ == "__main__":
    main()
