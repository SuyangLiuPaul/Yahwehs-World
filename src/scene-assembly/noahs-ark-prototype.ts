import {
  bootNoahsArkWorld,
  type ArkViewMode,
  type LightingPreset,
  type BiblicalEntry,
} from './noahs-ark-world.ts';

const canvas = document.querySelector<HTMLCanvasElement>('#stage')!;
const loadStatus = document.querySelector<HTMLElement>('#load-status');
const inspectCard = document.querySelector<HTMLElement>('#inspect-card');
const inspectBadge = document.querySelector<HTMLElement>('#inspect-badge');
const inspectZh = document.querySelector<HTMLElement>('#inspect-zh');
const inspectEn = document.querySelector<HTMLElement>('#inspect-en');
const inspectVerse = document.querySelector<HTMLElement>('#inspect-verse');
const inspectFact = document.querySelector<HTMLElement>('#inspect-fact');
const inspectArt = document.querySelector<HTMLElement>('#inspect-art');
const loader = document.querySelector<HTMLElement>('#ark-loader');
const loaderFill = document.querySelector<HTMLElement>('#loader-fill');
const loaderText = document.querySelector<HTMLElement>('#loader-text');

function showInspectCard(entry: BiblicalEntry) {
  if (!inspectCard) return;
  if (inspectBadge) inspectBadge.textContent = `${entry.scriptureRef} · ${entry.pairingRuleZh}`;
  if (inspectZh) inspectZh.textContent = entry.zhName;
  if (inspectEn) inspectEn.textContent = entry.hebrew ? `${entry.enName} · ${entry.hebrew}` : entry.enName;
  if (inspectVerse) inspectVerse.textContent = entry.scriptureQuoteZh;
  if (inspectFact) inspectFact.textContent = `【圣经事实】${entry.biblicalFactZh}`;
  if (inspectArt) inspectArt.textContent = `【三维复原】${entry.artisticNoteZh}`;
  inspectCard.hidden = false;
}

document.querySelector('#inspect-close')?.addEventListener('click', () => {
  if (inspectCard) inspectCard.hidden = true;
});

// Modals
const refModal = document.querySelector<HTMLElement>('#reference-modal');
const factsModal = document.querySelector<HTMLElement>('#facts-modal');

document.querySelector('#reference')?.addEventListener('click', () => {
  if (refModal) refModal.hidden = false;
});
document.querySelector('#close-reference')?.addEventListener('click', () => {
  if (refModal) refModal.hidden = true;
});
refModal?.addEventListener('click', (e) => {
  if (e.target === refModal) refModal.hidden = true;
});

document.querySelector('#btn-facts')?.addEventListener('click', () => {
  if (factsModal) factsModal.hidden = false;
});
document.querySelector('#close-facts')?.addEventListener('click', () => {
  if (factsModal) factsModal.hidden = true;
});
factsModal?.addEventListener('click', (e) => {
  if (e.target === factsModal) factsModal.hidden = true;
});

const urlParams = new URLSearchParams(window.location.search);
const urlMode = urlParams.get('mode') as ArkViewMode | null;
const initialMode: ArkViewMode = urlMode || 'overview';
const initialRulers = urlParams.get('rulers') === '1';

// Assigned once the HUD is wired in onReady; called when the last pair is in and the door is shut.
let handleBoardingComplete: () => void = () => {};

void bootNoahsArkWorld({
  canvas,
  initialMode,
  onBoardingComplete: () => handleBoardingComplete(),
  onProgress: (loaded, total) => {
    if (loadStatus) {
      loadStatus.textContent = `载入模型 ${loaded}/${total}`;
    }
    const pct = Math.round((loaded / Math.max(total, 1)) * 100);
    if (loaderFill) loaderFill.style.width = `${Math.min(96, pct)}%`;
    if (loaderText) loaderText.textContent = `正在载入 3D 模型 ${loaded} / ${total}（${pct}%）`;
  },
  onSelectEntry: (entry) => {
    showInspectCard(entry);
  },
  onReady: (ctrl) => {
    if (initialRulers) {
      ctrl.toggleRulers(true);
    }
    const st = ctrl.getState();
    if (loadStatus) {
      loadStatus.textContent = `✓ 1:1 真实尺度 · ${st.placementsCount} 实体就绪`;
    }
    document.body.dataset.ready = 'true';
    // Keep the loading page up until the first fully-populated frames have actually been drawn
    if (loaderFill) loaderFill.style.width = '100%';
    if (loaderText) loaderText.textContent = '方舟已备齐 · 进入场景';
    let loaderHidden = false;
    const hideLoader = () => {
      if (loaderHidden) return;
      loaderHidden = true;
      loader?.classList.add('hidden');
      window.setTimeout(() => loader?.remove(), 700);
    };
    requestAnimationFrame(() => requestAnimationFrame(hideLoader));
    window.setTimeout(hideLoader, 450); // fallback if rAF is throttled (background tab)

    const syncDockButtons = (mode: ArkViewMode) => {
      for (const btn of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-mode]'))) {
        btn.classList.toggle('active', btn.dataset.mode === mode);
      }
    };
    syncDockButtons(st.viewMode);

    // Dock mode buttons
    for (const btn of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-mode]'))) {
      btn.addEventListener('click', () => {
        const mode = (btn.dataset.mode as ArkViewMode) || 'overview';
        ctrl.setViewMode(mode);
        syncDockButtons(mode);
      });
    }

    // Lighting preset buttons
    for (const btn of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-light]'))) {
      btn.addEventListener('click', () => {
        const preset = (btn.dataset.light as LightingPreset) || 'morning';
        ctrl.setLighting(preset);
        for (const b of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-light]'))) {
          b.classList.toggle('active', b.dataset.light === preset);
        }
      });
    }

    // 3D Biblical Cubit Rulers button
    const btnRulers = document.querySelector<HTMLButtonElement>('#btn-rulers');
    if (btnRulers) {
      btnRulers.classList.toggle('active', st.rulersVisible);
      btnRulers.addEventListener('click', () => {
        const vis = ctrl.toggleRulers();
        btnRulers.classList.toggle('active', vis);
        if (vis) syncDockButtons('overview');
      });
    }

    // Boarding procession toggle button
    const btnBoarding = document.querySelector<HTMLButtonElement>('#btn-boarding');
    const questBoarding = document.querySelector<HTMLElement>('#quest-boarding');
    type BoardingUiState = 'idle' | 'running' | 'complete';
    const updateBoardingUi = (state: BoardingUiState) => {
      if (btnBoarding) {
        btnBoarding.textContent =
          state === 'running' ? '⏹ 停止登船游行' : state === 'complete' ? '🔁 重播百兽登船' : '🐾 启动百兽登船游行';
        btnBoarding.classList.toggle('active', state === 'running');
      }
      if (questBoarding) {
        // The quest only counts as done once every pair is inside and the door has been shut
        questBoarding.classList.toggle('done', state === 'complete');
        questBoarding.classList.toggle('running', state === 'running');
        const check = questBoarding.querySelector('.q-check');
        if (check) check.textContent = state === 'complete' ? '✓' : state === 'running' ? '…' : '▶';
      }
    };
    let boardingCompletedOnce = false;
    handleBoardingComplete = () => {
      boardingCompletedOnce = true;
      updateBoardingUi('complete');
    };
    const startOrStopBoarding = (force?: boolean) => {
      const active = ctrl.toggleBoardingMarch(force);
      updateBoardingUi(active ? 'running' : boardingCompletedOnce ? 'complete' : 'idle');
      if (active) syncDockButtons('overview');
    };

    btnBoarding?.addEventListener('click', () => startOrStopBoarding());

    // Interactive Quest list items
    for (const item of Array.from(document.querySelectorAll<HTMLElement>('[data-quest]'))) {
      item.addEventListener('click', () => {
        const q = item.dataset.quest;
        if (q !== 'boarding') {
          item.classList.add('done');
          const check = item.querySelector('.q-check');
          if (check) check.textContent = '✓';
        }

        if (q === 'yard') {
          ctrl.setViewMode('yard');
          syncDockButtons('yard');
        } else if (q === 'boarding') {
          startOrStopBoarding(true);
        } else if (q === 'cutaway') {
          ctrl.setViewMode('deck1');
          syncDockButtons('deck1');
        } else if (q === 'covenant') {
          ctrl.setViewMode('covenant');
          syncDockButtons('covenant');
        }
      });
    }

    // Boarding speed (scales both walking pace and walk-cycle playback)
    const speedBtns = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-speed]'));
    for (const btn of speedBtns) {
      btn.addEventListener('click', () => {
        const v = ctrl.setBoardingSpeed(Number(btn.dataset.speed) || 1);
        for (const b of speedBtns) b.classList.toggle('active', Number(b.dataset.speed) === v);
      });
    }

    // Motion toggle
    const motionBtn = document.querySelector<HTMLButtonElement>('#motion');
    motionBtn?.addEventListener('click', () => {
      const isMoving = ctrl.toggleMotion();
      motionBtn.textContent = isMoving ? '⏸ 暂停动作' : '▶ 播放动作';
    });
  },
});
