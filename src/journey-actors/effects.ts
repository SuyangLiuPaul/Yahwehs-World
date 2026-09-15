import * as T from 'three';
/** Original analytic fire/dust, no video texture, particles or external asset.
 * Slow advected noise; explicit reduced motion freezes uTime in the caller. */
export function effectMaterial(dust=false){
  return new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,
    blending:dust?T.NormalBlending:T.AdditiveBlending,
    uniforms:{uTime:{value:0},uDust:{value:dust?1:0}},
    vertexShader:`varying vec2 vUv;
      void main(){vUv=uv;vec4 p=vec4(position,1.);
      #ifdef USE_INSTANCING
      p=instanceMatrix*p;
      #endif
      gl_Position=projectionMatrix*modelViewMatrix*p;}`,
    fragmentShader:`uniform float uTime;uniform float uDust;varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
      void main(){vec2 uv=vUv;float n=noise(vec2(uv.x*7.,uv.y*6.-uTime*.7))*.65+noise(vec2(uv.x*17.,uv.y*13.-uTime))* .35;
      if(uDust>.5){float strand=sin(uv.x*31.4+uv.y*21.-uTime*.8)*.5+.5;
        float a=smoothstep(.28,.8,n)*(.1+strand*.38)*smoothstep(0.,.1,uv.y)*(1.-smoothstep(.72,1.,uv.y));
        gl_FragColor=vec4(vec3(.81,.73,.59),a);
      }else{float width=(1.-uv.y)*.48+.025;float edge=abs(uv.x-.5+(n-.5)*.22*uv.y);
        float a=(1.-smoothstep(width*.35,width,edge))*smoothstep(0.,.08,uv.y)*(1.-smoothstep(.65,1.,uv.y+n*.14));
        float heat=clamp((1.-uv.y)*(1.-edge*2.5),0.,1.);
        vec3 c=mix(vec3(1.,.13,.008),vec3(1.,.78,.24),heat);c=mix(c,vec3(1.,.97,.75),pow(heat,4.));
        gl_FragColor=vec4(c,a*.68);}
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
}
