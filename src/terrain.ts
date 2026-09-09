import * as THREE from 'three';
import { GLOBE_RADIUS } from './globe.ts';

// A high-resolution terrain patch over the biblical world, laid on the globe.
//
// The painted basemap in basemap.ts is a parchment: coastlines, lakes and
// rivers stroked from Natural Earth vectors. It carries the whole sphere at a
// glance, and it can never show a mountain, because a stroke has no elevation
// behind it. Relief has to come from measured height, so this patch carries
// Natural Earth's shaded-relief and cross-blended hypsometric rasters (public
// domain, elevation-derived, not photography), cropped to the ground the text
// actually walks over and colour-graded so the sea has depth and the desert is
// warm rather than atlas-grey.
//
// It fades in on approach. Far out, the parchment reads better and the patch
// would only be a bright rectangle stuck to a globe; close in, the parchment
// has nothing left to say and the terrain does.

/** The crop, in degrees. Rome to Susa, the first cataract to the Black Sea. */
export const REGION = { lon0: 10, lon1: 50, lat0: 12, lat1: 45 };

const D2R = Math.PI / 180;

/** Distance from the globe's centre at which the terrain is fully opaque, and
 *  the one past which it is gone. Measured in globe radii. */
const NEAR = 1.55;
const FAR = 2.45;

export class Terrain {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.MeshBasicMaterial;
  private target = 0;

  constructor() {
    // THREE's sphere takes the azimuth as `phi` and the polar angle as
    // `theta`, which is the reverse of the usual naming; these two lines are
    // matched to lonLatToVec3 so the patch lands exactly on its coordinates.
    const phiStart = (REGION.lon0 + 180) * D2R;
    const phiLength = (REGION.lon1 - REGION.lon0) * D2R;
    const thetaStart = (90 - REGION.lat1) * D2R;
    const thetaLength = (REGION.lat1 - REGION.lat0) * D2R;

    const geom = new THREE.SphereGeometry(
      GLOBE_RADIUS + 0.05, 192, 160, phiStart, phiLength, thetaStart, thetaLength,
    );

    const loader = new THREE.TextureLoader();
    const map = loader.load('data/terrain-color.webp');
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 16;

    // Unlit, and the texture carries the whole appearance.
    //
    // The scene's rig is built for a dark painted globe: ambient 1.35, a key
    // whose sub-solar point falls in the mid-Atlantic and a fill whose own
    // falls in the Coral Sea. Over this crop the fill contributes nothing at
    // all and the key only about a quarter of the light, so a lit material
    // here is very nearly ambient times albedo -- a flat multiply, which was
    // then being fought with a second flat multiply on the albedo. Together
    // they landed the terrain at roughly a third of its graded colour. That is
    // the grey-olive.
    //
    // A normal map cannot earn its place against that rig, and the relief is
    // already shaded into the source raster, so the honest arrangement is to
    // stop pretending the light does the modelling: grade the texture to the
    // tone it should render at, and show it unmodified. Lost is a relief that
    // shifts as the globe turns; bought is a map that looks like what was
    // graded, and a mid tone for the gold route and markers to sit on instead
    // of a near-white one.
    this.material = new THREE.MeshBasicMaterial({
      map,
      // The texture carries a feathered alpha border, so the patch dissolves
      // into the painted globe instead of ending on a straight line.
      transparent: true, opacity: 0,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(geom, this.material);
    this.mesh.visible = false;
    this.mesh.renderOrder = 1;
  }

  /** Called every frame with the camera's distance from the globe centre. */
  update(cameraDistance: number, dt: number) {
    const r = cameraDistance / GLOBE_RADIUS;
    this.target = THREE.MathUtils.clamp((FAR - r) / (FAR - NEAR), 0, 1);
    const k = 1 - Math.exp(-dt * 6);   // frame-rate independent ease
    this.material.opacity += (this.target - this.material.opacity) * k;
    this.mesh.visible = this.material.opacity > 0.01;
  }
}
