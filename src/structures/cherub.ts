import * as THREE from 'three';

/** Original interpretive goldwork. Exodus 25:18–20 specifies two figures,
 * inward/downward faces and wings above the cover, NOT their anatomy, dress,
 * posture, dimensions or feather pattern. Never an excavated replica. */
export function buildCherub(scale:number,material:THREE.Material){
  const g=new THREE.Group();
  const oval=(x:number,y:number,z:number,rx:number,ry:number,rz:number)=>{
    const geo=new THREE.SphereGeometry(1,24,16);geo.scale(rx,ry,rz);
    const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);g.add(m);return m;
  };
  const tube=(points:THREE.Vector3[],radius:number)=>{
    const curve=new THREE.CatmullRomCurve3(points);
    const m=new THREE.Mesh(new THREE.TubeGeometry(curve,24,radius,8,false),material);g.add(m);return m;
  };
  // Continuous tapered torso/robe, rather than separately stacked ellipsoids.
  const sections=[[0,.035,.095,.125],[.04,.035,.13,.14],[.12,.004,.104,.12],
    [.23,-.012,.064,.084],[.32,.004,.064,.093],[.39,.018,.064,.113],[.425,.024,.046,.068]];
  const p:number[]=[],uv:number[]=[],ix:number[]=[];
  for(let j=0;j<sections.length;j++)for(let k=0;k<=40;k++){
    const [y,x,rx,rz]=sections[j]!,a=k/40*Math.PI*2;
    const folds=1+(1-y!/.5)*(.028*Math.cos(a*9)+.018*Math.sin(a*17));
    p.push(x!+Math.cos(a)*rx!*folds,y!,Math.sin(a)*rz!*folds);uv.push(k/40,y!*2);
    if(j<sections.length-1&&k<40){const q=j*41+k;ix.push(q,q+41,q+1,q+1,q+41,q+42);}
  }
  const robe=new THREE.BufferGeometry();robe.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  robe.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));robe.setIndex(ix);robe.computeVertexNormals();g.add(new THREE.Mesh(robe,material));
  oval(.075,.057,.085,.093,.051,.054);oval(.075,.057,-.085,.093,.051,.054);
  oval(.03,.442,0,.037,.045,.039);
  const head=oval(.065,.502,0,.056,.078,.054);head.rotation.z=.28;
  oval(.111,.506,0,.014,.042,.042).rotation.z=.28;
  oval(.129,.490,0,.017,.022,.012).rotation.z=.2;
  for(const side of [-1,1]){
    tube([new THREE.Vector3(.008,.397,side*.091),new THREE.Vector3(.036,.335,side*.127),
      new THREE.Vector3(.116,.258,side*.09),new THREE.Vector3(.161,.20,side*.063)],.021);
    oval(.157,.20,side*.059,.032,.020,.023);
    // Primaries trail from separate attachment points along a curved leading
    // edge, giving a wing silhouette rather than a flat triangular fan.
    const arm=new THREE.CubicBezierCurve3(new THREE.Vector3(-.025,.38,side*.084),
      new THREE.Vector3(.02,.65,side*.21),new THREE.Vector3(.38,.90,side*.23),new THREE.Vector3(.66,.86,side*.11));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(arm,40,.013,8,false),material));
    for(let row=0;row<2;row++)for(let i=0;i<22;i++){
      const t=.02+i*.96/21,root=arm.getPoint(t);
      root.y-=row*.016;root.z+=side*row*.012;
      const length=(.12+.18*Math.sin(t*Math.PI))*(row?.47:1);
      const end=root.clone().add(new THREE.Vector3(-length*(.65-t*.95),-length*(1-t*.7),side*length*.32));
      const middle=root.clone().lerp(end,.55);middle.z+=side*.018;
      const curve=new THREE.QuadraticBezierCurve3(root,middle,end);
      const verts:number[]=[],tex:number[]=[],faces:number[]=[];
      for(let j=0;j<=14;j++){
        const f=j/14,c=curve.getPoint(f),tan=curve.getTangent(f),width=.036*Math.sin(Math.PI*f)**.65*(row?.85:1);
        const n=new THREE.Vector3(-tan.y,tan.x,0).normalize();
        for(const k of [-1,0,1]){
          verts.push(c.x+n.x*width*k,c.y+n.y*width*k,c.z+side*width*(1-Math.abs(k))*.3);
          tex.push(f,k/2+.5);
        }
      }
      for(let j=0;j<14;j++)for(let k=0;k<2;k++){const a=j*3+k;faces.push(a,a+3,a+1,a+1,a+3,a+4);}
      const feather=new THREE.BufferGeometry();feather.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
      feather.setAttribute('uv',new THREE.Float32BufferAttribute(tex,2));feather.setIndex(faces);feather.computeVertexNormals();
      g.add(new THREE.Mesh(feather,material));
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve,12,.0015,4,false),material));
    }
  }
  g.scale.setScalar(scale);return g;
}
