import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { applySurfaceFinishes } from '../shared/materials.js';

// Geometry only. No labels, logos, model names, decals or printed text.
export function createBattery() {
  const root = new THREE.Group(), parts = [], cache = new Map();
  const material=(kind,color,metalness,roughness)=>{const m=new THREE.MeshStandardMaterial({color,metalness,roughness});m.userData.kind=kind;return m;};
  const mat={
    black:material('plastic',0x101214,0,.76),blue:material('plastic',0x0084e9,0,.40),blueDark:material('plastic',0x0069bf,0,.46),
    aluminum:material('metal',0xbec3c9,.92,.34),edge:material('metal',0xd5d9de,.95,.24),nickel:material('metal',0xc4c8ce,.88,.28),copper:material('metal',0xc68c42,.82,.30),
    cell:material('cells',0xbac0c7,.78,.30),pcb:material('pcb',0x073e29,.1,.60),chip:material('pcb',0x131719,.12,.55),trace:material('metal',0x929c70,.64,.5),darkMetal:material('metal',0x41484f,.8,.5)
  };
  const V=a=>new THREE.Vector3(...a);
  function part(id,selectionId,kind,base,offset,anchor=[0,0,0],follow=null){
    const group=new THREE.Group();group.name=id;group.position.fromArray(base);group.userData.partId=selectionId;root.add(group);
    parts.push({id,selectionId,kind,group,base:V(base),offset:V(offset),anchor:V(anchor),follow});return group;
  }
  function add(parent,g,m,pos=[0,0,0],id=null){const mesh=new THREE.Mesh(g,m);mesh.position.fromArray(pos);mesh.userData.partId=id??parent.userData.partId;mesh.userData.kind=m.userData.kind;parent.add(mesh);return mesh;}
  function box(p,w,h,d,m,x=0,y=0,z=0,r=.025,id=null){const k=[w,h,d,r].join('/');if(!cache.has(k))cache.set(k,r?new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/3,h/3,d/3)):new THREE.BoxGeometry(w,h,d));return add(p,cache.get(k),m,[x,y,z],id);}
  function cyl(p,r,h,m,x,y,z,id=null,n=24){return add(p,new THREE.CylinderGeometry(r,r,h,n),m,[x,y,z],id);}
  function screw(p,x,y,z){cyl(p,.055,.035,mat.edge,x,y,z,'fasteners',16);box(p,.065,.006,.009,mat.darkMetal,x,y+.020,z,.001,'fasteners');box(p,.009,.006,.065,mat.darkMetal,x,y+.020,z,.001,'fasteners');}
  function rect(w,d,r,p=new THREE.Shape()){
    const x=-w/2,z=-d/2;p.moveTo(x+r,z);p.lineTo(x+w-r,z);p.quadraticCurveTo(x+w,z,x+w,z+r);p.lineTo(x+w,z+d-r);p.quadraticCurveTo(x+w,z+d,x+w-r,z+d);p.lineTo(x+r,z+d);p.quadraticCurveTo(x,z+d,x,z+d-r);p.lineTo(x,z+r);p.quadraticCurveTo(x,z,x+r,z);return p;
  }
  function extrude(s,h){const g=new THREE.ExtrudeGeometry(s,{depth:h,bevelEnabled:false,curveSegments:10});g.rotateX(-Math.PI/2);g.translate(0,-h/2,0);return g;}
  function tube(w,d,h,wall,r=.1){const s=rect(w,d,r);s.holes.push(rect(w-2*wall,d-2*wall,Math.max(.015,r-wall),new THREE.Path()));return extrude(s,h);}
  function instances(p,g,m,positions,id=null){
    const mesh=new THREE.InstancedMesh(g,m,positions.length),dummy=new THREE.Object3D();mesh.userData.partId=id??p.userData.partId;mesh.userData.kind=m.userData.kind;
    positions.forEach((v,i)=>{dummy.position.fromArray(v);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});p.add(mesh);return mesh;
  }
  // The approved green prototype used a tall removable pack with horizontal
  // cells. Keep that silhouette; 13 rows of five share the exact 21:70 ratio.
  const mm=.32/21,r=21*mm/2,h=70*mm,px=.44,py=.35,positions=[];
  for(let row=0;row<13;row++)for(let col=0;col<5;col++)positions.push([(col-2)*px,(row-6)*py,0]);
  const width=2.68,depth=1.68,caseHeight=5.32;
  const axial=g=>{g.rotateX(Math.PI/2);return g;};
  function wire(p,points,m,radius=.025,id='pcb'){
    const curve=new THREE.CatmullRomCurve3(points.map(V));
    return add(p,new THREE.TubeGeometry(curve,30,radius,8,false),m,[0,0,0],id);
  }

  const shell=part('shell','shell','metal',[0,0,0],[-3.2,-.08,-.65],[1.25,.35,.84]);
  add(shell,tube(width,depth,caseHeight,.085,.12),mat.aluminum).name='tallExtrudedAluminumCase';
  // Continuous corner channels and longitudinal ribs, like an extruded sleeve.
  for(const x of [-1.22,1.22])for(const z of [-.72,.72])add(shell,tube(.10,.10,caseHeight,.026,.04),mat.edge,[x,0,z]);
  for(const sign of [-1,1]){
    for(let i=0;i<7;i++)box(shell,.022,5.20,.026,mat.edge,sign*1.343,0,-.58+i*.193,.009);
    for(const x of [.99,1.12])box(shell,.016,5.22,.012,mat.edge,sign*x,0,.842,.004);
  }
  for(const y of [-2.63,2.63])add(shell,tube(width+.005,depth+.005,.034,.095,.12),mat.edge,[0,y,0]);

  const top=part('topCap','p1','plastic',[0,2.85,0],[0,1.95,0],[1.15,.12,.7]);
  box(top,2.78,.34,1.78,mat.black,0,0,0,.12).name='handleTopCover';
  add(top,tube(2.48,1.48,.065,.05,.07),mat.black,[0,-.20,0]);
  add(top,tube(2.58,1.58,.045,.055,.11),mat.black,[0,-.155,0]);
  // Molded arched handle: thick radiused feet and a broad grip with fine ribs.
  for(const x of [-.83,.83]){
    const foot=box(top,.34,.65,.39,mat.black,x,.41,-.09,.11);foot.rotation.z=x>0?.15:-.15;
    box(top,.49,.065,.55,mat.black,x,.205,-.09,.08);
  }
  box(top,1.92,.25,.42,mat.black,0,.73,-.09,.12);
  for(let i=0;i<19;i++)box(top,.013,.009,.30,mat.black,-.63+i*.07,.858,-.09,.003);
  for(const x of [-1.17,1.17])for(const z of [-.65,.65]){cyl(top,.085,.025,mat.darkMetal,x,.181,z,'fasteners');screw(top,x,.201,z);}
  cyl(top,.105,.055,mat.black,-.38,.20,.55);
  cyl(top,.145,.045,mat.edge,.64,.20,.53,'fasteners');
  box(top,.10,.008,.014,mat.darkMetal,.64,.227,.53,.002,'fasteners');
  // Charging-port recess, dust cap, and a discrete molded lamp window, no text.
  cyl(top,.135,.025,mat.darkMetal,.10,.185,.53,'fasteners');
  cyl(top,.085,.03,mat.copper,.10,.193,.53,'contacts');
  const cap=box(top,.23,.04,.28,mat.black,.1,.32,.34,.10);cap.rotation.x=-.55;
  box(top,.44,.025,.18,mat.black,-.87,.188,.48,.04);
  for(let i=0;i<4;i++)box(top,.055,.012,.07,mat.blueDark,-1.01+i*.09,.208,.48,.009);

  const base=part('base','p1','plastic',[0,-2.83,0],[0,-1.55,.08],[1.12,.08,.76]);
  box(base,2.78,.27,1.78,mat.black,0,-.035,0,.12);
  for(const x of [-1.29,1.29])box(base,.18,.36,1.53,mat.black,x,.25,0,.045);
  box(base,2.48,.36,.14,mat.black,0,.25,-.80,.035);
  for(const x of [-1,1])box(base,.58,.36,.14,mat.black,x,.25,.80,.035);
  for(const x of [-.90,-.45,0,.45,.90])box(base,.045,.16,1.39,mat.black,x,.16,0,.01);
  for(const x of [-1.11,1.11])for(const z of [-.61,.61]){
    cyl(base,.12,.34,mat.black,x,.23,z);cyl(base,.065,.025,mat.copper,x,.405,z,'fasteners');screw(base,x,.426,z);
    box(base,.33,.085,.36,mat.black,x,-.21,z,.055);
  }

  const cells=part('cells','cells','cells',[0,-.10,0],[.45,0,.3],[.65,.25,.58]);
  // Rotate the geometry itself so metadata still records the real cylinder length.
  const bodies=instances(cells,axial(new THREE.CylinderGeometry(r,r,h,32)),mat.cell,positions);
  bodies.name='cellBodies';Object.assign(bodies.userData,{cellCount:65,diameterMm:21,lengthMm:70,mmPerSceneUnit:1/mm,axis:'z',rows:13,columns:5});
  for(const sign of [-1,1]){
    const caps=positions.map(([x,y])=>[x,y,sign*(h/2+.009)]);
    instances(cells,axial(new THREE.CylinderGeometry(r*.92,r*.92,.018,32)),mat.edge,caps);
    instances(cells,new THREE.TorusGeometry(r*.88,.008,6,28),mat.darkMetal,positions.map(([x,y])=>[x,y,sign*(h/2+.021)]));
    instances(cells,axial(new THREE.CylinderGeometry(.065,.065,.018,20)),mat.nickel,positions.map(([x,y])=>[x,y,sign*(h/2+.025)]));
  }

  // The upper and lower insulating carriers each cradle half the array. Their
  // split is horizontal, keeping the requested two upper/lower plastic parts.
  function holder(id,upper){
    const center=upper?1.225:-1.05,ys=upper?[.35,.7,1.05,1.4,1.75,2.1]:[-2.1,-1.75,-1.4,-1.05,-.7,-.35,0];
    const p=part(id,'p2','plastic',[0,center-.10,0],[0,upper?1.35:-1.35,0],[1.12,upper?.78:-.85,.64]);
    const ring=rect(px-.006,py-.006,.035),hole=new THREE.Path();hole.absarc(0,0,r+.005,0,Math.PI*2,true);ring.holes.push(hole);
    const face=extrude(ring,.066);face.rotateX(Math.PI/2);
    const sockets=[];for(const y of ys)for(let col=0;col<5;col++)for(const sign of [-1,1])sockets.push([(col-2)*px,y-center,sign*.477]);
    instances(p,face,mat.blue,sockets).name=upper?'upperCellRetainers':'lowerCellRetainers';
    const height=ys.length*py;
    for(const x of [-1.13,1.13])for(const z of [-.51,.51])box(p,.085,height+.04,.14,mat.blue,x,0,z,.025);
    const endY=(upper?1:-1)*(height/2+.045);
    add(p,tube(2.35,1.33,.115,.075,.06),mat.blue,[0,endY,0]);
    for(const x of [-.88,0,.88])box(p,.085,.095,1.21,mat.blue,x,endY,0,.018);
    for(const x of [-1.12,1.12])for(const z of [-.57,.57]){cyl(p,.083,.19,mat.blue,x,endY,z);cyl(p,.035,.195,mat.darkMetal,x,endY,z,'fasteners');}
    return p;
  }
  holder('upperHolder',true);holder('lowerHolder',false);
  parts.find(p=>p.id==='lowerHolder').isolationOffset=V([0,0,2]);

  const bracket=part('bmsBracket','p3','plastic',[0,2.37,0],[.1,.9,0],[1.06,.05,.62]);
  add(bracket,tube(2.38,1.32,.15,.095,.07),mat.blue);
  for(const x of [-.87,0,.87])box(bracket,.09,.07,1.15,mat.blue,x,-.06,0,.015);
  for(const x of [-1.08,1.08])for(const z of [-.55,.55]){cyl(bracket,.085,.25,mat.blue,x,.065,z);cyl(bracket,.035,.03,mat.copper,x,.2,z,'fasteners');}
  const pcb=part('pcb','pcb','pcb',[0,2.46,0],[.1,1.3,0],[.9,.1,.5]);
  box(pcb,2.20,.052,1.13,mat.pcb,0,0,0,.032);
  for(let i=0;i<6;i++){
    const x=-.84+i*.335;box(pcb,.25,.14,.23,mat.chip,x,.10,-.28,.012);
    box(pcb,.19,.012,.10,mat.nickel,x,.034,-.44,.002,'pcb');
    for(let pin=0;pin<3;pin++)box(pcb,.024,.022,.10,mat.nickel,x-.07+pin*.07,.039,-.115,.002,'pcb');
  }
  box(pcb,.36,.045,.32,mat.chip,-.24,.055,.17,.009);
  for(let i=0;i<8;i++)for(const sign of [-1,1])box(pcb,.018,.015,.065,mat.nickel,-.385+i*.041,.034,.17+sign*.195,.002,'pcb');
  for(let i=0;i<24;i++){
    const x=-.93+(i%12)*.17,z=.04+Math.floor(i/12)*.36;
    if(x>-.45&&x<.05)continue;
    box(pcb,.075,.037,.045,i%3?mat.chip:mat.nickel,x,.05,z,.004,'pcb');
    box(pcb,.011,.003,.13,mat.trace,x,.028,z-.07,.001,'pcb');
  }
  for(const x of [-.89,.89]){cyl(pcb,.07,.15,mat.edge,x,.11,.32,'pcb');cyl(pcb,.052,.008,mat.chip,x,.19,.32,'pcb');}
  for(const x of [-.99,.99])for(const z of [-.46,.46])screw(pcb,x,.036,z);
  box(pcb,.38,.15,.16,mat.blueDark,.58,.105,.44,.018,'pcb');
  for(let i=0;i<6;i++)wire(pcb,[[.43+i*.057,.06,.48],[.44+i*.057,-.18,.69],[.74+i*.045,-.55,.66]],mat.darkMetal,.008);

  const busbar=part('busbar','busbar','metal',[0,-.10,0],[2.8,0,1.15],[.85,.3,.61]);
  const welds=[];
  for(let row=0;row<13;row++)for(const sign of [-1,1]){
    const y=(row-6)*py,z=sign*(h/2+.046);
    box(busbar,4*px+.17,.07,.022,mat.nickel,0,y,z,.009);
    for(let col=0;col<5;col++){
      const x=(col-2)*px;box(busbar,.125,.19,.025,mat.nickel,x,y,z,.018);
      for(const dx of [-.035,.035])welds.push([x+dx,y,sign*(h/2+.062)]);
    }
    if(row<12&&sign===(row%2?1:-1))box(busbar,.07,py+.075,.022,mat.nickel,(row%2?1:-1)*.96,y+py/2,z,.008);
  }
  instances(busbar,axial(new THREE.CylinderGeometry(.009,.009,.006,8)),mat.darkMetal,welds);

  const socket=part('socket','p4','plastic',[0,-2.58,.83],[0,.16,.92],[.55,.03,.18],'base');
  box(socket,1.18,.09,.37,mat.blue,0,.19,0,.025);box(socket,1.18,.09,.37,mat.blue,0,-.19,0,.025);
  for(const x of [-.545,.545])box(socket,.09,.30,.37,mat.blue,x,0,0,.02);
  box(socket,1.02,.30,.045,mat.blueDark,0,0,-.19,.01);
  for(const x of [-.36,-.18,0,.18,.36]){box(socket,.074,.23,.25,mat.copper,x,0,-.02,.009,'contacts');box(socket,.076,.04,.01,mat.edge,x,.065,.11,.003,'contacts');}
  for(const x of [-.67,.67]){box(socket,.14,.34,.16,mat.blue,x,0,-.05,.025);const s=cyl(socket,.045,.17,mat.edge,x,0,-.05,'fasteners',16);s.rotation.x=Math.PI/2;}

  const clones=new Map();
  root.traverse(o=>{if(!o.isMesh)return;const key=o.userData.partId+':'+o.material.uuid;if(!clones.has(key))clones.set(key,o.material.clone());o.material=clones.get(key);o.userData.highlightable=o.userData.kind==='plastic' && /^p[1-4]$/.test(o.userData.partId);});
  applySurfaceFinishes(root);
  // Keep molded black truly matte under the shared studio's bright softboxes.
  root.traverse(o=>{if(!o.isMesh||o.material.userData.kind!=='plastic')return;
    const m=o.material,dark=Math.max(m.color.r,m.color.g,m.color.b)<.035;
    m.envMapIntensity=dark?.22:.25;m.roughness=dark?.72:.42;
  });
  return {root,parts};
}
