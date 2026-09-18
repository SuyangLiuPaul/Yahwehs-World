"""Colour a generated shape with photographs of it from several sides.

    blender -b --python tools/autorig/project_multiview.py -- shape.glb out.glb \
        --view front.png@0 --view left.png@90 --view back.png@180 --view right.png@270 \
        [--size 2048] [--power 4] [--bake-python /path/to/python]

The next step after project_photo.py. That script projects ONE photograph:
the front of the figure is photographic and the rest is a smear or a blur.
This one takes a photograph from each side, with the direction each was
taken from, and every surface takes the picture that saw it best — the front
photo on the face, the side photo on the ear and the sleeve, the back photo
on the back of the bonnet — blended where two pictures saw the same cloth.

TWO PROGRAMS, ON PURPOSE. Blender does what only Blender does well here:
imports the shape, lays out a real UV atlas (smart projection — islands of
the surface flattened, not the camera's projection, so the atlas stays valid
however the figure is later posed by bodyfit.py), and exports the GLB. The
picture work — finding the figure in each photo, fitting the silhouette,
depth-testing occlusion, blending, filling the unseen — is numpy over
images, and Blender's Python has neither PIL nor OpenCV. It is done by
mvbake.py under the Hunyuan venv's Python (the default for --bake-python,
because that is the environment the shape came out of), and handed back as
one PNG.

WHY NOT A DIFFUSION INPAINTER for the texels no photo saw. Those are the
armpits, the underside of the chin, the top of the head, the inside of a
cuff — a few per cent of the surface, all of it plain linen or skin in
shadow. Growing the neighbouring colour inward and softening it gives a
soft patch of the same cloth, which is what a viewer expects there. SDXL
inpainting (a 7 GB download, minutes per atlas on MPS) would invent
texture in places nobody looks and could just as well invent a seam. If a
future figure has a patterned back that is only half seen, that is the
time to reconsider; for a robe it is not worth it.
"""
import bpy, sys, os, math, subprocess
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:]
SHAPE, OUT = argv[0], argv[1]
opt = {"view": [], "size": "2048", "power": "8", "min-cos": "0.25", "side-min-cos": "0.5", "debug": False,
       "bake-python": os.path.expanduser("~/Documents/CodingProject/hunyuan3d/.venv/bin/python")}
i = 2
while i < len(argv):
    a = argv[i]
    if a in ("--debug", "--keep-interior"):
        opt[a[2:]] = True; i += 1; continue
    k = a[2:]; v = argv[i + 1]; i += 2
    if k == "view":
        opt["view"].append(v)
    else:
        opt[k] = v
if not opt["view"]:
    sys.exit("give at least one --view picture.png@yaw")
HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SHAPE)
    obs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in obs: o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    if len(obs) > 1: bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    me = ob.data
    # Hunyuan exports its figure facing +Z in glTF, which Blender imports as
    # facing -Y — the convention mvbake.py's yaw 0 assumes. (project_photo.py
    # learnt not to test this with the nose: the priest's bonnet reaches
    # further back than his nose does forward.)

    stem = OUT[:-4] if OUT.endswith(".glb") else OUT
    npz = stem + "_mesh.npz"; atlas = stem + "_atlas.png"; interior = stem + "_interior.npy"

    def mesh_arrays():
        V = np.array([v.co[:] for v in me.vertices], np.float32)
        F, UV = [], []
        uvl = me.uv_layers.active
        for p in me.polygons:
            li = list(p.loop_indices)
            for k in range(1, len(li) - 1):
                tri = (li[0], li[k], li[k + 1])
                F.append([me.loops[j].vertex_index for j in tri])
                UV.append([uvl.data[j].uv[:] if uvl else (0, 0) for j in tri])
        return V, np.array(F, np.int32), np.array(UV, np.float32)

    # THE INSIDE OF THE ROBE. Hunyuan's figure is a solid with the legs and
    # the inner wall of the skirt inside it — a sixth of the surface that no
    # camera can see. mvbake finds those faces (seen from none of 26
    # directions) and they are deleted before the atlas is laid out, so the
    # atlas is spent on what shows. (Triangles only, so face indices match.)
    V, F, _ = mesh_arrays()
    np.savez(npz, V=V, F=F, UV=np.zeros((len(F), 3, 2), np.float32))
    if opt.get("keep-interior"):
        dead = np.zeros(0, np.int32); np.save(interior, dead)
    else:
        subprocess.run([opt["bake-python"], os.path.join(HERE, "mvbake.py"), "cull", npz, interior], check=True)
        dead = np.load(interior)
    if len(dead):
        import bmesh
        bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[bm.faces[i] for i in dead], context="FACES")
        bm.to_mesh(me); bm.free(); me.update()
    print(f"CULL: {len(dead):,} interior faces removed, {len(me.polygons):,} left", flush=True)

    # A REAL ATLAS. Smart projection: the surface is cut into islands by
    # normal, each island laid flat. The photo pixels are looked up per
    # texel by the bake; nothing about the layout depends on the cameras,
    # so rigging and posing leave the texture where it belongs.
    for l in list(me.uv_layers):
        me.uv_layers.remove(l)
    uv = me.uv_layers.new(name="atlas"); me.uv_layers.active = uv
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    # 80°, not the default 66°: on a 40k-triangle generated surface the
    # default cut the crown of the atlas into thousands of confetti islands
    # and left the atlas 44 % covered. Fewer, bigger islands are more
    # distorted, which the per-texel bake does not mind, and have fewer seams
    # for the renderer's filtering to show.
    bpy.ops.uv.smart_project(angle_limit=math.radians(80), island_margin=0.002,
                             area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    me.uv_layers.active = me.uv_layers["atlas"]   # the edit-mode round trip rebuilt the mesh data; old handles are stale

    # Hand the mesh to the bake: triangles only (the smart projection keeps
    # whatever the shape had; Hunyuan's output is triangles already, but a
    # quad would be split here the same way the exporter splits it).
    V, F, UV = mesh_arrays()
    np.savez(npz, V=V, F=F, UV=UV)

    cmd = [opt["bake-python"], os.path.join(HERE, "mvbake.py"), "bake", npz, atlas,
           "--size", opt["size"], "--power", opt["power"], "--min-cos", opt["min-cos"],
           "--side-min-cos", opt["side-min-cos"]]
    for v in opt["view"]:
        cmd += ["--view", v]
    if opt["debug"]:
        cmd.append("--debug")
    print("BAKE:", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True)

    A = bpy.data.images.load(atlas)
    mat = bpy.data.materials.new("Photo"); mat.use_nodes = True
    nt = mat.node_tree; bsdf = next(nd for nd in nt.nodes if nd.type == "BSDF_PRINCIPLED")
    t = nt.nodes.new("ShaderNodeTexImage"); t.image = A
    nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.85
    bsdf.inputs["Specular IOR Level"].default_value = 0.15
    me.materials.clear(); me.materials.append(mat)
    for p in me.polygons: p.use_smooth = True
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_image_format="JPEG", export_jpeg_quality=90)
    if not opt["debug"]:
        os.remove(npz); os.remove(interior)
    print(f"PROJECT_MULTIVIEW {OUT}: {len(F):,} triangles, {len(opt['view'])} views "
          f"({', '.join(v.rsplit('@', 1)[1] + '°' for v in opt['view'])}), atlas {atlas}")


main()
