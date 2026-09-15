import { MathUtils, type PerspectiveCamera } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/** Tune the globe only; the scene inspector and first-person walk have their
 * own controls. OrbitControls' default gain is radians per viewport pixel,
 * which moves nearby terrain tens of times faster than the pointer. */
export function installGlobeNavigation(controls: OrbitControls, camera: PerspectiveCamera, canvas: HTMLCanvasElement, radius: number) {
  const updateSensitivity = () => {
    const altitude = Math.max(0, camera.position.distanceTo(controls.target) - radius);
    // At screen centre: metres/px = 2 * altitude * tan(fov/2) / height.
    // OrbitControls uses angle/px = 2π * rotateSpeed / height. Equating
    // these on the sphere gives approximately 1:1 vertical surface dragging.
    // North stays upright; longitude motion naturally foreshortens at high
    // latitudes. A distant whole globe retains a bounded rotation rate.
    controls.rotateSpeed = MathUtils.clamp(
      altitude * Math.tan(MathUtils.degToRad(camera.getEffectiveFOV()) / 2) / (Math.PI * radius),
      0.002, 0.42,
    );
  };
  // Direct manipulation: no delayed catch-up while held, no coast on release.
  // Motion depends on pointer distance, not event frequency or display FPS.
  controls.enableDamping = false;
  controls.addEventListener('change', updateSensitivity);
  updateSensitivity();

  const abort = new AbortController();
  const options = { capture: true, signal: abort.signal };
  const pointers = new Map<number, { x: number; y: number }>();
  let cancelled = false;
  let tap: PointerEvent | null = null;
  const clear = () => {
    pointers.clear(); cancelled = true; tap = null;
    canvas.classList.remove('dragging');
  };
  canvas.addEventListener('pointerdown', ev => {
    if (!pointers.size) cancelled = false;
    tap = null;
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pointers.size > 1 || ev.button !== 0 || ev.ctrlKey || ev.metaKey || ev.shiftKey) cancelled = true;
    canvas.classList.add('dragging');
    canvas.classList.remove('over-place');
  }, options);
  // Track the maximum excursion, not just where the drag ends. A loop back
  // to its start and the last finger of a pinch must never count as a tap.
  const track = (ev: PointerEvent) => {
    const down = pointers.get(ev.pointerId);
    if (down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 5) cancelled = true;
  };
  canvas.ownerDocument.addEventListener('pointermove', track, options);
  canvas.ownerDocument.addEventListener('pointerup', ev => {
    track(ev);
    const known = pointers.delete(ev.pointerId);
    tap = known && !cancelled && !pointers.size ? ev : null;
    if (!pointers.size) canvas.classList.remove('dragging');
  }, options);
  canvas.ownerDocument.addEventListener('pointercancel', ev => {
    if (pointers.has(ev.pointerId)) clear();
  }, options);
  canvas.addEventListener('lostpointercapture', ev => {
    if (pointers.has(ev.pointerId)) clear();
  }, options);
  window.addEventListener('blur', clear, { signal: abort.signal });

  return {
    get active() { return pointers.size > 0; },
    consumeTap(ev: PointerEvent) { const result = tap === ev; tap = null; return result; },
    dispose() { clear(); abort.abort(); controls.removeEventListener('change', updateSensitivity); },
  };
}
