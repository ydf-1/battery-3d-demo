import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createBattery } from './model.js';
import { PART_DATA, PACK_CONFIG } from './data.js';
const $=id=>document.getElementById(id),V=a=>new THREE.Vector3(...a);
const ISO=V([8,6.6,14.6]).normalize(),DURATION=1600,STAGGER=60,CAMERA_MS=720;
const state={ready:false,selected:'p1',activePlastic:null,explosion:0,theme:'light'};
let renderer,scene,camera,controls,root,parts,assembly,globalMotion=null,localMotion=null,cameraMotion=null,dirty=true,frames=0,lastTime=0;
let isolation=V([0,0,0]),isolations=new Map(),environment,shadow,contactShadow;
let lastSchedule=[],trace=[],motionStarted=0,lastCameraRun=null;
const viewport=$('viewport'),labels=new Map(),leaders=new Map(),materialDefaults=new Map();
const plasticIds=PART_DATA.filter(d=>d.number).map(d=>d.id);
const lines=document.createElementNS('http://www.w3.org/2000/svg','svg');lines.classList.add('leader-lines');$('labels').append(lines);
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
const clamp=t=>Math.max(0,Math.min(1,t));
function detail(){
 const d=PART_DATA.find(d=>d.id===state.selected);$('part-detail').replaceChildren();
 const h=document.createElement('h3');h.className='detail-title';
 if(d.number){const n=document.createElement('span');n.className='detail-number';n.textContent=d.number;h.append(n);}
 const name=document.createElement('span');name.textContent=d.name;h.append(name);$('part-detail').append(h);
 if(d.number){const rec=document.createElement('div');rec.className='recommendation';const title=document.createElement('h4');title.textContent='邦泰推荐';const copy=document.createElement('p');copy.className='recommendation-copy';copy.textContent=d.recommendation;rec.append(title,copy);$('part-detail').append(rec);}
 $('part-detail').dataset.selection=d.id;
 document.querySelectorAll('[data-part]').forEach(el=>{el.classList.toggle('selected',el.dataset.part===state.selected);el.setAttribute('aria-pressed',String(el.dataset.part===state.selected));});
 for(const [id,label] of labels)label.classList.toggle('selected',id===state.activePlastic);
 $('selection-caption').textContent=d.name;
}
for(const d of PART_DATA){
 const row=document.createElement('button');row.dataset.part=d.id;row.className='part-row '+(d.number?'plastic-row':'plain-row');
 if(d.number){const n=document.createElement('span');n.className='part-number';n.textContent=d.number;row.append(n);}
 const text=document.createElement('span');text.className='part-text';const bold=document.createElement('b');bold.textContent=d.name;text.append(bold);row.append(text);row.onclick=()=>select(d.id);$(d.number?'part-list':'other-parts').append(row);
 if(d.number){const label=document.createElement('button');label.className='part-label';label.dataset.selection=d.id;label.setAttribute('aria-label',d.number+d.name);label.innerHTML=`<b data-digit="${plasticIds.indexOf(d.id)+1}">${d.number}</b><span>${d.name}</span>`;label.onclick=()=>select(d.id);$('labels').append(label);labels.set(d.id,label);const line=document.createElementNS('http://www.w3.org/2000/svg','line');lines.append(line);leaders.set(d.id,line);}
}
for(const p of PACK_CONFIG){const row=document.createElement('div');const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=p.label;dd.textContent=p.value;row.append(dt,dd);$('pack-specs').append(row);const metric=document.createElement('div');const strong=document.createElement('strong');strong.textContent=p.value;metric.append(strong);$('hero-specs').append(metric);}
function pose(part,progress,isolated=false,cache=new Map()){
 if(cache.has(part.id))return cache.get(part.id).clone();
 const p=part.base.clone().addScaledVector(part.offset,progress(part));
 if(part.follow){const parent=parts.find(p=>p.id===part.follow);p.add(pose(parent,progress,isolated,cache)).sub(parent.base);}
 if(isolated&&part.selectionId===state.activePlastic)p.add(isolation);
 cache.set(part.id,p.clone());return p;
}
function applyPoses(){
 const cache=new Map();
 function current(p){if(cache.has(p.id))return cache.get(p.id);const pos=p.base.clone().addScaledVector(p.offset,p.progress).add(isolations.get(p.id));if(p.follow){const parent=parts.find(x=>x.id===p.follow);pos.add(current(parent)).sub(parent.base);}cache.set(p.id,pos);return pos;}
 for(const part of parts)part.group.position.copy(current(part));
 root.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(root);shadow.position.y=bounds.min.y-.035;contactShadow.position.set(bounds.getCenter(new THREE.Vector3()).x,bounds.min.y-.025,0);
}
function styleSelection(){
 root.traverse(o=>{if(!o.isMesh)return;const m=o.material,original=materialDefaults.get(m);const selected=o.userData.partId===state.activePlastic;
 m.color.copy(original.color);m.emissive.copy(original.emissive);m.emissiveIntensity=original.intensity;m.opacity=1;m.transparent=false;m.depthWrite=true;o.renderOrder=1;
 if(state.activePlastic&&!selected){m.color.set('#92979E');m.emissive.set(0);m.emissiveIntensity=0;m.opacity=.2;m.transparent=true;m.depthWrite=false;o.renderOrder=0;}
 if(selected){m.emissive.set('#1E7BE0');m.emissiveIntensity=.25;o.renderOrder=2;}
 m.needsUpdate=true;});dirty=true;
}
function boundsPoints(selectedOnly=false,target=false){
 const points=[],cache=new Map();
 for(const part of parts){if(selectedOnly&&part.selectionId!==state.activePlastic)continue;
 const position=target?pose(part,()=>state.explosion,true,cache):part.group.position;
 const b=part.localBounds;
 for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])points.push(V([x,y,z]).add(position));
 }return points;
}
function fit(direction=ISO,selectedOnly=!!state.activePlastic){
 const points=boundsPoints(selectedOnly,true),center=new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());
 const dir=direction.clone().normalize(),right=new THREE.Vector3().crossVectors(camera.up,dir).normalize();
 const probe=new THREE.PerspectiveCamera(camera.fov,camera.aspect,.01,500);
 const reserved=Math.min(320,viewport.clientWidth*.34),shift=reserved/viewport.clientWidth;
 function project(distance){
 const target=center.clone().addScaledVector(right,distance*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect*shift);
 probe.position.copy(target).addScaledVector(dir,distance);probe.lookAt(target);probe.updateMatrixWorld(true);
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const point of points){const p=point.clone().project(probe);minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}
 return {target,position:probe.position.clone(),height:(maxY-minY)/2,minX,maxX};
 }
 let lo=.5,hi=200;
 for(let i=0;i<34;i++){const mid=(lo+hi)/2,r=project(mid);if(r.height>.82||r.minX<-.94||r.maxX>1-2*shift-.015)lo=mid;else hi=mid;}
 return project(hi);
}
function reframe(duration=CAMERA_MS,direction=null,instant=false){
 const result=fit(direction||camera.position.clone().sub(controls.target));
 if(instant){camera.position.copy(result.position);controls.target.copy(result.target);controls.update();cameraMotion=null;}
 else {cameraMotion={start:performance.now(),duration,from:camera.position.clone(),to:result.position,fromTarget:controls.target.clone(),target:result.target};lastCameraRun={plannedDurationMs:duration,observedDurationMs:null,target:result.target.toArray(),position:result.position.toArray(),trace:[]};}
 dirty=true;
}
function select(id){
 if(!PART_DATA.some(d=>d.id===id))return;state.selected=id;
 if(plasticIds.includes(id)&&state.ready){
 state.activePlastic=state.activePlastic===id?null:id;
 isolation.copy(camera.position).sub(controls.target).normalize().multiplyScalar(4.4);
 localMotion={start:performance.now(),duration:800,from:new Map(parts.map(p=>[p.id,isolations.get(p.id).clone()]))};
 styleSelection();reframe();
 }
 detail();dirty=true;
}
function setExplosion(value){
 state.explosion=clamp(value);state.activePlastic=null;localMotion=null;for(const p of parts||[])isolations.set(p.id,V([0,0,0]));
 const reverse=parts?.some(p=>p.progress>state.explosion+.0001);
 lastSchedule=(parts||[]).map(p=>({id:p.id,rank:reverse?7-p.animationRank:p.animationRank,delayMs:(reverse?7-p.animationRank:p.animationRank)*STAGGER,durationMs:DURATION-7*STAGGER,from:p.progress,to:state.explosion}));
 motionStarted=performance.now();trace=[];globalMotion={start:motionStarted,schedule:lastSchedule};
 $('explosion').value=String(Math.round(value*100));$('explosion-output').textContent=Math.round(value*100)+'%';$('scene-state').textContent=value===0?'装配视图':value===1?'完整拆解':'拆解视图';
 if(state.ready){styleSelection();reframe(DURATION);}detail();dirty=true;
}
function theme(){state.theme=state.theme==='light'?'dark':'light';document.body.classList.toggle('dark-theme',state.theme==='dark');$('theme-toggle').textContent=state.theme==='light'?'深色':'浅色';$('theme-toggle').setAttribute('aria-pressed',String(state.theme==='dark'));dirty=true;}
function bindUI(){
 $('theme-toggle').onclick=theme;$('explode').onclick=()=>setExplosion(1);$('assemble').onclick=()=>setExplosion(0);$('explosion').oninput=e=>setExplosion(+e.target.value/100);
 $('auto-rotate').onclick=()=>{controls.autoRotate=!controls.autoRotate;$('auto-rotate').classList.toggle('active',controls.autoRotate);$('auto-rotate').setAttribute('aria-pressed',String(controls.autoRotate));dirty=true;};
 $('reset').onclick=()=>{controls.autoRotate=false;reframe(CAMERA_MS,ISO);};
 for(const el of document.querySelectorAll('[data-view]'))el.onclick=()=>reframe(CAMERA_MS,el.dataset.view==='front'?V([0,0,1]):ISO);
 $('zoom-in').onclick=()=>zoom(.85);$('zoom-out').onclick=()=>zoom(1.18);
 function zoom(f){cameraMotion=null;camera.position.sub(controls.target).multiplyScalar(f).add(controls.target);controls.update();dirty=true;}
 $('toggle-labels').onclick=()=>{};
 for(const tab of ['components','specs'])$('tab-'+tab).onclick=()=>{for(const t of ['components','specs']){$('tab-'+t).setAttribute('aria-selected',String(t===tab));$('tab-'+t).classList.toggle('active',t===tab);$(t+'-panel').hidden=t!==tab;}};
 $('help').onclick=()=>$('guide').showModal();$('close-guide').onclick=()=>$('guide').close();$('start-explore').onclick=()=>$('guide').close();$('retry').onclick=()=>location.reload();
 document.querySelector('.brand').onclick=e=>{e.preventDefault();setExplosion(0);};
 const ray=new THREE.Raycaster(),mouse=new THREE.Vector2();let down=null;
 renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
 renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;const r=viewport.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(mouse,camera);const hits=ray.intersectObject(root,true);const hit=hits.find(h=>h.object.userData.partId===state.activePlastic)||hits.find(h=>h.object.userData.partId);if(hit)select(hit.object.userData.partId);down=null;});
 viewport.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT')return;if(e.key===' ') {e.preventDefault();setExplosion(state.explosion>.5?0:1);}if(e.key.toLowerCase()==='r')reframe(CAMERA_MS,ISO);if(e.key==='+'||e.key==='=')zoom(.9);if(e.key==='-')zoom(1.1);if(e.key.startsWith('Arrow')){e.preventDefault();cameraMotion=null;controls.autoRotate=false;const v=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));if(e.key==='ArrowLeft')v.theta-=.12;if(e.key==='ArrowRight')v.theta+=.12;if(e.key==='ArrowUp')v.phi-=.12;if(e.key==='ArrowDown')v.phi+=.12;v.phi=THREE.MathUtils.clamp(v.phi,.12,Math.PI-.12);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(v));controls.update();dirty=true;}});
}
function updateLabels(){
 const w=viewport.clientWidth,h=viewport.clientHeight,order=['p1','p3','p2','p4'];
 order.forEach((id,i)=>{const label=labels.get(id),p=parts.find(p=>p.selectionId===id);const b=p.localBounds.getCenter(new THREE.Vector3()).add(p.group.position).project(camera);
 const x=w-Math.min(308,w*.34),y=Math.max(65,(h-4*80)/2)+i*80;
 label.style.display='flex';label.style.transform=`translate(${x}px,${y}px)`;
 const line=leaders.get(id);line.setAttribute('x1',(b.x*.5+.5)*w);line.setAttribute('y1',(-b.y*.5+.5)*h);line.setAttribute('x2',x);line.setAttribute('y2',y+label.offsetHeight/2);line.style.display='';
 });
}
function init(){
 renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0xffffff,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.VSMShadowMap;viewport.prepend(renderer.domElement);
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(36,1,.01,500);
 const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;scene.environmentIntensity=.8;room.dispose();pmrem.dispose();
 scene.add(new THREE.HemisphereLight(0xffffff,0x7e8997,.7));const key=new THREE.DirectionalLight(0xfff9f2,2.1);key.position.set(-6,12,8);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-16,right:16,top:16,bottom:-16,near:.1,far:70});key.shadow.bias=-.0002;key.shadow.normalBias=.025;key.shadow.radius=4;key.shadow.blurSamples=8;scene.add(key);const fill=new THREE.DirectionalLight(0xd6e6ff,1);fill.position.set(6,3,-3);scene.add(fill);
 ({root,parts,assembly}=createBattery());scene.add(root);
 for(const p of parts){p.progress=0;isolations.set(p.id,V([0,0,0]));}
 root.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;if(!materialDefaults.has(o.material))materialDefaults.set(o.material,{color:o.material.color.clone(),emissive:o.material.emissive.clone(),intensity:o.material.emissiveIntensity});});
 shadow=new THREE.Mesh(new THREE.PlaneGeometry(120,120),new THREE.ShadowMaterial({opacity:.12}));shadow.name='softShadowFloor';shadow.rotation.x=-Math.PI/2;shadow.receiveShadow=true;scene.add(shadow);
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');const g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(0,0,0,.30)');g.addColorStop(.45,'rgba(0,0,0,.14)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
 contactShadow=new THREE.Mesh(new THREE.PlaneGeometry(5,3.6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));contactShadow.name='contactShadow';contactShadow.rotation.x=-Math.PI/2;scene.add(contactShadow);
 controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=3;controls.maxDistance=200;controls.autoRotateSpeed=.6;controls.addEventListener('change',()=>dirty=true);controls.addEventListener('start',()=>cameraMotion=null);
 applyPoses();function resize(){const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();reframe(0,ISO,true);dirty=true;}
 new ResizeObserver(resize).observe(viewport);resize();state.ready=true;$('loading').hidden=true;$('render-status').textContent='渲染就绪';bindUI();detail();animate(performance.now());
}
// Inspect actual vertices rather than nominal dimensions; this is called only
// when an acceptance snapshot is requested, never on each rendering frame.
function measuredGeometry(){
 root.updateMatrixWorld(true);camera.updateMatrixWorld(true);const all={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity},entries=[];
 const matrix=new THREE.Matrix4(),instance=new THREE.Matrix4(),p=new THREE.Vector3();
 for(const part of parts){const box=new THREE.Box3(),screen={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};part.group.traverse(mesh=>{if(!mesh.isMesh)return;const a=mesh.geometry.attributes.position;for(let i=0;i<(mesh.isInstancedMesh?mesh.count:1);i++){matrix.copy(mesh.matrixWorld);if(mesh.isInstancedMesh){mesh.getMatrixAt(i,instance);matrix.multiply(instance);}for(let j=0;j<a.count;j++){p.fromBufferAttribute(a,j).applyMatrix4(matrix);box.expandByPoint(p);p.project(camera);const x=(p.x*.5+.5)*viewport.clientWidth,y=(-p.y*.5+.5)*viewport.clientHeight;screen.minX=Math.min(screen.minX,x);screen.maxX=Math.max(screen.maxX,x);screen.minY=Math.min(screen.minY,y);screen.maxY=Math.max(screen.maxY,y);}}});
 all.minX=Math.min(all.minX,screen.minX);all.maxX=Math.max(all.maxX,screen.maxX);all.minY=Math.min(all.minY,screen.minY);all.maxY=Math.max(all.maxY,screen.maxY);
 entries.push({id:part.id,selectionId:part.selectionId,base:part.base.toArray(),position:part.group.position.toArray(),offset:part.offset.toArray(),progress:part.progress,follow:part.follow,worldBounds:{min:box.min.toArray(),max:box.max.toArray()},screenBounds:screen});}
 return {parts:entries,modelScreenBounds:all};
}
function pickPoints(){
 root.updateMatrixWorld(true);const points={},ray=new THREE.Raycaster();
 root.traverse(mesh=>{if(!mesh.isMesh||!mesh.userData.partId)return;const id=mesh.userData.partId;if((points[id]?.length||0)>=4)return;const p=new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3()).project(camera);if(Math.abs(p.x)>.95||Math.abs(p.y)>.88||Math.abs(p.z)>1)return;ray.setFromCamera(new THREE.Vector2(p.x,p.y),camera);const hit=ray.intersectObject(root,true).find(h=>h.object.userData.partId);if(hit?.object.userData.partId===id)(points[id]??=[]).push({x:(p.x*.5+.5)*viewport.clientWidth,y:(-p.y*.5+.5)*viewport.clientHeight});});return points;
}
function snapshot(){const geometry=measuredGeometry();const mats=[];const seen=new Set();root.traverse(o=>{if(!o.isMesh)return;const m=o.material;if(seen.has(m))return;seen.add(m);mats.push({partId:o.userData.partId,role:m.userData.role,kind:m.userData.kind,color:m.color.getHexString(),opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite,renderOrder:o.renderOrder,roughness:m.roughness,metalness:m.metalness,emissive:m.emissive.getHexString(),emissiveIntensity:m.emissiveIntensity});});
 return {...state,settled:!globalMotion&&!localMotion&&!cameraMotion,renderedFrames:frames,...geometry,camera:{position:camera.position.toArray(),target:controls.target.toArray(),direction:camera.position.clone().sub(controls.target).normalize().toArray()},materials:mats,assembly,render:{alpha:renderer.getClearAlpha(),antialias:renderer.getContext().getContextAttributes().antialias,outputColorSpace:renderer.outputColorSpace,toneMapping:renderer.toneMapping,exposure:renderer.toneMappingExposure,environmentType:'RoomEnvironment/PMREMGenerator',shadowType:shadow.material.type,shadowMapType:renderer.shadowMap.type,contactShadow:!!contactShadow},motion:{durationMs:DURATION,staggerMs:STAGGER,cameraDurationMs:CAMERA_MS,cameraRun:lastCameraRun,schedule:lastSchedule,trace:[...trace]},cellGeometry:{count:root.getObjectByName('cellBodies').count}};
}
function animate(time){requestAnimationFrame(animate);const dt=Math.min(.05,(time-lastTime)/1000||.016);lastTime=time;
 if(globalMotion){const elapsed=time-globalMotion.start;for(const task of globalMotion.schedule){const p=parts.find(p=>p.id===task.id);p.progress=THREE.MathUtils.lerp(task.from,task.to,ease(clamp((elapsed-task.delayMs)/task.durationMs)));}
 if(trace.length<512||elapsed>=DURATION)trace.push({elapsedMs:elapsed,progress:Object.fromEntries(parts.map(p=>[p.id,p.progress]))});if(elapsed>=DURATION)globalMotion=null;dirty=true;}
 if(localMotion){const t=clamp((time-localMotion.start)/localMotion.duration);for(const p of parts){const to=p.selectionId===state.activePlastic?isolation:V([0,0,0]);isolations.get(p.id).lerpVectors(localMotion.from.get(p.id),to,ease(t));}if(t===1)localMotion=null;dirty=true;}
 if(cameraMotion){const t=clamp((time-cameraMotion.start)/cameraMotion.duration);camera.position.lerpVectors(cameraMotion.from,cameraMotion.to,ease(t));controls.target.lerpVectors(cameraMotion.fromTarget,cameraMotion.target,ease(t));if(lastCameraRun)lastCameraRun.trace.push({elapsedMs:time-cameraMotion.start,position:camera.position.toArray(),target:controls.target.toArray()});if(t===1){lastCameraRun.observedDurationMs=time-cameraMotion.start;cameraMotion=null;}dirty=true;}
 controls.update(dt);if(dirty||controls.autoRotate){applyPoses();updateLabels();renderer.render(scene,camera);frames++;dirty=false;}
}
try{init();Object.defineProperty(window,'batteryExplorer',{value:Object.freeze({snapshot,pickPoints,status:()=>({ready:state.ready,settled:!globalMotion&&!localMotion&&!cameraMotion})})});}catch(error){console.error(error);$('loading').hidden=true;$('canvas-error').hidden=false;}
