import { applyStudio } from '../shared/studio.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createBattery } from './model.js';
import { PART_DATA, PACK_CONFIG } from './data.js';

const $ = id => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = { selected: 'p1', explosion: .72, overrides: new Map(), labels: true, ready: false };
let scene, camera, renderer, composer, outline, controls, root, parts = [], materials = new Map();
let toastTimer, resetTween = null, frame = 0, disposed = false, lastTime = 0;
const viewport = $('viewport');
const svg = id => `<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
const selectionMeshes = new Map(PART_DATA.map(p=>[p.id,[]]));
const plasticIds = PART_DATA.filter(p=>p.kind==='plastic').map(p=>p.id);
const labels = new Map();
const leaderSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
leaderSvg.classList.add('leader-lines');
leaderSvg.setAttribute('aria-hidden', 'true');
$('labels').prepend(leaderSvg);
const leaders = new Map();

function toast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').classList.add('show');
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2200);
}
function partTarget(id) { return state.overrides.get(id) ?? state.explosion; }
function updateDetail() {
  const data = PART_DATA.find(p => p.id === state.selected);
  const panel=$('part-detail');panel.replaceChildren();
  const title=document.createElement('h3');title.className='detail-title';
  if(data.number){const n=document.createElement('span');n.className='detail-number';n.textContent=data.number;title.append(n);}
  const name=document.createElement('span');name.textContent=data.name;title.append(name);panel.append(title);
  if(data.number){
    const recommendation=document.createElement('div');recommendation.className='recommendation';
    const heading=document.createElement('h4');heading.textContent='邦泰推荐';
    const copy=document.createElement('p');copy.className='recommendation-copy';copy.textContent=data.recommendation;
    recommendation.append(heading,copy);panel.append(recommendation);
  }
  panel.dataset.selection=data.id;
  for (const row of document.querySelectorAll('.part-row')) {
    const active = row.dataset.part === data.id;
    row.classList.toggle('selected', active);
    row.setAttribute('aria-pressed', String(active));
  }
  for (const [id, label] of labels) label.classList.toggle('selected', id === data.id);
}
function updateOutline(){
  if(!outline)return;
  const selected=PART_DATA.find(p=>p.id===state.selected);
  outline.selectedObjects=selected.kind==='plastic'?(selectionMeshes.get(state.selected)||[]).filter(m=>m.userData.highlightable):[];
}
function selectPart(id, move = true) {
  if (!PART_DATA.some(p=>p.id === id)) return;
  const wasSelected = state.selected === id;
  state.selected = id;
  if (move && state.ready && plasticIds.includes(id)) {
    const previous = state.overrides.get(id);
    const newValue = previous !== undefined ? (previous > .95 ? 0 : 1) : (wasSelected && partTarget(id) > .95 ? 0 : 1);
    state.overrides.set(id, newValue);
    toast(`${PART_DATA.find(p=>p.id===id).name} · ${newValue ? '已展开' : '已归位'}`);
    $('scene-state').textContent = '局部拆解';
  }
  updateOutline();
  $('selection-caption').textContent = PART_DATA.find(p=>p.id === id).name;
  updateDetail();
}
for (const data of PART_DATA) {
  const row = document.createElement('button');
  row.className = data.number ? 'part-row plastic-row' : 'part-row plain-row';
  row.dataset.part = data.id;
  row.setAttribute('aria-pressed', String(data.id === state.selected));
  row.innerHTML = `${data.number?`<span class="part-number">${data.number}</span>`:''}<span class="part-text"><b>${data.name}</b></span><span class="part-dot"></span>`;
  row.addEventListener('click', () => selectPart(data.id));
  $(data.number?'part-list':'other-parts').append(row);
  const label = document.createElement('button');
  label.className = 'part-label';
  label.dataset.selection=data.id;
  label.setAttribute('aria-label', `${data.number||''}${data.name}`);
  label.innerHTML = `${data.number?`<b>${data.number}</b>`:''}<span>${data.name}</span>`;
  label.addEventListener('click', () => selectPart(data.id));
  $('labels').append(label);
  labels.set(data.id, label);
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  leaderSvg.append(line); leaders.set(data.id, line);
}
for(const item of PACK_CONFIG){
  const row=document.createElement('div'),label=document.createElement('dt'),value=document.createElement('dd');
  label.textContent=item.label;value.textContent=item.value;row.append(label,value);$('pack-specs').append(row);
  const metric=document.createElement('div'),text=document.createElement('strong');text.textContent=item.value;metric.append(text);$('hero-specs').append(metric);
}
updateDetail();
setExplosion(state.explosion);

function showTab(tab) {
  for (const name of ['components', 'specs']) {
    const active = name === tab;
    $(`tab-${name}`).classList.toggle('active', active);
    $(`tab-${name}`).setAttribute('aria-selected', String(active));
    $(`${name}-panel`).hidden = !active;
  }
}
$('tab-components').addEventListener('click', () => showTab('components'));
$('tab-specs').addEventListener('click', () => showTab('specs'));
document.querySelector('.tabs').addEventListener('keydown', e => {
  if (['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) {
    e.preventDefault();
    const tab = e.key==='Home' ? 'components' : e.key==='End' ? 'specs' : $('tab-components').getAttribute('aria-selected')==='true' ? 'specs' : 'components';
    showTab(tab); $(`tab-${tab}`).focus();
  }
});
$('help').addEventListener('click', () => $('guide').showModal());
$('close-guide').addEventListener('click', () => $('guide').close());
$('start-explore').addEventListener('click', () => { $('guide').close(); viewport.focus({ preventScroll: true }); });
$('guide').addEventListener('click', e => { if(e.target === $('guide')) { const r = $('guide').getBoundingClientRect(); if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) $('guide').close(); }});
$('retry').addEventListener('click', () => location.reload());
document.querySelector('.brand').addEventListener('click', e => { e.preventDefault(); setExplosion(.72); resetView(); selectPart('p1', false); });

function setExplosion(value) {
  state.explosion = THREE.MathUtils.clamp(value, 0, 1);
  state.overrides.clear();
  const pct = Math.round(state.explosion * 100);
  $('explosion').value = String(pct);
  $('explosion-output').textContent = pct===0?'已组装':pct===100?'已拆解':'展开中';
  $('explosion').style.background = `linear-gradient(to right,var(--accent) ${pct}%,#364e64 ${pct}%)`;
  $('scene-state').textContent = pct === 0 ? '装配视图' : pct === 100 ? '完整拆解' : '拆解视图';
  updateDetail();
}
$('explosion').addEventListener('input', e => setExplosion(Number(e.target.value) / 100));
$('explode').addEventListener('click', () => { setExplosion(1); toast('完整拆解'); });
$('assemble').addEventListener('click', () => { setExplosion(0); toast('部件归位 · 查看完整外观'); });
function toggleLabels() {
  state.labels = !state.labels;
  $('toggle-labels').classList.toggle('active', state.labels);
  $('toggle-labels').setAttribute('aria-pressed', String(state.labels));
  $('labels').hidden = !state.labels;
}
$('toggle-labels').addEventListener('click', toggleLabels);
$('auto-rotate').addEventListener('click', () => {
  if (!controls) return;
  controls.autoRotate = !controls.autoRotate;
  $('auto-rotate').classList.toggle('active', controls.autoRotate);
  $('auto-rotate').setAttribute('aria-pressed', String(controls.autoRotate));
  toast(controls.autoRotate ? '自动旋转已开启' : '自动旋转已暂停');
});
function stopAutoRotate() {
  if(!controls) return;
  controls.autoRotate = false;
  $('auto-rotate').classList.remove('active');
  $('auto-rotate').setAttribute('aria-pressed', 'false');
}
function zoom(factor) {
  if(!controls) return;
  resetTween = null;
  const delta = camera.position.clone().sub(controls.target);
  delta.setLength(THREE.MathUtils.clamp(delta.length()*factor, controls.minDistance, controls.maxDistance));
  camera.position.copy(controls.target).add(delta);
  controls.update();
}
$('zoom-in').addEventListener('click', () => zoom(.84));
$('zoom-out').addEventListener('click', () => zoom(1.19));
$('reset').addEventListener('click', () => { resetView(); toast('已恢复等轴视角'); });
for(const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => resetView(button.dataset.view));
function viewPosition(view = 'iso') {
  const aspect = viewport.clientWidth / Math.max(viewport.clientHeight, 1);
  const scale = Math.max(1, .95 / aspect);
  return (view === 'front' ? new THREE.Vector3(0, 3.5, 18) : new THREE.Vector3(8, 7.2, 14.6)).multiplyScalar(scale);
}
function resetView(view = 'iso', instant = false) {
  if(!camera) return;
  stopAutoRotate();
  const position = viewPosition(view), target = new THREE.Vector3(0, .6, 0);
  for(const button of document.querySelectorAll('[data-view]')) {
    const active = button.dataset.view === view;
    button.classList.toggle('active',active); button.setAttribute('aria-pressed',String(active));
  }
  if(instant || reducedMotion) { camera.position.copy(position); controls.target.copy(target); controls.update(); }
  else resetTween = { start: performance.now(), from: camera.position.clone(), to: position, fromTarget: controls.target.clone(), target };
}
viewport.addEventListener('keydown', e => {
  if(e.target !== viewport && e.target.tagName !== 'CANVAS') return;
  if(!state.ready) return;
  const key = e.key.toLowerCase();
  if (['arrowleft','arrowright','arrowup','arrowdown','+','=','-',' ','r','l'].includes(key)) e.preventDefault();
  if(key === ' ') setExplosion(state.explosion > .5 ? 0 : 1);
  if(key === 'r') resetView();
  if(key === 'l') toggleLabels();
  if(key === '+' || key === '=') zoom(.9);
  if(key === '-') zoom(1.1);
  if(key.startsWith('arrow')) {
    resetTween = null; stopAutoRotate();
    const sphere = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if(key === 'arrowleft') sphere.theta -= .12;
    if(key === 'arrowright') sphere.theta += .12;
    if(key === 'arrowup') sphere.phi -= .12;
    if(key === 'arrowdown') sphere.phi += .12;
    sphere.phi = THREE.MathUtils.clamp(sphere.phi, .12, Math.PI - .12);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sphere));
    controls.update();
  }
});

function fail(error) {
  console.error('Battery viewer initialization failed:', error);
  state.ready = false;
  $('loading').hidden = true;
  $('canvas-error').hidden = false;
  $('render-status').textContent = '模型不可用 · 部件信息可浏览';
  $('labels').hidden = true;
  for(const el of document.querySelectorAll('.control-panel button, .control-panel input, .stage-tools button, .view-switch button')) el.disabled = true;
  updateDetail();
}
function initScene() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x111713, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .86;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.info.autoReset = false;
  renderer.domElement.setAttribute('aria-label', '可旋转、缩放和点击的轻型车电池模型');
  viewport.prepend(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
  const env = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(env, .04);
  scene.environment = environment.texture;
  scene.environmentIntensity = .55;
  env.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xf0f4ff,0x222933,.7));
  const key = new THREE.DirectionalLight(0xffffff,2.2); key.position.set(3,8,6); scene.add(key);
  const rim = new THREE.DirectionalLight(0xd3e7ff,1.4); rim.position.set(-6,3,-4); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xf4f7ff,.6); fill.position.set(6,0,5); scene.add(fill);
  ({ root, parts } = createBattery());
  scene.add(root);
  for(const part of parts) {
    part.progress = state.explosion;
    part.isolation = 0;
    part.group.position.copy(part.base).addScaledVector(part.offset, part.progress);
    const collection = new Set();
    part.group.traverse(obj => {
      if(obj.isMesh) {
        // Keep the mesh identity: metal pins must not inherit the plastic socket ID.
        if(!obj.userData.partId)obj.userData.partId=part.selectionId;
        selectionMeshes.get(obj.userData.partId)?.push(obj);
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for(const mat of mats) if(mat.emissive) { collection.add(mat); if(!mat.userData.baseEmissive) { mat.userData.baseEmissive = mat.emissive.clone(); mat.userData.baseIntensity = mat.emissiveIntensity; } }
      }
    });
    materials.set(part.id, collection);
  }
  // Sparse reference grid: every line is generated geometry, not an image.
  const grid = new THREE.GridHelper(26,26,0x3c536a,0x293c50);
  grid.position.y = -5.2;
  grid.material.transparent = true; grid.material.opacity = .12;
  scene.add(grid);
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.3,4.315,128), new THREE.MeshBasicMaterial({ color:0x8db5dc,transparent:true,opacity:.10,side:THREE.DoubleSide }));
  ring.rotation.x = -Math.PI/2;ring.position.y=-5.18;scene.add(ring);
  applyStudio(scene,renderer,root,-5.2);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .075;
  controls.minDistance = 7; controls.maxDistance = 48;
  controls.minPolarAngle = .12; controls.maxPolarAngle = Math.PI - .12;
  controls.autoRotateSpeed = .65;
  controls.screenSpacePanning = true;
  controls.addEventListener('start', () => { resetTween = null; });
  composer = new EffectComposer(renderer);
  composer.renderTarget1.samples = 4;
  composer.renderTarget2.samples = 4;
  composer.addPass(new RenderPass(scene,camera));
  outline = new OutlinePass(new THREE.Vector2(1,1), scene, camera);
  outline.edgeStrength = 1.9; outline.edgeGlow = .32; outline.edgeThickness = 1.1;
  outline.visibleEdgeColor.set(0x58bdff); outline.hiddenEdgeColor.set(0x173b57);
  outline.pulsePeriod = reducedMotion ? 0 : 4;
  composer.addPass(outline);composer.addPass(new OutputPass());
  updateOutline();
  function resize() {
    const w = viewport.clientWidth, h = viewport.clientHeight;
    if(w===0 || h===0) return;
    camera.aspect = w/h;camera.updateProjectionMatrix();
    renderer.setSize(w,h);composer.setSize(w,h);
  }
  const observer = new ResizeObserver(resize); observer.observe(viewport);
  resize();resetView('iso',true);
  let lastWidth = viewport.clientWidth;
  window.addEventListener('resize', () => {
    if(Math.abs(viewport.clientWidth-lastWidth)>150) { lastWidth=viewport.clientWidth;resetView('iso',true); }
  });
  bindPicking();
  state.ready = true;
  updateDetail();
  $('render-status').textContent = '渲染就绪';
  $('loading').hidden = true;
  renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); disposed = true; fail(new Error('WebGL context lost')); });
  window.addEventListener('pagehide', e => {
    if(e.persisted) return;
    disposed = true; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose();
    const geometries = new Set(), mats = new Set(), textures = new Set();
    scene.traverse(obj => { if(obj.geometry) geometries.add(obj.geometry);if(obj.material) for(const mat of Array.isArray(obj.material)?obj.material:[obj.material]) mats.add(mat); });
    for(const mat of mats) { for(const value of Object.values(mat)) if(value?.isTexture) textures.add(value);mat.dispose(); }
    for(const geometry of geometries) geometry.dispose();for(const texture of textures) texture.dispose();
    environment.dispose();outline.dispose();composer.dispose();renderer.dispose();
  },{once:true});
  animate(performance.now());
  // Small read-only snapshot for reproducible interaction checks.
  Object.defineProperty(window,'batteryExplorer',{value:Object.freeze({
    snapshot:()=>({ready:state.ready,selected:state.selected,explosion:state.explosion,labels:state.labels,autoRotate:controls.autoRotate,parts:parts.map(p=>({id:p.id,selectionId:p.selectionId,kind:p.kind,progress:p.progress,target:partTarget(p.selectionId),position:p.group.position.toArray(),base:p.base.toArray()})),camera:camera.position.toArray(),highlightedIds:[...new Set(outline.selectedObjects.map(o=>o.userData.partId))],cellGeometry:(()=>{const m=root.getObjectByName('cellBodies');return {count:m.count,radius:m.geometry.parameters.radiusTop,height:m.geometry.parameters.height,...m.userData};})(),meshCounts:Object.fromEntries([...selectionMeshes].map(([id,meshes])=>[id,meshes.length])),materials:[...new Set([...materials.values()].flatMap(m=>[...m]))].map(m=>({kind:m.userData.kind,color:m.color.getHexString(),emissive:m.emissive.getHexString(),intensity:m.emissiveIntensity,roughness:m.roughness,metalness:m.metalness})),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles})
  })});
}

function bindPicking() {
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  const canvas = renderer.domElement;
  const activePointers = new Set();
  let down = null, lastHover = 0;
  function pick(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
    ray.setFromCamera(mouse,camera);
    const hit = ray.intersectObject(root,true).find(h=>h.object.userData.partId);
    return hit?.object.userData.partId;
  }
  canvas.addEventListener('pointerdown',e=>{activePointers.add(e.pointerId);down=activePointers.size===1?{x:e.clientX,y:e.clientY,id:e.pointerId,time:performance.now()}:null;});
  canvas.addEventListener('pointerup', e=>{
    const wasSingle = activePointers.size === 1;activePointers.delete(e.pointerId);
    if(wasSingle && down && e.pointerId===down.id && e.button===0 && Math.hypot(e.clientX-down.x,e.clientY-down.y)<5 && performance.now()-down.time<650) { const id=pick(e);if(id) selectPart(id); }
    down=null;
  });
  canvas.addEventListener('pointercancel',e=>{activePointers.delete(e.pointerId);down=null;});
  canvas.addEventListener('pointerleave',()=>{canvas.style.cursor='grab';});
  canvas.addEventListener('pointermove',e=>{
    if(activePointers.size) {canvas.style.cursor='grabbing';return;}
    if(performance.now()-lastHover<65) return;lastHover=performance.now();
    canvas.style.cursor=pick(e)?'pointer':'grab';
  });
  canvas.style.cursor='grab';
}

const projected = new THREE.Vector3();
const labelOffsets = {p1:[32,-8],p2:[45,17],p3:[45,-23],p4:[28,8],shell:[-145,-5],pcb:[-145,-12],busbar:[-130,10],cells:[-130,0],contacts:[25,8],fasteners:[22,8]};
function updateLabels() {
  if(!state.labels) return;
  const w=viewport.clientWidth,h=viewport.clientHeight;
  const rects=[];
  const order=['p1','p3','p2','p4','shell','cells','pcb','busbar','contacts','fasteners'];
  const ordered=[...PART_DATA].sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
  for(const data of ordered) {
    const label=labels.get(data.id),leader=leaders.get(data.id);
    const part=parts.find(p=>p.selectionId===data.id);
    const mesh=selectionMeshes.get(data.id)?.[0];
    if(part)part.group.localToWorld(projected.copy(part.anchor));else if(mesh)mesh.getWorldPosition(projected);else continue;
    projected.project(camera);
    const visible = projected.z > -1 && projected.z < 1 && (data.number || data.id===state.selected) && ((part?.progress??state.explosion)>.08 || data.id===state.selected);
    if(!visible) {label.style.display='none';leader.style.display='none';continue;}
    label.style.display='flex';
    let [dx,dy]=labelOffsets[data.id];
    const lw=label.offsetWidth,lh=label.offsetHeight;
    let x=THREE.MathUtils.clamp((projected.x*.5+.5)*w+dx,10,w-lw-10);
    let y=THREE.MathUtils.clamp((-projected.y*.5+.5)*h+dy,8,h-lh-10);
    for(let n=0;n<8;n++) {
      const collision=rects.find(r=>x<r.x+r.w+5 && x+lw+5>r.x && y<r.y+r.h+5 && y+lh+5>r.y);
      if(!collision) break;
      y=collision.y+collision.h+6;
      if(y+lh>h-8) {y=8;x=THREE.MathUtils.clamp(x+35,8,w-lw-8);}
    }
    const onScreen = projected.x > -1.4 && projected.x < 1.4 && projected.y > -1.4 && projected.y < 1.4;
    label.style.opacity = onScreen?'1':'0';label.style.pointerEvents = onScreen?'auto':'none';label.tabIndex=onScreen?0:-1;
    label.style.transform=`translate(${Math.round(x)}px,${Math.round(y)}px)`;
    leader.style.display = onScreen ? '' : 'none';
    leader.setAttribute('x1', String((projected.x*.5+.5)*w));
    leader.setAttribute('y1', String((-projected.y*.5+.5)*h));
    leader.setAttribute('x2', String(THREE.MathUtils.clamp((projected.x*.5+.5)*w,x+5,x+lw-5)));
    leader.setAttribute('y2', String(y+lh/2));
    leader.classList.toggle('selected',data.id===state.selected);
    rects.push({x,y,w:lw,h:lh});
  }
}
function animate(time) {
  if(disposed) return;
  frame=requestAnimationFrame(animate);
  if(document.hidden) {lastTime=time;return;}
  const dt=Math.min((time-lastTime)/1000 || .016,.05);lastTime=time;
  const ease=reducedMotion?1:1-Math.exp(-dt*7);
  for(const part of parts) {
    const target=partTarget(part.selectionId);
    part.progress += (target-part.progress)*ease;
    if(Math.abs(target-part.progress)<.0001) part.progress=target;
    part.group.position.copy(part.base).addScaledVector(part.offset,part.progress);
    // In a global explosion the lower holder stays below the array; when picked
    // alone it additionally slides out through the front so the shell cannot hide it.
    if(part.id==='lowerHolder') {
      const extra=state.overrides.get('p2')===1?2.0:0;
      part.isolation+=(extra-part.isolation)*ease;
      if(Math.abs(extra-part.isolation)<.0001)part.isolation=extra;
      part.group.position.z+=part.isolation;
    }
    if(part.follow){const parent=parts.find(p=>p.id===part.follow);part.group.position.add(parent.group.position).sub(parent.base);}
    const moving=Math.abs(target-part.progress)>.005;
    for(const mat of materials.get(part.id)) {
      const highlighted=part.selectionId===state.selected && part.kind==='plastic' && mat.userData.kind==='plastic';
      mat.emissive.copy(mat.userData.baseEmissive);
      mat.emissiveIntensity=mat.userData.baseIntensity;
      if(highlighted || (moving && part.kind==='plastic' && mat.userData.kind==='plastic')) {mat.emissive.set(0x147bd4);mat.emissiveIntensity=highlighted?.055:.025;}
    }
  }
  if(resetTween) {
    const t=Math.min((time-resetTween.start)/650,1),e=1-(1-t)**3;
    camera.position.lerpVectors(resetTween.from,resetTween.to,e);controls.target.lerpVectors(resetTween.fromTarget,resetTween.target,e);
    if(t===1) resetTween=null;
  }
  controls.update(dt);
  root.updateMatrixWorld(true);
  // Labels need not run at display refresh; 30Hz keeps text steady and saves layout work.
  if(Math.floor(time/33)!==Math.floor((time-dt*1000)/33)) updateLabels();
  renderer.info.reset();
  composer.render();
}

try { initScene(); } catch(error) { fail(error); }
