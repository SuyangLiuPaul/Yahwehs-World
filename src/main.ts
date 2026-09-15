import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './style.css';
import './route-ui.css';
import { paintBasemap } from './basemap.ts';
import { createGlobe, createLighting, GLOBE_RADIUS, lonLatToVec3 } from './globe.ts';
import { Terrain } from './terrain.ts';
import { placeLabel, bareName } from './names.ts';
import { Markers } from './markers.ts';
import { bookName, bookOf, localiseRef } from './books.ts';
import { precisionOf, precisionStyle } from './theme.ts';
import { Route, type Journey } from './routes.ts';
import { RouteLabels } from './labels.ts';
import { RouteThumbnail } from './route-thumbnail.ts';
import { Cartography, measureMap } from './cartography.ts';
import { applyStatic, bindSwitch, locale as currentLocale, onLocale } from './locale.ts';
import type { GeoJson, Place, PlacesBundle } from './types.ts';

type Locale = 'zh' | 'en';
let locale: Locale = currentLocale();

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** A place's name in the reader's language. The English name is kept alongside
 *  rather than replaced: it is what every other Bible atlas and every English
 *  commentary calls the place, and a reader cross-referencing needs both. */
const placeName = (p: Place) => placeLabel(p.name, p.zh, locale);

const T = {
  loading:   { zh: '正在绘制世界…', en: 'Drawing the world…' },
  places:    { zh: (n: number) => `${n} 处地名`, en: (n: number) => `${n} places` },
  through:   { zh: '读到', en: 'Through' },
  atRest:    { zh: '全书 · 拖动或播放', en: 'Whole canon · scrub or play' },
  firstIn:   { zh: '首次出现', en: 'First named in' },
  modernName:{ zh: '今名', en: 'Modern' },
  precision: { zh: '定位依据', en: 'Located by' },
  confidence:{ zh: '考据强度', en: 'Identification' },
  mentions:  { zh: '经文提及', en: 'Mentions' },
  refsTitle: { zh: '出现于', en: 'Appears in' },
  disputed:  { zh: (n: number) => `${n} 种考据并存`, en: (n: number) => `${n} rival identifications` },
  settled:   { zh: '考据一致', en: 'Undisputed' },
  times:     { zh: (n: number) => `${n} 次`, en: (n: number) => `${n}×` },
  andMore:   { zh: (n: number) => `…另有 ${n} 处`, en: (n: number) => `…and ${n} more` },
  stop:      { zh: (n: number) => `第 ${n} 站`, en: (n: number) => `Stop ${n}` },
  stopsMerged: {
    zh: (a: number, b: number, n: number) => `第 ${a}–${b} 站（${n} 站共用一个坐标）`,
    en: (a: number, b: number, n: number) => `Stops ${a}–${b} (${n} camps on one coordinate)`,
  },
  stopCount: {
    zh: (n: number, m: number) => `${n} 站 · 合并为 ${m} 个标记`,
    en: (n: number, m: number) => `${n} stops · ${m} markers`,
  },
  stops:     { zh: (n: number) => `${n} 站`, en: (n: number) => `${n} stops` },
  statStops:   { zh: '站', en: 'stops' },
  statMarkers: { zh: '个标记', en: 'markers' },
  statMerged:  { zh: '组共用坐标', en: 'shared coordinates' },
};

// ── data ──────────────────────────────────────────────────────────────────
// One-time migration away from the former year-long immutable /data cache.
// New responses revalidate via Netlify; returning readers must also leave
// their already-cached, pre-correction URL behind.
const j = <T,>(u: string) => fetch(`${u}?v=2026-09-15`).then((r) => {
  if (!r.ok) throw new Error(`${u} → ${r.status}`);
  return r.json() as Promise<T>;
});

const [bundle, journeyData, land, coastline, lakes, rivers] = await Promise.all([
  j<PlacesBundle>('/data/places.json'),
  j<{ journeys: Journey[] }>('/data/journeys.json'),
  j<GeoJson>('/data/ne_50m_land.geojson'),
  j<GeoJson>('/data/ne_50m_coastline.geojson'),
  j<GeoJson>('/data/ne_50m_lakes.geojson'),
  j<GeoJson>('/data/ne_50m_rivers_lake_centerlines.geojson'),
]);

// ── scene ─────────────────────────────────────────────────────────────────
const canvas = $<HTMLCanvasElement>('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();

// A page that first loads at zero size — a background tab, a hidden iframe,
// some PWA launch paths — makes innerWidth/innerHeight 0. Feeding 0/0 to the
// camera writes NaN through the projection matrix, and nothing renders ever
// again, even after the page is shown. So every size read goes through here.
const viewport = () => ({
  w: Math.max(1, innerWidth),
  h: Math.max(1, innerHeight),
  real: innerWidth > 0 && innerHeight > 0,
});

const camera = new THREE.PerspectiveCamera(42, viewport().w / viewport().h, 1, 4000);
// Opens looking at the Levant rather than the mid-Atlantic: the map's subject
// should be on screen before the user touches anything.
camera.position.copy(lonLatToVec3(35, 31, 300));

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.rotateSpeed = 0.42;
controls.minDistance = GLOBE_RADIUS * 1.08;
controls.maxDistance = GLOBE_RADIUS * 6;
controls.enablePan = false;
controls.zoomSpeed = 0.7;

createLighting(scene);
const globe = createGlobe(paintBasemap({ land, coastline, lakes, rivers }));
scene.add(globe);

// Measured relief over the biblical world, fading in as the camera closes.
const terrain = new Terrain();
globe.add(terrain.mesh);

const markers = new Markers(bundle.places, bundle.events);
globe.add(markers.mesh);

// A ring that snaps to the selected place — cheaper and clearer than
// re-colouring an instance, and it survives the timeline hiding things.
const selectionRing = new THREE.Mesh(
  new THREE.TorusGeometry(2.1, 0.16, 8, 40),
  new THREE.MeshBasicMaterial({ color: 0xe8c55a, transparent: true, opacity: 0.95 }),
);
selectionRing.visible = false;
globe.add(selectionRing);

// ── interaction ───────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hovered = -1;
let selected: Place | null = null;

function pick(ev: PointerEvent): number {
  pointer.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  for (const hit of raycaster.intersectObject(markers.mesh)) {
    const i = hit.instanceId;
    if (i !== undefined && markers.isVisible(i)) return i;
  }
  return -1;
}

canvas.addEventListener('pointermove', (ev) => {
  hovered = pick(ev);
  canvas.classList.toggle('over-place', hovered >= 0);
});

// Distinguishes a click from the end of a drag, so orbiting the globe past a
// marker does not fling the panel open.
let downAt = { x: 0, y: 0 };
canvas.addEventListener('pointerdown', (ev) => { downAt = { x: ev.clientX, y: ev.clientY }; });
canvas.addEventListener('pointerup', (ev) => {
  if (Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) > 5) return;
  const i = pick(ev);
  if (i >= 0) select(bundle.places[i]!); else closePanel();
});

function select(p: Place) {
  selected = p;
  const pos = lonLatToVec3(p.lon, p.lat, 0.6);
  selectionRing.position.copy(pos);
  selectionRing.lookAt(0, 0, 0);
  selectionRing.visible = true;
  renderPanel();
}

function closePanel() {
  selected = null;
  selectionRing.visible = false;
  $('panel').hidden = true;
}
$('panel-close').addEventListener('click', closePanel);

function renderPanel() {
  const p = selected;
  if (!p) return;
  $('panel').hidden = false;
  $('p-name').textContent = placeName(p);
  // When a Chinese name is shown, the English one moves to the line below so
  // the reader can still find the place in an English reference.
  const alt = locale === 'zh' && p.zh ? placeLabel(p.name, undefined, 'en') : '';
  const modern = p.modern && p.modern !== bareName(p.name) ? `${T.modernName[locale]} · ${p.modern}` : '';
  $('p-modern').textContent = [alt, modern].filter(Boolean).join('　·　');

  const prec = precisionOf(p.precision);
  const badges = [`<span class="badge" style="color:${prec.color}">${locale === 'zh' ? prec.labelZh : prec.label}</span>`];
  badges.push(p.rivals > 1
    ? `<span class="badge disputed">${T.disputed[locale](p.rivals)}</span>`
    : `<span class="badge" style="color:#7f9c7a">${T.settled[locale]}</span>`);
  $('p-badges').innerHTML = badges.join('');

  const first = p.first !== null ? bookName(bookOf(p.first), locale) : '—';
  $('p-meta').innerHTML = `
    <dt>${T.mentions[locale]}</dt><dd>${T.times[locale](p.verseCount)}</dd>
    <dt>${T.firstIn[locale]}</dt><dd>${first}</dd>
    <dt>${T.precision[locale]}</dt><dd>${p.precisionNote || prec.label}</dd>
    <dt>${T.confidence[locale]}</dt><dd>${p.confidence}</dd>`;

  $('p-refs-title').textContent = T.refsTitle[locale];
  const shown = p.readable.slice(0, 24);
  const rest = p.verseCount - shown.length;
  $('p-refs').textContent = shown.join(' · ') + (rest > 0 ? `  ${T.andMore[locale](rest)}` : '');
}

// ── routes ────────────────────────────────────────────────────────────────
// A route takes over from the verse timeline while it runs: the two answer
// different questions, and showing both at once would put a wandering camp and
// a whole canon's worth of places on screen together.
let route: Route | null = null;
let routePlaying = false;
let routeT = 0;
const routeLabels = new RouteLabels(document.body);
const routeThumbnail = new RouteThumbnail(renderer, globe, terrain, $<HTMLCanvasElement>('r-thumbnail'));
const cartography = new Cartography();
let selectedOrdinal: number | null = null;
let readoutKey = '';
let safeBand = { top: 48, height: innerHeight - 160 };

const routesEl = $('routes');
const rlist = $('rlist');
const rOpen = $('r-open');
const rCard = $('r-card');
const rToggle = $('r-toggle');
const rStop = $('r-stop');
const rBasis = $('r-basis');

// Rebuilt rather than written once: the menu names the ten journeys, and a
// reader who switches language with the menu open should not be left reading
// the list they just switched away from.
function renderRouteList() {
  rlist.innerHTML = journeyData.journeys.map((jr) => `
    <button class="rbtn" type="button" data-id="${jr.id}">
      <span>${jr[locale]}</span><i>${T.stops[locale](jr.stopCount)}</i>
    </button>`).join('');
}
renderRouteList();
setRoutesState('closed');

function setRoutesState(state: 'closed' | 'open' | 'active') {
  routesEl.dataset.state = state;
  rOpen.setAttribute('aria-expanded', String(state === 'open'));
}

function clearRoute() {
  if (route) { globe.remove(route.group); route.dispose(); route = null; }
  // Leaving a route restores the world's own up, or the globe stays tilted.
  camera.up.set(0, 1, 0);
  routePlaying = false; routeT = 0;
  selectedOrdinal=null; readoutKey='';
  document.body.classList.remove('route-active');
  $('map-tools').hidden=true;
  routeLabels.clear();
  routeThumbnail.clear();
  rCard.hidden = true;
  rBasis.textContent = '';
  rToggle.textContent = '▶';
  setRoutesState('closed');
  markers.mesh.visible = true;
  markers.setRoute(null);
  applyCursor();
  updateLayout();
}

function openRoute(id: string) {
  stop();
  clearRoute();
  const jr = journeyData.journeys.find((x) => x.id === id);
  if (!jr) return;
  route = new Route(jr);
  route.setProgress(0);
  globe.add(route.group);
  routeLabels.build(route.markerObjects, locale);
  // The place field would otherwise sit under the route as visual noise.
  markers.setRoute(jr.markers.flatMap(m=>m.places??[m.place]));
  document.body.classList.add('route-active');
  $('map-tools').hidden=false;
  closePanel();
  rCard.hidden = false;
  setRoutesState('active');
  renderRouteHeader(jr);

  // The merge count is the route's own reservation; putting it in the header
  // beside the stop count means a reader meets it before the animation, not
  // after wondering why 42 stops drew 23 dots.
  renderRouteStats(jr);
  renderStops();
  updateLayout();
  frameRoute(jr);
  routeT = 0;
  setRoutePlayback(false);
  updateRouteReadout();
}

/** Moves the camera to hold the whole route.
 *
 *  Without this, opening a short journey shows nothing at all: Jesus' itinerary
 *  in Mark spans half a degree of longitude and the ark's spans six tenths, so
 *  at whatever zoom the reader happened to leave the globe on, both are a
 *  single dot. The altitude comes from the route's own angular extent. */
function frameRoute(jr: Journey) {
  const wasDamping=controls.enableDamping; controls.enableDamping=false; controls.update(); controls.enableDamping=wasDamping;
  const pts = jr.markers
    .filter((m) => m.lat !== null && m.lon !== null)
    .map((m) => lonLatToVec3(m.lon!, m.lat!, 0).normalize());
  if (!pts.length) return;

  const centre = pts
    .reduce((a, v) => a.add(v), new THREE.Vector3())
    .normalize();
  // Widest angle any stop sits from the centre — the route's own radius.
  const spread = Math.max(...pts.map((v) => v.angleTo(centre)));

  // The route has to fit BOTH ways, and on a portrait phone the horizontal
  // field is the binding one: a perspective camera's fov is vertical, so at
  // 375x812 the horizontal half-angle is less than half the vertical. Framing
  // to the vertical field alone left Paul's fourteen degrees of longitude
  // fitting top-to-bottom and running clean off both sides, after which the
  // camera chased the head east and west across a route it could never hold.
  const vHalf = (camera.fov * Math.PI) / 360;
  const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
  const half = Math.max(0.12, Math.min(vHalf, hHalf));

  // Frame into the band that is actually visible, not into the viewport. The
  // nav sits over the top and the route card over the bottom, and in an in-app
  // browser — with its own address bar and toolbar shortening the page — those
  // two together take more than half the height. A route framed to the full
  // viewport then puts its northern stops behind the nav, which is what made a
  // stationary camera still look like it was running away.
  const band = visibleBand();
  const bandRatio = Math.max(0.25, band.height / Math.max(1, innerHeight));

  const need = Math.max(0.035, spread * 1.18);
  // The usable vertical field is only the band's share of the frame.
  const usableHalf = Math.min(half, vHalf * bandRatio);
  const alt = GLOBE_RADIUS * (Math.sin(need) / Math.tan(usableHalf) + 1 - Math.cos(need));
  const dist = THREE.MathUtils.clamp(GLOBE_RADIUS + alt, GLOBE_RADIUS * 1.09, GLOBE_RADIUS * 5);

  camera.position.copy(centre.clone().multiplyScalar(dist));

  // And aim so the route lands in the band's centre rather than the frame's.
  //
  // Camera rotation does not map to screen displacement by any simple factor —
  // it depends on the altitude and on where the route sits on the sphere, and
  // a formula derived for one produced two and a half times the intended shift
  // for another. So the correction is measured instead: nudge, project, look
  // at the residual, correct. Two passes land it inside a few pixels.
  const wantY = band.top + band.height / 2;
  const axis = new THREE.Vector3().crossVectors(centre, camera.up).normalize();
  if (axis.lengthSq() > 0.5) {
    const probe = new THREE.Vector3();
    const screenY = () => {
      camera.updateMatrixWorld(true);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld(true);
      probe.copy(centre).multiplyScalar(GLOBE_RADIUS).project(camera);
      return (-probe.y + 1) / 2 * innerHeight;
    };
    // A small known rotation calibrates pixels-per-radian for this exact framing.
    const y0 = screenY();
    const PROBE = 0.02;
    camera.position.applyAxisAngle(axis, PROBE);
    const y1 = screenY();
    const pxPerRad = (y1 - y0) / PROBE;
    camera.position.applyAxisAngle(axis, -PROBE);

    if (Math.abs(pxPerRad) > 1) {
      for (let i = 0; i < 2; i++) {
        const residual = wantY - screenY();
        if (Math.abs(residual) < 2) break;
        camera.position.applyAxisAngle(axis, residual / pxPerRad);
      }
    }
  }

  // Use projected extents to use the long dimension of a phone. A circular
  // spread wastes half the available vertical space on a north/south route.
  const projectedBounds = () => {
    camera.lookAt(0,0,0); camera.updateMatrixWorld(true);
    const points=pts.map(p=>p.clone().multiplyScalar(GLOBE_RADIUS).project(camera));
    const left=(1+Math.min(...points.map(p=>p.x)))*innerWidth/2;
    const right=(1+Math.max(...points.map(p=>p.x)))*innerWidth/2;
    const top=(1-Math.max(...points.map(p=>p.y)))*innerHeight/2;
    const bottom=(1-Math.min(...points.map(p=>p.y)))*innerHeight/2;
    return {width:right-left,height:bottom-top,x:(left+right)/2,y:(top+bottom)/2};
  };
  const fitAxis=new THREE.Vector3().crossVectors(centre,camera.up).normalize();
  const horizontalPadding = innerWidth <= 520 ? 40 : 64;
  for(let i=0;i<8;i++){
    const bounds=projectedBounds();
    const ratio=Math.max(bounds.width/Math.max(100,innerWidth-horizontalPadding),bounds.height/Math.max(100,band.height-32));
    const next=THREE.MathUtils.clamp(GLOBE_RADIUS+(camera.position.length()-GLOBE_RADIUS)*ratio,GLOBE_RADIUS*1.09,GLOBE_RADIUS*5);
    camera.position.setLength(next);
    // Centre the projected bounds, not the mean of the stops: clusters in
    // Moab otherwise push the southernmost camp underneath the player.
    for(const [axis,key,want] of [[fitAxis,'y',band.top+band.height/2],[camera.up,'x',innerWidth/2]] as const){
      const at=projectedBounds()[key];camera.position.applyAxisAngle(axis,.001);
      const slope=(projectedBounds()[key]-at)/.001;camera.position.applyAxisAngle(axis,-.001);
      if(Math.abs(slope)>1)camera.position.applyAxisAngle(axis,(want-at)/slope);
    }
  }
  // Drain inertial drag before a deliberate fit; it must not move the new view.
  const damping=controls.enableDamping; controls.enableDamping=false; controls.update(); controls.enableDamping=damping;
  camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
}

/** The strip of screen the map actually shows through, measured from the DOM
 *  rather than assumed, since the chrome differs between a tab and an in-app
 *  browser and between a route being open and not. */
function visibleBand() {
  const h = Math.max(1, innerHeight);
  const navEl = document.querySelector('.sitenav') as HTMLElement | null;
  const top = Math.max(navEl ? navEl.getBoundingClientRect().bottom : 0,
    route ? $('map-tools').getBoundingClientRect().bottom : 0);

  let bottom = h;
  for (const el of [rCard, $('timeline')]) {
    if (!el || (el as HTMLElement).hidden) continue;
    const r = el.getBoundingClientRect();
    if (r.height > 0) bottom = Math.min(bottom, r.top);
  }
  return { top, height: Math.max(h * 0.25, bottom - top) };
}

function updateLayout() {
  document.body.style.setProperty('--footer-height',$('timeline').getBoundingClientRect().height+'px');
  safeBand=visibleBand();
  document.body.style.setProperty('--map-bottom',(safeBand.top+safeBand.height-10)+'px');
}

function setRoutePlayback(value: boolean) {
  routePlaying=value;
  rToggle.textContent=value?'❚❚':routeT>=1?'↻':'▶';
  rToggle.classList.toggle('playing',value);
  const text=locale==='zh'?(value?'暂停路线':routeT>=1?'重新播放':'播放路线'):(value?'Pause journey':routeT>=1?'Replay journey':'Play journey');
  rToggle.setAttribute('aria-label',text);rToggle.title=text;
}

function renderStops() {
  if(!route)return;
  $('r-dots').replaceChildren();$('r-source-stops').replaceChildren();
  const labels:Record<string,[string,string]>={
    'r-clear':['Close journey','退出路线'],'r-prev':['Previous stop','上一站'],
    'r-next':['Next stop','下一站'],'r-sources-close':['Close sources','关闭依据'],
    'map-in':['Zoom in','放大'],'map-out':['Zoom out','缩小'],
    'r-thumbnail':['Terrain near this stop','本站附近的地形'],'r-dots':['Journey stops','行程各站'],
  };
  for(const [id,words] of Object.entries(labels))$(id).setAttribute('aria-label',words[locale==='en'?0:1]!);
  for(const m of route.journey.markers){
    m.stops.forEach((n,i)=>{
      const name=placeLabel(m.places?.[i]??m.place,m.zhAll?.[i]??m.zh,locale);
      const ref=m.refs?.[i]??m.ref;
      const button=document.createElement('button');button.type='button';button.className='r-step';button.dataset.stop=String(n);
      button.setAttribute('aria-label',T.stop[locale](n)+' · '+name);button.title=button.getAttribute('aria-label')!;
      const ordinal=document.createElement('span');ordinal.textContent=String(n);button.appendChild(ordinal);
      button.addEventListener('click',()=>seekStop(n));$('r-dots').appendChild(button);
      const li=document.createElement('li');li.value=n;li.append(document.createTextNode(name+' · '));
      const link=document.createElement('a');link.textContent=localiseRef(ref,locale);
      const match=ref.match(/^(.+) (\d+):(\d+)/);
      if(match){link.href='https://biblehub.com/bsb/'+match[1]!.toLowerCase().replaceAll(' ','_')+'/'+match[2]+'.htm';link.target='_blank';link.rel='noopener';}
      li.appendChild(link);
      const note=document.createElement('small');
      const remarks:string[]=[];
      if(m.stops.length>1)remarks.push(locale==='zh'?'与其他营站共用区域坐标，实际位置未定。':'Shares a regional coordinate with other camps; exact site uncertain.');
      if(m.aside)remarks.push(locale==='zh'?'经文提名；未记载到达，不连接路线。':'Named in the account; arrival is not recorded. Not connected to the route.');
      if(!m.attested)remarks.push(locale==='zh'?'推定的中间地点，非经文明确记载的停站。':'Inferred waypoint, not an explicitly recorded stop.');
      if(m.lat===null||m.lon===null)remarks.push(locale==='zh'?'位置未定；此处不连线。':'Unlocated; the route breaks here.');
      if(locale==='zh'&&m.note)remarks.push(m.note);
      if(locale==='en'&&m.noteEn)remarks.push(m.noteEn);
      note.textContent=remarks.join(' ');if(remarks.length)li.appendChild(note);
      $('r-source-stops').appendChild(li);
    });
  }
}

function seekStop(n: number) {
  if(!route)return;
  const index=route.journey.markers.findIndex(m=>m.stops.includes(n));
  if(index<0)return;
  selectedOrdinal=n;
  const at=route.progressAt(index);
  if(at!==undefined&&Number.isFinite(at)){routeT=at;route.setProgress(routeT);}
  route.focusMarker(index);
  setRoutePlayback(false);
  updateRouteReadout();
}
function stepStop(delta:number){
  if(!route)return;
  const n=selectedOrdinal??route.markerAt(routeT)?.stops[0]??1;
  seekStop(THREE.MathUtils.clamp(n+delta,1,route.journey.stopCount));
}
$('r-prev').addEventListener('click',()=>stepStop(-1));
$('r-next').addEventListener('click',()=>stepStop(1));
$('r-info').addEventListener('click',()=>{setRoutePlayback(false);$<HTMLDialogElement>('r-sources').showModal();});
$('r-sources-close').addEventListener('click',()=>$<HTMLDialogElement>('r-sources').close());
$('map-fit').addEventListener('click',()=>{if(route)frameRoute(route.journey);});
for(const [id,factor] of [['map-in',.75],['map-out',1.3]] as const){
  $(id).addEventListener('click',()=>{
    const distance=THREE.MathUtils.clamp(GLOBE_RADIUS+(camera.position.length()-GLOBE_RADIUS)*factor,controls.minDistance,controls.maxDistance);
    camera.position.setLength(distance);controls.update();
  });
}
let swipe:{x:number;y:number}|null=null;
$('rplay').addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&!(e.target as HTMLElement).closest('button'))swipe={x:e.clientX,y:e.clientY};});
$('rplay').addEventListener('pointerup',e=>{
  if(swipe){const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;if(Math.abs(dx)>44&&Math.abs(dx)>Math.abs(dy)*1.5)stepStop(dx<0?1:-1);}
  swipe=null;
});
$('rplay').addEventListener('pointercancel',()=>{swipe=null;});
rCard.addEventListener('keydown',e=>{
  if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();stepStop(e.key==='ArrowLeft'?-1:1);}
});

function updateRouteReadout() {
  if (!route) return;
  const m = selectedOrdinal===null ? route.markerAt(routeT) : route.journey.markers.find(m=>m.stops.includes(selectedOrdinal!));
  if (!m) { rStop.textContent = ''; return; }
  const key=route.journey.id+':'+m.n+':'+selectedOrdinal+':'+locale;
  if(key===readoutKey)return;
  readoutKey=key;
  const sub=selectedOrdinal===null ? 0 : Math.max(0,m.stops.indexOf(selectedOrdinal));
  const selectedName=placeLabel(m.places?.[sub]??m.place,m.zhAll?.[sub]??m.zh,locale);
  const label = m.stops.length > 1
    // A merged marker says so outright: these camps share one coordinate
    // because nobody knows where they were.
    ? selectedOrdinal===null ? T.stopsMerged[locale](m.stops[0]!, m.stops[m.stops.length - 1]!, m.stops.length) : `${T.stop[locale](selectedOrdinal)} · ${selectedName}`
    : `${T.stop[locale](m.n)} · ${placeLabel(m.place, m.zh, locale)}`;
  rStop.textContent = label;
  rStop.title=label;
  $('r-ref').textContent=localiseRef(m.refs?.[sub]??m.ref,locale);
  routeThumbnail.show(m);
  $('r-unlocated').hidden=m.lat!==null&&m.lon!==null;
  const ordinal=selectedOrdinal??m.stops[0]??m.n;
  for(const button of Array.from($('r-dots').querySelectorAll<HTMLButtonElement>('button'))){
    const n=Number(button.dataset.stop);
    button.classList.toggle('passed',n<ordinal);
    if(n===ordinal)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');
  }
  const dot=$('r-dots').querySelector<HTMLElement>('[aria-current="step"]');
  if(dot) $('r-dots').scrollLeft=dot.offsetLeft-$('r-dots').offsetLeft-$('r-dots').clientWidth/2+22;
  $<HTMLButtonElement>('r-prev').disabled=ordinal<=1;
  $<HTMLButtonElement>('r-next').disabled=ordinal>=route.journey.stopCount;
  // Marker refs are stored in English; the book name is the only part of a
  // reference that is language at all, so it is swapped on the way out.
  $('t-ref').textContent = localiseRef(m.refs?.[0] ?? m.ref, locale);
  // Keeps the `: m.zh` fallback: five aside markers across paul-rome and
  // elijah carry no zhAll at all, and mapping over a missing array blanks them.
  // Two OpenBible places can share one Chinese name — 25 verses in the index
  // name two that render identically — and printing "伯特利 · 伯特利" reads as
  // a bug rather than as two places the Union Version calls the same thing.
  const here = m.zhAll?.length
    ? m.zhAll.map((z, k) => placeLabel(m.places?.[k] ?? m.place, z, locale))
    : [placeLabel(m.place, m.zh, locale)];
  $('t-here').textContent = [...new Set(here)].join(' · ');
  $('t-count').textContent = T.stopCount[locale](route.journey.stopCount, route.journey.markers.length);
}

rOpen.addEventListener('click', () => {
  setRoutesState(routesEl.dataset.state === 'open' ? 'closed' : 'open');
});
rlist.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('.rbtn') as HTMLElement | null;
  if (!btn) return;
  openRoute(btn.dataset.id!);
});
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && routesEl.dataset.state === 'open') setRoutesState('closed');
});
rToggle.addEventListener('click', () => {
  if (!route) return;
  if (routeT >= 1) { routeT=0;route.setProgress(0); }
  selectedOrdinal=null;
  setRoutePlayback(!routePlaying);
  updateRouteReadout();
});
$('r-clear').addEventListener('click', clearRoute);

/** Advances the path only; the camera belongs to the reader. */
function advanceRoute(dt: number) {
  if (!route || !routePlaying) return;
  // Slow enough to read each stop; the wilderness is forty years, not a lap.
  routeT = Math.min(1, routeT + dt / Math.max(24,route.journey.stopCount*1.6));
  route.setProgress(routeT);
  updateRouteReadout();
  if (routeT >= 1) setRoutePlayback(false);

  // The camera deliberately does NOT follow. It frames the whole route once
  // when the route opens and then stays put: a camera that chases the head
  // swings the world under the reader for the length of the journey, which is
  // motion sickness rather than travel. The entire path is on screen from the
  // first frame, the light moves along it, and panning and zooming belong to
  // whoever is looking.
}

// ── timeline ──────────────────────────────────────────────────────────────
// One step per verse that names a place: 5,582 of them, in canonical order.
// Playing it start to finish walks the entire biblical world.
const range = $<HTMLInputElement>('t-range');
range.max = String(bundle.events.length - 1);
range.value = range.max;

function applyCursor() {
  const i = Number(range.value);
  markers.setCursor(i);
  const ev = bundle.events[i];
  if (ev) {
    const book = bookName(bookOf(ev.sort), locale);
    const cv = ev.readable.replace(/^.*?(\d+:\d+.*)$/, '$1');
    $('t-ref').textContent = locale === 'zh' ? `${book} ${cv}` : ev.readable;
    $('t-here').textContent = markers.activeIndices
      .map((n) => placeName(bundle.places[n]!)).join(' · ');
  } else {
    $('t-ref').textContent = T.atRest[locale];
    $('t-here').textContent = '';
  }
  $('t-count').textContent = T.places[locale](markers.visibleCount);
  if (selected && !markers.isVisible(bundle.places.indexOf(selected))) closePanel();
}
range.addEventListener('input', () => { if(route)clearRoute(); stop(); applyCursor(); });

// ── playback ──────────────────────────────────────────────────────────────
const VERSES_PER_SECOND = 7;
let playing = false;
let carry = 0;
const playBtn = $('t-play');

function play() {
  if(route)clearRoute();
  // Restarting from the end would show nothing move, so rewind first.
  if (Number(range.value) >= bundle.events.length - 1) { range.value = '0'; applyCursor(); }
  playing = true; carry = 0;
  playBtn.textContent = '❚❚';
  playBtn.classList.add('playing');
}
function stop() {
  playing = false;
  playBtn.textContent = '▶';
  playBtn.classList.remove('playing');
}
playBtn.addEventListener('click', () => (playing ? stop() : play()));

function advance(dt: number) {
  if (!playing) return;
  carry += dt * VERSES_PER_SECOND;
  const steps = Math.floor(carry);
  if (steps < 1) return;
  carry -= steps;
  const next = Number(range.value) + steps;
  if (next >= bundle.events.length - 1) { range.value = String(bundle.events.length - 1); stop(); }
  else range.value = String(next);
  applyCursor();
}

// The canon ranges from Tarshish to Persia, so without this half of the
// playback would happen on the far side of the globe. The camera eases toward
// whatever is being read, and yields the moment the user grabs the globe.
let userDriving = false;
controls.addEventListener('start', () => { userDriving = true; });
controls.addEventListener('end', () => { userDriving = false; });

const followTarget = new THREE.Vector3();
function follow(dt: number) {
  if (route || !playing || userDriving || markers.activeIndices.length === 0) return;
  let lon = 0, lat = 0;
  for (const n of markers.activeIndices) {
    lon += bundle.places[n]!.lon; lat += bundle.places[n]!.lat;
  }
  lon /= markers.activeIndices.length; lat /= markers.activeIndices.length;
  followTarget.copy(lonLatToVec3(lon, lat, camera.position.length() - GLOBE_RADIUS));
  camera.position.lerp(followTarget, Math.min(1, dt * 1.1));
}

// ── legend & i18n ─────────────────────────────────────────────────────────
function renderRouteStats(jr: Journey) {
  const stats: [number, string, boolean][] = [
    [jr.stopCount, T.statStops[locale], false],
    [jr.markers.filter(m=>m.lat!==null&&m.lon!==null).length, T.statMarkers[locale], false],
  ];
  if(jr.unlocated)stats.push([jr.unlocated,locale==='zh'?'未定位':'unlocated',false]);
  if (jr.merged > 0) stats.push([jr.merged, T.statMerged[locale], true]);
  $('r-stats').innerHTML = stats
    .map(([n, label, caveat]) =>
      `<div${caveat ? ' class="caveat"' : ''}><b>${n}</b><span>${label}</span></div>`)
    .join('');
}

function renderRouteHeader(jr: Journey) {
  $('r-name').textContent = jr[locale];
  $('r-range').textContent = locale === 'zh' ? jr.range : jr.rangeEn;
  rBasis.textContent = locale === 'zh' ? jr.basis : jr.basisEn;
}

function renderLegend() {
  $('legend').innerHTML = Object.entries(precisionStyle)
    .filter(([k]) => k !== 'unknown')
    .map(([, v]) => `<span><i style="background:${v.color}"></i>${locale === 'zh' ? v.labelZh : v.label}</span>`)
    .join('');
}

bindSwitch(document.querySelector('.lang-switch') as HTMLElement);
onLocale((l) => {
  locale = l;
  applyStatic();
  renderLegend();
  applyCursor();
  renderRouteList();
  if (route) {
    renderRouteHeader(route.journey);
    renderRouteStats(route.journey);
    routeLabels.build(route.markerObjects, locale);
    renderStops();
    setRoutePlayback(routePlaying);
    // applyCursor() has just overwritten the readout with timeline text, and
    // nothing else put the route's own back, so switching language with a
    // route open left the stop line in the language you just left.
    updateRouteReadout();
  }
  if (selected) renderPanel();
  updateLayout();
});

// ── loop ──────────────────────────────────────────────────────────────────
function fitToViewport() {
  const { w, h } = viewport();
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
addEventListener('resize', () => {
  fitToViewport();
  updateLayout();
});
// Catches the transition from zero size to real size, which fires no resize
// event of its own when the page was laid out hidden from the start.
new ResizeObserver(()=>{fitToViewport();updateLayout();}).observe(document.body);
const chromeObserver=new ResizeObserver(updateLayout);
chromeObserver.observe($('timeline'));chromeObserver.observe(rCard);

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.getElapsedTime();
  advance(dt);
  follow(dt);
  advanceRoute(dt);
  controls.update();
  camera.updateMatrixWorld(true); globe.updateMatrixWorld(true);
  if (route) {
    route.faceCamera(camera.position.length(), GLOBE_RADIUS, innerHeight, camera.fov);
    route.setResolution(renderer.domElement.width, renderer.domElement.height);
    routeLabels.update(camera, globe, route.reachedIndex(routeT), innerWidth, innerHeight, safeBand, route.highlightedIndex(routeT));
  }
  terrain.update(camera.position.length(), dt);
  markers.setZoom(camera.position.length(), GLOBE_RADIUS, dt, innerHeight, camera.fov);
  cartography.update(camera,innerWidth,innerHeight,locale);
  // The selection ring breathes so the eye can find it again after orbiting.
  if (selectionRing.visible) selectionRing.scale.setScalar(1 + Math.sin(t * 2.4) * 0.12);
  renderer.render(scene, camera);
});

fitToViewport();
applyStatic();
renderLegend();
applyCursor();
updateLayout();
$('loading').classList.add('done');
console.info(
  `%c雅伟之界 · 圣经世界%c  ${bundle.meta.located} located / ${bundle.meta.unlocated} unlocated  ·  ${bundle.meta.source} (${bundle.meta.license})`,
  'color:#e8c55a;font-weight:600', 'color:#7d8896',
);

// Dev-only handle. Picking and camera framing are the two things that are
// tedious to verify by eye, and this makes both scriptable from the console.
// Guarded by import.meta.env.DEV, so it is dropped from a production build.
if (import.meta.env.DEV) {
  (globalThis as unknown as Record<string, unknown>).__globe = {
    scene, camera, controls, markers, globe, bundle, renderer,
    measureMap, visibleBand, frameRoute, seekStop,
    /** Screen-space position of a place, for synthetic pointer events. */
    screenOf(place: Place) {
      const v = lonLatToVec3(place.lon, place.lat, 0.5).applyMatrix4(globe.matrixWorld).project(camera);
      return { x: (v.x + 1) / 2 * innerWidth, y: (-v.y + 1) / 2 * innerHeight, z: v.z };
    },
    select,
    get selected() { return selected; },
    // The render loop is parked whenever the page is hidden, so playback has
    // to be drivable without rAF to be testable at all.
    advance, follow, advanceRoute, openRoute, clearRoute,
    get playing() { return playing; },
    get route() { return route; },
    /** Drives one frame of the whole route layer — path, marker sizing and
     *  labels — for inspection where rAF is parked. */
    tickRoute() {
      if (!route) return;
      controls.update(); camera.updateMatrixWorld(true); globe.updateMatrixWorld(true);
      route.faceCamera(camera.position.length(), GLOBE_RADIUS, innerHeight, camera.fov);
      route.setResolution(renderer.domElement.width, renderer.domElement.height);
      routeLabels.update(camera, globe, route.reachedIndex(routeT), innerWidth, innerHeight, visibleBand(), route.highlightedIndex(routeT));
      renderer.render(scene, camera);
    },
    get routeT() { return routeT; },
    get routePlaying() { return routePlaying; },
    /** Renders one frame at an arbitrary size, for inspection where the page
     *  is not being painted. */
    snapshot(w = 1400, h = 900) {
      const prev = { w: renderer.domElement.width, h: renderer.domElement.height };
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      controls.update(); camera.updateMatrixWorld(true); globe.updateMatrixWorld(true);
      route?.faceCamera(camera.position.length(), GLOBE_RADIUS, h, camera.fov);
      route?.setResolution(renderer.domElement.width, renderer.domElement.height);
      renderer.render(scene, camera);
      const url = renderer.domElement.toDataURL('image/png');
      renderer.setSize(prev.w, prev.h, false);
      camera.aspect = Math.max(1, innerWidth) / Math.max(1, innerHeight);
      camera.updateProjectionMatrix();
      return url;
    },
  };
}
