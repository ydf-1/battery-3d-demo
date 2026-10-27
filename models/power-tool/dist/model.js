import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { applySurfaceFinishes } from '../../../shared/materials.js';

// Procedural geometry only: no labels, logos, model files, textures or decals.
export function createBattery() {
  const root = new THREE.Group(), parts = [], cache = new Map();
  root.name = 'powerToolBattery';
  const V = a => new THREE.Vector3(...a);
  const material = (kind, color, metalness, roughness) => {
    const m = new THREE.MeshStandardMaterial({ color, metalness, roughness });
    m.userData.kind = kind; return m;
  };
  const mat = {
    shell: material('plastic', 0x141719, 0, .73),
    rail: material('plastic', 0x141719, 0, .73),
    latch: material('plastic', 0x008be8, 0, .38),
    holder: material('plastic', 0x008be8, 0, .40),
    cover: material('plastic', 0x008be8, 0, .39),
    cell: material('cells', 0xbec4cb, .83, .27),
    nickel: material('metal', 0xc3c8cd, .91, .27),
    steel: material('metal', 0xb6bec6, .93, .24),
    copper: material('metal', 0xc57d43, .85, .25),
    darkMetal: material('metal', 0x454b52, .78, .42),
    pcb: material('pcb', 0x073c27, .08, .53),
    chip: material('pcb', 0x151b1c, .08, .60),
    trace: material('pcb', 0x527956, .32, .49),
    ceramic: material('pcb', 0xb5ad83, .1, .50),
    led: material('led', 0x35da6a, .05, .3)
  };
  mat.led.emissive.set(0x23d75b); mat.led.emissiveIntensity = .65;
  function part(id, selectionId, kind, base, anchor = [0, 0, 0], follow = null) {
    const group = new THREE.Group(); group.name = id; group.position.fromArray(base);
    group.userData.partId = selectionId; root.add(group);
    const record = { id, selectionId, kind, group, base: V(base), offset: V([0, 0, 0]), anchor: V(anchor), follow };
    parts.push(record); return record;
  }
  function identify(mesh, id, kind, name = '') {
    Object.assign(mesh.userData, { partId: id, kind, highlightable: kind === 'plastic' && /^p[1-4]$/.test(id) });
    if (name) mesh.name = name; return mesh;
  }
  function add(parent, geometry, m, position = [0, 0, 0], id = parent.userData.partId, name = '') {
    const mesh = identify(new THREE.Mesh(geometry, m), id, m.userData.kind, name);
    mesh.position.fromArray(position); parent.add(mesh); return mesh;
  }
  function box(p, w, h, d, m, x = 0, y = 0, z = 0, radius = .025, id, name) {
    const key = [w, h, d, radius].join('/');
    if (!cache.has(key)) cache.set(key, radius ? new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3)) : new THREE.BoxGeometry(w, h, d));
    return add(p, cache.get(key), m, [x, y, z], id, name);
  }
  function cylinder(p, r, h, m, x, y, z, id, segments = 24) {
    return add(p, new THREE.CylinderGeometry(r, r, h, segments), m, [x, y, z], id);
  }
  function screw(p, x, y, z) {
    cylinder(p, .075, .035, mat.steel, x, y, z, 'fasteners');
    box(p, .079, .005, .012, mat.darkMetal, x, y + .021, z, .001, 'fasteners');
    box(p, .012, .005, .079, mat.darkMetal, x, y + .021, z, .001, 'fasteners');
  }
  function roundedRect(w, d, r, path = new THREE.Shape(), cx = 0, cz = 0) {
    const x = cx - w / 2, z = cz - d / 2;
    path.moveTo(x + r, z); path.lineTo(x + w - r, z); path.quadraticCurveTo(x + w, z, x + w, z + r);
    path.lineTo(x + w, z + d - r); path.quadraticCurveTo(x + w, z + d, x + w - r, z + d);
    path.lineTo(x + r, z + d); path.quadraticCurveTo(x, z + d, x, z + d - r);
    path.lineTo(x, z + r); path.quadraticCurveTo(x, z, x + r, z); return path;
  }
  function plate(shape, height) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 10 });
    g.rotateX(-Math.PI / 2); g.translate(0, -height / 2, 0); return g;
  }
  function tube(w, d, h, wall, radius = .15) {
    const shape = roundedRect(w, d, radius);
    shape.holes.push(roundedRect(w - wall * 2, d - wall * 2, Math.max(.02, radius - wall), new THREE.Path()));
    return plate(shape, h);
  }
  function instances(parent, geometry, m, positions, id, name, rotation = [0, 0, 0]) {
    const mesh = identify(new THREE.InstancedMesh(geometry, m, positions.length), id ?? parent.userData.partId, m.userData.kind, name);
    const dummy = new THREE.Object3D(); dummy.rotation.fromArray(rotation);
    positions.forEach((p, i) => { dummy.position.fromArray(p); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); });
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingBox(); mesh.computeBoundingSphere(); parent.add(mesh); return mesh;
  }

  const width = 5.72, depth = 4.22;
  const bottom = part('bottomShell', 'p1', 'plastic', [0, 0, 0], [2.70, -.72, 1.87]);
  const b = bottom.group;
  // A real open cup: the cells fit between these walls, above its floor.
  box(b, width, .21, depth, mat.shell, 0, -1.30, 0, .19, 'p1', 'lowerFloor');
  add(b, tube(width, depth, 1.45, .17, .25), mat.shell, [0, -.47, 0], 'p1', 'lowerCupWalls');
  add(b, tube(width - .08, depth - .08, .065, .065, .21), mat.shell, [0, .275, 0], 'p1', 'lowerMatingLip');
  for (const x of [-2.38, 2.38]) {
    box(b, .48, .13, 3.5, mat.shell, x, -1.46, 0, .055);
    for (let i = 0; i < 6; i++) box(b, .025, .035, .54, mat.shell, x, -1.54, -1.36 + i * .55, .004);
  }
  for (const x of [-2.59, 2.59]) for (const z of [-1.81, 1.81]) {
    cylinder(b, .14, 1.34, mat.shell, x, -.49, z, 'p1');
    cylinder(b, .073, .055, mat.copper, x, .2, z, 'fasteners');
    cylinder(b, .04, .06, mat.darkMetal, x, .205, z, 'fasteners');
  }
  for (const x of [-1.5, -.5, .5, 1.5]) box(b, .055, .10, 3.6, mat.shell, x, -1.145, 0, .01);
  for (const sign of [-1, 1]) for (let i = 0; i < 6; i++) box(b, .025, .70, .09, mat.shell, sign * 2.865, -.53, -.95 + i * .38, .01);

  const top = part('topShell', 'p1', 'plastic', [0, 0, 0], [2.65, 1.16, 1.67]);
  const t = top.group;
  // The opening for the front latch is left empty; the button is independent.
  for (const x of [-2.745, 2.745]) box(t, .23, 1.12, 3.92, mat.shell, x, .84, 0, .10, 'p1', 'upperSideWall');
  box(t, 5.35, 1.12, .22, mat.shell, 0, .84, -1.995, .08);
  for (const x of [-1.91, 1.91]) box(t, 1.72, 1.12, .23, mat.shell, x, .84, 1.995, .09);
  box(t, 1.2, .17, .24, mat.shell, 0, .365, 2.0, .03);
  const deck = roundedRect(width, depth, .26);
  // Local 2D z is inverted by plate(); center +.48 becomes world z -.48.
  deck.holes.push(roundedRect(2.42, 1.23, .07, new THREE.Path(), 0, .48));
  add(t, plate(deck, .18), mat.shell, [0, 1.49, 0], 'p1', 'upperDeckWithTerminalOpening');
  for (const x of [-2.6, 2.6]) for (const z of [-1.81, 1.81]) screw(t, x, 1.59, z);
  for (const x of [-2.59, 2.59]) box(t, .22, .15, 3.10, mat.shell, x, 1.61, 0, .045);
  // Rails are true children of the upper shell, never independently translated.
  for (const [i, x] of [-1.75, 1.75].entries()) {
    const pieces = [
      box(t, .49, .18, 3.48, mat.rail, x, 1.66, -.04, .035, 'p3', `rail-${i}-foot`),
      box(t, .25, .42, 3.28, mat.rail, x, 1.92, -.09, .035, 'p3', `rail-${i}-web`),
      box(t, .48, .12, 3.32, mat.rail, x, 2.115, -.09, .027, 'p3', `rail-${i}-flange`)
    ];
    for (const piece of pieces) piece.userData.highlightIds = ['p1', 'p3'];
    for (let j = 0; j < 3; j++) {
      const stop = box(t, .48, .13, .15, mat.rail, x, 2.17, -1.4 + j * 1.35, .016, 'p3', `rail-${i}-stop-${j}`);
      stop.userData.highlightIds = ['p1', 'p3'];
    }
  }
  // Four LEDs and their recessed side bezel. No printed scale or text.
  box(t, .045, .35, 1.48, mat.shell, 2.88, .94, -.35, .035, 'p1', 'indicatorBezel');
  for (let i = 0; i < 4; i++) box(t, .053, .18, .18, mat.led, 2.912, .94, -.85 + i * .33, .017, 'leds', `indicator-${i}`);
  box(t, .065, .34, .37, mat.shell, 2.90, .94, .90, .045, 'p1', 'indicatorButton');

  const latch = part('latch', 'p3', 'plastic', [0, .98, 2.10], [0, .1, .18], 'topShell');
  // Global separation retains the button on its shell. Selecting ③ is the
  // distinct action that pulls the button forward, including in the full view.
  latch.isolationOffset = V([0, .04, 1.05]);
  box(latch.group, 1.65, .67, .28, mat.latch, 0, 0, 0, .085, 'p3', 'pressLatchButton');
  for (const y of [-.17, -.015, .14]) box(latch.group, 1.1, .045, .045, mat.latch, 0, y, .154, .015, 'p3', 'latchGripRib');
  box(latch.group, .85, .12, .56, mat.latch, 0, .26, -.30, .025, 'p3', 'latchHook');
  const spring = part('spring', 'spring', 'metal', [.97, 1.01, 1.97], [0, 0, .15], 'topShell');
  class Coil extends THREE.Curve {
    getPoint(t, target = new THREE.Vector3()) { return target.set(Math.cos(t * Math.PI * 12) * .09, Math.sin(t * Math.PI * 12) * .09, (t - .5) * .42); }
  }
  add(spring.group, new THREE.TubeGeometry(new Coil(), 120, .018, 8, false), mat.steel, [0, 0, 0], 'spring', 'latchCompressionSpring');

  const terminal = part('terminalCover', 'p4', 'plastic', [0, 1.63, -.48], [1.05, .10, .49]);
  terminal.isolationOffset = V([0, 0, .75]);
  const tc = terminal.group;
  box(tc, 2.25, .11, 1.05, mat.cover, 0, -.29, 0, .035, 'p4', 'terminalCoverFloor');
  box(tc, 2.25, .57, .12, mat.cover, 0, .0, -.48, .025, 'p4', 'terminalCoverBack');
  for (const x of [-1.07, 1.07]) box(tc, .11, .64, 1.05, mat.cover, x, -.02, 0, .025);
  for (const x of [-.72, -.24, .24, .72]) {
    box(tc, .065, .53, .85, mat.cover, x, -.03, -.04, .012);
    box(tc, .075, .08, 1.10, mat.cover, x, .26, 0, .014);
  }
  for (const x of [-1.13, 1.13]) box(tc, .11, .37, .38, mat.cover, x, -.06, .04, .018);
  for (const x of [-.96, -.48, 0, .48, .96]) {
    const wide = Math.abs(x) > .7 ? .27 : .19;
    box(tc, wide, .055, .66, mat.copper, x, -.17, .03, .017, 'contacts', 'terminalCopperFoot');
    for (const sign of [-1, 1]) {
      box(tc, .036, .34, .46, mat.copper, x + sign * wide * .38, .015, -.005, .012, 'contacts', 'terminalCopperSpringContact');
      box(tc, .055, .07, .12, mat.copper, x + sign * wide * .32, .13, .19, .015, 'contacts', 'terminalCopperLip');
    }
  }

  const pcb = part('pcb', 'pcb', 'pcb', [0, 1.10, 0], [-1.9, .08, 1.3]);
  const p = pcb.group;
  box(p, 4.86, .07, 3.08, mat.pcb, 0, 0, 0, .075, 'pcb', 'protectionCircuitBoard');
  for (const x of [-2.22, 2.22]) for (const z of [-1.32, 1.32]) {
    cylinder(p, .092, .008, mat.copper, x, .04, z, 'pcb');
    cylinder(p, .045, .010, mat.chip, x, .042, z, 'pcb');
  }
  for (let i = 0; i < 6; i++) {
    const x = -1.95 + i * .78;
    box(p, .52, .14, .45, mat.chip, x, .115, -1.0, .022, 'pcb');
    for (const sign of [-1, 1]) for (let pin = 0; pin < 3; pin++) box(p, .033, .025, .11, mat.nickel, x - .14 + pin * .14, .053, -1.0 + sign * .27, .002, 'pcb');
  }
  box(p, .73, .085, .73, mat.chip, -.62, .09, .24, .019, 'pcb');
  for (let pin = 0; pin < 9; pin++) for (const sign of [-1, 1]) {
    box(p, .03, .022, .11, mat.nickel, -.90 + pin * .07, .055, .24 + sign * .42, .002, 'pcb');
    box(p, .11, .022, .03, mat.nickel, -.62 + sign * .42, .055, -.04 + pin * .07, .002, 'pcb');
  }
  for (let i = 0; i < 30; i++) {
    const x = -2.03 + (i % 10) * .45, z = -.40 + Math.floor(i / 10) * .60;
    if (Math.abs(x + .62) < .55 && Math.abs(z - .24) < .6) continue;
    box(p, .16, .055, .09, i % 3 ? mat.chip : mat.ceramic, x, .066, z, .008, 'pcb');
    for (const sign of [-1, 1]) box(p, .04, .05, .1, mat.nickel, x + sign * .09, .065, z, .003, 'pcb');
    box(p, .018, .003, .27, mat.trace, x, .037, z + .17, 0, 'pcb');
    box(p, .23, .003, .018, mat.trace, x + .11, .037, z + .29, 0, 'pcb');
  }
  for (const x of [1.25, 1.76]) {
    cylinder(p, .125, .23, mat.steel, x, .16, .47, 'pcb');
    cylinder(p, .102, .008, mat.chip, x, .279, .47, 'pcb');
  }
  box(p, .66, .17, .29, mat.ceramic, 1.75, .125, 1.10, .025, 'pcb');
  for (let i = 0; i < 6; i++) box(p, .027, .03, .16, mat.nickel, 1.51 + i * .095, .054, 1.31, .003, 'pcb');

  // 18650: all ten cylinders share the same 18 mm x 65 mm geometry.
  const mmPerSceneUnit = 20, radius = 18 / mmPerSceneUnit / 2, length = 65 / mmPerSceneUnit;
  const centers = []; for (const y of [-.49, .49]) for (let col = 0; col < 5; col++) centers.push([(col - 2) * .98, y, 0]);
  const cells = part('cells', 'cells', 'cells', [0, 0, 0], [-1.96, .49, 1.66]);
  const bodies = instances(cells.group, new THREE.CylinderGeometry(radius, radius, length, 48), mat.cell, centers, 'cells', 'cellBodies', [Math.PI / 2, 0, 0]);
  Object.assign(bodies.userData, { cellCount: 10, diameterMm: 18, lengthMm: 65, mmPerSceneUnit });
  for (const sign of [-1, 1]) {
    const endPositions = centers.map(([x, y]) => [x, y, sign * (length / 2 + .013)]);
    instances(cells.group, new THREE.CylinderGeometry(.408, .408, .026, 40), mat.nickel, endPositions, 'cells', `cellEndCaps-${sign}`, [Math.PI / 2, 0, 0]);
    instances(cells.group, new THREE.RingGeometry(.405, .443, 40), mat.darkMetal, centers.map(([x, y]) => [x, y, sign * (length / 2 + .028)]), 'cells', `cellInsulatingRims-${sign}`, sign > 0 ? [0, 0, 0] : [0, Math.PI, 0]);
    instances(cells.group, new THREE.CylinderGeometry(.13, .13, .018, 28), mat.steel, centers.map(([x, y]) => [x, y, sign * (length / 2 + .034)]), 'cells', `cellTerminalButtons-${sign}`, [Math.PI / 2, 0, 0]);
  }
  function holder(id, y) {
    const record = part(id, 'p2', 'plastic', [0, 0, 0], [2.38, y, 1.55]);
    const group = record.group;
    const ring = roundedRect(.985, .985, .09), hole = new THREE.Path();
    hole.absarc(0, 0, .454, 0, Math.PI * 2, true); ring.holes.push(hole);
    const ringGeometry = new THREE.ExtrudeGeometry(ring, { depth: .13, bevelEnabled: false, curveSegments: 20 });
    ringGeometry.translate(0, 0, -.065);
    for (const z of [-1.44, 1.44]) for (let col = 0; col < 5; col++) add(group, ringGeometry, mat.holder, [(col - 2) * .98, y, z], 'p2', `${id}-cellCollar`);
    for (const x of [-2.48, 2.48]) {
      box(group, .14, .98, 3.11, mat.holder, x, y, 0, .035);
      for (const z of [-1.52, 1.52]) box(group, .20, .98, .22, mat.holder, x, y, z, .03);
    }
    const edgeY = y > 0 ? .99 : -.99;
    for (const z of [-1.45, 1.45]) box(group, 5.10, .085, .18, mat.holder, 0, edgeY, z, .018);
    for (const x of [-1.47, -.49, .49, 1.47]) box(group, .095, .075, 2.70, mat.holder, x, edgeY, 0, .016);
    record.isolationOffset = V([0, y > 0 ? .67 : -.67, y > 0 ? -.20 : .20]); return record;
  }
  const upper = holder('upperHolder', .49), lower = holder('lowerHolder', -.49);
  const busbar = part('busbar', 'busbar', 'metal', [0, 0, 0], [1.96, -.49, 1.69]);
  const strips = busbar.group;
  for (const sign of [-1, 1]) {
    const z = sign * (length / 2 + .064);
    for (const y of [-.49, .49]) {
      const starts = (sign > 0) === (y > 0) ? [0, 2] : [1, 3];
      for (const col of starts) box(strips, 1.25, .13, .025, mat.nickel, (col - 1.5) * .98, y, z, .035, 'busbar', 'nickelCellBridge');
    }
    const bridgeX = sign > 0 ? 1.96 : -1.96;
    box(strips, .13, 1.22, .025, mat.nickel, bridgeX, 0, z, .032, 'busbar', 'nickelRowBridge');
    for (const [x, y] of centers) for (const dx of [-.07, .07]) {
      const weld = cylinder(strips, .023, .007, mat.steel, x + dx, y, z + sign * .017, 'busbar', 12); weld.rotation.x = Math.PI / 2;
    }
  }

  // Calculate exploded offsets from actual geometry, not guessed origins.
  // The four visible vertical clearances between major layers are all identical.
  root.updateMatrixWorld(true);
  const layers = [[bottom], [cells, upper, lower, busbar], [pcb], [terminal], [top]];
  const bounds = layer => {
    const box = new THREE.Box3(); layer.forEach(p => box.union(new THREE.Box3().setFromObject(p.group))); return box;
  };
  const gap = 1.0, layerBoxes = layers.map(bounds);
  const totalHeight = layerBoxes.reduce((sum, b) => sum + b.max.y - b.min.y, 0) + gap * (layers.length - 1);
  let cursor = -totalHeight / 2;
  layers.forEach((layer, i) => {
    const box = layerBoxes[i], dy = cursor - box.min.y;
    layer.forEach(p => p.offset.y = dy);
    cursor += box.max.y - box.min.y + gap;
  });
  // All materials are scoped to their semantic part identity. Metal never takes
  // the emissive selection color of the plastic piece surrounding it.
  const clones = new Map();
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    const key = mesh.userData.partId + ':' + mesh.material.uuid;
    if (!clones.has(key)) clones.set(key, mesh.material.clone());
    mesh.material = clones.get(key);
  });
  applySurfaceFinishes(root);
  return { root, parts, assembly: { cellCount: 10, cellRows: 2, cellsPerRow: 5, cellDiameterMm: 18, cellLengthMm: 65, explodedLayerGap: gap } };
}
