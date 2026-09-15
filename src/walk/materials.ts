import * as THREE from 'three';

/** Original Higgsfield material studies, NOT site photography or measured PBR
 * scans. The height channel is a restrained artistic luminance approximation.
 * Progressive loading always leaves the authored procedural material usable. */
type SurfaceName = 'desert-ground' | 'desert-rock' | 'fine-linen' | 'veil-embroidery' | 'screen-embroidery';
type Surface = { color: THREE.Texture; height: THREE.DataTexture };
const jobs: Promise<boolean>[] = [];
const cache = new Map<SurfaceName, Promise<Surface>>();

function surface(name: SurfaceName) {
  if (!cache.has(name)) {
    cache.set(name, new THREE.TextureLoader().loadAsync(`/materials/${name}-v1.webp`).then(color => {
      color.colorSpace = THREE.SRGBColorSpace;
      color.wrapS = color.wrapT = THREE.RepeatWrapping;
      color.anisotropy = 8;
      const c = document.createElement('canvas'); c.width = c.height = 512;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(color.image, 0, 0, 512, 512);
      const pixels = ctx.getImageData(0, 0, 512, 512).data;
      const values = new Uint8Array(512 * 512);
      for (let i = 0; i < values.length; i++) values[i] = pixels[i * 4]! * .21 + pixels[i * 4 + 1]! * .72 + pixels[i * 4 + 2]! * .07;
      const height = new THREE.DataTexture(values, 512, 512, THREE.RedFormat);
      height.wrapS = height.wrapT = THREE.RepeatWrapping;
      height.magFilter = THREE.LinearFilter; height.minFilter = THREE.LinearMipmapLinearFilter;
      height.generateMipmaps = true; height.anisotropy = 8; height.flipY = true; height.needsUpdate = true;
      return { color, height };
    }));
  }
  return cache.get(name)!;
}

export function detailedSurface(material: THREE.MeshStandardMaterial, name: SurfaceName,
  repeat: number | [number, number], bumpScale: number) {
  const pair = Array.isArray(repeat) ? repeat : [repeat, repeat];
  const job = surface(name).then(({ color, height }) => {
    // Clones share source image data, but not texture transforms.
    material.map = color.clone(); material.map.repeat.set(pair[0]!, pair[1]!);
    material.map.needsUpdate = true;
    material.bumpMap = height.clone(); material.bumpMap.repeat.copy(material.map.repeat);
    material.bumpMap.needsUpdate = true; material.bumpScale = bumpScale;
    material.normalMap = null;
    material.needsUpdate = true;
    return true;
  }).catch(() => false);
  jobs.push(job);
  return material;
}

/** Called after the synchronous scene builder has registered every consumer. */
export function materialsReady() { return Promise.all(jobs).then(results => results.every(Boolean)); }

/** Three planar samples avoid the rubber-sheet stretching of a top-down UV
 * projection on steep rock. No displacement is faked into a backdrop image. */
export function rockProjection(material: THREE.MeshStandardMaterial, metres = 5) {
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      varying vec3 vRockPosition; varying vec3 vRockNormal;`);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vRockPosition = position; vRockNormal = normal;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vRockPosition; varying vec3 vRockNormal;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec3 blend = pow(abs(normalize(vRockNormal)), vec3(4.0));
        blend /= max(dot(blend, vec3(1.0)), .001);
        vec3 q = vRockPosition / ${metres.toFixed(2)};
        vec4 rockTexel = texture2D(map, q.yz) * blend.x + texture2D(map, q.xz) * blend.y + texture2D(map, q.xy) * blend.z;
        diffuseColor *= rockTexel;
      #endif`);
  };
  material.customProgramCacheKey = () => `rock-triplanar-${metres}`;
  return material;
}
