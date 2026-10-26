import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

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
  // The requested real cell dimensions use a common scene scale.
  const mm=.014,r=21*mm/2,h=70*mm,pitch=23*mm,positions=[];
  for(let col=0;col<13;col++)for(let row=0;row<5;row++)positions.push([(col-6)*pitch,0,(row-2)*pitch]);
  const width=4.55,depth=1.94;

  const shell=part('shell','shell','metal',[0,0,0],[.1,-2.15,-.15],[2.26,.1,.5]);
  add(shell,tube(width,depth,1.91,.085,.13),mat.aluminum);
  for(const x of [-width/2+.125,width/2-.125])for(const z of [-depth/2+.125,depth/2-.125])add(shell,tube(.17,.17,1.9,.04,.055),mat.edge,[x,0,z]);
  for(const sign of [-1,1])for(let i=0;i<7;i++)box(shell,.025,1.84,.017,mat.edge,sign*(width/2-.015),0,-.67+i*.22,.005);
  const brush=[];for(let i=0;i<55;i++)brush.push([-2.06+i*.076,0,depth/2+.002]);instances(shell,new THREE.BoxGeometry(.002,1.83,.001),mat.edge,brush);

  // p1 has two independent transforms, linked by the interaction selection ID.
  const top=part('topCap','p1','plastic',[0,1.14,0],[0,3.95,0],[1.8,.12,.86]);
  box(top,4.64,.30,2.02,mat.black,0,0,0,.11);box(top,4.39,.055,1.79,mat.black,0,-.18,0,.03);add(top,tube(4.44,1.82,.055,.045,.1),mat.black,[0,.17,0]);
  for(const x of [-1.02,1.02])box(top,.30,.55,.43,mat.black,x,.40,-.05,.09);
  box(top,2.29,.26,.43,mat.black,0,.69,-.05,.12);
  for(let i=0;i<17;i++)box(top,.025,.012,.33,mat.black,-.77+i*.095,.827,-.05,.003);
  for(const x of [-2.1,2.1])for(const z of [-.77,.77])screw(top,x,.173,z);
  cyl(top,.10,.045,mat.black,-.45,.18,.63);cyl(top,.14,.035,mat.edge,.48,.185,.62,'fasteners');cyl(top,.085,.04,mat.darkMetal,.48,.194,.62,'fasteners');

  const base=part('base','p1','plastic',[0,-1.12,0],[0,-3.15,.08],[1.8,.12,.8]);
  box(base,4.64,.27,2.02,mat.black,0,-.035,0,.11);
  for(const x of [-2.2,2.2])box(base,.18,.27,1.83,mat.black,x,.19,0,.04);
  box(base,4.34,.27,.13,mat.black,0,.19,-.92,.025);
  for(const sign of [-1,1])box(base,1.42,.27,.13,mat.black,sign*1.43,.19,.92,.025);
  for(let i=0;i<10;i++)box(base,.04,.13,1.59,mat.black,-1.94+i*.43,.13,0,.009);
  for(const x of [-2.08,2.08])for(const z of [-.76,.76]){cyl(base,.10,.22,mat.black,x,.19,z);screw(base,x,.315,z);}
  for(const x of [-1.7,1.7])box(base,.55,.075,1.5,mat.black,x,-.21,0,.025);

  const cells=part('cells','cells','cells',[0,-.13,0],[0,.88,0],[-.1,0,.8]);
  const bodies=instances(cells,new THREE.CylinderGeometry(r,r,h,28),mat.cell,positions);
  bodies.name='cellBodies';Object.assign(bodies.userData,{cellCount:65,diameterMm:21,lengthMm:70,mmPerSceneUnit:1/mm});
  const caps=new THREE.CylinderGeometry(r*.88,r*.88,.018,24);
  instances(cells,caps,mat.edge,positions.map(([x,y,z])=>[x,h/2+.009,z]),'cells');
  instances(cells,caps,mat.edge,positions.map(([x,y,z])=>[x,-h/2-.009,z]),'cells');
  instances(cells,new THREE.CylinderGeometry(.065,.065,.020,20),mat.nickel,positions.map(([x,y,z])=>[x,h/2+.027,z]),'cells');

  function holder(id,y,dy){
    const p=part(id,'p2','plastic',[0,y,0],[0,dy,0],[2.08,.06,.73]);
    const s=rect(.319,.319,.054),hole=new THREE.Path();hole.absarc(0,0,r+.003,0,Math.PI*2,true);s.holes.push(hole);
    instances(p,extrude(s,.17),mat.blue,positions);add(p,tube(4.31,1.76,.13,.075,.07),mat.blue);
    for(const x of [-2.12,2.12])for(const z of [-.82,.82]){box(p,.14,.25,.14,mat.blue,x,.02,z,.025);cyl(p,.035,.255,mat.darkMetal,x,.02,z,'fasteners',12);}
    return p;
  }
  holder('upperHolder',.31,1.64);holder('lowerHolder',-.56,-.12);

  const bracket=part('bmsBracket','p3','plastic',[0,.65,0],[.15,2.0,0],[2.06,.1,.79]);
  add(bracket,tube(4.29,1.75,.15,.10,.075),mat.blue);
  for(const x of [-1.82,-.61,.61,1.82])box(bracket,.085,.08,1.54,mat.blue,x,-.075,0,.014);
  for(const x of [-1.99,1.99])for(const z of [-.73,.73]){box(bracket,.15,.38,.15,mat.blue,x,.095,z,.025);cyl(bracket,.042,.10,mat.copper,x,.235,z,'fasteners',16);}
  const pcb=part('pcb','pcb','pcb',[0,.77,0],[.15,2.68,0],[1.4,.09,.62]);
  box(pcb,4.03,.065,1.49,mat.pcb,0,0,0,.035);
  for(let i=0;i<8;i++){
    const x=-1.64+i*.45;box(pcb,.31,.18,.24,mat.chip,x,.12,-.40,.018);box(pcb,.24,.018,.18,mat.nickel,x,.027,-.61,.003,'pcb');
    for(let pin=0;pin<3;pin++)box(pcb,.025,.025,.11,mat.nickel,x-.08+pin*.08,.045,-.215,.002,'pcb');
  }
  box(pcb,.51,.075,.45,mat.chip,-.65,.073,.17,.015);
  for(let i=0;i<8;i++)for(const sign of [-1,1])box(pcb,.027,.022,.10,mat.nickel,-.86+i*.06,.045,.17+sign*.275,.002,'pcb');
  for(let i=0;i<22;i++){
    const x=-1.76+(i%11)*.30,z=.05+Math.floor(i/11)*.42;
    box(pcb,.11,.047,.07,i%3?mat.chip:mat.nickel,x,.06,z,.006,'pcb');box(pcb,.018,.003,.16,mat.trace,x,.035,z+.10,.001,'pcb');
  }
  for(const x of [-1.78,1.72]){cyl(pcb,.09,.19,mat.edge,x,.13,.41,'pcb');cyl(pcb,.065,.008,mat.chip,x,.228,.41,'pcb');}
  for(const x of [-1.99,1.99])for(const z of [-.67,.67])screw(pcb,x,.048,z);

  const busbar=part('busbar','busbar','metal',[0,-.13,0],[.7,1.05,.35],[1.8,.52,.61]);
  for(let col=0;col<13;col++)for(const sign of [-1,1]){
    const x=(col-6)*pitch,y=sign*(h/2+.044);box(busbar,.095,.018,4*pitch+.16,mat.nickel,x,y,0,.008);
    if(col<12 && sign===(col%2?1:-1))box(busbar,pitch+.095,.018,.09,mat.nickel,x+pitch/2,y,col%2?2*pitch:-2*pitch,.006);
  }
  const tabs=[];for(const p of positions)for(const sign of [-1,1])tabs.push([p[0],sign*(h/2+.047),p[2]]);instances(busbar,new THREE.BoxGeometry(.17,.018,.12),mat.nickel,tabs);

  // The hollow socket follows the base displacement without inheriting its number.
  const socket=part('socket','p4','plastic',[0,-.91,.99],[0,.16,.92],[.55,.03,.18],'base');
  box(socket,1.18,.09,.37,mat.blue,0,.19,0,.025);box(socket,1.18,.09,.37,mat.blue,0,-.19,0,.025);
  for(const x of [-.545,.545])box(socket,.09,.30,.37,mat.blue,x,0,0,.02);
  box(socket,1.02,.30,.045,mat.blueDark,0,0,-.19,.01);
  for(const x of [-.36,-.18,0,.18,.36]){box(socket,.074,.23,.25,mat.copper,x,0,-.02,.009,'contacts');box(socket,.076,.04,.01,mat.edge,x,.065,.11,.003,'contacts');}
  for(const x of [-.67,.67]){box(socket,.14,.34,.16,mat.blue,x,0,-.05,.025);const s=cyl(socket,.045,.17,mat.edge,x,0,-.05,'fasteners',16);s.rotation.x=Math.PI/2;}

  const clones=new Map();
  root.traverse(o=>{if(!o.isMesh)return;const key=o.userData.partId+':'+o.material.uuid;if(!clones.has(key))clones.set(key,o.material.clone());o.material=clones.get(key);o.userData.highlightable=o.userData.kind==='plastic' && /^p[1-4]$/.test(o.userData.partId);});
  return {root,parts};
}
