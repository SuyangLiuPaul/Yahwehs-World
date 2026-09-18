"""A tunic SEWN from flat panels — the kuttoneth — not a tube swept round the body.

robe.py sweeps horizontal sections of the body into a tube and adds tube
sleeves, and every figure came out with the same silhouette: a column with two
pipes on it, a pointed "epaulette" where the sleeve tube began inboard of the
shoulder, a step at the elbow where the two tube radii met, and no folds,
because a tube that already fits the body has no spare cloth to fold. Real
cloth is cut FLAT and sewn, and its shape comes from where the seams pull it
in and where the spare width gathers. So this file cuts a T-tunic the way one
was cut — a body cloth folded over the shoulders, two sleeves set into the
armholes — and lets Blender's cloth solver sew it and drop it onto the body.

  · THE PATTERN. One body cloth, FOLDED at the shoulders (a real tunic of the
    period was woven in one piece and folded; there is no shoulder seam), with
    a round neck hole cut in the fold. Front and back go over the shoulder on
    a quarter turn and hang from it as flat panels, wider than the body by
    `ease` at the chest and widening to `full` times the hip width at the
    hem. Two sleeves, each a tube of cloth round the arm with `sleeve` times a
    hand's breadth of room, a little looser to the cuff; the tube's first
    ring IS the armhole — the top of each side edge, from the fold down to
    the armpit — so the sleeve grows out of the body cloth. Below the armpit
    the side edges are SEWN.
  · THE SEWING. Every seam is a set of loose edges joining the two edges to be
    sewn, and the solver's sewing springs pull them together while gravity
    drops the whole cloth onto the body collider. The side seams close round
    the body, and the spare cloth — the ease — has to go somewhere, so it
    folds. That is the whole point.
  · THE GIRDLE is in the cloth, not on it: a band of shrink at the waist pulls
    the tunic in as a girdle would, so the cloth blouses above the belt and
    hangs straight below it. The belt itself is then made to the tunic's
    measured waist (make_girdle here), where robe.make_girdle measured the
    body and cut through the cloth.
  · SIMULATED FINE, SHIPPED COARSE. The sim runs on ~1.5 cm cells; after it the
    seams are welded into one surface and the mesh is decimated to ~10k
    triangles, keeping the folds and collapsing the flat runs.

Called with the arms MOST OF THE WAY DOWN — person.py lowers them 20° of
their 36° first, drapes, then lowers the last 16° by the skin weights
(basebody.lower_arms bakes that into the tunic as it does into the body).
Draped in the full A-pose, a sleeve on an arm held out is a tent along its
top, and turned down by its weights it kept that shape. The weights come
from the body under the cloth, arm bones only on the sleeves, leg bones
smoothed on the skirt.

WHAT WAS TRIED AND FAILED, so it is not tried again: a shrink band set as
shrink_min shrank the whole tunic by a third; a head ring sewn onto the
armhole sat a hand above the fold and puffed; a head ring the armhole's
perimeter wide frilled; a fold row cut at the body's FRONT (a guard against
cutting into the chest, applied to the fold too) left the back panel one
cell to bridge the whole top of the shoulder — a flat plate that no arm
angle, no weighting and no sleeve change removed, because it was in the cut.
"""
import bpy, bmesh, math
from mathutils import Vector
from mathutils.bvhtree import BVHTree

import robe as _robe          # the same fabric material and body measurements


def _profile(trunk, z_lo, z_hi, step=0.01):
    """Per centimetre of height: the front-most (min y) and back-most (max y)
    trunk points, plus the half perimeter of the trunk's outline. Missing bins
    (between the legs, say) take the nearest filled bin."""
    n = int((z_hi - z_lo) / step) + 2
    fr = [None] * n; bk = [None] * n; per = [None] * n
    N = 48
    for i in range(n):
        z = z_lo + i * step
        band = [v for v in trunk if abs(v.z - z) < step]
        if len(band) < 8:
            continue
        fr[i] = min(v.y for v in band); bk[i] = max(v.y for v in band)
        cx = sum(v.x for v in band) / len(band); cy = sum(v.y for v in band) / len(band)
        r = [0.0] * N
        for v in band:
            k = int(((math.atan2(v.y - cy, v.x - cx) + math.pi) / (2 * math.pi)) * N) % N
            r[k] = max(r[k], math.hypot(v.x - cx, v.y - cy))
        for _ in range(6):
            r = [x if x > 0 else max(r[(j - 1) % N], r[(j + 1) % N]) for j, x in enumerate(r)]
        pts = [(cx + r[k] * math.cos(-math.pi + (k + .5) * 2 * math.pi / N),
                cy + r[k] * math.sin(-math.pi + (k + .5) * 2 * math.pi / N)) for k in range(N)]
        per[i] = sum(math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]) for k in range(N)) / 2
    for arr in (fr, bk, per):
        last = next((x for x in arr if x is not None), 0.0)
        for i in range(n):
            if arr[i] is None:
                arr[i] = last
            last = arr[i]
        for i in range(n - 1, -1, -1):
            if arr[i] is None:
                arr[i] = last
            last = arr[i]

    def at(arr, z):
        t = (z - z_lo) / step
        i = max(0, min(n - 2, int(t)))
        f = max(0.0, min(1.0, t - i))
        return arr[i] * (1 - f) + arr[i + 1] * f
    return (lambda z: at(fr, z)), (lambda z: at(bk, z)), (lambda z: at(per, z))


def make_tunic(body, rig, fabric="Fabric036", tint=(0.93, 0.89, 0.80), hem=0.05, full=1.5,
               ease=0.22, sleeve=1.0, sleeve_len=1.0, cinch=0.30, frames=110, cell=0.015,
               target_tris=10000, sleeves=True, neck_extra=0.0, pad=0.02, colliders=(),
               name="Tunic", stiff=1.0):
    """Cut, sew and drape one tunic. Returns the finished, skinned object.

    hem        where the hem falls, as a fraction of stature (0.05 = the ankle)
    full       hem width over hip width — 1.3 is a slim tunic, 1.9 a full one
    ease       spare width at the chest, as a fraction of the half-girth
    sleeve     room in the sleeve, 1 = a hand's breadth; 0 = no sleeves
    sleeve_len 1 = to the wrist, 0.75 = three-quarter
    cinch      how far the waist band shrinks (0 = ungirded)
    colliders  other cloth this one must fall against (an outer garment over
               a tunic); the body is always one
    """
    z0, H, trunk = _robe._trunk(body)
    k_ = H / 1.73
    allv = [body.matrix_world @ v.co for v in body.data.vertices]
    cx = sum(v.x for v in trunk) / len(trunk)
    dg = bpy.context.evaluated_depsgraph_get()
    tree = BVHTree.FromObject(body, dg)
    inv = body.matrix_world.inverted()
    W = rig.matrix_world

    # MEASUREMENTS. The shoulder joints, the shoulder line's height and depth,
    # the neck's girth, the armpit, and the body's front/back/girth per height.
    joint = {sd: W @ rig.data.bones[f"mixamorig:{sd}Arm"].head_local for sd in ("Left", "Right")}
    x_joint = (abs(joint["Left"].x - cx) + abs(joint["Right"].x - cx)) / 2
    sh = [v for v in allv if z0 + 0.78 * H < v.z < z0 + 0.84 * H and abs(v.x - cx) < x_joint]
    y_c = sum(v.y for v in sh) / len(sh)
    # the neck, at the THROAT (86-87 % of stature, measured: the narrowest
    # band between the shoulders and the jaw). A band a little higher took in
    # the chin, a little lower the trapezius, and either way the hole came
    # out wider than the shoulders.
    neck = [v for v in trunk if z0 + 0.858 * H < v.z < z0 + 0.868 * H and abs(v.x - cx) < 0.10 * k_]
    yn = sum(v.y for v in neck) / len(neck)
    r_neck = max(math.hypot(v.x - cx, v.y - yn) for v in neck) + 0.022 * k_ + neck_extra
    z_hem = z0 + hem * H
    z_hip = z0 + 0.50 * H
    z_waist = z0 + 0.585 * H

    def drop(x, y=None):
        """Height of the body's top surface under (x, y), or None."""
        o = inv @ Vector((x, y_c if y is None else y, z0 + 1.2 * H))
        hit, _n, _i, _d = tree.ray_cast(o, inv.to_3x3() @ Vector((0, 0, -1)))
        return (body.matrix_world @ hit).z if hit is not None else None

    # the armpit: going UP from above the hanging hands (a lean, long-armed
    # figure's fingertips reach the hip, and a ray from the hip hit the hand
    # and put his armpit at his waist) just inside the shoulder tip, the
    # first thing hit is the underside of the arm where it leaves the trunk
    def rise(x):
        o = inv @ Vector((x, y_c, z0 + 0.62 * H))
        hit, _n, _i, _d = tree.ray_cast(o, inv.to_3x3() @ Vector((0, 0, 1)))
        return (body.matrix_world @ hit).z if hit is not None else None
    pits = [z for z in (rise(cx + s * 0.86 * x_joint) for s in (1, -1)) if z is not None]
    z_armpit = (min(pits) if pits else z0 + 0.73 * H) - 0.012 * k_

    # the shoulder line: the top of the body under each column, so the fold
    # sits on the slope from neck to shoulder tip; inside the neck hole it is
    # held level at the neck's edge (a ray there would find the head)
    _fold = {}
    for i in range(int((x_joint + 0.06 * k_ - r_neck) / 0.005) + 1):
        xx = r_neck + i * 0.005
        hits = [z for z in (drop(cx + xx), drop(cx - xx)) if z is not None and z > z_armpit]
        _fold[i] = max(hits) if hits else (_fold[i - 1] if i else z0 + 0.82 * H)

    def z_fold(x):
        xx = max(r_neck, abs(x - cx))
        i = min(int((xx - r_neck) / 0.005), max(_fold))
        return _fold[i]

    # The trunk, no wider than the shoulders. With the arms part-way down the
    # hands hang below the height where _trunk stops trusting width, and the
    # fingernails — which MakeHuman weights to no bone — counted as trunk: a
    # slim young man's chest measured a foot in front of him.
    torso = [v for v in trunk if abs(v.x - cx) < x_joint + 0.02 * k_]
    front, back, halfper = _profile(torso, max(z_hem, z0 + 0.07 * H), z0 + 0.86 * H)
    x_tip = x_joint + 0.015 * k_             # the shoulder tip, a little past the joint
    # THE DELTOID, measured on its own. The trunk leaves out every vertex that
    # is mostly arm, and the deltoid is; so the trunk's front at shoulder
    # height is the collar bone, a finger behind the deltoid's bulge, and the
    # cloth cut to it started INSIDE the shoulder. The collider pushed those
    # rows up on top of it, and each figure wore a flat plate on each
    # shoulder that no arm angle and no weighting could take off.
    delt = [v for v in allv if x_joint - 0.07 * k_ <= abs(v.x - cx) <= x_tip + 0.01 * k_
            and v.z > z0 + 0.60 * H]
    d_front, d_back, _ = _profile(delt, z0 + 0.66 * H, z0 + 0.88 * H)
    # a flat panel below the armpit stands off the furthest point of the body
    # between there and the hem (the chest, the belly, or the buttocks)
    zs_flat = [z_armpit - i * 0.01 for i in range(int((z_armpit - max(z_hem, z0 + 0.07 * H)) / 0.01))]
    y_front_flat = min(front(z) for z in zs_flat) - pad
    y_back_flat = max(back(z) for z in zs_flat) + pad

    def body_front(x, z):
        """The body's front under the armhole rows: the throat and collar bone
        by the neck, the deltoid at the shoulder tip, blended between."""
        t = max(0.0, min(1.0, (abs(x - cx) - r_neck) / max(x_tip - r_neck, 1e-6)))
        return front(z) * (1 - t) + min(front(z), d_front(z)) * t

    def body_back(x, z):
        t = max(0.0, min(1.0, (abs(x - cx) - r_neck) / max(x_tip - r_neck, 1e-6)))
        return back(z) * (1 - t) + max(back(z), d_back(z)) * t

    def half_width(z):
        """Half the panel's width at a height below the armpit."""
        if z >= z_hip:
            w = halfper(z) * (1 + ease) / 2
        else:
            t = (z_hip - z) / max(z_hip - z_hem, 1e-6)
            w = halfper(z_hip) * (1 + ease) / 2 * (1 + (full - 1) * t)
        return max(w, x_tip + 0.01 * k_)

    # ROWS. s is the distance down the cloth from the fold. Rows 0..A are the
    # armhole zone: the cloth goes OVER the shoulder on a quarter circle from
    # the fold on top to the body's front (or back), then down to the armpit;
    # below A the panels are flat. The first cut put the fold itself at the
    # body's front, so the back panel's first row had to bridge the whole top
    # of the shoulder in one cell — a flat plate on each shoulder that
    # survived every sim, and that the wrong arm angle, the wrong weights and
    # the wrong sleeve were each blamed for in turn.
    step = cell

    def shoulder(P, x, pad_):
        """(top of the fold, edge depth, radius of the turn) at column x."""
        zf = z_fold(x) + pad_ * 0.6
        y_edge = body_front(x, zf - 0.05 * k_) - pad_ if P == "F" else body_back(x, zf - 0.05 * k_) + pad_
        return zf, y_edge, max(0.02 * k_, abs(y_edge - y_c))
    zf_t, _, r_t = shoulder("F", cx + x_joint + 0.015 * k_, pad)
    s_A = math.pi / 2 * r_t + (zf_t - r_t - z_armpit)
    A = max(6, int(round(s_A / step)))
    s_A = A * step
    z_fold_c = z_fold(cx + r_neck)
    nB = int(math.ceil((z_armpit - z_hem) / step))
    R = A + nB
    C = max(24, int(round(2 * half_width(z_hip) / step)))     # columns across the panel

    def pos(P, x, s, pad_=pad):
        """World position of the point (x across, s down) of panel P."""
        if s <= s_A:
            zf, y_edge, r_s = shoulder(P, x, pad_)
            arc = math.pi / 2 * r_s
            if s < arc:
                th = s / r_s
                y = y_c + (y_edge - y_c) * math.sin(th)
                z = zf - r_s * (1 - math.cos(th))
            else:
                # from the shoulder's edge, the cloth heads for the flat
                # panel's plane — and never inside the chest or the back
                u = (s - arc) / max(s_A - arc, 1e-6)
                z = (zf - r_s) + (z_armpit - (zf - r_s)) * u
                sm = u * u * (3 - 2 * u)
                if P == "F":
                    y = min(y_edge + (y_front_flat - y_edge) * sm, body_front(x, z) - pad_)
                else:
                    y = max(y_edge + (y_back_flat - y_edge) * sm, body_back(x, z) + pad_)
        else:
            z = z_armpit - (s - s_A)
            y = y_front_flat if P == "F" else y_back_flat
        return Vector((x, y, z))

    def hw(i):
        """Half width of row i: the armhole is a straight cut at the shoulder
        tip from the fold to the armpit; below that, the pattern's own width.
        (Slanted out to the side seam, the armhole was a third longer than
        the arm's girth, and the spare cloth stood up on the shoulder.)"""
        if i <= A:
            return x_tip
        w = half_width(z_armpit - (i - A) * step)
        if not (sleeves and sleeve > 0):
            # a sleeveless garment has no seam to pull the step from the
            # armhole to the full width in: left as one row, that step hung
            # out as a wing at each armpit on the mantle. So it is a slant
            # over a hand's length below the armpit instead.
            t = min(1.0, (i - A) * step / (0.10 * k_))
            w = x_tip + (w - x_tip) * t
        return w

    # VERTICES. Row 0 is the fold, shared by front and back.
    verts, uvs, vid = [], [], {}
    tile = 0.55
    for P in ("F", "B"):
        for i in range(R + 1):
            if P == "B" and i == 0:
                continue
            w = hw(i)
            for j in range(C + 1):
                x = cx - w + 2 * w * j / C
                s = i * step
                vid[(P, i, j)] = len(verts)
                verts.append(pos(P, x, s))
                uvs.append(((x - cx) / tile, -s / tile))
    for j in range(C + 1):
        vid[("B", 0, j)] = vid[("F", 0, j)]

    # THE NECK HOLE: a round hole in the fold, deeper at the front than the
    # back. Faces whose middle lies inside it go; every vertex left within
    # half a cell of its edge is pulled onto the circle, so the neckline is a
    # curve. (Dropping the vertices inside it and their faces left a sawtooth
    # of half-cells round the neck, plain in the head close-up.)
    kP = {"F": 1.0, "B": 1.8}
    rn = r_neck

    def rho(P, i, j):
        w = hw(i)
        x = cx - w + 2 * w * j / C
        return math.hypot(x - cx, i * step * kP[P])
    faces, face_uvs = [], []
    for P in ("F", "B"):
        for i in range(R):
            for j in range(C):
                q = (vid[(P, i, j)], vid[(P, i, j + 1)], vid[(P, i + 1, j + 1)], vid[(P, i + 1, j)])
                mid = (rho(P, i, j) + rho(P, i, j + 1) + rho(P, i + 1, j + 1) + rho(P, i + 1, j)) / 4
                if mid < rn:
                    continue
                faces.append(q if P == "F" else q[::-1])
                face_uvs.append(None)
    # onto the circle: every kept vertex inside it, and the first vertex past
    # it down each column and along the fold — one per column, so the edge is
    # one clean run and not a zigzag of cells that happened to fall near it
    snap = set()
    for P in ("F", "B"):
        for j in range(C + 1):
            for i in range(R + 1):
                if P == "B" and i == 0:
                    continue
                r_ = rho(P, i, j)
                if r_ < rn:
                    snap.add((P, i, j))
                else:
                    if i > 0 and rho(P, i - 1, j) < rn:
                        snap.add((P, i, j))
                    break
        if P == "F":
            for j in range(1, C):
                if rho("F", 0, j) >= rn and (rho("F", 0, j - 1) < rn or rho("F", 0, j + 1) < rn):
                    snap.add(("F", 0, j))
    neck_ring = set()
    for P in ("F", "B"):
        for i in range(R + 1):
            for j in range(C + 1):
                v = vid[(P, i, j)]
                if (P, i, j) not in snap:
                    continue
                neck_ring.add(v)
                w = hw(i)
                x = cx - w + 2 * w * j / C
                dx, ds = x - cx, i * step * kP[P]
                f = rn / max(math.hypot(dx, ds), 1e-6)
                x2, s2 = cx + dx * f, ds * f / kP[P]
                # the neckline is pinned where it is cut, so it is cut CLOSE:
                # at the cloth's full standoff it hung a finger behind the
                # neck for the whole sim and read as a standing collar
                verts[v] = pos(P, x2, s2, pad_=pad * 0.5) if i > 0 else pos("F", x2, 0.0, pad_=pad * 0.5)
                uvs[v] = ((x2 - cx) / tile, -s2 / tile)

    # SLEEVES: a tube of cloth round each outstretched arm whose FIRST RING IS
    # THE ARMHOLE — the fold's end at the top, the front edge down, the armpit
    # at the bottom, the back edge up — so the sleeve grows out of the body
    # cloth and there is no head seam to close. (A separate head ring sewn on
    # sat a hand above the fold before the seam pulled it down, and the cloth
    # between bunched into a puff on each shoulder.) From there the tube is
    # the arm's measured girth plus `sleeve` times a hand's breadth of room,
    # a little looser to the cuff.
    sewing = []
    sleeve_ids = set()
    SN = 2 * A
    for sd in (("Left", "Right") if sleeves and sleeve > 0 else ()):
        up = rig.data.bones[f"mixamorig:{sd}Arm"]; lo = rig.data.bones[f"mixamorig:{sd}ForeArm"]
        a, b, c = W @ up.head_local, W @ lo.head_local, W @ lo.tail_local
        sgn = 1 if (a.x - cx) > 0 else -1
        jc = C if sgn > 0 else 0
        ring0 = [vid[("F", k, jc)] for k in range(A + 1)] + [vid[("B", SN - k, jc)] for k in range(A + 1, SN)]
        d0 = (b - a).normalized()
        # The first tube ring sits a thumb's length down the arm from the
        # joint — INSIDE the deltoid's span, so the ring encloses it. A sign
        # slip once put the left ring twice as far out as the right: the
        # right shoulder draped and the left wore a box, which is how the
        # near placement was found to be the right one.
        c0 = a + d0 * (0.035 * k_)
        c_end = b.lerp(c, sleeve_len)
        n1 = max(4, int((b - c0).length / (step * 1.1))); n2 = max(3, int((c_end - b).length / (step * 1.1)))
        path = [c0.lerp(b, t / n1) for t in range(n1)] + [b.lerp(c_end, t / n2) for t in range(n2 + 1)]
        # the arm's own vertices only — the Shoulder group reaches into the
        # chest, and measured with it the sleeve head was a lantern
        ids = {g.index for g in body.vertex_groups
               if g.name in (f"mixamorig:{sd}Arm", f"mixamorig:{sd}ForeArm")}
        armv = [body.matrix_world @ v.co for v in body.data.vertices
                if sum(g.weight for g in v.groups if g.group in ids) > 0.5]
        rads = []
        for i, p in enumerate(path):
            d = ((path[i + 1] if i + 1 < len(path) else p + (p - path[i - 1])) - p).normalized()
            # The first rings must ENCLOSE THE DELTOID, which sits above and
            # behind a slab cut square to the bone at the shoulder: measured
            # in that thin slab the head ring was the upper arm's size, the
            # deltoid stood out through the sleeve cap, and the collider
            # pushed the cap up over it into a flat plate on every shoulder.
            back_ = 0.08 * k_ if i < 4 else 0.02 * k_
            near = [q for q in armv if -back_ < (q - p).dot(d) < 0.02 * k_ and (q - p).length < 0.15 * k_]
            meas = max([((q - p) - d * (q - p).dot(d)).length for q in near] or [0.045 * k_])
            # snug over the shoulder cap (a sleeve standing off the deltoid
            # read as an epaulette), the room coming in over the first rings,
            # and looser again toward the cuff
            room = (0.006 + 0.012 * min(1.0, i / 4)) * k_ * sleeve + 0.014 * k_ * sleeve * (i / (len(path) - 1))
            rads.append(meas + room)
        for _ in range(6):
            rads = [rads[0]] + [(rads[i - 1] + 2 * rads[i] + rads[i + 1]) / 4 for i in range(1, len(rads) - 1)] + [rads[-1]]
        # The tube starts at the arm's girth plus its room, no bigger: the
        # straight armhole is about that long already, and a head ring sized
        # to the armhole's perimeter only added cloth to gather.
        edge = [verts[v] for v in ring0]
        r_head = sum((edge[k] - edge[k - 1]).length for k in range(len(edge))) / (2 * math.pi)
        print(f"GARMENT sleeve {sd}: joint {tuple(round(c, 3) for c in a)} c0 {tuple(round(c, 3) for c in c0)} "
              f"loop top {tuple(round(c, 3) for c in edge[0])} bottom {tuple(round(c, 3) for c in edge[A])} "
              f"r_head {r_head:.3f} rads {[round(r, 3) for r in rads[:4]]} rings {len(path)}")
        prev = ring0
        prev_uv = [(2 * math.pi * k / SN * r_head / tile + 3.0, 0.0) for k in range(SN)]
        prev_r = r_head
        dist = 0.0
        for i, p in enumerate(path):
            d = ((path[i + 1] if i + 1 < len(path) else p + (p - path[i - 1])) - p).normalized()
            upv = (Vector((0, 0, 1)) - d * d.z).normalized()
            fwd = d.cross(upv).normalized()
            if fwd.y > 0:
                fwd = -fwd
            dist += (p - path[i - 1]).length if i else 0.06 * k_
            ring, ring_uv = [], []
            for k in range(SN):
                th = 2 * math.pi * k / SN
                ring.append(len(verts))
                verts.append(p + (upv * math.cos(th) + fwd * math.sin(th)) * rads[i])
                ring_uv.append((th * rads[i] / tile + 3.0, dist / tile))
                uvs.append(ring_uv[-1])
                sleeve_ids.add(ring[-1])
            # the tube's UVs are per corner, so the seam where the ring closes
            # and the ring that is the armhole get the sleeve's own cloth
            for k in range(SN):
                k2 = (k + 1) % SN
                q = (prev[k], prev[k2], ring[k2], ring[k])
                wrap_p = (2 * math.pi * prev_r / tile + 3.0, prev_uv[0][1])
                wrap_r = (2 * math.pi * rads[i] / tile + 3.0, ring_uv[0][1])
                quv = (prev_uv[k], prev_uv[k2] if k2 else wrap_p, ring_uv[k2] if k2 else wrap_r, ring_uv[k])
                faces.append(q if sgn > 0 else q[::-1])
                face_uvs.append(quv if sgn > 0 else quv[::-1])
            prev, prev_uv, prev_r = ring, ring_uv, rads[i]
    # the side seams, from the armpit to the hem
    for i in range(A, R + 1):
        for jc in (0, C):
            sewing.append((vid[("F", i, jc)], vid[("B", i, jc)]))

    # Neighbouring vertices pulled onto the same point of the circle become
    # one (a zero-length spring is a NaN in the solver's first step, and the
    # first cut this way blew the cloth across the scene); a face left with
    # fewer than three corners goes.
    ring = sorted(neck_ring)
    alias = {}
    for n, v in enumerate(ring):
        for u in ring[:n]:
            if u not in alias and (verts[u] - verts[v]).length < 0.003:
                alias[v] = u
                break
    faces2, uvs2 = [], []
    for q, fuv in zip(faces, face_uvs):
        q2 = []
        for v in q:
            v = alias.get(v, v)
            if v not in q2:
                q2.append(v)
        if len(q2) >= 3:
            faces2.append(tuple(q2)); uvs2.append(fuv if fuv and len(q2) == 4 else None)
    faces, face_uvs = faces2, uvs2
    neck_ring -= set(alias)

    # COMPACT: the vertices inside the neck hole belong to nothing now
    used = sorted({v for f in faces for v in f} | {v for e in sewing for v in e})
    remap = {old: new for new, old in enumerate(used)}
    verts = [verts[v] for v in used]; uvs = [uvs[v] for v in used]
    faces = [tuple(remap[v] for v in f) for f in faces]
    sewing = [(remap[a_], remap[b_]) for a_, b_ in sewing]
    neck_ring = {remap[v] for v in neck_ring if v in remap}
    sleeve_ids = {remap[v] for v in sleeve_ids}

    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], sewing, faces); me.update()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    uv = me.uv_layers.new(name="UVMap")
    for poly, fuv in zip(me.polygons, face_uvs):
        for n, li in enumerate(poly.loop_indices):
            uv.data[li].uv = fuv[n] if fuv else uvs[me.loops[li].vertex_index]
    # the neck hole is held where it was cut; the rest of the cloth hangs from
    # it and from the shoulders it rests on
    pin = ob.vertex_groups.new(name="pin")
    pin.add(sorted(neck_ring), 1.0, "REPLACE")
    grp_sleeve = ob.vertex_groups.new(name="sleeve")
    if sleeve_ids:
        grp_sleeve.add(sorted(sleeve_ids), 1.0, "REPLACE")
    # a girdle's worth of shrink round the waist
    if cinch > 0:
        gird = ob.vertex_groups.new(name="girdle")
        band = 0.045 * k_
        for vi, v in enumerate(me.vertices):
            if vi in sleeve_ids:
                continue
            dz = abs(v.co.z - z_waist)
            if dz < band and (abs(v.co.x - cx) < half_width(z_waist) + 0.05):
                gird.add([vi], max(0.0, 1 - (dz / band) ** 2), "REPLACE")

    # THE FALL.
    cols = []
    for other in [body] + list(colliders):
        cm = other.modifiers.new("collide", "COLLISION")
        other.collision.thickness_outer = 0.004
        other.collision.cloth_friction = 6.0
        cols.append((other, cm))
    bpy.context.view_layer.objects.active = ob
    cloth = ob.modifiers.new("cloth", "CLOTH")
    s = cloth.settings
    s.quality = 7; s.mass = 0.3; s.air_damping = 1.0
    s.tension_stiffness = 15 * stiff; s.compression_stiffness = 15 * stiff; s.shear_stiffness = 5 * stiff
    s.bending_stiffness = 0.5 * stiff
    s.tension_damping = 5; s.compression_damping = 5; s.shear_damping = 5; s.bending_damping = 0.5
    s.vertex_group_mass = "pin"; s.pin_stiffness = 1.0
    s.use_sewing_springs = True; s.sewing_force_max = 8.0
    if cinch > 0:
        # shrink_min is what the WHOLE cloth shrinks by, and the group scales
        # each vertex from there toward shrink_max. Set as shrink_min the first
        # time, the band took the whole tunic in by a third: the hem rose to
        # the knee and the sleeves to the elbow.
        s.vertex_group_shrink = "girdle"; s.shrink_min = 0.0; s.shrink_max = cinch
    cs = cloth.collision_settings
    cs.distance_min = 0.005; cs.collision_quality = 3
    cs.use_self_collision = True; cs.self_distance_min = 0.005; cs.self_friction = 5
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, frames
    cloth.point_cache.frame_start, cloth.point_cache.frame_end = 1, frames
    for f in range(1, frames + 1):
        sc.frame_set(f)
    bpy.ops.object.modifier_apply(modifier="cloth")
    sc.frame_set(1)
    for other, cm in cols:
        other.modifiers.remove(cm)

    # WELD THE SEAMS into one surface: each sewn pair becomes one vertex at the
    # middle, the sewing edges go, and the normals are made to agree and point
    # out. Then decimate: the folds stay, the flat runs collapse.
    bm = bmesh.new(); bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    parent = list(range(len(bm.verts)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]; i = parent[i]
        return i
    for a_, b_ in sewing:
        ra, rb = find(a_), find(b_)
        if ra != rb:
            parent[rb] = ra
    groups = {}
    for i in range(len(bm.verts)):
        groups.setdefault(find(i), []).append(i)
    tmap = {}
    for rep, members in groups.items():
        if len(members) < 2:
            continue
        cen = sum((bm.verts[i].co for i in members), Vector()) / len(members)
        bm.verts[rep].co = cen
        for i in members:
            if i != rep:
                tmap[bm.verts[i]] = bm.verts[rep]
    bmesh.ops.weld_verts(bm, targetmap=tmap)
    bmesh.ops.delete(bm, geom=[e for e in bm.edges if not e.link_faces], context="EDGES")
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    cen = sum((v.co for v in bm.verts), Vector()) / len(bm.verts)
    if sum(f.normal.dot(f.calc_center_median() - cen) for f in bm.faces) < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free(); me.update()
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    if tris > target_tris:
        dec = ob.modifiers.new("dec", "DECIMATE"); dec.ratio = target_tris / tris
        dec.vertex_group = "pin"; dec.invert_vertex_group = True     # the neckline keeps its curve
        bpy.ops.object.modifier_apply(modifier="dec")

    mat = _robe._material(name, fabric, tint, tile)
    mat.use_backface_culling = False
    me.materials.append(mat)
    for p in me.polygons:
        p.use_smooth = True

    # WEIGHTS from the body under the cloth: the sleeves answer to the arms,
    # the body cloth below the armpit to the trunk and legs only, and the legs'
    # weights are smoothed so a stride does not split the skirt.
    for g in body.vertex_groups:
        if g.name.startswith("mixamorig:") and g.name not in ob.vertex_groups:
            ob.vertex_groups.new(name=g.name)
    bpy.context.view_layer.objects.active = ob
    dt = ob.modifiers.new("dt", "DATA_TRANSFER"); dt.object = body; dt.use_vert_data = True
    dt.data_types_verts = {"VGROUP_WEIGHTS"}; dt.vert_mapping = "POLYINTERP_NEAREST"
    dt.layers_vgroup_select_src = "ALL"; dt.layers_vgroup_select_dst = "NAME"
    bpy.ops.object.modifier_apply(modifier="dt")
    sl = ob.vertex_groups["sleeve"].index
    arms = [g for g in ob.vertex_groups if any(a in g.name for a in ("Arm", "Hand", "Shoulder"))]
    low = [v.index for v in me.vertices
           if sum(g.weight for g in v.groups if g.group == sl) < 0.5 and v.co.z < z_armpit + 0.03 * k_]
    for g in arms:
        g.remove(low)
    # THE SLEEVE IS THE ARM'S. Copied from the nearest skin, the cloth over the
    # shoulder cap took the trapezius's weights — bones that do not move when
    # the arm comes down — and when it did, the sleeve head stayed up as a
    # flat plate on each shoulder. So every sleeve vertex answers to its own
    # arm alone, and the body cloth past the shoulder joint is eased onto the
    # arm over a few centimetres, so the fold's end goes down with it.
    side_ids = {sd: {ob.vertex_groups[f"mixamorig:{sd}{p}"].index for p in ("Arm", "ForeArm", "Hand")
                     if f"mixamorig:{sd}{p}" in ob.vertex_groups} for sd in ("Left", "Right")}
    for v in me.vertices:
        in_sleeve = sum(g.weight for g in v.groups if g.group == sl) >= 0.5
        dx = v.co.x - cx
        sd = "Left" if dx > 0 else "Right"                # MakeHuman's left is +X
        if in_sleeve:
            want = 1.0
        elif v.co.z > z_armpit - 0.02 * k_:
            want = max(0.0, min(1.0, (abs(dx) - (x_joint - 0.025 * k_)) / (0.04 * k_))) * 0.95
        else:
            continue
        if want <= 0:
            continue
        have = sum(g.weight for g in v.groups if g.group in side_ids[sd])
        if have >= want:
            continue
        other = [(g.group, g.weight) for g in v.groups if g.group not in side_ids[sd] and g.weight > 0]
        osum = sum(w for _, w in other)
        for gi, w in other:
            ob.vertex_groups[gi].add([v.index], w * (1 - want) / osum if osum > 0 else 0.0, "REPLACE")
        if have > 1e-6:
            for gi in side_ids[sd]:
                w = next((g.weight for g in v.groups if g.group == gi), 0.0)
                if w > 0:
                    ob.vertex_groups[gi].add([v.index], w * want / have, "REPLACE")
        else:
            ob.vertex_groups[f"mixamorig:{sd}Arm"].add([v.index], want, "REPLACE")
    bpy.ops.object.mode_set(mode="WEIGHT_PAINT")
    # only the legs and hips: smoothing the spine too bled trunk weight along
    # the shoulders into the sleeve heads (bodyfit.py found the same)
    for g in list(ob.vertex_groups):
        if any(k in g.name for k in ("UpLeg", "Leg", "Hips")) and "Foot" not in g.name:
            ob.vertex_groups.active_index = g.index
            bpy.ops.object.vertex_group_smooth(group_select_mode="ACTIVE", factor=0.5, repeat=8)
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    for gname in ("pin", "sleeve", "girdle"):
        if gname in ob.vertex_groups:
            ob.vertex_groups.remove(ob.vertex_groups[gname])
    ob.parent = rig
    ob.matrix_parent_inverse = rig.matrix_world.inverted()
    m = ob.modifiers.new("Armature", "ARMATURE"); m.object = rig
    ob["z_waist"] = z_waist
    print(f"GARMENT {name}: {len(me.polygons):,} faces, {tris:,} tris before decimation, "
          f"{len(sewing)} sewn pairs, panel {C}x{R}, armhole rows {A}, neck r {r_neck:.3f}, "
          f"armpit z {z_armpit - z0:.3f}, fold z {z_fold_c - z0:.3f}")
    return ob


def make_girdle(body, rig, tunic, fabric="Fabric036", tint=(0.42, 0.30, 0.20), width=0.055, tail=0.34):
    """A girdle of wool at the waist, tied, with its ends hanging (Ex 28:39;
    2 Kgs 1:8). robe.make_girdle measured the BODY and cut through a tunic
    that stood off it; this one measures the tunic where the shrink band
    pulled it in, and lies on the cloth."""
    z0, H, _trunk = _robe._trunk(body)
    zc = tunic.get("z_waist", z0 + 0.585 * H)
    N = 40
    # the body cloth only: the outstretched sleeves pass the waist's height
    # near the hands, and measured with them the belt was a hoop a yard wide
    k_ = H / 1.73
    pts = [tunic.matrix_world @ v.co for v in tunic.data.vertices]
    cx0 = sum(p.x for p in pts) / len(pts)
    pts = [p for p in pts if abs(p.x - cx0) < 0.22 * k_]
    rg = _robe._ring(pts, zc, N, band=0.02)
    cx, cy, r = rg
    rings = []
    for dz in (-width / 2, 0, width / 2):
        rings.append([Vector((cx + (r[k] + 0.012) * math.cos(-math.pi + (k + .5) * 2 * math.pi / N),
                              cy + (r[k] + 0.012) * math.sin(-math.pi + (k + .5) * 2 * math.pi / N),
                              zc + dz)) for k in range(N)])
    v, f = _robe._tube(rings, N)
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
    g.data.materials.append(_robe._material("Girdle", fabric, tint, 0.1))
    for p in g.data.polygons:
        p.use_smooth = True
    for grp in body.vertex_groups:
        if grp.name.startswith("mixamorig:"):
            g.vertex_groups.new(name=grp.name)
    dt = g.modifiers.new("dt", "DATA_TRANSFER"); dt.object = body; dt.use_vert_data = True
    dt.data_types_verts = {"VGROUP_WEIGHTS"}; dt.vert_mapping = "POLYINTERP_NEAREST"
    dt.layers_vgroup_select_src = "ALL"; dt.layers_vgroup_select_dst = "NAME"
    bpy.ops.object.modifier_apply(modifier="dt")
    for x in [x for x in g.vertex_groups if any(a in x.name for a in ("Arm", "Hand", "Shoulder"))]:
        x.remove([vv.index for vv in g.data.vertices])
    bpy.ops.object.mode_set(mode="WEIGHT_PAINT")
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    g.parent = rig; g.matrix_parent_inverse = rig.matrix_world.inverted()
    m = g.modifiers.new("Armature", "ARMATURE"); m.object = rig
    return g
