import * as THREE from 'three';

// Fit every part's target pose in the camera's projected space. A single fixed
// camera distance makes a closed product tiny and clips a wide exploded model.
export function assemblyFrame(root, parts, progressFor, camera, viewport, direction, isolationFor=()=>0) {
  const points=[], positions=new Map();
  function pose(part) {
    if(positions.has(part.id))return positions.get(part.id);
    const progress=progressFor(part);
    const position=part.base.clone().addScaledVector(part.offset,progress);
    if(part.isolationOffset)position.addScaledVector(part.isolationOffset,isolationFor(part));
    if(part.follow) {
      const parent=parts.find(p=>p.id===part.follow);
      position.add(pose(parent)).sub(parent.base);
    }
    positions.set(part.id,position);
    return position;
  }
  for(const part of parts) {
    const progress=progressFor(part),position=pose(part);
    if(!part.frameBounds) {
      const bounds=new THREE.Box3();
      part.group.updateMatrixWorld(true);
      const inverse=part.group.matrixWorld.clone().invert();
      part.group.traverse(o=>{
        if(!o.isMesh)return;
        // Box3 also supports the existing instanced cell arrays.
        const local=new THREE.Box3().setFromObject(o).applyMatrix4(inverse);
        bounds.union(local);
      });
      part.frameBounds=bounds;
    }
    const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),(part.rotationY??0)*progress);
    for(const x of [part.frameBounds.min.x,part.frameBounds.max.x])
      for(const y of [part.frameBounds.min.y,part.frameBounds.max.y])
        for(const z of [part.frameBounds.min.z,part.frameBounds.max.z])
          points.push(new THREE.Vector3(x,y,z).applyQuaternion(q).add(position).multiply(root.scale));
  }
  const target=new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());
  const forward=direction.clone().normalize();
  const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),forward).normalize();
  const up=new THREE.Vector3().crossVectors(forward,right);
  const tanV=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
  const tanH=tanV*viewport.clientWidth/Math.max(1,viewport.clientHeight);
  let distance=0;
  for(const point of points) {
    const p=point.clone().sub(target),depth=p.dot(forward);
    distance=Math.max(distance,depth+Math.abs(p.dot(right))/(tanH*.86),depth+Math.abs(p.dot(up))/(tanV*.90));
  }
  return {target,position:target.clone().addScaledVector(forward,distance)};
}
