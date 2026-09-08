import * as THREE from 'three';

// First-person walking. Pointer lock for the look, WASD for the move, and
// swept-box collision against the structure's colliders so the walls are walls.
//
// The controls are deliberately unremarkable — this is the cheap part of a
// walkable scene, and pretending otherwise is how projects mistake where their
// real cost sits. What makes the tabernacle worth walking is that its geometry
// came out of Exodus, not that the camera moves well.

const SPEED = 3.2;          // m/s — an unhurried walk, this is not a shooter
const SPRINT = 6.0;
const EYE = 1.65;           // eye height of a person of average build
const RADIUS = 0.32;        // the walker's own girth, for collision
const ACCEL = 12;
const DAMP = 9;

export class Walker {
  readonly yaw = new THREE.Object3D();
  readonly pitch = new THREE.Object3D();
  private readonly velocity = new THREE.Vector3();
  private readonly keys = new Set<string>();
  private locked = false;
  /** Virtual stick deflection, -1..1 on each axis. */
  private readonly stick = new THREE.Vector2();
  private touching = false;
  private readonly box = new THREE.Box3();
  private readonly size = new THREE.Vector3(RADIUS * 2, EYE * 1.2, RADIUS * 2);

  constructor(
    camera: THREE.PerspectiveCamera,
    dom: HTMLElement,
    private colliders: THREE.Box3[],
  ) {
    this.yaw.add(this.pitch);
    this.pitch.add(camera);
    camera.position.set(0, 0, 0);
    this.yaw.position.set(0, EYE, 0);

    dom.addEventListener('click', () => { if (!this.locked) dom.requestPointerLock(); });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === dom;
      this.onLockChange?.(this.locked);
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      if (e.movementX || e.movementY) this.onManualInput?.();
      this.yaw.rotation.y -= e.movementX * 0.0022;
      this.pitch.rotation.x = THREE.MathUtils.clamp(
        this.pitch.rotation.x - e.movementY * 0.0022, -Math.PI / 2.1, Math.PI / 2.1);
    });
    addEventListener('keydown', (e) => {
      if (['KeyW','KeyA','KeyS','KeyD'].includes(e.code)) this.onManualInput?.();
      this.keys.add(e.code);
      // Space would otherwise scroll the page out from under the canvas.
      if (e.code === 'Space') e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    this.bindTouch(dom);
  }

  /** True where pointer lock and a keyboard are not both available — which is
   *  every phone and tablet. Without this the gate's enter button asks for a
   *  lock the browser will not grant and the visitor never gets inside. */
  static get touchOnly() {
    return !('requestPointerLock' in HTMLElement.prototype) ||
      (matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches);
  }

  /** The standard two-thumb layout: a touch that starts on the left half walks,
   *  one that starts on the right half looks. It is what every phone player
   *  already knows, and it needs no on-screen furniture over a small screen. */
  private bindTouch(dom: HTMLElement) {
    const move = new Map<number, { x0: number; y0: number }>();
    const look = new Map<number, { x: number; y: number }>();

    dom.addEventListener('touchstart', (e) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.clientX < innerWidth / 2) move.set(t.identifier, { x0: t.clientX, y0: t.clientY });
        else look.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
      this.touching = true;
      this.onManualInput?.();
      e.preventDefault();
    }, { passive: false });

    dom.addEventListener('touchmove', (e) => {
      for (const t of Array.from(e.changedTouches)) {
        const m = move.get(t.identifier);
        if (m) {
          // Distance from where the thumb landed is the stick deflection.
          const R = 62;
          this.stick.set(
            THREE.MathUtils.clamp((t.clientX - m.x0) / R, -1, 1),
            THREE.MathUtils.clamp((t.clientY - m.y0) / R, -1, 1),
          );
          continue;
        }
        const l = look.get(t.identifier);
        if (l) {
          this.yaw.rotation.y -= (t.clientX - l.x) * 0.005;
          this.pitch.rotation.x = THREE.MathUtils.clamp(
            this.pitch.rotation.x - (t.clientY - l.y) * 0.005, -Math.PI / 2.1, Math.PI / 2.1);
          l.x = t.clientX; l.y = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });

    const end = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (move.delete(t.identifier)) this.stick.set(0, 0);
        look.delete(t.identifier);
      }
      this.touching = move.size > 0 || look.size > 0;
    };
    dom.addEventListener('touchend', end);
    dom.addEventListener('touchcancel', end);
  }

  onLockChange?: (locked: boolean) => void;

  setColliders(c: THREE.Box3[]) { this.colliders = c; }

  moveTo(x: number, z: number, facing = 0) {
    this.yaw.position.set(x, EYE, z);
    this.yaw.rotation.y = facing;
    this.pitch.rotation.x = 0;
    this.velocity.set(0, 0, 0);
  }

  /** Where the walker stands and looks, for a tour to resume from. */
  get pose() {
    return {
      x: this.yaw.position.x, z: this.yaw.position.z,
      yaw: this.yaw.rotation.y, pitch: this.pitch.rotation.x,
    };
  }

  /** Places the walker exactly. Used only by the tour, which owns the camera
   *  while it runs. */
  setPose(p: { x: number; z: number; yaw: number; pitch: number }) {
    this.yaw.position.set(p.x, EYE, p.z);
    this.yaw.rotation.y = p.yaw;
    this.pitch.rotation.x = p.pitch;
    this.velocity.set(0, 0, 0);
  }

  /** Fires whenever the visitor moves, looks or taps — a tour hands control
   *  back the moment anyone reaches for it. */
  onManualInput?: () => void;

  /** True while the walker's box at (x, z) overlaps anything solid. */
  private blocked(x: number, z: number): boolean {
    this.box.setFromCenterAndSize(new THREE.Vector3(x, EYE * 0.6, z), this.size);
    return this.colliders.some((c) => c.intersectsBox(this.box));
  }

  update(dt: number) {
    const fwd = (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0) - this.stick.y;
    const side = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0) + this.stick.x;
    const speed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? SPRINT : SPEED;

    const wish = new THREE.Vector3(side, 0, -fwd);
    if (wish.lengthSq() > 0) {
      wish.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw.rotation.y);
      this.velocity.addScaledVector(wish, ACCEL * speed * dt);
      if (this.velocity.length() > speed) this.velocity.setLength(speed);
    }
    this.velocity.multiplyScalar(Math.max(0, 1 - DAMP * dt));

    // Axis-separated so sliding along a wall works instead of stopping dead.
    const p = this.yaw.position;
    const nx = p.x + this.velocity.x * dt;
    if (!this.blocked(nx, p.z)) p.x = nx; else this.velocity.x = 0;
    const nz = p.z + this.velocity.z * dt;
    if (!this.blocked(p.x, nz)) p.z = nz; else this.velocity.z = 0;
  }

  get position() { return this.yaw.position; }
  get isLocked() { return this.locked; }
  get isTouching() { return this.touching; }
  /** Entered by either route — a pointer lock, or a touch device let straight in. */
  enterTouch() { this.onLockChange?.(true); }
}
