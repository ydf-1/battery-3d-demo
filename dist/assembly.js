import * as THREE from 'three';

const LAYER_IDS = ['topCap', 'pcb', 'bmsBracket', 'upperHolder', 'cells', 'lowerHolder', 'base'];
const OUTSIDE_IN = ['shell', 'topCap', 'base', 'pcb', 'bmsBracket', 'upperHolder', 'lowerHolder', 'cells'];

function serialBox(box) {
  return { min: box.min.toArray(), max: box.max.toArray(), size: box.getSize(new THREE.Vector3()).toArray() };
}

// Measure actual mesh vertices in the part's coordinate space, including every
// instanced cell, instead of assuming that a helper's nominal dimensions are its
// finished extents. Nested rotations and thin electrical leads count as geometry.
function localBounds(part) {
  part.group.updateWorldMatrix(true, true);
  const inverse = part.group.matrixWorld.clone().invert();
  const transform = new THREE.Matrix4(), instance = new THREE.Matrix4();
  const vertex = new THREE.Vector3(), box = new THREE.Box3();
  part.group.traverse(mesh => {
    if (!mesh.isMesh) return;
    const positions = mesh.geometry.getAttribute('position');
    const count = mesh.isInstancedMesh ? mesh.count : 1;
    for (let i = 0; i < count; i++) {
      transform.multiplyMatrices(inverse, mesh.matrixWorld);
      if (mesh.isInstancedMesh) { mesh.getMatrixAt(i, instance); transform.multiply(instance); }
      for (let j = 0; j < positions.count; j++) box.expandByPoint(vertex.fromBufferAttribute(positions, j).applyMatrix4(transform));
    }
  });
  return box;
}

export function configureLayeredAssembly(root, parts) {
  const byId = new Map(parts.map(part => [part.id, part]));
  root.updateMatrixWorld(true);
  for (const part of parts) {
    part.localBounds = localBounds(part);
    part.frameBounds = part.localBounds.clone();
  }
  // Followers preserve their assembled relationship at every slider position.
  for (const [id, parent] of [['socket', 'base'], ['busbar', 'cells']]) {
    byId.get(id).follow = parent;
    byId.get(id).offset.set(0, 0, 0);
  }
  const layers = LAYER_IDS.map((id, index) => {
    const part = byId.get(id), bounds = part.localBounds.clone();
    const followers = parts.filter(p => p.follow === id);
    for (const child of followers) bounds.union(child.localBounds.clone().translate(child.base.clone().sub(part.base)));
    return { id, part, index, bounds, members: [id, ...followers.map(p => p.id)] };
  });
  const solidHeight = layers.reduce((sum, layer) => sum + layer.bounds.max.y - layer.bounds.min.y, 0);
  // H = S + 6g. g = .08S makes g/H = .054054..., above five percent
  // even when "model height" means the full exploded height rather than closed H.
  const gap = solidHeight * .08;
  const height = solidHeight + gap * (layers.length - 1);
  let cursor = -height / 2;
  for (const layer of [...layers].reverse()) {
    const positionY = cursor - layer.bounds.min.y;
    layer.part.offset.set(-layer.part.base.x, positionY - layer.part.base.y, -layer.part.base.z);
    layer.part.layerIndex = layer.index;
    cursor += layer.bounds.max.y - layer.bounds.min.y + gap;
  }
  const middle = new THREE.Box3();
  for (const layer of layers) middle.union(layer.bounds.clone().translate(layer.part.base.clone().add(layer.part.offset)));
  const shell = byId.get('shell');
  shell.offset.set(middle.min.x - gap - shell.localBounds.max.x - shell.base.x, 0, 0);
  for (const part of parts) {
    const source = part.follow ? byId.get(part.follow) : part;
    part.animationRank = OUTSIDE_IN.indexOf(source.id);
    part.delayMs = part.animationRank * 60;
    if (part.follow) part.layerIndex = source.layerIndex;
    // Selection is an extra displacement, separate from the global explosion.
    part.isolationOffset = new THREE.Vector3(0, 0, 2.4);
  }

  function explodedPosition(part) {
    const result = part.base.clone().add(part.offset);
    if (part.follow) {
      const parent = byId.get(part.follow);
      result.add(explodedPosition(parent)).sub(parent.base);
    }
    return result;
  }
  const boxes = Object.fromEntries(parts.map(part => [part.id, part.localBounds.clone().translate(explodedPosition(part))]));
  const layerBoxes = layers.map(layer => {
    const box = new THREE.Box3();
    for (const id of layer.members) box.union(boxes[id]);
    return { id: layer.id, members: layer.members, box };
  });
  const adjacent = layerBoxes.slice(0, -1).map((layer, index) => ({
    upper: layer.id, lower: layerBoxes[index + 1].id,
    gap: layer.box.min.y - layerBoxes[index + 1].box.max.y,
    overlap: layer.box.intersectsBox(layerBoxes[index + 1].box)
  }));
  const report = {
    order: [...LAYER_IDS], solidHeight, gap, totalHeight: height, gapHeightRatio: gap / height,
    parts: Object.fromEntries(parts.map(part => [part.id, { ...serialBox(boxes[part.id]), position: explodedPosition(part).toArray(), offset: part.offset.toArray(), follow: part.follow, delayMs: part.delayMs }])),
    layers: layerBoxes.map(layer => ({ id: layer.id, members: layer.members, ...serialBox(layer.box) })),
    adjacent, middle: serialBox(middle),
    shellClearance: middle.min.x - boxes.shell.max.x,
    shellOverlapsMiddle: boxes.shell.intersectsBox(middle),
    animationOrder: [...OUTSIDE_IN], staggerMs: 60, maximumDelayMs: (OUTSIDE_IN.length - 1) * 60
  };
  return report;
}
