import * as THREE from 'three';

// One procedural studio rig for all models. No environment-image downloads.
export function applyStudio(scene, renderer, root, floorY) {
  renderer.toneMappingExposure = .9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  scene.environmentIntensity = .7;
  for (const child of [...scene.children]) {
    if (child.isLight) scene.remove(child);
    if (child.type === 'GridHelper') child.visible = false;
    if (child.geometry?.type === 'RingGeometry') child.material.opacity = .035;
  }
  scene.add(new THREE.HemisphereLight(0xf4f7ff, 0x182333, .65));
  const key = new THREE.DirectionalLight(0xfff8f0, 2.4);
  key.position.set(-3, 12, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, {left:-12,right:12,top:12,bottom:-12,near:.5,far:45});
  key.shadow.bias = -.0004; key.shadow.normalBias = .035; key.shadow.radius = 5;
  const fill = new THREE.DirectionalLight(0xc5e0ff, .75); fill.position.set(7, 3, 4);
  const rim = new THREE.DirectionalLight(0xe0edff, 1.25); rim.position.set(-4, 6, -7);
  scene.add(key, fill, rim);
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.ShadowMaterial({opacity:.075}));
  floor.name = 'studioShadowFloor'; floor.rotation.x = -Math.PI/2;
  floor.position.y = floorY; floor.receiveShadow = true; scene.add(floor);
}
