import * as THREE from 'three';

// One procedural studio rig for all models. No environment-image downloads.
export function applyStudio(scene, renderer, root, floorY) {
  renderer.toneMappingExposure = .9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.environmentIntensity = .85;
  for (const child of [...scene.children]) {
    if (child.isLight) scene.remove(child);
    if (child.type === 'GridHelper') child.visible = false;
    if (child.geometry?.type === 'RingGeometry') child.material.opacity = .035;
  }
  scene.add(new THREE.HemisphereLight(0xf4f7ff, 0x182333, .5));
  const key = new THREE.DirectionalLight(0xfff9f1, 1.9);
  key.position.set(-5, 9, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, {left:-12,right:12,top:12,bottom:-12,near:.5,far:45});
  key.shadow.bias = -.0004; key.shadow.normalBias = .035; key.shadow.radius = 5;
  const fill = new THREE.DirectionalLight(0xdae8ff, .55); fill.position.set(7, 3, 4);
  const rim = new THREE.DirectionalLight(0xe0edff, 1.65); rim.position.set(-4, 6, -7);
  scene.add(key, fill, rim);
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.ShadowMaterial({opacity:.065}));
  floor.name = 'studioShadowFloor'; floor.rotation.x = -Math.PI/2;
  floor.position.y = floorY; floor.receiveShadow = true; scene.add(floor);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d');
  if(ctx){
    const fade=ctx.createRadialGradient(64,64,8,64,64,64);
    fade.addColorStop(0,'rgba(0,0,0,.38)');fade.addColorStop(.45,'rgba(0,0,0,.18)');fade.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=fade;ctx.fillRect(0,0,128,128);
    const shadow=new THREE.Mesh(new THREE.PlaneGeometry(8,6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false}));
    shadow.name='softContactShadow';shadow.rotation.x=-Math.PI/2;shadow.position.y=floorY+.006;scene.add(shadow);
  }
}
