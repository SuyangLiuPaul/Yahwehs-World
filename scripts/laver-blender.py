"""Original mesh authored for Higgsfield 3D Jutsu, Blender 5.2, metre units.
Exodus 30:18 specifies bronze basin + stand but no dimensions/profile.
All dimensions and concentric rim ornament here are display reconstruction.
No catalog assets, copied reconstruction, imagery or procedural-only shader.
"""
import bpy, math, random
from mathutils import Vector
random.seed(3018)
scene=bpy.context.scene
root=bpy.data.objects.new('Laver_Exodus30_18',None)
scene.collection.objects.link(root)
root['reference']='Exodus 30:18; 38:8'
root['interpretation']='Bronze basin and stand stated. Profile, height 0.95m, diameter 1.04m and ornament illustrative; not archaeological.'
def material(name,color,metal,rough):
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    return m
bronze=material('Bronze • warm worked alloy',(.44,.235,.092),.92,.32)
edge=material('Polished rolled bronze edges',(.63,.38,.15),.95,.24)
dark=material('Recessed bronze',(.20,.095,.035),.9,.43)
water=material('Illustrative still wash water',(.065,.16,.18),.35,.17)
def lathe(name,profile,mat,segments=96,hammer=False):
    vertices=[];faces=[]
    for j,(r,z) in enumerate(profile):
        for i in range(segments):
            a=math.tau*i/segments
            h=(math.sin(a*23+j*.9)*math.sin(j*1.9)*.0006) if hammer else 0
            vertices.append(((r+h)*math.cos(a),(r+h)*math.sin(a),z))
    for j in range(len(profile)-1):
        for i in range(segments):
            a=j*segments+i;b=j*segments+(i+1)%segments
            faces.append((a,b,b+segments,a+segments))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);scene.collection.objects.link(o);o.parent=root
    o.data.materials.append(mat)
    for p in mesh.polygons:p.use_smooth=True
    return o
lathe('Basin • continuous thick inner and outer wall',[
 (.001,.65),(.18,.65),(.25,.66),(.32,.69),(.39,.735),(.445,.79),(.486,.855),(.512,.914),
 (.519,.936),(.516,.946),(.505,.949),(.493,.945),(.483,.926),(.463,.875),(.425,.82),
 (.37,.764),(.30,.717),(.23,.692),(.15,.686),(.001,.686)],bronze,hammer=True)
lathe('Stand • foot stem and support',[(.001,0),(.28,0),(.30,.012),(.30,.027),(.284,.043),(.23,.057),
 (.20,.082),(.158,.13),(.103,.22),(.084,.32),(.087,.45),(.107,.525),(.17,.59),(.25,.628),(.255,.65),(.001,.65)],bronze)
def ring(name,r,z,thick,mat):
    profile=[(r+thick*math.cos(math.tau*j/12),z+thick*math.sin(math.tau*j/12)) for j in range(13)]
    return lathe(name,profile,mat)
ring('Rolled lip',.508,.94,.009,edge)
ring('Under-rim raised bead',.485,.857,.004,edge)
ring('Under-rim recessed band',.477,.84,.003,dark)
ring('Stand foot rolled rim',.293,.032,.005,edge)
ring('Stem collar lower',.089,.27,.005,edge)
ring('Stem collar upper',.107,.524,.006,edge)
lathe('Water • removable interpretive surface',[(.001,.806),(.412,.806)],water)
# Neutral product camera, motivated sun plus two portable studio fills. These
# are a review rig only; the app imports the Laver root, not these lights.
def light(name,kind,loc,energy,color):
    data=bpy.data.lights.new(name,kind);data.energy=energy;data.color=color
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=loc
    o.rotation_euler=(Vector((0,0,.5))-o.location).to_track_quat('-Z','Y').to_euler()
    return o
key=light('Review sunlight','SUN',(3,-4,5),2.2,(1,.88,.72));key.data.angle=.12
light('Review soft fill','POINT',(-2,-2,2),150,(.63,.78,1)).data.shadow_soft_size=1.2
light('Review rim','POINT',(1,2,3),220,(1,.88,.70)).data.shadow_soft_size=1
if scene.world is None: scene.world=bpy.data.worlds.new('Review ambient')
scene.world.color=(.24,.24,.24)
camdata=bpy.data.cameras.new('Delivery camera');cam=bpy.data.objects.new('Delivery camera',camdata)
scene.collection.objects.link(cam);cam.location=(1.5,-2.1,1.55)
cam.rotation_euler=(Vector((0,0,.48))-cam.location).to_track_quat('-Z','Y').to_euler();camdata.lens=56
scene.camera=cam;scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=900;scene.render.resolution_y=900;scene.render.resolution_percentage=100
scene.render.image_settings.media_type='IMAGE';scene.render.image_settings.file_format='PNG'
target=artifacts.file(name='laver-review.png',media_type='image/png')
scene.render.filepath=target.path;bpy.ops.render.render(write_still=True);target.publish()
result={'root':root.name,'heightMetres':.958,'diameterMetres':1.04,
 'meshes':len(root.children),'triangles':sum(len(o.data.polygons)*2 for o in root.children),
 'assumptions':root['interpretation']}
