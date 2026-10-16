#!/usr/bin/env python3
"""
Gemini 4 Argon Pagoda-Style Headless Blender Generator for Noah's Ark (Round 2 Critique Refined)
- Prominent multi-tier turquoise waterfall & mossy terraced cliffs at x = -18.5..24, z = -4..-13
- Warm limestone distant citadel on green mountain terrace at x = 22.5, z = -15.5 (no raw grey boxes)
- 3.0m–3.2m vertical deck clearance on the 3-Deck Cutaway Ark (Deck 1 y=1.25, Deck 2 y=4.45, Deck 3 y=7.45, Roof y=10.45)
"""

import bpy
import bmesh
import pathlib

OUT_DIR = pathlib.Path("/Users/pliu0036/Documents/CodingProject/yahwehs-globe/public/models/ark")
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUT_GLB = OUT_DIR / "ark-pagoda-environment.glb"


def srgb(r: float, g: float, b: float, a: float = 1.0) -> tuple:
    return (pow(r, 2.2), pow(g, 2.2), pow(b, 2.2), a)


def reset_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for me in list(bpy.data.meshes):
        if me.users == 0:
            bpy.data.meshes.remove(me)
    for mat in list(bpy.data.materials):
        if mat.users == 0:
            bpy.data.materials.remove(mat)


def make_mat(name: str, rgba_srgb: tuple, roughness: float = 0.85, metallic: float = 0.0, emission_srgb: tuple = None, emission_strength: float = 0.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = srgb(*rgba_srgb)
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if "Specular IOR Level" in bsdf.inputs:
            bsdf.inputs["Specular IOR Level"].default_value = 0.2
        if emission_srgb and "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = srgb(*emission_srgb)
            bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


def create_parent(name: str) -> bpy.types.Object:
    empty = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(empty)
    return empty


def add_bevelled_box(name: str, parent: bpy.types.Object, size: tuple, loc: tuple, mat: bpy.types.Material, rot: tuple = (0.0, 0.0, 0.0), bevel_width: float = 0.04):
    sx, sy, sz = size
    lx, ly, lz = loc
    rx, ry, rz = rot

    me = bpy.data.meshes.new(name + "_mesh")
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= sx
        v.co.y *= sz
        v.co.z *= sy
    bmesh.ops.bevel(
        bm,
        geom=list(bm.verts) + list(bm.edges),
        offset=min(bevel_width, min(sx, sy, sz) * 0.22),
        segments=2,
        profile=0.5,
        affect='EDGES',
    )
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True

    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(mat)
    ob.location = (lx, -lz, ly)
    ob.rotation_euler = (rx, -rz, ry)
    ob.parent = parent
    bpy.context.scene.collection.objects.link(ob)
    return ob


def build_all():
    reset_scene()

    m_grass_top = make_mat("GrassTop", (0.37, 0.54, 0.19, 1.0), roughness=0.90)
    m_grass_terrace = make_mat("GrassTerrace", (0.31, 0.47, 0.16, 1.0), roughness=0.92)
    m_grass_warm = make_mat("GrassWarm", (0.45, 0.60, 0.23, 1.0), roughness=0.88)
    m_cliff_stone = make_mat("CliffStone", (0.45, 0.43, 0.38, 1.0), roughness=0.88)
    m_cliff_dark = make_mat("CliffDark", (0.35, 0.33, 0.28, 1.0), roughness=0.92)
    m_cobble_path = make_mat("CobblePath", (0.76, 0.65, 0.44, 1.0), roughness=0.86)
    m_cobble_trim = make_mat("CobbleTrim", (0.65, 0.53, 0.34, 1.0), roughness=0.88)
    m_water_deep = make_mat("WaterDeep", (0.16, 0.54, 0.74, 1.0), roughness=0.18, metallic=0.08)
    m_water_fall = make_mat("WaterFall", (0.35, 0.76, 0.92, 1.0), roughness=0.15, metallic=0.04, emission_srgb=(0.30, 0.68, 0.88, 1.0), emission_strength=0.22)
    m_water_foam = make_mat("WaterFoam", (0.92, 0.97, 1.00, 1.0), roughness=0.35, emission_srgb=(0.85, 0.94, 1.0, 1.0), emission_strength=0.28)

    m_pitch_hull = make_mat("GopherPitchHull", (0.24, 0.14, 0.08, 1.0), roughness=0.72)
    m_gopher_dark = make_mat("GopherDark", (0.38, 0.22, 0.11, 1.0), roughness=0.78)
    m_gopher_mid = make_mat("GopherMid", (0.52, 0.31, 0.15, 1.0), roughness=0.76)
    m_gopher_warm = make_mat("GopherWarm", (0.64, 0.40, 0.19, 1.0), roughness=0.74)
    m_gopher_gold = make_mat("GopherGold", (0.76, 0.52, 0.24, 1.0), roughness=0.68)
    m_hay_bed = make_mat("HayBedding", (0.82, 0.64, 0.22, 1.0), roughness=0.92)
    m_citadel_wall = make_mat("CitadelStone", (0.78, 0.68, 0.52, 1.0), roughness=0.84)
    m_citadel_roof = make_mat("CitadelRoof", (0.60, 0.41, 0.25, 1.0), roughness=0.80)
    m_window_glow = make_mat("ClerestoryGlow", (1.0, 0.84, 0.42, 1.0), roughness=0.25, emission_srgb=(1.0, 0.78, 0.32, 1.0), emission_strength=1.2)

    # 1. ENV_VALLEY_TERRAIN
    env_terrain = create_parent("Env_ValleyTerrain")
    add_bevelled_box("MainMeadow", env_terrain, (96.0, 0.8, 80.0), (0.0, -0.4, 2.0), m_grass_top, bevel_width=0.12)
    add_bevelled_box("LowerEarthBase", env_terrain, (100.0, 2.4, 84.0), (0.0, -1.9, 2.0), m_cliff_dark, bevel_width=0.18)

    add_bevelled_box("LeftPenEarth", env_terrain, (10.5, 0.06, 14.5), (-10.8, 0.01, 11.2), m_grass_warm, bevel_width=0.02)
    add_bevelled_box("RightPenEarth", env_terrain, (10.5, 0.06, 13.5), (10.8, 0.01, 12.2), m_grass_warm, bevel_width=0.02)

    # Lush green terraced hills framing the valley (every cliff has a green grass cap so no grey box top shows!)
    for i, (x, y, z, sx, sy, sz) in enumerate([
        (-22.5, 1.4, -7.5, 14.0, 2.8, 20.0),
        (-24.5, 3.8, -10.5, 12.0, 3.2, 16.0),
        (-26.0, 6.4, -13.0, 10.5, 3.0, 13.0),
        (23.5, 1.2, -8.5, 15.0, 2.4, 20.0),
        (25.5, 3.2, -12.5, 12.5, 2.8, 16.0),
        (26.5, 5.2, -15.5, 10.0, 2.6, 12.0),
        (0.0, 1.1, -20.5, 48.0, 2.2, 12.0),
    ]):
        add_bevelled_box(f"HillTerrace_{i}", env_terrain, (sx, sy, sz), (x, y, z), m_grass_terrace if i % 2 == 0 else m_grass_top, bevel_width=0.18)

    # Sculpted cliff faces along the left waterfall gorge (capped by the green terraces above)
    cliff_blocks = [
        (-19.2, 2.0, -7.2, 4.2, 3.8, 5.5),
        (-20.8, 4.2, -9.5, 4.5, 4.4, 5.5),
        (-17.8, 1.4, -9.8, 3.8, 2.8, 4.5),
        (20.5, 1.8, -11.5, 4.5, 3.2, 5.5),
    ]
    for i, (x, y, z, sx, sy, sz) in enumerate(cliff_blocks):
        add_bevelled_box(f"CliffBlock_{i}", env_terrain, (sx, sy, sz), (x, y, z), m_cliff_stone if i % 2 == 0 else m_cliff_dark, bevel_width=0.22)
        # Mossy green cap on top of each cliff block
        add_bevelled_box(f"CliffCap_{i}", env_terrain, (sx + 0.3, 0.45, sz + 0.3), (x, y + sy * 0.5 + 0.15, z), m_grass_terrace, bevel_width=0.10)

    # Central Cobblestone Boarding Avenue (z = 3.5 to 26.0)
    add_bevelled_box("AvenueBase", env_terrain, (10.2, 0.07, 24.0), (0.0, 0.015, 14.5), m_cobble_path, bevel_width=0.02)
    for row in range(12):
        z = 4.2 + row * 1.85
        add_bevelled_box(f"CurbL_{row}", env_terrain, (0.60, 0.13, 1.40), (-5.1, 0.055, z), m_cobble_trim, bevel_width=0.03)
        add_bevelled_box(f"CurbR_{row}", env_terrain, (0.60, 0.13, 1.40), (5.1, 0.055, z), m_cobble_trim, bevel_width=0.03)
        for col in range(-2, 3):
            ox = col * 1.80 + (0.32 if row % 2 else -0.32)
            add_bevelled_box(f"Cobble_{row}_{col}", env_terrain, (1.42, 0.085, 1.32), (ox, 0.03, z), m_cobble_trim if (row + col) % 2 == 0 else m_cobble_path, bevel_width=0.03)

    # 2. ENV_WATERFALL_RIVER (Clearly visible on left cliff at x = -18.5..-20.5, z = -4..-10)
    env_water = create_parent("Env_WaterfallRiver")
    add_bevelled_box("UpperStream", env_water, (3.2, 0.25, 5.0), (-20.2, 6.5, -10.2), m_water_deep, bevel_width=0.05)
    add_bevelled_box("FallTier1", env_water, (2.8, 3.4, 0.85), (-19.4, 4.9, -7.4), m_water_fall, bevel_width=0.06)
    add_bevelled_box("FallTier2", env_water, (3.1, 3.1, 0.95), (-18.4, 2.0, -6.0), m_water_fall, bevel_width=0.06)
    for i, (x, y, z, sx, sy, sz) in enumerate([
        (-19.4, 6.55, -7.5, 3.0, 0.34, 0.9),
        (-18.8, 3.45, -6.5, 3.3, 0.38, 1.1),
        (-18.0, 0.22, -5.0, 4.4, 0.30, 2.4),
        (-17.4, 0.16, -3.4, 3.4, 0.20, 1.8),
    ]):
        add_bevelled_box(f"WaterfallFoam_{i}", env_water, (sx, sy, sz), (x, y, z), m_water_foam, bevel_width=0.08)
    add_bevelled_box("PlungePool", env_water, (6.5, 0.12, 7.5), (-18.0, 0.04, -3.2), m_water_deep, bevel_width=0.04)
    add_bevelled_box("ValleyStream1", env_water, (4.2, 0.10, 13.0), (-19.2, 0.03, 5.5), m_water_deep, rot=(0.0, 0.12, 0.0), bevel_width=0.04)

    # 3. ENV_DISTANT_CITADEL (Warm sunlit limestone citadel on top-right green hill)
    env_citadel = create_parent("Env_DistantCitadel")
    cx, cy, cz = 24.5, 6.6, -15.5
    add_bevelled_box("CitadelBaseWall", env_citadel, (7.2, 1.8, 4.5), (cx, cy, cz), m_citadel_wall, bevel_width=0.08)
    add_bevelled_box("CitadelKeep", env_citadel, (3.2, 3.2, 2.8), (cx - 1.0, cy + 2.0, cz - 0.3), m_citadel_wall, bevel_width=0.08)
    add_bevelled_box("CitadelKeepRoof", env_citadel, (3.6, 0.6, 3.2), (cx - 1.0, cy + 3.8, cz - 0.3), m_citadel_roof, bevel_width=0.06)
    add_bevelled_box("CitadelTowerL", env_citadel, (1.7, 3.8, 1.7), (cx - 3.4, cy + 2.1, cz + 0.9), m_citadel_wall, bevel_width=0.06)
    add_bevelled_box("CitadelTowerLRoof", env_citadel, (2.0, 0.55, 2.0), (cx - 3.4, cy + 4.1, cz + 0.9), m_citadel_roof, bevel_width=0.05)
    add_bevelled_box("CitadelTowerR", env_citadel, (1.9, 3.5, 1.9), (cx + 2.0, cy + 1.9, cz + 0.6), m_citadel_wall, bevel_width=0.06)
    add_bevelled_box("CitadelTowerRRoof", env_citadel, (2.2, 0.55, 2.2), (cx + 2.0, cy + 3.8, cz + 0.6), m_citadel_roof, bevel_width=0.05)

    # 4. ARK_HULL_CUTAWAY (3.0m-3.2m clear headroom per deck: Deck 1 y=1.25, Deck 2 y=4.45, Deck 3 y=7.45, Roof y=10.45)
    ark_z = -6.2
    ark_hull = create_parent("Ark_HullCutaway")

    for kx in range(-14, 15, 2):
        add_bevelled_box(f"KeelSleeper_{kx}", ark_hull, (0.55, 0.50, 9.8), (float(kx), 0.25, ark_z), m_gopher_dark, bevel_width=0.05)
    add_bevelled_box("MainKeelSpine", ark_hull, (31.5, 0.55, 1.2), (0.0, 0.50, ark_z), m_pitch_hull, bevel_width=0.06)
    add_bevelled_box("PitchedBilgeHull", ark_hull, (30.8, 0.75, 9.2), (0.0, 0.90, ark_z), m_pitch_hull, bevel_width=0.10)

    back_z = ark_z - 4.55
    for row in range(16):
        py = 1.35 + row * 0.58
        mat_row = [m_gopher_dark, m_gopher_mid, m_gopher_warm, m_pitch_hull][row % 4]
        add_bevelled_box(f"BackHullPlank_{row}", ark_hull, (30.4, 0.54, 0.28), (0.0, py, back_z), mat_row, bevel_width=0.04)

    for side_x, sign in [("BowL", -1.0), ("SternR", 1.0)]:
        for step in range(6):
            sy_base = 1.3 + step * 1.50
            out_x = sign * (15.2 + step * 0.36)
            add_bevelled_box(f"{side_x}_ProwPost_{step}", ark_hull, (0.95, 1.55, 8.8 - step * 0.35), (out_x, sy_base + 0.65, ark_z), m_gopher_gold if step == 5 else m_gopher_mid, bevel_width=0.06)
        add_bevelled_box(f"{side_x}_HornStem", ark_hull, (0.85, 3.2, 0.95), (sign * 16.9, 10.5, ark_z), m_gopher_gold, rot=(0.0, 0.0, -sign * 0.18), bevel_width=0.06)

    front_z = ark_z + 4.55
    for idx, rx in enumerate(range(-14, 15, 4)):
        add_bevelled_box(f"BackRib_{idx}", ark_hull, (0.38, 9.2, 0.42), (float(rx), 5.8, back_z + 0.15), m_gopher_dark, bevel_width=0.04)
        if abs(rx) >= 2:
            add_bevelled_box(f"FrontCutawayRib_{idx}", ark_hull, (0.34, 9.0, 0.36), (float(rx), 5.7, front_z), m_gopher_gold if abs(rx) == 2 else m_gopher_dark, bevel_width=0.04)

    add_bevelled_box("SideDoorThreshold", ark_hull, (3.6, 0.32, 0.95), (0.0, 1.32, front_z + 0.25), m_gopher_gold, bevel_width=0.05)
    add_bevelled_box("SideDoorLintel", ark_hull, (3.8, 0.38, 0.55), (0.0, 4.35, front_z + 0.08), m_gopher_gold, bevel_width=0.05)

    # 5. THREE INTERNAL DECKS (Deck 1 y=1.25, Deck 2 y=4.45, Deck 3 y=7.45)
    deck_specs = [
        (1, "Ark_Deck1", 1.25),
        (2, "Ark_Deck2", 4.45),
        (3, "Ark_Deck3", 7.45),
    ]
    for level, dname, dy in deck_specs:
        d_parent = create_parent(dname)
        for p_idx in range(-15, 16):
            px = p_idx * 0.98
            p_mat = [m_gopher_mid, m_gopher_warm, m_gopher_dark][p_idx % 3]
            add_bevelled_box(f"D{level}_FloorPlank_{p_idx}", d_parent, (0.94, 0.22, 8.9), (px, dy, ark_z), p_mat, bevel_width=0.025)
        add_bevelled_box(f"D{level}_FrontBeam", d_parent, (30.6, 0.28, 0.32), (0.0, dy + 0.14, front_z), m_gopher_gold, bevel_width=0.03)
        add_bevelled_box(f"D{level}_BackBeam", d_parent, (30.6, 0.28, 0.32), (0.0, dy + 0.14, back_z), m_gopher_gold, bevel_width=0.03)

        for rx in [-11.5, -6.0, 6.0, 11.5]:
            add_bevelled_box(f"D{level}_FrontRail_{rx}", d_parent, (4.4, 0.14, 0.16), (rx, dy + 0.68, front_z), m_gopher_warm, bevel_width=0.02)

        stall_xs = [-10.0, -5.0, 5.0, 10.0]
        for sx in stall_xs:
            add_bevelled_box(f"D{level}_StallWall_{sx}", d_parent, (0.22, 1.75, 3.4), (sx, dy + 0.98, ark_z - 2.5), m_gopher_mid, bevel_width=0.03)
            add_bevelled_box(f"D{level}_StallPost_{sx}", d_parent, (0.28, 2.85, 0.28), (sx, dy + 1.52, ark_z - 0.8), m_gopher_dark, bevel_width=0.03)
            add_bevelled_box(f"D{level}_HayBed_{sx}", d_parent, (3.4, 0.10, 2.5), (sx + (2.2 if sx < 0 else -2.2), dy + 0.14, ark_z - 2.7), m_hay_bed, bevel_width=0.03)
            add_bevelled_box(f"D{level}_Trough_{sx}", d_parent, (1.6, 0.38, 0.50), (sx + (2.2 if sx < 0 else -2.2), dy + 0.28, ark_z - 1.3), m_gopher_warm, bevel_width=0.03)

        if level < 3:
            ramp_x = -2.2 if level == 1 else 2.2
            add_bevelled_box(
                f"D{level}_InternalRamp",
                d_parent,
                (4.0, 0.18, 1.35),
                (ramp_x, dy + 1.55, ark_z - 3.3),
                m_gopher_gold,
                rot=(0.0, 0.0, 0.62 if level == 1 else -0.62),
                bevel_width=0.03,
            )

    # 6. ARK_ROOF_CLERESTORY (y = 10.45)
    ark_roof = create_parent("Ark_RoofClerestory")
    roof_y = 10.45
    add_bevelled_box("RoofSlope_Back", ark_roof, (31.2, 0.26, 3.6), (0.0, roof_y + 0.35, ark_z - 2.9), m_gopher_warm, rot=(-0.22, 0.0, 0.0), bevel_width=0.04)
    add_bevelled_box("RoofSlope_Front", ark_roof, (31.2, 0.26, 2.4), (0.0, roof_y + 0.25, ark_z + 3.4), m_gopher_warm, rot=(0.22, 0.0, 0.0), bevel_width=0.04)

    clerestory_y = roof_y + 0.85
    for cx_post in range(-13, 14, 2):
        add_bevelled_box(f"ClerestoryPostF_{cx_post}", ark_roof, (0.22, 0.68, 0.22), (float(cx_post), clerestory_y, ark_z + 1.45), m_gopher_gold, bevel_width=0.02)
        add_bevelled_box(f"ClerestoryPostB_{cx_post}", ark_roof, (0.22, 0.68, 0.22), (float(cx_post), clerestory_y, ark_z - 1.45), m_gopher_gold, bevel_width=0.02)
        if cx_post < 13:
            add_bevelled_box(f"ClerestoryLightPane_{cx_post}", ark_roof, (1.65, 0.42, 0.08), (float(cx_post) + 1.0, clerestory_y, ark_z + 1.45), m_window_glow, bevel_width=0.01)

    add_bevelled_box("ClerestoryCrownCap", ark_roof, (29.2, 0.32, 3.4), (0.0, clerestory_y + 0.45, ark_z), m_gopher_dark, bevel_width=0.05)
    add_bevelled_box("ClerestoryRidgeBeam", ark_roof, (29.8, 0.28, 0.45), (0.0, clerestory_y + 0.68, ark_z), m_gopher_gold, bevel_width=0.04)

    bpy.context.view_layer.update()
    bpy.ops.export_scene.gltf(
        filepath=str(OUT_GLB),
        export_format="GLB",
        use_selection=False,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
    )
    print(f"Exported {OUT_GLB} ({OUT_GLB.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    build_all()
