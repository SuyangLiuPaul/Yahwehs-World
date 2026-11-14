import * as THREE from 'three';
import { CUBITS, metres, type Structure } from './specs.ts';
import { animateStructureNodes, buildStructure, collectAnimatedNodes, humanFigure } from './build.ts';
import { fullLocale, hant, onLocale, t } from '../locale.ts';
import './panel.css';

interface PanelOptions {
  cards: Structure[];
  dialog: HTMLDialogElement;
  openers: (Element | null)[];
  beforeOpen?: () => void;
}

const isZh = (): boolean => fullLocale().startsWith('zh');

function esc(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function richText(s: string): string {
  return esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function tx(en: string, zh: string): string {
  return isZh() ? hant(zh) : en;
}

function fmt(n: number): string {
  if (n >= 100) return String(Math.round(n));
  if (n >= 10) {
    const r = Math.round(n * 10) / 10;
    return r % 1 === 0 ? String(r) : r.toFixed(1);
  }
  const r = Math.round(n * 100) / 100;
  return r % 1 === 0 ? String(r) : r.toFixed(2).replace(/0$/, '');
}

function fmtSpan(m: number): string {
  if (m >= 1000) return `${fmt(m / 1000)} ${t('km', '公里')}`;
  return `${fmt(m)} ${t('m', '米')}`;
}

function disposeGroup(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments || child instanceof THREE.Line) {
      child.geometry?.dispose();
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) {
        if (!m) continue;
        for (const val of Object.values(m)) {
          if (val && typeof val === 'object' && 'isTexture' in val) {
            const tex = val as THREE.Texture;
            if (!tex.userData?.shared) tex.dispose();
          }
        }
        m.dispose();
      }
    }
  });
}

function isReliefOrDiorama(s: Structure, varId?: string): boolean {
  return (
    s.kind === 'canaanAllotment' ||
    s.kind === 'exodusRelief' ||
    s.kind === 'gerizimEbalRelief' ||
    s.kind === 'paulJourneysRelief' ||
    s.kind === 'asiaChurchesRelief' ||
    s.kind === 'paulLettersRelief' ||
    s.kind === 'dispersionRelief' ||
    s.kind === 'beatitudesHillside' ||
    (s.kind === 'gideonDiorama' && varId !== 'pitcher-torch-horn') ||
    (s.kind === 'ninevehRelief' && varId !== 'jonah-booth') ||
    (s.kind === 'redSeaCrossing' && varId !== 'seabed-and-wheels') ||
    (s.kind === 'sinaiBounds' && varId !== 'altar-twelve-pillars') ||
    (s.kind === 'zionAscent' && varId !== 'fifteen-steps') ||
    (s.kind === 'mamreJordanRelief' && varId !== 'mamre-oaks-altar') ||
    (s.kind === 'bethelPillar' && varId !== 'anointed-pillar') ||
    (s.kind === 'josephGranaries' && varId === 'dothan-to-egypt') ||
    (s.kind === 'actsCoastalRelief' && varId !== 'joppa-rooftop') ||
    s.kind === 'jobWhirlwind' ||
    (s.kind === 'caesareaHall' && varId === 'promontory-praetorium')
  );
}

function cardHTML(s: Structure, index: number, cubitM: number, selectedVariant?: string): string {
  const activeVarId = selectedVariant ?? s.variants?.options[0]?.id;
  const activeVarOpt = s.variants?.options.find((v) => v.id === activeVarId) ?? s.variants?.options[0];
  const cubitLabel = t('cubits', '肘');
  const unitText = s.unit ? tx(s.unit.en, s.unit.zh) : cubitLabel;

  const dimRows = s.dims.length
    ? s.dims
        .map((d) => {
          const mv = metres(d.cubits, s, cubitM);
          return `<tr><th>${esc(tx(d.en, d.zh))}</th><td>${fmt(d.cubits)} ${esc(unitText)}</td><td class="m">${esc(fmtSpan(mv))}</td></tr>`;
        })
        .join('')
    : '';

  const countRows = s.counts?.length
    ? s.counts
        .map(
          (c) =>
            `<tr><th>${esc(tx(c.en, c.zh))}</th><td class="cnt" colspan="2">${esc(String(c.n))}</td></tr>`,
        )
        .join('')
    : '';

  const variantBlock = s.variants
    ? `<div class="mp-var" data-var-key="${esc(s.variants.key)}">
         <span class="mp-var-lbl">${esc(tx(s.variants.en, s.variants.zh))}</span>
         <div class="mp-var-btns">
           ${s.variants.options
             .map(
               (o) =>
                 `<button type="button" class="${o.id === activeVarOpt?.id ? 'on' : ''}" data-opt="${esc(o.id)}">${esc(tx(o.en, o.zh))}</button>`,
             )
             .join('')}
         </div>
         ${activeVarOpt ? `<p class="mp-var-note">${richText(tx(activeVarOpt.noteEn, activeVarOpt.note))}</p>` : ''}
       </div>`
    : '';

  const maxCompare = Math.max(...s.compare.map((c) => c.m), 1);
  const compareRows = s.compare
    .map((c) => {
      const pct = Math.max(4, Math.min(100, (c.m / maxCompare) * 100));
      return `<div class="mp-cmp-row">
        <span class="mp-cmp-lbl">${esc(tx(c.en, c.zh))}</span>
        <span class="mp-cmp-bar"><i style="width:${pct.toFixed(1)}%"></i></span>
        <span class="mp-cmp-val">${esc(fmtSpan(c.m))}</span>
      </div>`;
    })
    .join('');

  const unstatedBlock = s.unstated.length
    ? `<details class="mp-unstated">
         <summary>${esc(t('What Scripture leaves unstated', '经文未明之处'))}</summary>
         <ul>${s.unstated.map((u) => `<li>${esc(tx(u.en, u.zh))}</li>`).join('')}</ul>
       </details>`
    : '';

  return `<article class="mp-card" data-id="${esc(s.id)}" data-i="${index}">
    <header>
      <div class="mp-card-title-row">
        <h3>${esc(tx(s.en, s.zh))}</h3>
        <span class="mp-ref">${esc(tx(s.ref, s.refZh))}</span>
      </div>
    </header>
    <blockquote class="mp-quote">${esc(tx(s.textEn, s.textZh))}</blockquote>
    ${dimRows || countRows ? `<table class="mp-dims"><tbody>${dimRows}${countRows}</tbody></table>` : ''}
    ${variantBlock}
    <p class="mp-punch">${richText(tx(s.punchEn, s.punchZh))}</p>
    ${compareRows ? `<div class="mp-cmp">${compareRows}</div>` : ''}
    ${unstatedBlock}
  </article>`;
}

export function installMeasures({ cards, dialog, openers, beforeOpen }: PanelOptions): {
  open: (id?: string) => void;
} {
  let cubitIdx = 0; // default 0.445 m
  try {
    const saved = localStorage.getItem('ydh.cubit');
    const found = CUBITS.findIndex((c) => c.id === saved);
    if (found >= 0) cubitIdx = found;
  } catch { /* ignore storage errors */ }
  let activeIdx = 0;
  const chosenVariants = new Map<string, string>();
  for (const s of cards) {
    if (s.variants?.options[0]) chosenVariants.set(s.id, s.variants.options[0].id);
  }

  dialog.innerHTML = `<div class="mp-chrome">
    <div class="mp-head">
      <div class="mp-head-top">
        <div>
          <h2 class="mp-title">${esc(t('Measured to Spec', '按经建形'))}</h2>
          <p class="mp-lede">${esc(
            t(
              'Every dimension and count taken directly from the text. Where Scripture is silent, assumptions are marked.',
              '尺寸与数目按经文所记直取；经文未明言之处，标明所补假设。',
            ),
          )}</p>
        </div>
        <button type="button" class="dialog-close" aria-label="${esc(t('Close', '关闭'))}">&times;</button>
      </div>
      <div class="mp-cubit">
        <span class="mp-c-lbl">${esc(t('Cubit standard', '肘尺标准'))}</span>
        <input id="mp-c-range" type="range" min="0" max="${CUBITS.length - 1}" step="1" value="${cubitIdx}">
        <strong id="mp-c-val"></strong>
        <span id="mp-c-note" class="mp-c-note"></span>
      </div>
    </div>
    <div class="mp-body">
      <div class="mp-stage">
        <canvas class="mp-canvas" tabindex="0" aria-label="${esc(t('Interactive 3D measured structure viewport', '交互式三维按经模型视窗'))}"></canvas>
        <div class="mp-stage-hud">
          <span class="mp-hint">${esc(t('Drag to orbit · Scroll / pinch to zoom', '拖拽旋转 · 滚轮/双指缩放'))}</span>
          <button type="button" class="mp-reset">${esc(t('Reset view', '重置视角'))}</button>
        </div>
        <div class="mp-caption">
          <strong class="mp-cap-name"></strong>
          <span class="mp-cap-meta"></span>
        </div>
      </div>
      <div class="mp-feed"></div>
    </div>
  </div>`;

  const titleEl = dialog.querySelector<HTMLElement>('.mp-title')!;
  const ledeEl = dialog.querySelector<HTMLElement>('.mp-lede')!;
  const closeBtn = dialog.querySelector<HTMLButtonElement>('.dialog-close')!;
  const cubitBar = dialog.querySelector<HTMLElement>('.mp-cubit')!;
  const cLbl = dialog.querySelector<HTMLElement>('.mp-c-lbl')!;
  const cRange = dialog.querySelector<HTMLInputElement>('#mp-c-range')!;
  const cVal = dialog.querySelector<HTMLElement>('#mp-c-val')!;
  const cNote = dialog.querySelector<HTMLElement>('#mp-c-note')!;
  const bodyEl = dialog.querySelector<HTMLElement>('.mp-body')!;
  const stageEl = dialog.querySelector<HTMLElement>('.mp-stage')!;
  const canvas = dialog.querySelector<HTMLCanvasElement>('.mp-canvas')!;
  const hintEl = dialog.querySelector<HTMLElement>('.mp-hint')!;
  const resetBtn = dialog.querySelector<HTMLButtonElement>('.mp-reset')!;
  const capName = dialog.querySelector<HTMLElement>('.mp-cap-name')!;
  const capMeta = dialog.querySelector<HTMLElement>('.mp-cap-meta')!;
  const feedEl = dialog.querySelector<HTMLElement>('.mp-feed')!;

  // Three.js WebGL state
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let pivot: THREE.Group | null = null;
  let activeModel: THREE.Group | null = null;
  let activeAnimatedNodes: THREE.Object3D[] = [];
  let activeBounds = new THREE.Box3();
  let rafId = 0;
  let scrollModelTimer: number | null = null;
  let clockStart = performance.now();
  let stageDirty = true;
  let ignoreScrollUntil = 0;

  // Camera orbit & smooth damping state
  let defaultYaw = 0.62;
  let defaultPitch = 0.34;
  let defaultDist = 18;
  let targetYaw = defaultYaw;
  let targetPitch = defaultPitch;
  let targetDist = defaultDist;
  let curYaw = defaultYaw;
  let curPitch = defaultPitch;
  let curDist = defaultDist;
  let targetCenter = new THREE.Vector3(0, 2, 0);
  let hasOrbited = false;
  let dragging = false;
  const pointers = new Map<number, { x: number; y: number }>();
  let prevPinchDist = 0;

  function renderCubitReadout(): void {
    const c = CUBITS[cubitIdx] ?? CUBITS[0]!;
    const meterUnit = t('m', '米');
    cVal.textContent = `${c.m.toFixed(3)} ${meterUnit} (${tx(c.en, c.zh)})`;
    cNote.textContent = tx(c.noteEn, c.note);
  }

  function renderChromeText(): void {
    titleEl.textContent = t('Measured to Spec', '按经建形');
    ledeEl.textContent = t(
      'Every dimension and count taken directly from the text. Where Scripture is silent, assumptions are marked.',
      '尺寸与数目按经文所记直取；经文未明言之处，标明所补假设。',
    );
    closeBtn.setAttribute('aria-label', t('Close', '关闭'));
    cLbl.textContent = t('Cubit standard', '肘尺标准');
    hintEl.textContent = t('Drag to orbit · Scroll / pinch to zoom', '拖拽旋转 · 滚轮/双指缩放');
    resetBtn.textContent = t('Reset view', '重置视角');
    canvas.setAttribute('aria-label', t('Interactive 3D measured structure viewport', '交互式三维按经模型视窗'));
    renderCubitReadout();
  }

  function renderFeed(): void {
    const cM = (CUBITS[cubitIdx] ?? CUBITS[0]!).m;
    const expanded = new Set<string>();
    feedEl.querySelectorAll<HTMLDetailsElement>('.mp-unstated[open]').forEach((det) => {
      const card = det.closest<HTMLElement>('.mp-card');
      if (card?.dataset.id) expanded.add(card.dataset.id);
    });
    feedEl.innerHTML = cards
      .map((s, i) => cardHTML(s, i, cM, chosenVariants.get(s.id)))
      .join('');
    expanded.forEach((id) => {
      const det = feedEl.querySelector<HTMLDetailsElement>(
        `.mp-card[data-id="${CSS.escape(id)}"] .mp-unstated`,
      );
      if (det) det.open = true;
    });
    markActiveCard(activeIdx);
  }

  function markActiveCard(idx: number): void {
    feedEl.querySelectorAll<HTMLElement>('.mp-card').forEach((el, i) => {
      el.classList.toggle('on', i === idx);
    });
  }

  function updateCaption(s: Structure): void {
    capName.textContent = `${tx(s.en, s.zh)} · ${tx(s.ref, s.refZh)}`;
    const cM = (CUBITS[cubitIdx] ?? CUBITS[0]!).m;
    const varId = chosenVariants.get(s.id);
    if (s.kind === 'cube') {
      capMeta.textContent = t(
        'Earth horizon (R = 6,371 km) & 408 km orbital arc shown beneath',
        '下方参照：地球弧面（半径 6,371 公里）与 408 公里轨道弧',
      );
    } else if (isReliefOrDiorama(s, varId)) {
      if (s.dims.length) {
        const span = Math.max(...s.dims.map((d) => metres(d.cubits, s, cM)));
        capMeta.textContent = `${t('Terrain span', '沙盘跨度')} ${fmtSpan(span)} · ${t(
          '3D topographic & route relief',
          '三维地形与路线沙盘',
        )}`;
      } else if (s.kind === 'gideonDiorama') {
        capMeta.textContent = t(
          '3 × 100 torches around the valley camp · 3D tactical diorama',
          '三队各百支火把合围谷中营盘 · 三维叙事沙盘',
        );
      } else {
        capMeta.textContent = t(
          '3D topographic & narrative diorama · Drag to orbit',
          '三维地形与叙事沙盘 · 可拖拽旋转',
        );
      }
    } else if (s.dims.length) {
      const span = Math.max(...s.dims.map((d) => metres(d.cubits, s, cM)));
      capMeta.textContent = `${t('Primary span', '主尺度')} ${fmtSpan(span)} · ${t(
        '1.72 m reference figure',
        '参照人物 1.72 米',
      )}`;
    } else {
      capMeta.textContent = `${t('Reference height', '参照高度')} ${fmtSpan(s.assumedHeight ?? 1.5)} · ${t(
        '1.72 m figure',
        '参照人物 1.72 米',
      )}`;
    }
  }

  function computeFitDist(box: THREE.Box3, yaw: number, pitch: number): { dist: number; center: THREE.Vector3 } {
    const center = new THREE.Vector3();
    box.getCenter(center);

    if (!camera) return { dist: 16, center };
    const forward = new THREE.Vector3(
      Math.cos(pitch) * Math.sin(yaw),
      Math.sin(pitch),
      Math.cos(pitch) * Math.cos(yaw),
    ).normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();
    const up = new THREE.Vector3().crossVectors(forward, right).normalize();

    const min = box.min;
    const max = box.max;
    const corners = [
      new THREE.Vector3(min.x, min.y, min.z),
      new THREE.Vector3(max.x, min.y, min.z),
      new THREE.Vector3(min.x, max.y, min.z),
      new THREE.Vector3(max.x, max.y, min.z),
      new THREE.Vector3(min.x, min.y, max.z),
      new THREE.Vector3(max.x, min.y, max.z),
      new THREE.Vector3(min.x, max.y, max.z),
      new THREE.Vector3(max.x, max.y, max.z),
    ];

    let halfW = 0;
    let halfH = 0;
    let halfD = 0;
    const tmp = new THREE.Vector3();
    for (const c of corners) {
      tmp.subVectors(c, center);
      halfW = Math.max(halfW, Math.abs(tmp.dot(right)));
      halfH = Math.max(halfH, Math.abs(tmp.dot(up)));
      halfD = Math.max(halfD, Math.abs(tmp.dot(forward)));
    }

    const vFov = (camera.fov * Math.PI) / 180;
    const tanV = Math.tan(vFov * 0.5);
    const tanH = tanV * Math.max(0.6, camera.aspect);
    const fill = 0.72;
    const dV = halfH / (tanV * fill);
    const dH = halfW / (tanH * fill);
    const dist = Math.max(dV, dH) + halfD * 0.85;
    return { dist: Math.max(4.5, dist), center };
  }

  function resizeRenderer(): void {
    if (!renderer || !camera) return;
    const w = Math.max(80, Math.floor(stageEl.clientWidth));
    const h = Math.max(80, Math.floor(stageEl.clientHeight));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const targetW = Math.floor(w * dpr);
    const targetH = Math.floor(h * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      stageDirty = true;
    }
    const nextAspect = w / h;
    if (Math.abs(camera.aspect - nextAspect) > 0.002) {
      camera.aspect = nextAspect;
      camera.updateProjectionMatrix();
      if (activeModel && !hasOrbited) {
        const fit = computeFitDist(activeBounds, defaultYaw, defaultPitch);
        defaultDist = fit.dist;
        targetDist = fit.dist;
        curDist = fit.dist;
      }
      stageDirty = true;
    }
  }

  function initThree(): void {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b101b);

    camera = new THREE.PerspectiveCamera(42, 16 / 10, 0.05, 400);

    // Balanced three-point + hemisphere studio rig
    scene.add(new THREE.HemisphereLight(0xf6eedf, 0x262d3d, 1.0));
    const key = new THREE.DirectionalLight(0xfff1d6, 1.85);
    key.position.set(14, 22, 16);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x88b4e8, 0.72);
    fill.position.set(-16, 10, -10);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xecc67c, 0.45);
    rim.position.set(0, -6, -18);
    scene.add(rim);

    pivot = new THREE.Group();
    scene.add(pivot);

    resizeRenderer();
  }

  function buildStageModel(idx: number, preserveOrbit = false): void {
    initThree();
    if (!pivot || !scene || !camera) return;

    const s = cards[idx];
    if (!s) return;

    if (activeModel) {
      pivot.remove(activeModel);
      disposeGroup(activeModel);
      activeModel = null;
      activeAnimatedNodes = [];
    }

    const assembly = new THREE.Group();
    const cubitM = (CUBITS[cubitIdx] ?? CUBITS[0]!).m;
    const varId = chosenVariants.get(s.id);
    const mesh = buildStructure(s, cubitM, varId);
    const meshBox = new THREE.Box3().setFromObject(mesh);

    let focusBox: THREE.Box3;
    if (s.kind === 'cube') {
      // New Jerusalem: keep Earth horizon sphere below y=0 and frame specifically on the 2,220 km cube + horizon rim
      const cubeM = 12000 * (s.unit?.m ?? 185);
      assembly.add(mesh);
      focusBox = new THREE.Box3(
        new THREE.Vector3(-cubeM * 0.62, -cubeM * 0.28, -cubeM * 0.62),
        new THREE.Vector3(cubeM * 0.62, cubeM * 1.06, cubeM * 0.62),
      );
    } else if (isReliefOrDiorama(s, varId)) {
      // Carved museum relief table / tactical diorama: centered directly on its plinth, no 1.72m companion figure
      const rawCenter = new THREE.Vector3();
      meshBox.getCenter(rawCenter);
      mesh.position.set(-rawCenter.x, -meshBox.min.y, -rawCenter.z);
      assembly.add(mesh);
      focusBox = new THREE.Box3().setFromObject(assembly);
    } else {
      // Ground object at y=0, center its footprint, then place 1.72m short-haired companion figure alongside
      const rawCenter = new THREE.Vector3();
      meshBox.getCenter(rawCenter);
      mesh.position.set(-rawCenter.x, -meshBox.min.y, -rawCenter.z);
      assembly.add(mesh);

      const mSize = new THREE.Vector3();
      meshBox.getSize(mSize);
      const spanXZ = Math.max(mSize.x, mSize.z, 1.0);
      const gap = Math.max(0.55, Math.min(3.5, spanXZ * 0.11));
      const person = humanFigure(1.72);
      person.position.set(mSize.x * 0.5 + gap, 0, Math.min(mSize.z * 0.35, 1.0));
      assembly.add(person);

      // Re-center full (structure + 1.72m person) footprint around (0, y>=0, 0)
      const fullBox = new THREE.Box3().setFromObject(assembly);
      const fullCenter = new THREE.Vector3();
      fullBox.getCenter(fullCenter);
      mesh.position.x -= fullCenter.x;
      mesh.position.z -= fullCenter.z;
      person.position.x -= fullCenter.x;
      person.position.z -= fullCenter.z;

      // Subtle dark-slate scale plinth disc under the assembly (when not astronomical scale)
      const baseRadius = Math.max(fullBox.getSize(new THREE.Vector3()).length() * 0.44, 1.5);
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(baseRadius, baseRadius * 1.02, 0.02 * baseRadius, 48),
        new THREE.MeshStandardMaterial({ color: 0x151c29, roughness: 0.92, metalness: 0.1 }),
      );
      pad.position.y = -0.011 * baseRadius;
      assembly.add(pad);

      focusBox = new THREE.Box3().setFromObject(assembly);
    }

    // Normalize into ~10-unit Three.js coordinate space for crisp depth precision from 0.5m to 2,220km
    const fSize = new THREE.Vector3();
    focusBox.getSize(fSize);
    const maxDim = Math.max(fSize.x, fSize.y, fSize.z, 0.1);
    const normScale = 10 / maxDim;
    assembly.scale.setScalar(normScale);

    activeBounds = new THREE.Box3(
      focusBox.min.clone().multiplyScalar(normScale),
      focusBox.max.clone().multiplyScalar(normScale),
    );
    activeModel = assembly;
    activeAnimatedNodes = collectAnimatedNodes(activeModel);
    pivot.add(activeModel);
    stageDirty = true;

    // Choose readable camera elevation per structure type (higher for plan-dominated enclosures & relief sandboxes)
    const reliefView = isReliefOrDiorama(s, varId);
    const isPlanHeavy =
      s.kind === 'court' || s.kind === 'ezekielGate' || s.kind === 'tabernacleTent' || s.kind === 'ezekielAltar' ||
      s.kind === 'wildernessCamp' || s.kind === 'rev4ThroneRoom' || s.kind === 'shushanCourt' ||
      s.kind === 'jordanCrossing' || s.kind === 'arkToZion' || s.kind === 'bethlehemManger' || s.kind === 'isaiahThrone' ||
      s.kind === 'davidPreparations' || s.kind === 'enclosedGarden' || s.kind === 'perpetualAltar' || s.kind === 'caesareaHall';
    defaultYaw = reliefView ? 0.36 : s.kind === 'highpriest' || s.kind === 'goliath' ? 0.38 : 0.62;
    defaultPitch = reliefView ? 0.56 : isPlanHeavy ? 0.48 : s.kind === 'cube' ? 0.28 : 0.34;

    resizeRenderer();
    const fit = computeFitDist(activeBounds, defaultYaw, defaultPitch);
    defaultDist = fit.dist;
    targetCenter.copy(fit.center);

    if (!preserveOrbit) {
      hasOrbited = false;
      targetYaw = defaultYaw;
      targetPitch = defaultPitch;
      targetDist = defaultDist;
      curYaw = defaultYaw;
      curPitch = defaultPitch;
      curDist = defaultDist;
    }
  }

  function show(idx: number, preserveOrbit = false, deferModel = false): void {
    const clamped = Math.max(0, Math.min(cards.length - 1, idx));
    const changedCard = clamped !== activeIdx;
    activeIdx = clamped;
    const s = cards[activeIdx];
    if (!s) return;

    if (scrollModelTimer !== null) {
      clearTimeout(scrollModelTimer);
      scrollModelTimer = null;
    }

    // Bug B24 fix: toggle .mp-cubit visibility dynamically per active card
    const showCubit = !s.unit && s.dims.length > 0;
    const nextCubitHidden = !showCubit;
    if (cubitBar.hidden !== nextCubitHidden) {
      ignoreScrollUntil = Math.max(ignoreScrollUntil, performance.now() + 260);
      cubitBar.hidden = nextCubitHidden;
    }

    markActiveCard(activeIdx);
    updateCaption(s);

    if (deferModel) {
      const targetIdx = activeIdx;
      scrollModelTimer = window.setTimeout(() => {
        scrollModelTimer = null;
        if (dialog.open && activeIdx === targetIdx) {
          buildStageModel(targetIdx, false);
        }
      }, 90);
    } else {
      buildStageModel(activeIdx, preserveOrbit && !changedCard);
    }
  }

  function stepAnimation(): void {
    rafId = requestAnimationFrame(stepAnimation);
    if (!dialog.open || !renderer || !scene || !camera || document.hidden) return;

    const now = performance.now();
    const elapsed = (now - clockStart) * 0.001;
    const orbiting = Boolean(activeModel && !dragging && pointers.size === 0 && !hasOrbited);
    const hasAnim = activeAnimatedNodes.length > 0;
    const damping =
      Math.abs(targetYaw - curYaw) > 1e-4 ||
      Math.abs(targetPitch - curPitch) > 1e-4 ||
      Math.abs(targetDist - curDist) > Math.max(1e-4, curDist * 1e-4);

    if (!stageDirty && !orbiting && !hasAnim && !damping) return;

    if (hasAnim) animateStructureNodes(activeAnimatedNodes, elapsed);

    // Slow idle turntable spin unless user is dragging or manually orbited
    if (orbiting) {
      targetYaw += 0.0022;
    }

    // Damped spherical orbit interpolation
    curYaw += (targetYaw - curYaw) * 0.16;
    curPitch += (targetPitch - curPitch) * 0.16;
    curDist += (targetDist - curDist) * 0.16;

    const cp = Math.cos(curPitch);
    camera.position.set(
      targetCenter.x + curDist * cp * Math.sin(curYaw),
      targetCenter.y + curDist * Math.sin(curPitch),
      targetCenter.z + curDist * cp * Math.cos(curYaw),
    );
    camera.lookAt(targetCenter);
    renderer.render(scene, camera);
    stageDirty = false;
  }

  function startLoop(): void {
    if (!rafId) {
      clockStart = performance.now();
      stageDirty = true;
      rafId = requestAnimationFrame(stepAnimation);
    }
  }

  function stopLoop(): void {
    if (scrollModelTimer !== null) {
      clearTimeout(scrollModelTimer);
      scrollModelTimer = null;
    }
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && dialog.open) stageDirty = true;
  });

  // Pointer drag-orbit + 2-finger pinch + wheel zoom + double-click / reset button
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stageDirty = true;
    if (pointers.size === 1) {
      dragging = true;
      canvas.classList.add('grabbing');
    } else if (pointers.size === 2) {
      dragging = false;
      const pts = Array.from(pointers.values());
      const p0 = pts[0];
      const p1 = pts[1];
      if (p0 && p1) prevPinchDist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    stageDirty = true;

    if (pointers.size === 1 && dragging) {
      hasOrbited = true;
      targetYaw -= dx * 0.0085;
      targetPitch = Math.max(-0.18, Math.min(1.42, targetPitch + dy * 0.0075));
    } else if (pointers.size === 2) {
      const pts = Array.from(pointers.values());
      const p0 = pts[0];
      const p1 = pts[1];
      if (p0 && p1) {
        const d = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        if (prevPinchDist > 0 && d > 0) {
          hasOrbited = true;
          targetDist = Math.max(defaultDist * 0.28, Math.min(defaultDist * 3.4, targetDist * (prevPinchDist / d)));
        }
        prevPinchDist = d;
      }
    }
  });

  const endPointer = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) prevPinchDist = 0;
    if (pointers.size === 0) {
      dragging = false;
      canvas.classList.remove('grabbing');
    }
    stageDirty = true;
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      hasOrbited = true;
      stageDirty = true;
      const factor = Math.exp(e.deltaY * 0.0012);
      targetDist = Math.max(defaultDist * 0.25, Math.min(defaultDist * 3.5, targetDist * factor));
    },
    { passive: false },
  );

  function resetView(): void {
    hasOrbited = false;
    stageDirty = true;
    targetYaw = defaultYaw;
    targetPitch = defaultPitch;
    targetDist = defaultDist;
  }

  canvas.addEventListener('dblclick', resetView);
  resetBtn.addEventListener('click', resetView);

  canvas.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      hasOrbited = true;
      stageDirty = true;
      targetYaw += 0.16;
    } else if (e.key === 'ArrowRight') {
      hasOrbited = true;
      stageDirty = true;
      targetYaw -= 0.16;
    } else if (e.key === 'ArrowUp') {
      hasOrbited = true;
      stageDirty = true;
      targetPitch = Math.min(1.42, targetPitch + 0.12);
    } else if (e.key === 'ArrowDown') {
      hasOrbited = true;
      stageDirty = true;
      targetPitch = Math.max(-0.18, targetPitch - 0.12);
    } else if (e.key === '+' || e.key === '=') {
      hasOrbited = true;
      stageDirty = true;
      targetDist = Math.max(defaultDist * 0.25, targetDist * 0.86);
    } else if (e.key === '-' || e.key === '_') {
      hasOrbited = true;
      stageDirty = true;
      targetDist = Math.min(defaultDist * 3.5, targetDist * 1.16);
    } else if (e.key === '0') {
      resetView();
    }
  });

  // ResizeObserver keeps WebGL crisp whenever .mp-cubit hides/shows or dialog resizes
  const ro = new ResizeObserver(() => {
    if (dialog.open) resizeRenderer();
  });
  ro.observe(stageEl);

  // Scroll sync: detect the card intersecting the active reading line inside feedEl or bodyEl
  let scrollScheduled = false;
  function syncFromScroll(): void {
    scrollScheduled = false;
    if (!dialog.open || performance.now() < ignoreScrollUntil) return;
    const cardEls = Array.from(feedEl.querySelectorAll<HTMLElement>('.mp-card'));
    if (!cardEls.length) return;

    const wide = window.matchMedia('(min-width: 900px)').matches;
    const scroller = wide ? feedEl : bodyEl;
    const rect = scroller.getBoundingClientRect();

    // If scrolled right to the bottom, activate last card cleanly
    if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 64) {
      if (activeIdx !== cardEls.length - 1) show(cardEls.length - 1, false, true);
      return;
    }

    const stageBottom = stageEl.getBoundingClientRect().bottom;
    const readingY = wide ? rect.top + rect.height * 0.24 : Math.max(rect.top, stageBottom) + 36;

    let bestIdx = activeIdx;
    let bestScore = Infinity;
    for (let i = 0; i < cardEls.length; i++) {
      const cr = cardEls[i]!.getBoundingClientRect();
      if (cr.top <= readingY && cr.bottom >= readingY) {
        bestIdx = i;
        bestScore = 0;
        break;
      }
      const dist = Math.min(Math.abs(cr.top - readingY), Math.abs(cr.bottom - readingY));
      if (dist < bestScore) {
        bestScore = dist;
        bestIdx = i;
      }
    }
    if (bestIdx !== activeIdx) show(bestIdx, false, true);
  }

  const onScroll = () => {
    if (!scrollScheduled) {
      scrollScheduled = true;
      requestAnimationFrame(syncFromScroll);
    }
  };
  feedEl.addEventListener('scroll', onScroll, { passive: true });
  bodyEl.addEventListener('scroll', onScroll, { passive: true });

  // Clicking a card focuses it cleanly; clicking a variant switches model & updates notes
  feedEl.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const card = target.closest<HTMLElement>('.mp-card');
    if (!card) return;
    const idx = Number(card.dataset.i);
    if (!Number.isFinite(idx)) return;

    const btn = target.closest<HTMLButtonElement>('.mp-var-btns button[data-opt]');
    if (btn && btn.dataset.opt) {
      const s = cards[idx];
      if (!s) return;
      const prevVar = chosenVariants.get(s.id);
      chosenVariants.set(s.id, btn.dataset.opt);

      // Update variant UI in-place without jarring scroll jump
      const wrap = card.querySelector<HTMLElement>('.mp-var');
      if (wrap) {
        wrap.querySelectorAll<HTMLButtonElement>('button[data-opt]').forEach((b) => {
          b.classList.toggle('on', b === btn);
        });
        const opt = s.variants?.options.find((o) => o.id === btn.dataset.opt);
        const noteEl = wrap.querySelector<HTMLElement>('.mp-var-note');
        if (noteEl && opt) noteEl.innerHTML = richText(tx(opt.noteEn, opt.note));
      }
      const keepOrbit =
        isReliefOrDiorama(s, prevVar) === isReliefOrDiorama(s, btn.dataset.opt) &&
        s.kind !== 'isaiahThrone' &&
        s.kind !== 'bethlehemManger';
      show(idx, keepOrbit);
      return;
    }

    if (!target.closest('summary, details, a')) {
      ignoreScrollUntil = performance.now() + 400;
      if (idx !== activeIdx) show(idx);
      requestAnimationFrame(() => {
        card.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior });
      });
    }
  });

  // Cubit slider: updates all metre tables & live-rebuilds active model
  cRange.addEventListener('input', () => {
    cubitIdx = Math.max(0, Math.min(CUBITS.length - 1, Number(cRange.value) || 0));
    try {
      const c = CUBITS[cubitIdx];
      if (c) localStorage.setItem('ydh.cubit', c.id);
    } catch { /* ignore storage errors */ }
    renderCubitReadout();
    const cM = (CUBITS[cubitIdx] ?? CUBITS[0]!).m;
    feedEl.querySelectorAll<HTMLElement>('.mp-card').forEach((cardEl) => {
      const s = cards.find((c) => c.id === cardEl.dataset.id);
      if (!s || s.unit) return;
      const tds = cardEl.querySelectorAll<HTMLElement>('table.mp-dims td.m');
      s.dims.forEach((d, di) => {
        const td = tds[di];
        if (td) td.textContent = fmtSpan(metres(d.cubits, s, cM));
      });
    });
    const s = cards[activeIdx];
    if (s) {
      updateCaption(s);
      buildStageModel(activeIdx, true);
    }
  });

  // Re-render strings smoothly on language toggle without losing position
  onLocale(() => {
    renderChromeText();
    renderFeed();
    const s = cards[activeIdx];
    if (s) updateCaption(s);
  });

  // Dialog close lifecycle
  closeBtn.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    stopLoop();
    if (/^#measures(?:=|$)/.test(location.hash)) {
      history.replaceState(null, '', location.pathname + location.search);
    }
  });

  function open(id?: string): void {
    beforeOpen?.();
    renderChromeText();

    const targetIdx = id ? Math.max(0, cards.findIndex((s) => s.id === id)) : activeIdx;
    activeIdx = targetIdx;
    renderFeed();

    if (!dialog.open) dialog.showModal();
    show(activeIdx);
    startLoop();

    if (id) {
      ignoreScrollUntil = performance.now() + 220;
      requestAnimationFrame(() => {
        const cardEl = feedEl.querySelector<HTMLElement>(`.mp-card[data-id="${CSS.escape(id)}"]`);
        cardEl?.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior });
      });
    }
  }

  for (const el of openers) {
    el?.addEventListener('click', () => open());
  }

  const openFromHash = (): void => {
    const m = /^#measures(?:=(.+))?$/.exec(location.hash);
    if (!m) return;
    const req = m[1];
    if (!req || cards.some((s) => s.id === req)) {
      open(req || undefined);
    }
  };

  renderChromeText();
  renderFeed();
  openFromHash();
  addEventListener('hashchange', openFromHash);

  return { open };
}
