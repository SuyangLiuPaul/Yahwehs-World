import * as THREE from 'three';

export type TabernacleTentVariant = 'cutaway' | 'covered';
export type ForestHouseVariant = '3-rows' | '4-rows';
export type EzekielGateVariant = 'cutaway' | 'full';
export type EzekielAltarVariant = 'full' | 'section';
export type GoliathVariant = 'mt-6-cubits' | 'lxx-4-cubits';
export type DuraImageVariant = 'dura-gold' | 'daniel2-metals';

interface MonumentTex {
  cherubLinen: THREE.CanvasTexture;
  cedar: THREE.CanvasTexture;
  ashlar: THREE.CanvasTexture;
  scaleMail: THREE.CanvasTexture;
  glazedPlinth: THREE.CanvasTexture;
}

let cachedMonumentTex: MonumentTex | null = null;

function shareTex(c: HTMLCanvasElement, rx = 1, ry = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.userData.shared = true;
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}

function getMonumentTex(): MonumentTex {
  if (cachedMonumentTex) return cachedMonumentTex;

  // 1. Cherubim embroidered tapestry (Exod 26:1, 31)
  const cc = document.createElement('canvas');
  cc.width = 256;
  cc.height = 256;
  const cx = cc.getContext('2d')!;
  cx.fillStyle = '#efe5cf';
  cx.fillRect(0, 0, 256, 256);
  const bandPalette = ['#1d4f8f', '#5a2468', '#a32222'];
  for (let y = 0; y < 256; y += 64) {
    cx.fillStyle = bandPalette[(y / 64) % bandPalette.length] ?? '#1d4f8f';
    cx.fillRect(0, y + 6, 256, 12);
    cx.fillStyle = '#d4af45';
    cx.fillRect(0, y + 20, 256, 3);
    for (let x = 24; x < 256; x += 64) {
      cx.fillStyle = '#244b82';
      cx.beginPath();
      cx.moveTo(x - 14, y + 40);
      cx.quadraticCurveTo(x, y + 24, x + 14, y + 40);
      cx.lineTo(x + 4, y + 54);
      cx.lineTo(x - 4, y + 54);
      cx.closePath();
      cx.fill();
    }
  }
  const cherubLinen = shareTex(cc, 2, 2);

  // 2. Lebanon Cedar timber planks
  const wc = document.createElement('canvas');
  wc.width = 256;
  wc.height = 256;
  const wx = wc.getContext('2d')!;
  wx.fillStyle = '#7b4827';
  wx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    wx.fillStyle = y % 64 === 0 ? 'rgba(98,53,24,0.45)' : 'rgba(138,84,48,0.3)';
    wx.fillRect(0, y, 256, 30);
    wx.fillStyle = 'rgba(46,24,10,0.45)';
    wx.fillRect(0, y + 30, 256, 2);
  }
  const cedar = shareTex(wc, 3, 2);

  // 3. Dressed ashlar limestone blocks
  const ac = document.createElement('canvas');
  ac.width = 256;
  ac.height = 256;
  const ax = ac.getContext('2d')!;
  ax.fillStyle = '#d4c8af';
  ax.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++) {
    const y = row * 32;
    const off = (row % 2) * 32;
    for (let col = -1; col < 5; col++) {
      const x = col * 64 + off;
      const shade = 200 + (((row * 7 + col * 13) & 15) - 7) * 2;
      ax.fillStyle = `rgb(${shade}, ${shade - 10}, ${shade - 26})`;
      ax.fillRect(x + 2, y + 2, 60, 28);
    }
  }
  const ashlar = shareTex(ac, 4, 3);

  // 4. Overlapping bronze scale armor (1 Sam 17:5)
  const sc = document.createElement('canvas');
  sc.width = 256;
  sc.height = 256;
  const sx = sc.getContext('2d')!;
  sx.fillStyle = '#73481d';
  sx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 16; row++) {
    const y = row * 16;
    const off = (row % 2) * 12;
    for (let x = -12; x < 268; x += 24) {
      const grad = sx.createLinearGradient(x + off, y, x + off, y + 18);
      grad.addColorStop(0, '#d89b4e');
      grad.addColorStop(0.7, '#9f692a');
      grad.addColorStop(1, '#583311');
      sx.fillStyle = grad;
      sx.beginPath();
      sx.arc(x + off + 12, y + 6, 11, 0, Math.PI, false);
      sx.lineTo(x + off + 1, y);
      sx.lineTo(x + off + 23, y);
      sx.closePath();
      sx.fill();
    }
  }
  const scaleMail = shareTex(sc, 3, 4);

  // 5. Glazed Babylonian plinth tiles
  const gc = document.createElement('canvas');
  gc.width = 256;
  gc.height = 256;
  const gx = gc.getContext('2d')!;
  gx.fillStyle = '#334d6e';
  gx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    gx.fillStyle = y % 64 === 0 ? '#b78b39' : '#253c59';
    gx.fillRect(0, y, 256, 8);
    for (let x = 0; x < 256; x += 32) {
      gx.strokeStyle = 'rgba(218, 178, 92, 0.35)';
      gx.strokeRect(x + 2, y + 10, 28, 20);
    }
  }
  const glazedPlinth = shareTex(gc, 2, 1);

  cachedMonumentTex = { cherubLinen, cedar, ashlar, scaleMail, glazedPlinth };
  return cachedMonumentTex;
}

/**
 * Tabernacle Tent, Frames & 4-Layer Coverings (Exodus 26):
 * 30 x 10 x 10 cubits golden acacia frames standing in 96+4 silver sockets,
 * 5 horizontal bars per side, interior 4-pillar cherubim veil, 5-pillar east door screen,
 * and 4 stepped covering layers (linen cherubim, goat hair, red ram skins, dark outer hides).
 */
export function buildTabernacleTent(
  cubitM: number,
  variant: TabernacleTentVariant = 'cutaway',
): THREE.Group {
  const C = cubitM;
  const L = 30 * C;
  const W = 10 * C;
  const H = 10 * C;
  const tex = getMonumentTex();
  const g = new THREE.Group();
  const cut = variant === 'cutaway';

  const gold = new THREE.MeshStandardMaterial({ color: 0xe7b946, metalness: 0.86, roughness: 0.24 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xd0d7e0, metalness: 0.88, roughness: 0.26 });
  const bronze = new THREE.MeshStandardMaterial({ color: 0xb67a42, metalness: 0.72, roughness: 0.36 });
  const mLinenCover = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex.cherubLinen,
    roughness: 0.82,
    side: THREE.DoubleSide,
  });
  const mGoatHair = new THREE.MeshStandardMaterial({
    color: 0x3b302a,
    roughness: 0.94,
    side: THREE.DoubleSide,
  });
  const mRamRed = new THREE.MeshStandardMaterial({
    color: 0x8f2424,
    roughness: 0.84,
    side: THREE.DoubleSide,
  });
  const mOuterHide = new THREE.MeshStandardMaterial({
    color: 0x3f434a,
    roughness: 0.88,
    side: THREE.DoubleSide,
  });

  // Floor mat showing 20c Holy Place + 10c Most Holy Place boundary
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xc2aa82, roughness: 0.95 });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(L + 2 * C, 0.06 * C, W + 2 * C), floorMat);
  floor.position.y = 0.03 * C;
  g.add(floor);

  const boardT = 0.22 * C;
  const boardW = 1.5 * C;
  const socketH = 0.32 * C;
  const boardGeo = new THREE.BoxGeometry(boardW * 0.95, H, boardT);
  const socketGeo = new THREE.BoxGeometry(boardW * 0.42, socketH, boardT * 1.45);

  const addBoardWithSockets = (x: number, z: number, rotY = 0, wOverride?: number) => {
    const bg = new THREE.Group();
    const w = wOverride ?? boardW;
    const board = new THREE.Mesh(
      wOverride ? new THREE.BoxGeometry(w * 0.94, H, boardT) : boardGeo,
      gold,
    );
    board.position.y = socketH * 0.5 + H * 0.5;
    bg.add(board);

    for (const off of [-w * 0.24, w * 0.24]) {
      const sock = new THREE.Mesh(socketGeo, silver);
      sock.position.set(off, socketH * 0.5, 0);
      bg.add(sock);
    }
    bg.position.set(x, 0, z);
    bg.rotation.y = rotY;
    g.add(bg);
  };

  // North wall (+Z edge = -W/2? Place interior facing +Z camera cleanly: North = -W/2, South = +W/2)
  for (let i = 0; i < 20; i++) {
    const x = -L * 0.5 + (i + 0.5) * boardW;
    // Always full 20 boards on far (-Z) wall
    addBoardWithSockets(x, -W * 0.5);
    // South (+Z) wall: if cutaway, keep west 4 + east 2 boards so full interior shines cleanly
    if (!cut || i < 4 || i >= 18) {
      addBoardWithSockets(x, W * 0.5);
    }
  }

  // West rear wall (x = -L/2): 6 regular boards (9C) + 2 corner boards (0.5C each)
  for (let i = 0; i < 6; i++) {
    const z = -4.5 * C + (i + 0.5) * boardW;
    addBoardWithSockets(-L * 0.5, z, Math.PI / 2);
  }
  addBoardWithSockets(-L * 0.5, -4.75 * C, Math.PI / 2, 0.5 * C);
  addBoardWithSockets(-L * 0.5, 4.75 * C, Math.PI / 2, 0.5 * C);

  // Horizontal golden bars along north, west, and surviving south boards (Exod 26:26-28)
  for (const barY of [2.2 * C, 5.0 * C, 7.8 * C]) {
    const northBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11 * C, 0.11 * C, L * 0.98, 10),
      gold,
    );
    northBar.rotation.z = Math.PI / 2;
    northBar.position.set(0, barY + socketH * 0.5, -W * 0.5 - boardT * 0.85);
    g.add(northBar);

    const westBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11 * C, 0.11 * C, W * 0.98, 10),
      gold,
    );
    westBar.rotation.x = Math.PI / 2;
    westBar.position.set(-L * 0.5 - boardT * 0.85, barY + socketH * 0.5, 0);
    g.add(westBar);

    if (!cut) {
      const southBar = northBar.clone();
      southBar.position.z = W * 0.5 + boardT * 0.85;
      g.add(southBar);
    }
  }

  // Dividing Veil at 20/10 division (x = -L/2 + 10C = -5C): 4 gold pillars on silver sockets
  const veilX = -L * 0.5 + 10 * C;
  for (let i = 0; i < 4; i++) {
    const pz = -3.75 * C + i * 2.5 * C;
    const sock = new THREE.Mesh(new THREE.BoxGeometry(0.65 * C, socketH, 0.65 * C), silver);
    sock.position.set(veilX, socketH * 0.5, pz);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * C, 0.22 * C, H, 14), gold);
    col.position.set(veilX, socketH * 0.5 + H * 0.5, pz);
    g.add(sock, col);
  }
  const veilCloth = new THREE.Mesh(
    new THREE.PlaneGeometry(cut ? W * 0.65 : W * 0.96, H * 0.98),
    mLinenCover,
  );
  veilCloth.rotation.y = Math.PI / 2;
  veilCloth.position.set(veilX, socketH * 0.5 + H * 0.49, cut ? -1.65 * C : 0);
  g.add(veilCloth);

  // Subtle interior sanctuary furniture markers (Ark, Menorah, Table, Incense Altar) inside the room!
  const arkHint = new THREE.Mesh(new THREE.BoxGeometry(1.5 * C, 1.5 * C, 2.5 * C), gold);
  arkHint.position.set(-10 * C, 0.85 * C, 0);
  const altarHint = new THREE.Mesh(new THREE.BoxGeometry(1 * C, 2 * C, 1 * C), gold);
  altarHint.position.set(-3 * C, 1.0 * C, 0);
  const tableHint = new THREE.Mesh(new THREE.BoxGeometry(2 * C, 1.5 * C, 1 * C), gold);
  tableHint.position.set(3 * C, 0.75 * C, -3.2 * C);
  const menorahHint = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * C, 0.45 * C, 2.6 * C, 10), gold);
  menorahHint.position.set(3 * C, 1.3 * C, 2.8 * C);
  g.add(arkHint, altarHint, tableHint, menorahHint);

  // East Door Screen (x = +L/2): 5 gold pillars on 5 bronze sockets (Exod 26:36-37)
  for (let i = 0; i < 5; i++) {
    const pz = -4 * C + i * 2 * C;
    const sock = new THREE.Mesh(new THREE.BoxGeometry(0.62 * C, socketH, 0.62 * C), bronze);
    sock.position.set(L * 0.5, socketH * 0.5, pz);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * C, 0.22 * C, H, 14), gold);
    col.position.set(L * 0.5, socketH * 0.5 + H * 0.5, pz);
    g.add(sock, col);
  }
  const doorCurtain = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 0.38, H * 0.96),
    mLinenCover,
  );
  doorCurtain.rotation.y = Math.PI / 2;
  doorCurtain.position.set(L * 0.5 + 0.08 * C, socketH * 0.5 + H * 0.48, -W * 0.29);
  g.add(doorCurtain);

  // Four stepped covering layers draped cleanly over top & north side (cutaway peels layers back along X!)
  const topY = socketH * 0.5 + H + 0.08 * C;
  const makeLayer = (
    xMin: number,
    xMax: number,
    liftY: number,
    dropZ: number,
    mat: THREE.Material,
  ) => {
    const spanX = xMax - xMin;
    const cx = (xMin + xMax) * 0.5;
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(spanX, W + 0.3 * C), mat);
    roof.rotation.x = -Math.PI / 2;
    roof.position.set(cx, topY + liftY, 0);
    g.add(roof);

    // North drape
    const drapeN = new THREE.Mesh(new THREE.PlaneGeometry(spanX, dropZ), mat);
    drapeN.position.set(cx, topY + liftY - dropZ * 0.5, -(W * 0.5 + 0.16 * C + liftY * 0.6));
    g.add(drapeN);

    if (!cut) {
      const drapeS = drapeN.clone();
      drapeS.position.z = W * 0.5 + 0.16 * C + liftY * 0.6;
      g.add(drapeS);
    }
  };

  if (cut) {
    // Stepped strata cutaway from West to East so all 4 layers are clearly distinguishable
    makeLayer(-L * 0.52, -0.22 * L, 0.42 * C, 8.8 * C, mOuterHide);
    makeLayer(-L * 0.50, 0.06 * L, 0.30 * C, 8.6 * C, mRamRed);
    makeLayer(-L * 0.48, 0.28 * L, 0.18 * C, 9.2 * C, mGoatHair);
    makeLayer(-L * 0.46, 0.48 * L, 0.06 * C, 8.0 * C, mLinenCover);
  } else {
    makeLayer(-L * 0.5, L * 0.5, 0.05 * C, 8.0 * C, mLinenCover);
    makeLayer(-L * 0.52, L * 0.54, 0.17 * C, 9.2 * C, mGoatHair);
    makeLayer(-L * 0.53, L * 0.52, 0.29 * C, 8.5 * C, mRamRed);
    makeLayer(-L * 0.54, L * 0.52, 0.41 * C, 8.8 * C, mOuterHide);
  }

  return g;
}

/**
 * House of the Forest of Lebanon (1 Kings 7:2-5):
 * 100 x 50 x 30 cubits royal cedar hall with 45 (3x15 MT) or 60 (4x15) cedar columns,
 * cedar ceiling beams, and 3 tiers of opposing square clerestory windows.
 */
export function buildForestHouse(
  cubitM: number,
  variant: ForestHouseVariant = '3-rows',
): THREE.Group {
  const C = cubitM;
  const L = 100 * C;
  const W = 50 * C;
  const H = 30 * C;
  const tex = getMonumentTex();
  const g = new THREE.Group();

  const stone = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex.ashlar,
    roughness: 0.88,
  });
  const cedar = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex.cedar,
    roughness: 0.78,
  });
  const darkCedar = new THREE.MeshStandardMaterial({ color: 0x4f2e17, roughness: 0.85 });
  const plinthH = 2.0 * C;

  // Dressed limestone podium
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(L + 4 * C, plinthH, W + 4 * C), stone);
  plinth.position.y = plinthH * 0.5;
  g.add(plinth);

  const wallT = 2.0 * C;
  // Back wall (-Z), West wall (-X), East wall (+X) full; Front wall (+Z) cut away to reveal cedar forest
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(L, H, wallT), stone);
  backWall.position.set(0, plinthH + H * 0.5, -W * 0.5 + wallT * 0.5);
  g.add(backWall);

  for (const sx of [-1, 1]) {
    const endWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, H, W), stone);
    endWall.position.set(sx * (L * 0.5 - wallT * 0.5), plinthH + H * 0.5, 0);
    g.add(endWall);
  }

  // Front lower balustrade + two corner piers with 3 tiers of window reveals (1 Kgs 7:4-5)
  const frontPierW = 14 * C;
  for (const sx of [-1, 1]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(frontPierW, H, wallT), stone);
    pier.position.set(sx * (L * 0.5 - frontPierW * 0.5), plinthH + H * 0.5, W * 0.5 - wallT * 0.5);
    g.add(pier);
  }
  const sill = new THREE.Mesh(new THREE.BoxGeometry(L - frontPierW * 2, 2.2 * C, wallT), stone);
  sill.position.set(0, plinthH + 1.1 * C, W * 0.5 - wallT * 0.5);
  g.add(sill);

  // 3 Tiers of square-framed opposing clerestory window openings along rear & front corner piers
  for (let tier = 0; tier < 3; tier++) {
    const wy = plinthH + 15 * C + tier * 4.5 * C;
    for (let i = 0; i < 12; i++) {
      const wx = -L * 0.42 + (i / 11) * (L * 0.84);
      const win = new THREE.Mesh(new THREE.BoxGeometry(2.6 * C, 2.6 * C, wallT * 1.15), darkCedar);
      win.position.set(wx, wy, -W * 0.5 + wallT * 0.5);
      g.add(win);
    }
  }

  // Rows of massive Lebanon cedar columns (3 rows x 15 = 45 OR 4 rows x 15 = 60)
  const rows = variant === '4-rows' ? 4 : 3;
  const cols = 15;
  const colGeo = new THREE.CylinderGeometry(0.95 * C, 1.12 * C, H - 2.5 * C, 12);
  const capGeo = new THREE.BoxGeometry(2.8 * C, 1.2 * C, 2.8 * C);
  const baseGeo = new THREE.BoxGeometry(2.8 * C, 0.8 * C, 2.8 * C);

  for (let r = 0; r < rows; r++) {
    const z = rows === 3 ? (r - 1) * 14 * C : (-1.5 + r) * 11 * C;
    for (let c = 0; c < cols; c++) {
      const x = -L * 0.44 + (c / (cols - 1)) * (L * 0.88);
      const col = new THREE.Mesh(colGeo, cedar);
      col.position.set(x, plinthH + (H - 2.5 * C) * 0.5, z);
      const base = new THREE.Mesh(baseGeo, stone);
      base.position.set(x, plinthH + 0.4 * C, z);
      const cap = new THREE.Mesh(capGeo, darkCedar);
      cap.position.set(x, plinthH + H - 2.2 * C, z);
      g.add(col, base, cap);
    }
    // Longitudinal cedar architrave beam running along each row
    const beam = new THREE.Mesh(new THREE.BoxGeometry(L * 0.94, 1.8 * C, 1.8 * C), darkCedar);
    beam.position.set(0, plinthH + H - 1.0 * C, z);
    g.add(beam);
  }

  // Transverse cedar roof beams + partial roof deck at rear half (leaving colonnade visible)
  for (let c = 0; c < cols; c++) {
    const x = -L * 0.44 + (c / (cols - 1)) * (L * 0.88);
    const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(1.4 * C, 1.4 * C, W * 0.92), cedar);
    crossBeam.position.set(x, plinthH + H - 0.5 * C, 0);
    g.add(crossBeam);
  }
  const roofSlice = new THREE.Mesh(new THREE.BoxGeometry(L, 1.2 * C, W * 0.45), cedar);
  roofSlice.position.set(0, plinthH + H + 0.6 * C, -W * 0.275);
  g.add(roofSlice);

  return g;
}

/**
 * Ezekiel's Monumental Gatehouse (Ezekiel 40:6-16):
 * 50 x 25 long cubits with 7 steps, 6c thresholds, 3+3 6c guardrooms,
 * 5c separating piers with palm-tree pilasters, 10c central passage, and 8c inner porch.
 */
export function buildEzekielGate(
  cubitM: number,
  variant: EzekielGateVariant = 'cutaway',
): THREE.Group {
  const C = cubitM;
  const L = 50 * C;
  const W = 25 * C;
  const H = variant === 'cutaway' ? 11 * C : 15 * C;
  const tex = getMonumentTex();
  const g = new THREE.Group();

  const stone = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex.ashlar,
    roughness: 0.86,
  });
  const cedar = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex.cedar,
    roughness: 0.78,
  });
  const palmGold = new THREE.MeshStandardMaterial({ color: 0xc2984b, roughness: 0.52 });

  const podiumH = 2.8 * C;
  // Base pavement (25 x 50 cubits)
  const floor = new THREE.Mesh(new THREE.BoxGeometry(L, podiumH, W), stone);
  floor.position.y = podiumH * 0.5;
  g.add(floor);

  // 7 Ascending East Steps approaching the outer threshold at +X (Ezek 40:22, 26)
  for (let i = 0; i < 7; i++) {
    const stepH = (podiumH / 7) * (i + 1);
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.1 * C, stepH, 12 * C), stone);
    step.position.set(L * 0.5 + (6.5 - i) * 1.1 * C, stepH * 0.5, 0);
    g.add(step);
  }

  // Gate axis along X from +25C (outer east entrance) to -25C (inner court porch):
  // East outer threshold: x = +19C..+25C (6C)
  // 3 Guardrooms (6C each) + 2 inner 5C piers + 2 flanking threshold piers:
  // Pier centers along X: [+19.5..+24.5 wall], [+11.5..+16.5], [+2.5..+7.5? Wait:]
  // Exact 50C breakdown (Ezek 40:6-15):
  // 6 (outer threshold) + 6 (room1) + 5 (pier) + 6 (room2) + 5 (pier) + 6 (room3) + 6 (inner threshold) + 8 (porch) + 2 (porch post wall) = 50C!
  const wallSide = (zCenter: number, zThick: number) => {
    const outerBack = new THREE.Mesh(new THREE.BoxGeometry(L, H, 1.5 * C), stone);
    outerBack.position.set(0, podiumH + H * 0.5, zCenter > 0 ? W * 0.5 - 0.75 * C : -W * 0.5 + 0.75 * C);
    g.add(outerBack);
    void zThick;
  };
  wallSide(-1, 1.5 * C);
  if (variant === 'full') wallSide(1, 1.5 * C);

  // Dividing 5C jamb-piers & threshold jambs flanking the 10C central passage (|z| >= 5C to |z| <= 12.5C)
  const wallIntervals: Array<[number, number]> = [
    [19, 25], // 6C outer threshold wall
    [8, 13],  // 5C pier between guardroom 1 & 2
    [-3, 2],  // 5C pier between guardroom 2 & 3
    [-15, -9], // 6C inner threshold
    [-25, -23], // 2C inner porch jamb wall (closing 8C porch)
  ];

  for (const [x0, x1] of wallIntervals) {
    const len = x1 - x0;
    const cx = (x0 + x1) * 0.5 * C;
    for (const sz of [-1, 1]) {
      const pier = new THREE.Mesh(
        new THREE.BoxGeometry(len * C, H, 7.5 * C),
        stone,
      );
      pier.position.set(cx, podiumH + H * 0.5, sz * (5 * C + 3.75 * C));
      g.add(pier);

      // Palm-tree relief pilaster facing the central 10C passage (Ezek 40:16)
      const palmShaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32 * C, 0.36 * C, H * 0.78, 8),
        palmGold,
      );
      palmShaft.position.set(cx, podiumH + H * 0.42, sz * 4.88 * C);
      const palmCrown = new THREE.Mesh(
        new THREE.ConeGeometry(0.85 * C, 1.1 * C, 6),
        palmGold,
      );
      palmCrown.position.set(cx, podiumH + H * 0.82, sz * 4.88 * C);
      g.add(palmShaft, palmCrown);
    }
  }

  // Highlight raised 1-cubit boundary sills inside each of the 6 guardrooms (Ezek 40:12)
  const roomCentersX = [16, 5, -6];
  for (const rx of roomCentersX) {
    for (const sz of [-1, 1]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(6 * C, 1.0 * C, 1.0 * C), stone);
      curb.position.set(rx * C, podiumH + 0.5 * C, sz * 5.5 * C);
      g.add(curb);
    }
  }

  // Roof beams & partial cedar roof when 'full'
  if (variant === 'full') {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(L, 1.4 * C, W), cedar);
    roof.position.set(0, podiumH + H + 0.7 * C, 0);
    g.add(roof);
  } else {
    // Cutaway lintels spanning across inner porch to emphasize passage scale
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(8 * C, 1.2 * C, 13 * C), cedar);
    lintel.position.set(-19 * C, podiumH + H + 0.6 * C, -2 * C);
    g.add(lintel);
  }

  return g;
}

/**
 * Ezekiel's Stepped Altar (Ezekiel 43:13-17):
 * Tiered altar in long cubits:
 * 18c base curb & drainage gutter (1c high),
 * 16c lower settle (2c high),
 * 14c upper settle (4c high),
 * 12c hearth / Ariel (4c high) + 4 corner horns + east stairs + fire embers.
 */
export function buildEzekielAltar(
  cubitM: number,
  variant: EzekielAltarVariant = 'full',
): THREE.Group {
  const C = cubitM;
  const g = new THREE.Group();
  const tex = getMonumentTex();
  const section = variant === 'section';

  const stone = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex.ashlar,
    roughness: 0.85,
  });
  const coreStone = new THREE.MeshStandardMaterial({ color: 0xa29379, roughness: 0.92 });
  const darkSlate = new THREE.MeshStandardMaterial({ color: 0x5c5349, roughness: 0.9 });

  const addTier = (spanC: number, hC: number, yBottomC: number, mat: THREE.Material) => {
    const w = spanC * C;
    const h = hC * C;
    if (section) {
      // Slice front-right (+Z) quarter open cleanly to show internal stepped courses
      const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.52), mat);
      back.position.set(0, yBottomC * C + h * 0.5, -w * 0.24);
      const cutFace = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, h, w * 0.48), coreStone);
      cutFace.position.set(-w * 0.25, yBottomC * C + h * 0.5, w * 0.26);
      g.add(back, cutFace);
    } else {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
      m.position.y = yBottomC * C + h * 0.5;
      g.add(m);
    }
  };

  // Tier 0: 18c outer base curb & 1c drainage bosom (y: 0..1C)
  addTier(18, 1.0, 0, darkSlate);
  // Tier 1: 16c lower settle (y: 1..3C)
  addTier(16, 2.0, 1.0, stone);
  // Tier 2: 14c upper settle (y: 3..7C)
  addTier(14, 4.0, 3.0, stone);
  // Tier 3: 12c hearth / Ariel (y: 7..11C)
  addTier(12, 4.0, 7.0, stone);

  // Perimeter gutter border curb (1-span high rim on 18c base)
  const rimH = 0.5 * C;
  for (const sz of [-1, 1]) {
    if (section && sz > 0) continue;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(18 * C, rimH, 0.5 * C), stone);
    bar.position.set(0, 1.0 * C + rimH * 0.5, sz * 8.75 * C);
    g.add(bar);
  }

  // Four 1-cubit horns on corners of 12c hearth (y: 11..12C)
  const hornGeo = new THREE.ConeGeometry(0.65 * C, 1.2 * C, 4);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      if (section && sx > 0 && sz > 0) continue;
      const horn = new THREE.Mesh(hornGeo, stone);
      horn.rotation.y = Math.PI / 4;
      horn.position.set(sx * 5.4 * C, 11.6 * C, sz * 5.4 * C);
      g.add(horn);
    }
  }

  // Hearth grate & glowing coals atop 12c Ariel (Ezek 43:15-16)
  const emberMat = new THREE.MeshStandardMaterial({
    color: 0xe64d19,
    emissive: 0xd13808,
    emissiveIntensity: 0.72,
    roughness: 0.78,
  });
  const hearth = new THREE.Mesh(
    new THREE.BoxGeometry(section ? 5.5 * C : 9 * C, 0.45 * C, section ? 5.5 * C : 9 * C),
    emberMat,
  );
  hearth.position.set(section ? -2 * C : 0, 11.15 * C, section ? -2 * C : 0);
  hearth.userData.ember = 3;
  g.add(hearth);

  // Ascending East Stairs facing east (+X side, Ezek 43:17)
  const steps = 11;
  for (let i = 0; i < steps; i++) {
    const sy = ((i + 1) / steps) * 8.5 * C;
    const sx = 14.5 * C - i * 0.78 * C;
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.95 * C, sy, 4.2 * C), stone);
    step.position.set(sx, sy * 0.5, 0);
    g.add(step);
  }

  return g;
}

/**
 * Goliath's Stature & Bronze Armor (1 Samuel 17:4-7):
 * 6 cubits + 1 span (~2.89-2.97m MT) vs 4 cubits + 1 span (~2.0m LXX/4QSam),
 * short-haired (1 Cor 11:14) Philistine warrior in bronze scale coat (5,000 shekels),
 * bronze helmet & greaves, bronze javelin slung on back, and weaver's-beam spear.
 */
export function buildGoliath(
  cubitM: number,
  variant: GoliathVariant = 'mt-6-cubits',
): THREE.Group {
  const heightM = variant === 'lxx-4-cubits' ? 4.5 * cubitM : 6.5 * cubitM;
  const s = heightM / 2.9; // Baseline proportions calibrated to 2.9m Goliath standing at exact `heightM`
  const tex = getMonumentTex();
  const g = new THREE.Group();

  const mSkin = new THREE.MeshStandardMaterial({ color: 0xaa7552, roughness: 0.68 });
  const mHair = new THREE.MeshStandardMaterial({ color: 0x221712, roughness: 0.88 });
  const mTunic = new THREE.MeshStandardMaterial({ color: 0x6e1f22, roughness: 0.82 });
  const mBronze = new THREE.MeshStandardMaterial({ color: 0xc2853d, metalness: 0.78, roughness: 0.3 });
  const mScale = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex.scaleMail,
    metalness: 0.68,
    roughness: 0.34,
  });
  const mIron = new THREE.MeshStandardMaterial({ color: 0x454a52, metalness: 0.85, roughness: 0.42 });
  const mWood = new THREE.MeshStandardMaterial({ color: 0x664123, roughness: 0.82 });

  // Sandals & Bronze Greaves on shins (1 Sam 17:6)
  for (const side of [-1, 1]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16 * s, 0.09 * s, 0.36 * s), mWood);
    foot.position.set(side * 0.19 * s, 0.045 * s, 0.04 * s);
    g.add(foot);

    const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * s, 0.088 * s, 0.64 * s, 14), mSkin);
    calf.position.set(side * 0.19 * s, 0.40 * s, 0);
    g.add(calf);

    const greave = new THREE.Mesh(
      new THREE.CylinderGeometry(0.122 * s, 0.098 * s, 0.60 * s, 14, 1, false, -0.75, Math.PI * 1.15),
      mBronze,
    );
    greave.position.set(side * 0.19 * s, 0.41 * s, 0.015 * s);
    g.add(greave);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.145 * s, 0.12 * s, 0.62 * s, 14), mSkin);
    thigh.position.set(side * 0.19 * s, 1.02 * s, 0);
    g.add(thigh);
  }

  // Crimson war skirt & belt
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.32 * s, 0.38 * s, 0.56 * s, 18), mTunic);
  skirt.scale.set(1.12, 1, 0.72);
  skirt.position.y = 1.18 * s;
  g.add(skirt);

  // Coat of Bronze Scale Mail (5,000 shekels, 1 Sam 17:5)
  const cuirass = new THREE.Mesh(new THREE.CylinderGeometry(0.37 * s, 0.32 * s, 0.92 * s, 22), mScale);
  cuirass.scale.set(1.16, 1, 0.74);
  cuirass.position.y = 1.76 * s;
  g.add(cuirass);

  const scaleSkirt = new THREE.Mesh(new THREE.CylinderGeometry(0.33 * s, 0.38 * s, 0.32 * s, 20), mScale);
  scaleSkirt.scale.set(1.14, 1, 0.72);
  scaleSkirt.position.y = 1.24 * s;
  g.add(scaleSkirt);

  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.33 * s, 0.33 * s, 0.11 * s, 20), mBronze);
  belt.scale.set(1.16, 1, 0.74);
  belt.position.y = 1.40 * s;
  g.add(belt);

  // Broad Bronze Pauldrons + Arms
  for (const side of [-1, 1]) {
    const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 14, 10), mScale);
    pauldron.scale.set(1.1, 0.85, 1.0);
    pauldron.position.set(side * 0.44 * s, 2.15 * s, 0);
    g.add(pauldron);

    const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.105 * s, 0.095 * s, 0.52 * s, 12), mSkin);
    upperArm.position.set(side * 0.47 * s, 1.84 * s, 0.02 * s);
    upperArm.rotation.z = side * 0.14;
    g.add(upperArm);

    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.088 * s, 0.075 * s, 0.46 * s, 12), mBronze);
    forearm.position.set(side * 0.52 * s, 1.46 * s, side > 0 ? 0.14 * s : 0.08 * s);
    forearm.rotation.x = -0.35;
    g.add(forearm);
  }

  // Head, Short Hair & Short Warrior Beard (1 Cor 11:14) + Bronze Helmet (1 Sam 17:5)
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * s, 0.13 * s, 0.18 * s, 14), mSkin);
  neck.position.y = 2.28 * s;
  g.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.175 * s, 18, 14), mSkin);
  head.scale.set(0.88, 1.06, 0.96);
  head.position.y = 2.48 * s;
  g.add(head);

  const shortBeard = new THREE.Mesh(
    new THREE.SphereGeometry(0.15 * s, 14, 10, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.42),
    mHair,
  );
  shortBeard.position.set(0, 2.42 * s, 0.02 * s);
  g.add(shortBeard);

  const helmetBowl = new THREE.Mesh(
    new THREE.SphereGeometry(0.195 * s, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
    mBronze,
  );
  helmetBowl.scale.set(0.92, 1.08, 1.02);
  helmetBowl.position.set(0, 2.52 * s, -0.01 * s);
  g.add(helmetBowl);

  // Bronze ridge crest crowning at exact `heightM` (`~2.89m` or `~2.0m`)
  const helmCrest = new THREE.Mesh(new THREE.BoxGeometry(0.055 * s, 0.19 * s, 0.28 * s), mBronze);
  helmCrest.position.set(0, 2.80 * s, 0);
  g.add(helmCrest);

  // Bronze javelin slung across his shoulders (1 Sam 17:6)
  const javelin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024 * s, 0.024 * s, 1.65 * s, 10),
    mBronze,
  );
  javelin.position.set(-0.04 * s, 1.85 * s, -0.26 * s);
  javelin.rotation.z = -0.62;
  g.add(javelin);

  // Massive Weaver's-Beam Spear with 600-shekel Iron Head in right hand (1 Sam 17:7)
  const spearShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042 * s, 0.048 * s, 3.05 * s, 12),
    mWood,
  );
  spearShaft.position.set(0.56 * s, 1.52 * s, 0.22 * s);
  g.add(spearShaft);

  const spearHead = new THREE.Mesh(new THREE.ConeGeometry(0.088 * s, 0.48 * s, 4), mIron);
  spearHead.position.set(0.56 * s, 3.24 * s, 0.22 * s);
  g.add(spearHead);

  // Heavy bronze-rimmed wooden shield beside left arm
  const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.46 * s, 0.46 * s, 0.055 * s, 20), mBronze);
  shield.scale.set(0.85, 1, 1.35);
  shield.rotation.z = Math.PI / 2;
  shield.rotation.y = 0.28;
  shield.position.set(-0.56 * s, 1.25 * s, 0.18 * s);
  g.add(shield);

  return g;
}

/**
 * Nebuchadnezzar's Golden Image on the Plain of Dura (Daniel 3:1; Daniel 2:31-35):
 * 60 x 6 cubits colossal royal monument (short hair per 1 Cor 11:14, modest ceremonial robes)
 * atop a stepped Babylonian glazed-brick plinth, with Daniel 2 five-metal variant.
 */
export function buildDuraImage(
  cubitM: number,
  variant: DuraImageVariant = 'dura-gold',
): THREE.Group {
  const C = cubitM;
  const totalH = 60 * C;
  const maxW = 6 * C;
  const tex = getMonumentTex();
  const g = new THREE.Group();
  const multi = variant === 'daniel2-metals';

  const mGold = new THREE.MeshStandardMaterial({
    color: 0xf1c74e,
    metalness: 0.9,
    roughness: 0.2,
    emissive: 0x3b2a08,
    emissiveIntensity: 0.14,
  });
  const mSilver = new THREE.MeshStandardMaterial({ color: 0xd9e0e8, metalness: 0.88, roughness: 0.22 });
  const mBronze = new THREE.MeshStandardMaterial({ color: 0xc2803a, metalness: 0.78, roughness: 0.3 });
  const mIron = new THREE.MeshStandardMaterial({ color: 0x4b5159, metalness: 0.86, roughness: 0.4 });
  const mIronClay = new THREE.MeshStandardMaterial({ color: 0x7a5747, metalness: 0.42, roughness: 0.78 });
  const mPlinth = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex.glazedPlinth,
    roughness: 0.75,
  });

  // Stepped glazed Babylonian plinth (lower ~16% of total monument height so 60C crown hits exact 60*C)
  const plinthH = 10 * C;
  const step1 = new THREE.Mesh(new THREE.BoxGeometry(maxW * 1.45, plinthH * 0.45, maxW * 1.45), mPlinth);
  step1.position.y = plinthH * 0.225;
  const step2 = new THREE.Mesh(new THREE.BoxGeometry(maxW * 1.15, plinthH * 0.35, maxW * 1.15), mPlinth);
  step2.position.y = plinthH * 0.45 + plinthH * 0.175;
  const step3 = new THREE.Mesh(
    new THREE.BoxGeometry(maxW * 0.92, plinthH * 0.2, maxW * 0.92),
    multi ? mIronClay : mGold,
  );
  step3.position.y = plinthH * 0.9;
  g.add(step1, step2, step3);

  const figBaseY = plinthH;
  const figH = totalH - figBaseY; // 50C towering robed royal statue crowning at 60C
  const fw = maxW * 0.88;

  // Zone 5: Feet (y: 0..0.10 figH) - iron & clay in Daniel 2
  const feetMat = multi ? mIronClay : mGold;
  for (const sx of [-1, 1]) {
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(fw * 0.32, figH * 0.08, fw * 0.56),
      feetMat,
    );
    foot.position.set(sx * fw * 0.22, figBaseY + figH * 0.04, fw * 0.08);
    g.add(foot);
  }

  // Zone 4: Lower legs & lower robe skirt (y: 0.08..0.34 figH) - iron in Daniel 2
  const legsMat = multi ? mIron : mGold;
  const lowerRobe = new THREE.Mesh(
    new THREE.CylinderGeometry(fw * 0.38, fw * 0.44, figH * 0.26, 20),
    legsMat,
  );
  lowerRobe.scale.set(1.0, 1, 0.72);
  lowerRobe.position.y = figBaseY + figH * 0.21;
  g.add(lowerRobe);

  // Zone 3: Mid-torso & thighs (y: 0.34..0.56 figH) - bronze in Daniel 2
  const midMat = multi ? mBronze : mGold;
  const midBody = new THREE.Mesh(
    new THREE.CylinderGeometry(fw * 0.42, fw * 0.38, figH * 0.22, 20),
    midMat,
  );
  midBody.scale.set(1.04, 1, 0.74);
  midBody.position.y = figBaseY + figH * 0.45;
  g.add(midBody);

  // Zone 2: Chest, shoulders & folded arms (y: 0.56..0.78 figH) - silver in Daniel 2
  const chestMat = multi ? mSilver : mGold;
  const chest = new THREE.Mesh(
    new THREE.CylinderGeometry(fw * 0.49, fw * 0.42, figH * 0.22, 20),
    chestMat,
  );
  chest.scale.set(1.08, 1, 0.74);
  chest.position.y = figBaseY + figH * 0.67;
  g.add(chest);

  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(fw * 0.14, fw * 0.12, figH * 0.22, 12),
      chestMat,
    );
    arm.position.set(sx * fw * 0.50, figBaseY + figH * 0.65, fw * 0.06);
    arm.rotation.z = sx * 0.12;
    arm.rotation.x = -0.2;
    g.add(arm);
  }

  // Zone 1: Neck, Royal Head (short cropped Babylonian hair & square beard), Crown (y: 0.78..1.00 figH) - pure Gold
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(fw * 0.18, fw * 0.21, figH * 0.04, 14),
    mGold,
  );
  neck.position.y = figBaseY + figH * 0.80;
  g.add(neck);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(fw * 0.28, 20, 16),
    mGold,
  );
  head.scale.set(0.88, 1.12, 0.96);
  head.position.y = figBaseY + figH * 0.89;
  head.userData.shimmer = 1;
  g.add(head);

  const beard = new THREE.Mesh(
    new THREE.BoxGeometry(fw * 0.30, figH * 0.065, fw * 0.22),
    mGold,
  );
  beard.position.set(0, figBaseY + figH * 0.84, fw * 0.16);
  g.add(beard);

  // Cylindrical Babylonian royal tiara/crown finishing cleanly at totalH = 60C
  const crown = new THREE.Mesh(
    new THREE.CylinderGeometry(fw * 0.27, fw * 0.25, figH * 0.068, 20),
    mGold,
  );
  crown.position.y = figBaseY + figH * 0.966;
  crown.userData.shimmer = 2;
  g.add(crown);

  return g;
}
