import * as THREE from 'three';
import { palette } from './theme.ts';

export const GLOBE_RADIUS = 100;

/** Longitude/latitude to a point on the globe. `alt` lifts the point off the
 *  surface, in world units, so markers sit above the parchment. */
export function lonLatToVec3(lon: number, lat: number, alt = 0): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const r = GLOBE_RADIUS + alt;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  );
}

export function createGlobe(basemap: HTMLCanvasElement): THREE.Group {
  const group = new THREE.Group();

  const texture = new THREE.CanvasTexture(basemap);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_RADIUS, 128, 96),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95, metalness: 0.02 }),
  );
  group.add(sphere);

  // A thin outward-facing shell tinted at the rim. It reads as atmosphere from
  // outside and costs one extra draw call — cheaper and steadier than a
  // post-process bloom, which would also blow out the gold coastline.
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_RADIUS * 1.035, 64, 48),
    new THREE.ShaderMaterial({
      transparent: true, side: THREE.BackSide, depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color(palette.gold) } },
      vertexShader: `
        varying vec3 vN; varying vec3 vP;
        void main() {
          vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vP = mv.xyz;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor; varying vec3 vN; varying vec3 vP;
        void main() {
          float rim = 1.0 - abs(dot(normalize(vN), normalize(-vP)));
          gl_FragColor = vec4(uColor, pow(rim, 3.0) * 0.55);
        }`,
    }),
  );
  group.add(halo);

  return group;
}

export function createLighting(scene: THREE.Scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 1.35));
  const key = new THREE.DirectionalLight(0xfff2d5, 1.6);
  key.position.set(1, 0.6, 1).multiplyScalar(400);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x9ab6d4, 0.5);
  fill.position.set(-1, -0.3, -0.6).multiplyScalar(400);
  scene.add(fill);
}
