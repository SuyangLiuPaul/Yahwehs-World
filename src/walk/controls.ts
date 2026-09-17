import * as THREE from 'three';

// First-person walking. Pointer lock for the look, WASD for the move, and
// swept-box collision against the structure's colliders so the walls are walls.
//
// The controls were deliberately unremarkable, and stayed unremarkable one
// dimension too long: the walker had no Y at all. The eye sat at a fixed
// 1.65 m, so there was no jumping, no falling, and — the part that mattered —
// no climbing. Solomon's temple has a ramp up to the altar and a winding stair
// up the side chambers (1 Kgs 6:8), and both were scenery you bumped into.
//
// Which controls a visitor gets is NOT a question about their device. The old
// answer was a one-shot guess at load — pointer lock exists, the pointer is
// coarse — and it is wrong for an iPad with a trackpad, for a touchscreen
// laptop, for a phone with a mouse, and for anyone who changes hands halfway
// through. So nothing is guessed: every input path is bound all the time, and
// the INPUT MODE is observed from what actually arrives. A touch switches to
// touch, a key or a mouse movement switches to keyboard, a gamepad axis
// switches to the pad. The mode decides only what the page shows and whether
// entering asks for a pointer lock; a wrong guess therefore costs nothing,
// and the right answer arrives the moment the visitor does anything at all.
//
// Keys follow what people already have in their hands: WASD and the arrow
// keys both walk, and — as in the game this is measured against — the left
// and right arrows TURN rather than strafe, so a laptop with no mouse can
// still look around. Shift runs, Space jumps.
//
// So the walker now has a vertical axis: gravity, a jump, and a step height.
// Two kinds of solid are distinguished, because a spiral stair needs it:
//   · colliders — walls. They stop you and you can stand on top of them.
//   · platforms — treads and ramps. They hold you up and never block you.
// Without that split, the axis-aligned boxes round the ~30 steps of a winding
// stair overlap each other into a solid cylinder, and the stair becomes a
// wall you can see through.

// Speeds. 3.2 m/s was chosen for a tent 30 cubits long; the temple court is
// 110 cubits across and the owner walked it and said so. A brisk walk is
// ~1.4 m/s in life — this is already a game speed, and the room being crossed
// is the reason.
const SPEED = 4.7;          // m/s
const SPRINT = 9.4;
const EYE = 1.65;           // eye height of a person of average build
const HEAD = 1.78;          // top of the head, for headroom and for blocking
const RADIUS = 0.32;        // the walker's own girth, for collision
const STEP = 0.62;          // the tallest thing you can walk up without jumping
const GRAVITY = 19;         // m/s²; steeper than earth so a jump lands promptly
const JUMP = 5.4;           // m/s at the toes → an apex of about 0.77 m
const ACCEL = 14;
const DAMP = 10;
const AIR_CONTROL = 0.35;   // you steer in the air, you do not walk in it
// The steepest ground that can be climbed, as a gradient. Without it the
// step-height rule alone lets a walker stroll up a cliff: at 4.7 m/s a frame
// advances 8 cm, so even a vertical face rises less than a step per frame.
const MAX_CLIMB = 1.0;      // 45°
const TURN = 2.2;           // rad/s, for the arrow keys and a pad's right stick
const PAD_LOOK = 2.6;       // rad/s at full deflection
const DEAD = 0.18;          // a stick at rest is never exactly at rest

/** What the visitor is driving with at this moment. Observed, never guessed. */
export type InputMode = 'key' | 'touch' | 'pad';

/** Keys that mean "I am walking this myself", so a tour hands back control. */
const WALK_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
]);
/** …and the ones the browser would otherwise use to scroll the page. */
const SCROLL_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export class Walker {
  readonly yaw = new THREE.Object3D();
  readonly pitch = new THREE.Object3D();
  private readonly velocity = new THREE.Vector3();
  private readonly keys = new Set<string>();
  private locked = false;
  /** Virtual stick deflection, -1..1 on each axis. */
  private readonly stick = new THREE.Vector2();
  private touching = false;
  private padRunning = false;
  private padJumped = false;
  /** Toggled by the on-screen run button; a thumb cannot hold Shift. */
  private runLatch = false;
  private mode: InputMode = 'key';
  /** Height of the floor under the feet, in metres. The camera's own Y lags
   *  it slightly so a step up is a step, not a teleport. */
  private feet = 0;
  private vy = 0;
  private grounded = true;
  /** Treads and ramps: they support the walker and never block them. */
  private platforms: THREE.Box3[] = [];
  /** Where the ground is where nothing else holds you up: a number for a tent
   *  pitched on the flat, or a height field for a house on a mountain. */
  private floor: number | ((x: number, z: number) => number) = 0;
  private groundAt(x: number, z: number) {
    return typeof this.floor === 'number' ? this.floor : this.floor(x, z);
  }

  constructor(
    camera: THREE.PerspectiveCamera,
    dom: HTMLElement,
    private colliders: THREE.Box3[],
    options: { platforms?: THREE.Box3[]; floorY?: number | ((x: number, z: number) => number) } = {},
  ) {
    this.platforms = options.platforms ?? [];
    this.floor = options.floorY ?? 0;
    this.yaw.add(this.pitch);
    this.pitch.add(camera);
    camera.position.set(0, 0, 0);
    this.yaw.position.set(0, EYE, 0);

    // A click asks for the pointer lock only when the visitor is driving with
    // a pointer. On touch, the click that follows a tap must not.
    dom.addEventListener('click', () => {
      if (!this.locked && this.mode === 'key' && !Walker.touchOnly) void dom.requestPointerLock()?.catch(() => {});
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === dom;
      this.onLockChange?.(this.locked);
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      if (e.movementX || e.movementY) { this.setMode('key'); this.onManualInput?.(); }
      this.yaw.rotation.y -= e.movementX * 0.0022;
      this.pitch.rotation.x = THREE.MathUtils.clamp(
        this.pitch.rotation.x - e.movementY * 0.0022, -Math.PI / 2.1, Math.PI / 2.1);
    });
    addEventListener('keydown', (e) => {
      if (WALK_KEYS.has(e.code)) { this.setMode('key'); this.onManualInput?.(); }
      this.keys.add(e.code);
      // Space jumps, and the arrows would otherwise scroll the page out from
      // under the canvas.
      if (SCROLL_KEYS.has(e.code)) { e.preventDefault(); this.setMode('key'); this.onManualInput?.(); }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    this.bindTouch(dom);
    addEventListener('gamepadconnected', () => this.setMode('pad'));
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
        if (t.clientX < innerWidth / 2) {
          move.set(t.identifier, { x0: t.clientX, y0: t.clientY });
          this.onStick?.({ active: true, x: t.clientX, y: t.clientY, dx: 0, dy: 0 });
        } else look.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
      this.touching = true;
      this.setMode('touch');
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
          this.onStick?.({ active: true, x: m.x0, y: m.y0, dx: this.stick.x * R, dy: this.stick.y * R });
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
        if (move.delete(t.identifier)) { this.stick.set(0, 0); this.onStick?.({ active: false, x: 0, y: 0, dx: 0, dy: 0 }); }
        look.delete(t.identifier);
      }
      this.touching = move.size > 0 || look.size > 0;
    };
    dom.addEventListener('touchend', end);
    dom.addEventListener('touchcancel', end);
  }

  onLockChange?: (locked: boolean) => void;
  /** Fires when the visitor picks up a different kind of control. The page
   *  uses it to show the right help and the right on-screen furniture. */
  onModeChange?: (mode: InputMode) => void;
  /** Where the thumb stick is and how far it is pushed, in CSS pixels, so the
   *  page can draw one. A stick you cannot see is a stick nobody finds. */
  onStick?: (s: { active: boolean; x: number; y: number; dx: number; dy: number }) => void;

  get inputMode() { return this.mode; }
  /** The page's opening guess, before the visitor has done anything. It must
   *  go through the walker and not just through the page's own CSS, or the
   *  first real input matches the walker's stale default, changes nothing,
   *  and the visitor is left reading the wrong legend. */
  assume(mode: InputMode) {
    this.mode = mode;
    this.onModeChange?.(mode);
  }
  private setMode(mode: InputMode) {
    if (this.mode === mode) return;
    this.mode = mode;
    if (mode !== 'touch') { this.stick.set(0, 0); this.onStick?.({ active: false, x: 0, y: 0, dx: 0, dy: 0 }); }
    this.onModeChange?.(mode);
  }

  /** The on-screen run button: a thumb cannot hold Shift down. */
  toggleRun() { this.runLatch = !this.runLatch; return this.runLatch; }
  get running() { return this.runLatch; }

  /** A gamepad, if one is being used: left stick walks, right stick looks,
   *  the bottom face button jumps, either trigger runs. Polled rather than
   *  evented, because that is the only way the API offers. */
  private pollPad(dt: number) {
    const pads = navigator.getGamepads?.() ?? [];
    const pad = [...pads].find((p) => p && p.connected);
    if (!pad) return;
    const axis = (i: number) => {
      const v = pad.axes[i] ?? 0;
      return Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD);
    };
    const [lx, ly, rx, ry] = [axis(0), axis(1), axis(2), axis(3)];
    const jump = pad.buttons[0]?.pressed ?? false;
    const run = (pad.buttons[7]?.pressed ?? false) || (pad.buttons[6]?.pressed ?? false) ||
      (pad.buttons[10]?.pressed ?? false);
    if (lx || ly || rx || ry || jump || run) { this.setMode('pad'); this.onManualInput?.(); }
    if (!lx && !ly && !rx && !ry && !jump && !run) return;
    this.stick.set(lx, ly);
    this.padRunning = run;
    if (jump && !this.padJumped) this.jump();
    this.padJumped = jump;
    if (rx || ry) {
      this.yaw.rotation.y -= rx * PAD_LOOK * dt;
      this.pitch.rotation.x = THREE.MathUtils.clamp(
        this.pitch.rotation.x - ry * PAD_LOOK * dt, -Math.PI / 2.1, Math.PI / 2.1);
    }
  }

  setColliders(c: THREE.Box3[], platforms: THREE.Box3[] = this.platforms) {
    this.colliders = c;
    this.platforms = platforms;
  }

  /** A hop, when the walker is standing on something. */
  jump() {
    if (!this.grounded) return;
    this.vy = JUMP;
    this.grounded = false;
  }

  /** `ceiling` caps the search, for a caller that means the ground floor and
   *  not the roof terrace directly above it. */
  moveTo(x: number, z: number, facing = 0, ceiling = Infinity) {
    this.feet = this.standingHeightAt(x, z, ceiling);
    this.yaw.position.set(x, this.feet + EYE, z);
    this.yaw.rotation.y = facing;
    this.pitch.rotation.x = 0;
    this.velocity.set(0, 0, 0);
    this.vy = 0;
    this.grounded = true;
  }

  /** Where the walker stands and looks, for a tour to resume from. */
  get pose() {
    return {
      x: this.yaw.position.x, z: this.yaw.position.z, y: this.yaw.position.y,
      yaw: this.yaw.rotation.y, pitch: this.pitch.rotation.x,
    };
  }

  /** Places the walker exactly. Used only by the tour, which owns the camera
   *  while it runs. */
  setPose(p: { x: number; z: number; y?: number; yaw: number; pitch: number }) {
    const eye = p.y ?? EYE;
    this.yaw.position.set(p.x, eye, p.z);
    this.yaw.rotation.y = p.yaw;
    this.pitch.rotation.x = p.pitch;
    this.velocity.set(0, 0, 0);
    // A tour that ends above the roof must not drop the walker out of the sky
    // when it hands control back: they resume standing on whatever is under
    // them.
    this.feet = Math.min(eye - EYE, this.standingHeightAt(p.x, p.z));
    this.vy = 0;
    this.grounded = false;
  }

  /** Fires whenever the visitor moves, looks or taps — a tour hands control
   *  back the moment anyone reaches for it. */
  onManualInput?: () => void;

  /** True while the walker's body at (x, z), standing with their feet at
   *  `feet`, overlaps a wall. Anything wholly below the feet is the floor and
   *  anything wholly above the head is a lintel; neither is in the way. */
  private blocked(x: number, z: number, feet: number): boolean {
    const y0 = feet + 0.05, y1 = feet + HEAD;
    for (const c of this.colliders) {
      if (c.max.y <= y0 || c.min.y >= y1) continue;
      if (x + RADIUS < c.min.x || x - RADIUS > c.max.x) continue;
      if (z + RADIUS < c.min.z || z - RADIUS > c.max.z) continue;
      return true;
    }
    return false;
  }

  /** The highest surface under the walker's footprint at or below `limit` —
   *  a tread, a ramp, the top of a wall, or the ground itself. */
  private supportAt(x: number, z: number, limit: number): number {
    let top = this.groundAt(x, z);
    const test = (c: THREE.Box3) => {
      if (c.max.y > limit || c.max.y <= top) return;
      if (x + RADIUS < c.min.x || x - RADIUS > c.max.x) return;
      if (z + RADIUS < c.min.z || z - RADIUS > c.max.z) return;
      top = c.max.y;
    };
    for (const c of this.colliders) test(c);
    for (const c of this.platforms) test(c);
    return top;
  }

  /** The highest surface at (x, z) a person actually fits on: the paving over
   *  the bedrock, a tread over the paving, the roof over the tread. Asking for
   *  "the ground" instead put a walker on the desert floor UNDER the temple's
   *  platform, where every direction is inside the platform and nothing moves.
   *  Used when placing the walker, never in the movement loop. */
  private standingHeightAt(x: number, z: number, ceiling = Infinity): number {
    const tops = [this.groundAt(x, z)];
    const gather = (c: THREE.Box3) => {
      if (c.max.y > ceiling) return;
      if (x + RADIUS < c.min.x || x - RADIUS > c.max.x) return;
      if (z + RADIUS < c.min.z || z - RADIUS > c.max.z) return;
      tops.push(c.max.y);
    };
    for (const c of this.colliders) gather(c);
    for (const c of this.platforms) gather(c);
    tops.sort((a, b) => b - a);
    return tops.find((t) => !this.blocked(x, z, t)) ?? this.groundAt(x, z);
  }

  /** Moves to (x, z) if the way is clear, stepping up onto anything no taller
   *  than STEP. Returns false when a wall is in the way. */
  private tryMove(x: number, z: number): boolean {
    // Ground too steep to climb is a wall. Measured as a gradient against the
    // distance actually moved, so it does not depend on the frame rate.
    const p = this.yaw.position;
    const rise = this.groundAt(x, z) - this.groundAt(p.x, p.z);
    if (rise > 0) {
      const run = Math.hypot(x - p.x, z - p.z);
      if (rise > MAX_CLIMB * run + 1e-4) return false;
    }
    if (!this.blocked(x, z, this.feet)) return true;
    if (!this.grounded) return false;
    const top = this.supportAt(x, z, this.feet + STEP);
    if (top > this.feet + 0.02 && !this.blocked(x, z, top)) { this.feet = top; return true; }
    return false;
  }

  update(dt: number) {
    if (this.mode !== 'touch') this.pollPad(dt);
    // Left and right arrows turn, as they do in the game this is measured
    // against, so a laptop with no mouse is not stuck facing one way.
    const turn = (this.keys.has('ArrowLeft') ? 1 : 0) - (this.keys.has('ArrowRight') ? 1 : 0);
    if (turn) this.yaw.rotation.y += turn * TURN * dt;

    const fwd = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0)
      - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) - this.stick.y;
    const side = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0) + this.stick.x;
    // Shift on a keyboard, a trigger on a pad, the run button or a thumb
    // pushed to the rim of the stick on a phone — where there is no Shift.
    const running = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ||
      this.padRunning || this.runLatch || this.stick.length() > 0.92;
    const speed = running ? SPRINT : SPEED;

    // Damp first, then accelerate, then clamp — in that order the clamp is the
    // speed the walker actually reaches. The other order costs a factor of
    // (1 − DAMP·dt): the old SPEED of 3.2 m/s measured 2.67 on the floor, and
    // scripts/audit-walk.mjs is what noticed.
    this.velocity.multiplyScalar(Math.max(0, 1 - (this.grounded ? DAMP : 0.6) * dt));
    const wish = new THREE.Vector3(side, 0, -fwd);
    if (wish.lengthSq() > 0) {
      wish.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw.rotation.y);
      const control = this.grounded ? 1 : AIR_CONTROL;
      this.velocity.addScaledVector(wish, ACCEL * speed * dt * control);
    }
    if (this.velocity.length() > speed) this.velocity.setLength(speed);

    if (this.keys.has('Space')) this.jump();

    // Axis-separated so sliding along a wall works instead of stopping dead.
    const p = this.yaw.position;
    const nx = p.x + this.velocity.x * dt;
    if (this.tryMove(nx, p.z)) p.x = nx; else this.velocity.x = 0;
    const nz = p.z + this.velocity.z * dt;
    if (this.tryMove(p.x, nz)) p.z = nz; else this.velocity.z = 0;

    // Fall, land, or stay glued to a descending stair: without the last one,
    // walking down the altar ramp is a run of small hops.
    this.vy -= GRAVITY * dt;
    const feetNext = this.feet + this.vy * dt;
    const support = this.supportAt(p.x, p.z, this.feet + (this.grounded ? STEP : 0.02));
    if (this.vy <= 0 && (feetNext <= support || (this.grounded && support >= feetNext - STEP))) {
      this.feet = support;
      this.vy = 0;
      this.grounded = true;
    } else if (this.vy > 0 && this.blocked(p.x, p.z, feetNext)) {
      this.vy = 0;                       // a head against a lintel
      this.grounded = false;
    } else {
      this.feet = feetNext;
      this.grounded = false;
    }

    // The camera follows the feet closely but not instantly, so a stair reads
    // as a stair. In the air it is exact — a jump you cannot feel is not one.
    const eye = this.feet + EYE;
    p.y = this.grounded ? eye + (p.y - eye) * Math.exp(-dt * 20) : eye;
  }

  get position() { return this.yaw.position; }
  get isLocked() { return this.locked; }
  get isTouching() { return this.touching; }
  /** Entered by either route — a pointer lock, or a touch device let straight in. */
  enterTouch() { this.onLockChange?.(true); }
  exit(){this.keys.clear();this.velocity.set(0,0,0);this.stick.set(0,0);this.runLatch=false;this.onStick?.({active:false,x:0,y:0,dx:0,dy:0});if(document.pointerLockElement)document.exitPointerLock();this.onLockChange?.(false);}
}
