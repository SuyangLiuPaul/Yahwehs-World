import { Walker, type InputMode } from './controls.ts';
import { applyStatic } from '../locale.ts';

// The on-screen half of the controls, shared by both walks.
//
// The page shows what the visitor is actually using. It does not decide that
// at load from the shape of the device — see the note at the top of
// controls.ts — it follows the walker's observed input mode, which changes the
// moment a thumb, a key or a stick arrives. So a phone gets a stick and a
// jump button, a keyboard gets the key legend, a gamepad gets neither, and an
// iPad with a trackpad gets whichever of them its owner reaches for next.

const LEGEND: Record<InputMode, [string, string][]> = {
  key: [
    ['kbd', 'W'], ['kbd', 'A'], ['kbd', 'S'], ['kbd', 'D'],
    ['en', 'move'], ['zh', '走动'],
    ['kbd', '↑'], ['kbd', '↓'], ['en', 'walk'], ['zh', '前后'],
    ['kbd', '←'], ['kbd', '→'], ['en', 'turn'], ['zh', '转身'],
    ['kbd', 'Shift'], ['en', 'run'], ['zh', '快走'],
    ['kbd', 'Space'], ['en', 'jump'], ['zh', '跳'],
    ['en', 'mouse to look'], ['zh', '鼠标转头'],
    ['kbd', 'Esc'], ['en', 'exit'], ['zh', '退出'],
  ],
  touch: [
    ['en', 'left half: a stick to walk'], ['zh', '左半屏：摇杆走动'],
    ['en', 'right half: drag to look'], ['zh', '右半屏：拖动转头'],
    ['en', 'Run and Jump are buttons'], ['zh', '快走与跳是按钮'],
  ],
  pad: [
    ['en', 'left stick to walk'], ['zh', '左摇杆走动'],
    ['en', 'right stick to look'], ['zh', '右摇杆转头'],
    ['en', 'A to jump, trigger to run'], ['zh', 'A 跳，扳机快走'],
  ],
};

/** Builds the legend for one mode: pairs of (kind, text), where en and zh of
 *  the same phrase sit next to each other and the locale layer picks one. */
function legend(mode: InputMode): string {
  const out: string[] = [];
  const items = LEGEND[mode];
  for (let i = 0; i < items.length; i++) {
    const [kind, text] = items[i]!;
    if (kind === 'kbd') { out.push(`<kbd>${text}</kbd>`); continue; }
    if (kind === 'zh') continue;                       // paired with its en
    const zh = items[i + 1]?.[0] === 'zh' ? items[i + 1]![1] : text;
    out.push(`<span data-en="${text}" data-zh="${zh}">${text}</span>`);
  }
  return out.join('');
}

export function bindInputUi(walker: Walker) {
  const stick = document.getElementById('stick');
  const knob = stick?.querySelector('i') as HTMLElement | null;
  const jump = document.getElementById('walk-jump') as HTMLButtonElement | null;
  const run = document.getElementById('walk-run') as HTMLButtonElement | null;
  const keys = document.querySelector('.keys');

  walker.onStick = ({ active, x, y, dx, dy }) => {
    if (!stick || !knob) return;
    stick.hidden = !active;
    if (!active) return;
    stick.style.left = `${x}px`;
    stick.style.top = `${y}px`;
    knob.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
  };

  const show = (mode: InputMode) => {
    if (jump) jump.hidden = mode !== 'touch';
    if (run) run.hidden = mode !== 'touch';
    if (keys) { keys.innerHTML = legend(mode); applyStatic(); }
  };
  walker.onModeChange = show;
  // The opening guess, and only a guess: it is replaced by the first thing
  // the visitor actually does. It goes through the walker so that the walker's
  // own idea of the mode and the page's agree.
  walker.assume(Walker.touchOnly ? 'touch' : 'key');

  jump?.addEventListener('click', () => { walker.jump(); });
  run?.addEventListener('click', () => {
    const on = walker.toggleRun();
    run.setAttribute('aria-pressed', String(on));
    run.classList.toggle('on', on);
  });
}
