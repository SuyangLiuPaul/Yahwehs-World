"""Put a painted surface back onto a rigged figure.

    blender -b --python tools/autorig/dress.py -- rigged.glb painted.obj out.glb

The painter re-unwraps the mesh it paints, so what comes back is the same
surface with new UVs and no rig. Rather than re-rig it, the UVs are carried
back: every rigged mesh takes its face-corner UVs from the painted surface
lying exactly on top of it (Data Transfer, nearest face), and the painted
material replaces its own. The rig, the weights and every clip are untouched.
"""
import bpy, sys
argv = sys.argv[sys.argv.index("--") + 1:]
RIGGED, PAINTED, OUT = argv[:3]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=RIGGED)
rigged = [o for o in bpy.context.scene.objects if o.type == "MESH"]
rig = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
before = set(bpy.context.scene.objects)
bpy.ops.wm.obj_import(filepath=PAINTED, forward_axis="NEGATIVE_Z", up_axis="Y")
painted = [o for o in bpy.context.scene.objects if o not in before and o.type == "MESH"]
src = painted[0]
if len(painted) > 1:
    bpy.ops.object.select_all(action="DESELECT")
    for o in painted: o.select_set(True)
    bpy.context.view_layer.objects.active = painted[0]
    bpy.ops.object.join()
    src = bpy.context.view_layer.objects.active
mat = src.data.materials[0]

for ob in rigged:
    bpy.context.view_layer.objects.active = ob
    # the transfer must see the rest pose, not a frame of a clip
    for m in ob.modifiers:
        if m.type == "ARMATURE":
            m.show_viewport = False
    if not ob.data.uv_layers:
        ob.data.uv_layers.new(name="UVMap")
    dt = ob.modifiers.new("uvt", "DATA_TRANSFER")
    dt.object = src
    dt.use_loop_data = True
    dt.data_types_loops = {"UV"}
    dt.loop_mapping = "POLYINTERP_NEAREST"
    bpy.ops.object.modifier_move_to_index(modifier="uvt", index=0)
    bpy.ops.object.modifier_apply(modifier="uvt")
    for m in ob.modifiers:
        if m.type == "ARMATURE":
            m.show_viewport = True
    ob.data.materials.clear()
    ob.data.materials.append(mat)

bpy.data.objects.remove(src)
bpy.ops.object.select_all(action="SELECT")
# Re-imported clips arrive as actions, not NLA tracks: export every action.
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_animations=True,
                          export_animation_mode="ACTIONS", export_skins=True, export_yup=True)
print(f"DRESS {OUT}: {len(rigged)} meshes took the painted surface; rig {rig.name} kept")
