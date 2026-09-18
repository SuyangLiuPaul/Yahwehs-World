"""A person, built in Blender from CC0 parts — no generated mesh.

    blender -b --python tools/autorig/person.py -- out.glb \
        [--gender 1] [--age 0.6] [--weight 0.5] [--height 0.5] [--muscle 0.5] \
        [--skin toigo_light_skin_male_bronze] [--hair short02] [--beard wdg_scruffy_beard] \
        [--eyebrows mindfront_eyebrows_04] [--robe ankle|none] [--clips idle,walk,...]

This is the "Blender, then real textures" route the owner asked for. Every
part is a MakeHuman asset, CC0 unless noted in handoff/MANIFEST-assets.md:
the body (parametric in sex, age, height, weight), a photographic skin, hair,
beard, eyebrows, eyelashes and eyes. The rig and its weights are MakeHuman's,
painted by hand, so the figure never tears; every clip in autorig_clips.py
plays on it.

MEN ARE SHORT-HAIRED. 1 Cor 11:14 is the only word in the letters on a man's
hair, and it says long hair is a shame to him; every male preset here uses a
short style, and --hair on a man is checked against that.
"""
import bpy, sys, importlib
argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
opt = {"gender": 1.0, "age": 0.6, "weight": 0.5, "height": 0.5, "muscle": 0.5, "proportions": 0.5,
       "skin": "toigo_light_skin_male_bronze", "hair": "short02", "beard": "grinsegold_beard_sigmund_wip",
       "beard_tint": "0.30,0.21,0.15", "fabric": "Fabric036",
       "eyebrows": "eyebrow001", "eyelashes": "eyelashes01",
       "robe": "ankle", "rig": "mixamo", "clips": "idle,walk,look,pray,speak,carry",
       # spring bones under the hem, the girdle's ends, a head-cloth and the
       # beard, for the app to swing at run time (springs.py). --springs 0 for
       # a figure skinned to the body alone, as before.
       "springs": 1.0}

# A FIRST CAST. Each preset is a person who can be told from the others at a
# glance: build, age, the face, the colour of hair and beard, the skin. They are
# ROLES, not portraits (handoff/FIGURES.md: a figure is named only where the
# text describes it) — except where a preset says which verse it answers to.
PRESETS = {
    # a man in his twenties: slight, dark-haired, a young beard
    "young-man": dict(robe_tint="0.78,0.70,0.58", girdle_tint="0.30,0.22,0.16", gender=1, age=0.47, weight=0.42, muscle=0.55, height=0.55,
                      skin="young_caucasian_male", tan="0.80,0.66,0.52", hair="short01",
                      beard="culturalibre_faun_beard", beard_tint="0.16,0.11,0.08",
                      face="nose-hump-incr=0.35,chin-prominent-incr=0.3,head-oval=0.5,eyebrows-trans-down=0.3"),
    # a man of forty — the default
    "man": dict(robe_tint="0.62,0.48,0.34", girdle_tint="0.25,0.18,0.12", gender=1, age=0.60, weight=0.5, muscle=0.5,
                skin="toigo_light_skin_male_bronze", tan="1,1,1", hair="short02",
                beard="grinsegold_beard_sigmund_wip", beard_tint="0.30,0.21,0.15",
                face="nose-hump-incr=0.5,nose-greek-incr=0.3,head-rectangular=0.4,l-cheek-bones-incr=0.3,r-cheek-bones-incr=0.3"),
    # Elijah: "an hairy man, and girt with a girdle of leather" (2 Kgs 1:8) — a
    # lean, weathered man of the wilderness, grey coming into a dark beard
    "elijah": dict(robe_tint="0.55,0.46,0.36", girdle_tint="0.22,0.14,0.08", mantle="hair", fabric="Fabric019", gender=1, age=0.74, weight=0.28, muscle=0.62, height=0.55,
                   skin="old_caucasian_male", tan="0.78,0.62,0.48", hair="short01", hair_tint="0.55,0.52,0.50",
                   beard="grinsegold_beard_sigmund_wip", beard_tint="0.42,0.38,0.35",
                   face="nose-hump-incr=0.8,l-cheek-inner-decr=0.6,r-cheek-inner-decr=0.6,l-cheek-bones-incr=0.6,r-cheek-bones-incr=0.6,eyebrows-trans-down=0.5,head-age-incr=0.4,chin-prominent-incr=0.4"),
    # an old man — fourscore years (Moses at Ex 7:7), white-haired
    "old-man": dict(robe_tint="0.88,0.85,0.78", girdle_tint="0.36,0.26,0.18", gender=1, age=0.93, weight=0.40, muscle=0.35, height=0.45,
                    skin="old_caucasian_male", tan="0.86,0.72,0.58", hair="short02", hair_tint="1.6,1.6,1.6",
                    beard="grinsegold_beard_sigmund_wip", beard_tint="1.05,1.05,1.05",
                    face="head-age-incr=0.8,nose-hump-incr=0.4,l-eye-bag-incr=0.7,r-eye-bag-incr=0.7,mouth-angles-down=0.4"),
    # a woman of forty; her head is covered (1 Cor 11:5)
    "woman": dict(robe_tint="0.36,0.40,0.55", girdle_tint="0.55,0.38,0.22", gender=0, age=0.60, weight=0.5, muscle=0.4, height=0.45,
                  skin="middleage_caucasian_female", tan="0.84,0.70,0.56", hair="none", beard="none", head="veil",
                  face="nose-hump-incr=0.3,head-oval=0.5"),
}

STR = {"skin", "hair", "beard", "eyebrows", "eyelashes", "robe", "rig", "clips", "fabric",
       "beard_tint", "hair_tint", "tan", "face", "preset", "head", "robe_tint", "girdle_tint", "mantle"}
opt.update({"hair_tint": "1,1,1", "tan": "1,1,1", "face": "", "head": "none",
            "robe_tint": "0.93,0.89,0.80", "girdle_tint": "0.42,0.30,0.20", "mantle": "none"})
args = {}
for i, a in enumerate(argv[1:], 1):
    if a.startswith("--"):
        k = a[2:]; v = argv[i + 1]
        args[k] = v if k in STR else float(v)
if "preset" in args:
    opt.update(PRESETS[args["preset"]])
opt.update(args)

if opt["head"] in ("veil", "headcloth"):
    # a covered head has no hair to show; the asset would only poke through
    opt["hair"] = "none"

LONG = {"long01", "o4saken_long01", "braid01", "ponytail01", "elvs_double_mh_braid",
        "elvs_french_braid_variation", "elvs_unkempt_french_braid", "rehmanpolanski_hair_bun_brown"}
if opt["gender"] >= 0.5 and opt["hair"] in LONG:
    raise SystemExit(f"{opt['hair']} is long hair on a man — 1 Cor 11:14. Choose a short style.")

HERE = __file__.rsplit("/", 1)[0]
sys.path.insert(0, HERE)
bb = {}
exec(compile(open(HERE + "/basebody.py").read().split("\ndef main():")[0]
             .replace("argv = sys.argv", "argv = ['x.glb'] or sys.argv"), "basebody", "exec"), bb)
HS = bb["HS"]
AS = importlib.import_module("bl_ext.blender_org.mpfb.services.assetservice").AssetService
import autorig_clips as ac  # noqa: E402


def find(sub, stem, kind="mhclo"):
    lst = AS.list_mhmat_assets(sub) if kind == "mhmat" else AS.list_mhclo_assets(sub)
    for p in lst:
        if p.stem == stem:
            return str(p)
    raise SystemExit(f"no {sub} asset called {stem}")


def wire_texture(obj, mhclo_path):
    """Give a hair/brow/lash/beard card its own texture, with alpha.

    MPFB's game-engine material for eyebrows came back with no image node at
    all — just a grey shader — so the brows exported as solid strips. The
    texture is named in the asset's .mhmat beside its .mhclo; read it and wire
    image colour to Base Color and image alpha to Alpha."""
    import pathlib, os
    folder = pathlib.Path(mhclo_path).parent
    mats = sorted(folder.glob("*.mhmat"))
    tex = None
    for mm in mats:
        for line in mm.read_text(errors="ignore").splitlines():
            parts = line.strip().split(None, 1)
            if len(parts) == 2 and parts[0] == "diffuseTexture":
                cand = (mm.parent / parts[1]).resolve()
                if not cand.exists():
                    cand = folder / pathlib.Path(parts[1]).name
                if cand.exists():
                    tex = str(cand); break
        if tex:
            break
    if not tex or not obj.data.materials:
        return False
    m = obj.data.materials[0]
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        return False
    img = nt.nodes.new("ShaderNodeTexImage")
    img.image = bpy.data.images.load(tex, check_existing=True)
    nt.links.new(img.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(img.outputs["Alpha"], bsdf.inputs["Alpha"])
    return True


# How each kind of material must be drawn once it is in three.js. Written into
# the GLB after export, because what Blender's exporter infers is not this:
# it marked the body BLEND (which sorts it wrongly against everything) and left
# the brows OPAQUE.
ALPHA = {"body": ("OPAQUE", None), "high-poly": ("BLEND", None), "low-poly": ("BLEND", None)}
CARDS = ("eyebrow", "eyelash", "beard", "moustache", "hair", "short", "long", "bob", "braid", "afro", "bun")


def set_alpha_modes(glb_path):
    import json, struct
    b = bytearray(open(glb_path, "rb").read())
    off = 12
    while off < len(b):
        ln, typ = struct.unpack_from("<II", b, off)
        if typ == 0x4E4F534A:
            j = json.loads(b[off + 8: off + 8 + ln])
            tint = [float(x) for x in opt.get("beard_tint", "1,1,1").split(",")] + [1.0]
            for mat in j.get("materials", []):
                n = mat.get("name", "").lower()
                if "beard" in n or "moustache" in n:
                    # MakeHuman's beards come grey; a man of forty is not.
                    mat.setdefault("pbrMetallicRoughness", {})["baseColorFactor"] = tint
                elif n.endswith("body"):
                    # the skin, toward a Levantine tone where the chosen skin is fairer
                    mat.setdefault("pbrMetallicRoughness", {})["baseColorFactor"] = \
                        [float(x) for x in opt["tan"].split(",")] + [1.0]
                elif opt["hair"].lower() in n:
                    mat.setdefault("pbrMetallicRoughness", {})["baseColorFactor"] = \
                        [min(float(x), 4.0) for x in opt["hair_tint"].split(",")] + [1.0]
                mode, cut = next((v for k, v in ALPHA.items() if n.endswith(k)), (None, None))
                if mode is None and any(c in n for c in CARDS):
                    mode, cut = "MASK", 0.5
                if mode:
                    mat["alphaMode"] = mode
                    mat.pop("alphaCutoff", None)
                    if cut is not None:
                        mat["alphaCutoff"] = cut
            new = json.dumps(j, separators=(",", ":")).encode()
            new += b" " * ((4 - len(new) % 4) % 4)
            out = b[:off] + struct.pack("<II", len(new), typ) + new + b[off + 8 + ln:]
            struct.pack_into("<I", out, 8, len(out))
            open(glb_path, "wb").write(bytes(out))
            return
        off += 8 + ln + ((4 - ln % 4) % 4)


def paint_hairline(body, hair_obj, strength=0.55, feather_px=None):
    """Paint the scalp under the hair in the hair's own colour, feathered.

    A MakeHuman hair is a cap, and where the cap ends the forehead begins at
    full skin colour — a hard line across the brow that no real head has. A
    real hairline thins out over a centimetre or so. So the skin texture is
    darkened toward the hair colour over the body's own 'scalp' region, with
    the edge blurred, and what shows below the cap is a gradient, not a cut."""
    import numpy as np
    if hair_obj is None or not body.data.materials:
        return False
    # the skin image and the hair colour
    skin = next((n.image for m in body.data.materials if m and m.use_nodes
                 for n in m.node_tree.nodes if n.type == "TEX_IMAGE" and n.image), None)
    himg = next((n.image for m in hair_obj.data.materials if m and m.use_nodes
                 for n in m.node_tree.nodes if n.type == "TEX_IMAGE" and n.image), None)
    if skin is None or himg is None:
        return False
    hp = np.empty(len(himg.pixels), dtype=np.float32); himg.pixels.foreach_get(hp)
    hp = hp.reshape(-1, 4)
    solid = hp[hp[:, 3] > 0.8][:, :3]
    col = np.median(solid, axis=0) if len(solid) else np.array([0.12, 0.08, 0.05])
    W, H = skin.size
    mask = np.zeros((H, W), dtype=np.float32)
    # WHERE: by distance to the HAIR ITSELF, not the 'scalp' group. The scalp
    # group lies wholly under the cap, so painting it changed nothing you can
    # see; the line to soften is the skin just below the cap's edge. Every body
    # vertex within ~2 cm of the hair, above the brows, is darkened, fading
    # with distance.
    from mathutils.kdtree import KDTree
    hv = [hair_obj.matrix_world @ v.co for v in hair_obj.data.vertices]
    kd = KDTree(len(hv))
    for i, q in enumerate(hv): kd.insert(q, i)
    kd.balance()
    bz = [(body.matrix_world @ v.co).z for v in body.data.vertices]
    ztop = max(bz); zmin = min(bz); Hh = ztop - zmin
    reach = 0.009 * Hh / 1.73          # about a centimetre: the width of a real hairline
    wv = {}
    for v in body.data.vertices:
        pw = body.matrix_world @ v.co
        if pw.z < zmin + 0.945 * Hh:            # above the brows only — never round the eyes
            continue
        d = kd.find(pw)[2]
        if d < reach:
            wv[v.index] = 1.0 - d / reach
    uv = body.data.uv_layers.active.data
    for poly in body.data.polygons:
        vids = [body.data.loops[li].vertex_index for li in poly.loop_indices]
        if not any(i in wv for i in vids):
            continue
        pts = [uv[li].uv for li in poly.loop_indices]
        ws = [wv.get(i, 0.0) for i in vids]
        for t in range(1, len(pts) - 1):
            a, b, c = pts[0], pts[t], pts[t + 1]
            xs = [p_.x * (W - 1) for p_ in (a, b, c)]; ys = [p_.y * (H - 1) for p_ in (a, b, c)]
            x0, x1 = int(max(0, min(xs))), int(min(W - 1, max(xs)) + 1)
            y0, y1 = int(max(0, min(ys))), int(min(H - 1, max(ys)) + 1)
            if x1 <= x0 or y1 <= y0:
                continue
            X, Y = np.meshgrid(np.arange(x0, x1), np.arange(y0, y1))
            d = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
            if abs(d) < 1e-9:
                continue
            l1 = ((ys[1] - ys[2]) * (X - xs[2]) + (xs[2] - xs[1]) * (Y - ys[2])) / d
            l2 = ((ys[2] - ys[0]) * (X - xs[2]) + (xs[0] - xs[2]) * (Y - ys[2])) / d
            inside = (l1 >= 0) & (l2 >= 0) & (l1 + l2 <= 1)
            val = l1 * ws[0] + l2 * ws[t] + (1 - l1 - l2) * ws[t + 1]
            sub = mask[y0:y1, x0:x1]
            sub[inside] = np.maximum(sub[inside], val[inside])
    if not mask.any():
        return False
    # feather: a separable box blur, a few passes (~ a centimetre on the head)
    r = feather_px or max(2, W // 400)
    for _ in range(3):
        k = np.ones(2 * r + 1, dtype=np.float32) / (2 * r + 1)
        mask = np.apply_along_axis(lambda m: np.convolve(m, k, mode="same"), 1, mask)
        mask = np.apply_along_axis(lambda m: np.convolve(m, k, mode="same"), 0, mask)
    sp = np.empty(len(skin.pixels), dtype=np.float32); skin.pixels.foreach_get(sp)
    sp = sp.reshape(H, W, 4)
    m3 = (mask * strength)[..., None]
    sp[..., :3] = sp[..., :3] * (1 - m3) + col[None, None, :] * m3
    skin.pixels.foreach_set(sp.ravel())
    skin.update()
    return True


def whiten_hair(hair_obj):
    """Grey and white hair. A colour factor only multiplies, and brown times
    anything is never white — the old man kept his brown hair. So where the
    hair tint asks for more than 1, the hair image is taken to grey and lifted
    toward the asked lightness, keeping its strands' light and dark."""
    import numpy as np
    t = [float(x) for x in opt["hair_tint"].split(",")]
    if hair_obj is None or max(t) <= 1.0 or not hair_obj.data.materials:
        return
    img = next((n.image for m in hair_obj.data.materials if m and m.use_nodes
                for n in m.node_tree.nodes if n.type == "TEX_IMAGE" and n.image), None)
    if img is None:
        return
    px = np.empty(len(img.pixels), dtype=np.float32); img.pixels.foreach_get(px)
    px = px.reshape(-1, 4)
    lum = px[:, :3] @ np.array([0.30, 0.59, 0.11], dtype=np.float32)
    lum = lum / max(float(np.percentile(lum[px[:, 3] > 0.5], 95)), 1e-3)   # stretch to full range
    target = min(max(t) / 2.0, 0.92)                                        # 1.6 -> 0.8 grey-white
    g = np.clip(0.35 * target + 0.65 * target * lum, 0, 1)
    px[:, 0] = g * 0.98; px[:, 1] = g * 0.97; px[:, 2] = g * 0.95
    img.pixels.foreach_set(px.ravel()); img.update()
    opt["hair_tint"] = "1,1,1"          # the colour is in the image now, not in a factor


def shrink_images():
    """Every texture at the size a figure a few metres away can use, and in the
    format its content needs: JPEG where there is no alpha (skin, cloth), PNG
    only where there is (hair, beard, lashes, brows). The exporter keeps each
    image's own format, so the images are re-saved before export."""
    import os, tempfile
    tmp = tempfile.mkdtemp(prefix="person-img-")
    ALPHA = ("hair", "short", "beard", "brow", "lash", "eye", "sigmund", "moustache")
    SMALL = ("beard", "brow", "lash", "eye", "sigmund", "moustache")
    # which material each image belongs to — the skin has transparent padding
    # outside its UV islands, and that is not a reason to ship it as PNG
    owner = {}
    for m in bpy.data.materials:
        if m.use_nodes:
            for nd in m.node_tree.nodes:
                if nd.type == "TEX_IMAGE" and nd.image:
                    owner.setdefault(nd.image.name, m.name.lower())
    # An opaque material must not feed its image's alpha to the shader: the
    # exporter sees the link and keeps the image as PNG to preserve an alpha
    # nobody will ever see (the skin went out as 885 kB of PNG for that).
    for m in bpy.data.materials:
        if not m.use_nodes or any(a in m.name.lower() for a in ALPHA):
            continue
        for bsdf in (nd for nd in m.node_tree.nodes if nd.type == "BSDF_PRINCIPLED"):
            for l in list(bsdf.inputs["Alpha"].links):
                m.node_tree.links.remove(l)
            bsdf.inputs["Alpha"].default_value = 1.0
            if m.name in ("Robe", "Girdle"):
                for l in list(bsdf.inputs["Roughness"].links):
                    m.node_tree.links.remove(l)
                bsdf.inputs["Roughness"].default_value = 0.9
    for img in list(bpy.data.images):
        if img.size[0] == 0 or img.users == 0:
            continue
        n = img.name.lower()
        # By CONTENT, not by name: an image keeps PNG only if some pixel is
        # actually transparent. Guessing from names left four PNGs that had
        # no transparency in them at all.
        mat = owner.get(img.name, "")
        keep_alpha = False
        if img.channels == 4 and any(a in mat for a in ALPHA):
            import numpy as np
            px = np.empty(len(img.pixels), dtype=np.float32)
            img.pixels.foreach_get(px)
            keep_alpha = bool((px[3::4] < 0.98).any())
        cap = 512 if any(k in n for k in ("normal", "roughness")) or any(k in mat for k in SMALL) else 1024
        w, h = img.size
        if max(w, h) > cap:
            k = cap / max(w, h)
            img.scale(max(1, int(w * k)), max(1, int(h * k)))
        ext = "png" if keep_alpha else "jpg"
        slug = "".join(c if c.isalnum() else "_" for c in img.name)[:48]
        path = os.path.join(tmp, f"{slug}.{ext}")
        img.filepath_raw = path
        img.file_format = "PNG" if keep_alpha else "JPEG"
        if not keep_alpha:
            bpy.context.scene.render.image_settings.quality = 85
        img.save()
        img.source = "FILE"
        img.reload()


def main():
    bb["opt"].update({k: opt[k] for k in ("gender", "age", "weight", "height", "muscle", "proportions")})
    bb["opt"].update({"rig": opt["rig"], "robe": opt["robe"]})
    face = {}
    for kv in filter(None, opt["face"].split(",")):
        k, v = kv.split("=")
        face[k.strip()] = float(v)
    body, rig = bb["make_body"](keep_helpers=True, face=face)

    # The likeness: skin, eyes, brows, lashes, hair, beard. GAMEENGINE materials
    # are plain image textures on a principled shader — what glTF, and so
    # three.js, can carry. The richer skin shaders do not survive export.
    HS.set_character_skin(find("skins", opt["skin"], "mhmat"), body, skin_type="GAMEENGINE")
    parts = []
    wired = []
    for sub, stem, kind in (("eyes", "high-poly", "Eyes"), ("eyebrows", opt["eyebrows"], "Eyebrows"),
                            ("eyelashes", opt["eyelashes"], "Eyelashes"), ("hair", opt["hair"], "Hair"),
                            ("clothes", opt["beard"] if opt["gender"] >= 0.5 else "none", "Clothes")):
        if stem and stem != "none":
            path = find(sub, stem)
            o = HS.add_mhclo_asset(path, body, asset_type=kind, material_type="GAMEENGINE", subdiv_levels=0)
            parts.append(o)
            if o is not None and kind != "Eyes":
                # only where MPFB left the material without a texture
                has_img = any(n.type == "TEX_IMAGE" and n.image for n in o.data.materials[0].node_tree.nodes) \
                    if o.data.materials and o.data.materials[0].use_nodes else False
                if not has_img and wire_texture(o, path):
                    wired.append(stem)

    bb["drop_helpers"](body)          # only now: the parts above were fitted by them
    # The robe is cut and DRAPED while the arms are still out (robe.py), then
    # the arms come down and the sleeves go with them.
    robe, sleeve_objs = (None, [])
    girdle = headcloth = None
    if opt["robe"] != "none":
        import robe as robe_mod
        tup = lambda k: tuple(float(x) for x in opt[k].split(","))
        robe, sleeve_objs = robe_mod.make_draped_robe(body, rig, fabric=opt.get("fabric", "Fabric036"),
                                                      tint=tup("robe_tint"))
        girdle = robe_mod.make_girdle(body, rig, tint=tup("girdle_tint"))
        sleeve_objs.append(girdle)
        if opt["mantle"] != "none":
            # the mantle: a sleeveless outer garment of rough hair-cloth to the
            # knee, standing a little off the robe — laid over it the same way
            mantle, _ = robe_mod.make_draped_robe(body, rig, fabric="Fabric019", tint=(0.34, 0.26, 0.18),
                                                  hem=0.30, pad=0.034, sleeves=False, name="Mantle")
            sleeve_objs.append(mantle)
    if opt["head"] in ("veil", "headcloth"):
        import robe as robe_mod
        headcloth = robe_mod.make_headcloth(
            body, rig, size=1.15 if opt["head"] == "veil" else 0.85,
            tint=(0.62, 0.52, 0.42) if opt["head"] == "veil" else (0.90, 0.86, 0.78),
            name="Veil" if opt["head"] == "veil" else "Headcloth",
            # a veil over a head with no hair asset comes down to the hairline
            brow=0.008 if opt["head"] == "veil" else 0.040)
        sleeve_objs.append(headcloth)
    bb["lower_arms"](body, rig)
    sleeves = None
    # Spring bones go in NOW: the rest pose is final (lower_arms has just made
    # it so) and no clip is keyed yet, so every clip is keyed onto the full
    # rig and the chains ride along at rest in all of them.
    if opt["springs"]:
        import springs as springs_mod
        beard_obj = next((o for o in parts if o is not None and "beard" in o.name.lower()), None)
        springs_mod.add_springs(body, rig, robe=robe, girdle=girdle, veil=headcloth, beard=beard_obj)

    for name in opt["clips"].split(","):
        ac.make_clip(rig, name, ac.CLIP_DEFS[name], ac.MIXAMO)
    for pb in rig.pose.bones:
        pb.rotation_mode = "QUATERNION"; pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)

    hair_obj = next((o for o in parts if o is not None and opt["hair"] in o.name), None)
    painted = paint_hairline(body, hair_obj) if opt["hair"] != "none" else False
    whiten_hair(hair_obj)
    shrink_images()
    bpy.ops.object.select_all(action="DESELECT")
    keep = [body, rig, robe] + sleeve_objs + [p for p in parts if p]
    for o in bpy.context.scene.objects:
        if o in keep or (o.type == "MESH" and o.parent == rig):
            o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True,
                              export_animations=True, export_animation_mode="NLA_TRACKS",
                              export_skins=True, export_yup=True,
                              # the spring bones' parameters and the colliders
                              # travel as custom properties → glTF extras
                              export_extras=True,
                              # NOT JPEG: hair, beards and brows are cards whose
                              # empty parts are transparent, and JPEG has no alpha —
                              # the first export drew every card solid, a helmet of
                              # hair over the face. AUTO keeps PNG where there is alpha.
                              export_image_format="AUTO")
    set_alpha_modes(OUT)
    print(f"PERSON {OUT}: skin {opt['skin']}, hair {opt['hair']}, beard {opt['beard']}, "
          f"textures wired by hand: {wired or 'none'}, hairline painted: {painted}, "
          f"{len([o for o in bpy.context.selected_objects if o.type == 'MESH'])} meshes, clips {opt['clips']}")


main()
