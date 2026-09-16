import { mountVoyage } from './scene.ts';

// Thin dev harness for voyage-demo.html only — the actual scene lives in
// scene.ts, mountable, so the globe (src/main.ts) can open the same thing as
// an overlay reached by clicking a route's ship, not send the reader here.
// This page stays as the fast-iteration surface for the scene alone.

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const loadingEl = document.getElementById('loading')!;
const handle = mountVoyage(canvas);
handle.ready.then(() => { loadingEl.hidden = true; });

function wireToggle(id: string, get: () => boolean, set: (v: boolean) => void, onText: string, offText: string) {
  const btn = document.getElementById(id) as HTMLButtonElement;
  btn.addEventListener('click', () => {
    const next = !get();
    set(next);
    btn.setAttribute('aria-pressed', String(next));
    btn.textContent = next ? onText : offText;
  });
}
wireToggle('toggle-anim', () => handle.animating, (v) => { handle.animating = v; }, '暂停动作', '继续动作');
wireToggle('toggle-outline', () => handle.outlinesVisible, (v) => { handle.outlinesVisible = v; }, '卡通轮廓：开', '卡通轮廓：关');
wireToggle('toggle-orbit', () => handle.autoRotate, (v) => { handle.autoRotate = v; }, '自动环绕：开', '自动环绕：关');

addEventListener('resize', () => handle.resize(innerWidth, innerHeight));
