import assert from 'node:assert/strict';
import * as THREE from 'three';
import { assemblyFrame } from '../shared/framing.js';
import { createBattery as createTwoWheeler } from '../dist/model.js';
import { createBattery as createPowerTool } from '../models/power-tool/dist/model.js';
import { createBattery as createStorage } from '../models/home-storage/model.js';

// Exercise the real generated geometry without WebGL. The assertion projects
// every vertex (including every cell instance), independently of the fitting
// algorithm's boxes, so a forgotten movement cannot hide behind its own bounds.
const models = [
  { name: 'two-wheeler', create: createTwoWheeler, iso: [8, 6.6, 14.6], maxDistance: 48 },
  { name: 'power-tool', create: createPowerTool, iso: [7.8, 5.8, 17.5], maxDistance: 48 },
  { name: 'home-storage', create: createStorage, iso: [.70, .40, 1], maxDistance: 80 }
];
const viewports = [
  { name: 'desktop', clientWidth: 1200, clientHeight: 800 },
  { name: 'mobile', clientWidth: 360, clientHeight: 480 }
];
const scenarios = ['assembled', 'exploded', 'p1', 'p2', 'p3', 'p4'];
const report = [];
let verticesChecked = 0;

for (const model of models) {
  const { root, parts } = model.create();
  const localScenarios = model.name === 'home-storage' ? [...scenarios, 'overview'] : scenarios;
  const directions = { iso: model.iso, front: [0, 0, 1], side: [1, .2, 0], below: [.2, -.8, 1] };
  root.updateMatrixWorld(true);
  if (model.name === 'two-wheeler') {
    assert.deepEqual(parts.find(p => p.id === 'lowerHolder').isolationOffset?.toArray(), [0, 0, 2],
      'The lower holder must expose its forward isolation movement to camera framing');
  }

  for (const scenario of localScenarios) {
    const localSelection = /^p[1-4]$/.test(scenario) ? scenario : null;
    const progressFor = part => {
      if (scenario === 'assembled' || part.phase === 'fixed') return 0;
      if (scenario === 'overview') return ['door', 'display'].includes(part.id) ? 1 : 0;
      if (scenario === 'exploded' || part.phase === 'outside') return 1;
      return part.selectionId === localSelection ? 1 : 0;
    };
    const isolationFor = part => part.selectionId === localSelection ? 1 : 0;

    for (const viewport of viewports) for (const [view, direction] of Object.entries(directions)) {
      const camera = new THREE.PerspectiveCamera(36, viewport.clientWidth / viewport.clientHeight, .1, 100);
      const frame = assemblyFrame(root, parts, progressFor, camera, viewport,
        new THREE.Vector3(...direction), isolationFor);
      const delta = frame.position.clone().sub(frame.target);
      delta.setLength(THREE.MathUtils.clamp(delta.length(), 7, model.maxDistance));
      camera.position.copy(frame.target).add(delta);
      camera.lookAt(frame.target);
      camera.updateMatrixWorld(true);

      // Apply the actual final component poses, then inspect their mesh vertices.
      // Follow offsets belong to the movement data, not to geometry fitting.
      for (const part of parts) {
        part.group.position.copy(part.base).addScaledVector(part.offset, progressFor(part));
        part.group.rotation.y = (part.rotationY ?? 0) * progressFor(part);
        if (part.isolationOffset) part.group.position.addScaledVector(part.isolationOffset, isolationFor(part));
        if (part.follow) {
          const parent = parts.find(p => p.id === part.follow);
          part.group.position.add(parent.group.position).sub(parent.base);
        }
      }
      root.updateMatrixWorld(true);
      const clipMatrix = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      const instance = new THREE.Matrix4(), world = new THREE.Matrix4(), projection = new THREE.Matrix4();
      const vertex = new THREE.Vector3();
      const maximum = { x: 0, y: 0, z: 0 };
      const context = `${model.name}/${scenario}/${viewport.name}/${view}`;
      root.traverse(mesh => {
        if (!mesh.isMesh || !mesh.visible) return;
        const positions = mesh.geometry.getAttribute('position');
        const count = mesh.isInstancedMesh ? mesh.count : 1;
        for (let i = 0; i < count; i++) {
          world.copy(mesh.matrixWorld);
          if (mesh.isInstancedMesh) { mesh.getMatrixAt(i, instance); world.multiply(instance); }
          projection.multiplyMatrices(clipMatrix, world);
          for (let j = 0; j < positions.count; j++) {
            vertex.fromBufferAttribute(positions, j).applyMatrix4(projection);
            assert(Number.isFinite(vertex.x) && Number.isFinite(vertex.y) && Number.isFinite(vertex.z),
              `${context}: non-finite projection in ${mesh.name || mesh.userData.partId}`);
            maximum.x = Math.max(maximum.x, Math.abs(vertex.x));
            maximum.y = Math.max(maximum.y, Math.abs(vertex.y));
            maximum.z = Math.max(maximum.z, Math.abs(vertex.z));
            verticesChecked++;
          }
        }
      });
      for (const axis of ['x', 'y', 'z']) assert(maximum[axis] <= 1.00001,
        `${context}: geometry is clipped on ${axis}; maximum NDC=${maximum[axis]}`);
      report.push({ model: model.name, scenario, viewport: viewport.name, view,
        maxX: +maximum.x.toFixed(4), maxY: +maximum.y.toFixed(4) });
    }
  }
}
console.log(JSON.stringify({ result: 'passed', checks: report.length, verticesChecked,
  maxX: Math.max(...report.map(r => r.maxX)), maxY: Math.max(...report.map(r => r.maxY)) }));
