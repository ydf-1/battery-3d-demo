import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { applySurfaceFinishes } from '../../shared/materials.js';

// P3-inspired structural illustration; scene units are not engineering dimensions.
// All surfaces, holes, wires and fasteners are generated geometry, without decals.
export function createBattery() {
  const root = new THREE.Group(), parts = [], geometries = new Map();
  const material = (kind, color, metalness, roughness) => {
    const m = new THREE.MeshStandardMaterial({ color, metalness, roughness });
    m.userData.kind = kind;
    return m;
  };
  const mat = {
    white: material('metal', 0xe7ebef, .28, .42), edge: material('metal', 0xc1cbd3, .82, .32),
    silver: material('cells', 0xc5cdd4, .76, .32), dark: material('metal', 0x343e47, .65, .4),
    blue: material('plastic', 0x008aee, .03, .36), blueDark: material('plastic', 0x0067b6, .02, .44),
    orange: material('plastic', 0xff690c, .02, .38), copper: material('metal', 0xcf8a45, .8, .3),
    pcb: material('pcb', 0x075537, .12, .52), chip: material('pcb', 0x172026, .1, .5),
    trace: material('pcb', 0x9eaa70, .5, .5), glass: material('glass', 0x070e17, .4, .09),
    rubber: material('metal', 0x202831, .02, .85), wire: material('wiring', 0x192028, .05, .6),
    red: material('wiring', 0xa92e22, .05, .58), amber: material('wiring', 0xcb8c22, .1, .5),
  };
  const v = a => new THREE.Vector3(...a);
  function part(id, selectionId, kind, base, offset, anchor = [0, 0, 0], options = {}) {
    const group = new THREE.Group(); group.name = id; group.position.fromArray(base);
    group.userData.partId = selectionId; root.add(group);
    parts.push({ id, selectionId, kind, group, base: v(base), offset: v(offset), anchor: v(anchor), phase: 'inside', ...options });
    return group;
  }
  function mesh(p, geometry, material, pos = [0, 0, 0], id = p.userData.partId) {
    const o = new THREE.Mesh(geometry, material); o.position.fromArray(pos);
    o.userData.partId = id; o.userData.kind = material.userData.kind; p.add(o); return o;
  }
  function box(p, w, h, d, m, x = 0, y = 0, z = 0, r = .025, id) {
    const key = [w, h, d, r].join('/');
    if (!geometries.has(key)) geometries.set(key, r ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 3, h / 3, d / 3)) : new THREE.BoxGeometry(w, h, d));
    return mesh(p, geometries.get(key), m, [x, y, z], id);
  }
  function cyl(p, r, h, m, x, y, z, axis = 'y', id, r2 = r) {
    const key = `c/${r}/${r2}/${h}`;
    if (!geometries.has(key)) geometries.set(key, new THREE.CylinderGeometry(r, r2, h, 24));
    const o = mesh(p, geometries.get(key), m, [x, y, z], id);
    if (axis === 'x') o.rotation.z = -Math.PI / 2;
    if (axis === 'z') o.rotation.x = Math.PI / 2;
    return o;
  }
  function screw(p, x, y, z, axis = 'z', id = 'cabinet') {
    cyl(p, .045, .028, mat.edge, x, y, z, axis, id);
    const slot = box(p, .05, .009, .007, mat.dark, x, y, z + (axis === 'z' ? .018 : 0), .001, id);
    if (axis === 'y') { slot.position.y += .018; slot.rotation.x = Math.PI / 2; }
  }
  function tube(p, outer, inner, length, m, pos, axis = 'x', id) {
    const s = new THREE.Shape(); s.absarc(0, 0, outer, 0, Math.PI * 2, false);
    const hole = new THREE.Path(); hole.absarc(0, 0, inner, 0, Math.PI * 2, true); s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, { depth: length, bevelEnabled: false, curveSegments: 24 }); g.translate(0, 0, -length / 2);
    const o = mesh(p, g, m, pos, id); if (axis === 'x') o.rotation.y = Math.PI / 2; return o;
  }
  function wire(p, points, m, radius = .035, id = 'wiring') {
    const curve = new THREE.CatmullRomCurve3(points.map(v));
    return mesh(p, new THREE.TubeGeometry(curve, 30, radius, 8, false), m, [0, 0, 0], id);
  }
  function frame(p, w, h, d, m, z = 0, id) {
    for (const x of [-w / 2, w / 2]) box(p, .13, h, d, m, x, 0, z, .025, id);
    for (const y of [-h / 2, h / 2]) box(p, w, .13, d, m, 0, y, z, .025, id);
  }

  // The exterior moves first. The internal rack stays on its floor-standing base.
  const shell = part('enclosure', 'cabinet', 'metal', [0, 0, 0], [4.25, 0, -1.6], [2.16, .3, .7], { phase: 'outside' });
  box(shell, 4.45, .12, 2.9, mat.white, 0, 4.15, 0, .055);
  box(shell, 4.42, 8.18, .1, mat.white, 0, .02, -1.4, .035);
  box(shell, .1, 8.18, 2.8, mat.white, -2.19, .02, 0, .035);
  // Actual apertures in the right sheet-metal panel, aligned with the connectors.
  const side = new THREE.Shape();
  side.moveTo(-1.4, -4.07); side.lineTo(1.4, -4.07); side.lineTo(1.4, 4.11); side.lineTo(-1.4, 4.11); side.closePath();
  for (const y of [3.05, 2.16]) { const h = new THREE.Path(); h.absarc(-.22, y, .245, 0, Math.PI * 2, true); side.holes.push(h); }
  // Vent slots are open holes, not markings or textures.
  for (let i = 0; i < 7; i++) {
    const y = .65 + i * .13, h = new THREE.Path();
    h.moveTo(-.84, y); h.lineTo(.64, y); h.lineTo(.64, y + .048); h.lineTo(-.84, y + .048); h.closePath(); side.holes.push(h);
  }
  const sheet = mesh(shell, new THREE.ExtrudeGeometry(side, { depth: .10, bevelEnabled: false, curveSegments: 24 }), mat.white, [2.14, 0, 0]); sheet.rotation.y = Math.PI / 2;
  for (const x of [-2.1, 2.1]) for (const z of [-1.2, 1.2]) screw(shell, x, 4.22, z, 'y');
  for (const x of [-2.1, 2.1]) box(shell, .06, 8.04, .11, mat.edge, x, 0, 1.36, .01);
  const rack = part('rack', 'cabinet', 'metal', [0, 0, 0], [0, 0, 0], [-1.98, -3.95, 1.25], { phase: 'fixed' });
  for (const x of [-1.98, 1.98]) for (const z of [-1.18, 1.18]) {
    box(rack, .14, 8.02, .14, mat.edge, x, -.04, z, .018);
    for (let i = 0; i < 23; i++) cyl(rack, .027, .008, mat.dark, x, -3.8 + i * .34, z + .074, 'z');
  }
  for (const y of [-4.06, -1.4, 1.32, 4.03]) {
    box(rack, 4.08, .10, 2.54, mat.edge, 0, y, 0, .018);
    for (const z of [-1.22, 1.22]) box(rack, 4.08, .16, .07, mat.edge, 0, y + .035, z, .01);
    for (const x of [-1.92, 1.92]) screw(rack, x, y + .03, 1.27);
  }
  box(rack, 4.4, .21, 2.84, mat.white, 0, -4.19, 0, .045);
  for (const x of [-1.73, 1.73]) for (const z of [-.98, .98]) {
    box(rack, .43, .09, .47, mat.edge, x, -4.35, z, .02);
    for (const dx of [-.16, .16]) box(rack, .065, .28, .38, mat.edge, x + dx, -4.48, z, .02);
    cyl(rack, .235, .25, mat.rubber, x, -4.63, z, 'x');
    cyl(rack, .105, .28, mat.edge, x, -4.63, z, 'x');
    cyl(rack, .042, .31, mat.dark, x, -4.63, z, 'x');
  }
  const door = part('door', 'door', 'metal', [0, -1.32, 1.46], [-4.05, 0, 1.55], [0, .5, .12], { phase: 'outside', rotationY: -.28 });
  box(door, 4.27, 5.52, .15, mat.white, 0, 0, 0, .055);
  for (const x of [-2.05, 2.05]) box(door, .12, 5.34, .18, mat.white, x, 0, -.14, .025);
  for (const y of [-2.65, 2.65]) box(door, 4.10, .12, .18, mat.white, 0, y, -.14, .025);
  box(door, .12, .52, .065, mat.dark, 1.79, .2, .10, .025, 'door');
  cyl(door, .07, .028, mat.edge, 1.79, -.16, .10, 'z', 'door');
  for (const y of [-1.9, 1.9]) { box(door, .14, .34, .13, mat.edge, -2.12, y, -.03, .025, 'door'); }

  const display = part('display', 'display', 'glass', [0, 2.79, 1.48], [-3.95, .68, 1.9], [0, 0, .12], { phase: 'outside' });
  box(display, 4.28, 2.02, .16, mat.white, 0, 0, 0, .065, 'display');
  for (const y of [-1.14, 1.14]) box(display, 4.28, .28, .16, mat.white, 0, y, 0, .035, 'display');
  box(display, 4.02, 1.77, .035, mat.glass, 0, 0, .10, .04);
  box(display, 3.9, .013, .006, mat.edge, 0, -.92, .092, .003, 'display');
  const bracket = part('displayBracket', 'p1', 'plastic', [0, 2.79, 1.22], [-1.65, .8, 1.48], [-1.3, .85, 0]);
  frame(bracket, 3.97, 1.76, .19, mat.blue);
  for (const x of [-1.87, 1.87]) for (const y of [-.75, .75]) {
    box(bracket, .26, .32, .3, mat.blue, x, y, -.10, .03);
    cyl(bracket, .05, .03, mat.copper, x, y, .112, 'z', 'cabinet');
  }
  for (let i = 0; i < 6; i++) box(bracket, .08, .17, .17, mat.blueDark, -1.5 + i * .6, -.82, -.15, .015);

  const bms = part('bmsSupport', 'p3', 'plastic', [0, 1.6, .25], [0, .18, 2.38], [1.55, .07, .72]);
  box(bms, 3.65, .16, 1.65, mat.blue, 0, 0, 0, .05);
  for (const x of [-1.7, 1.7]) box(bms, .16, .47, 1.65, mat.blue, x, .19, 0, .03);
  for (const x of [-1.25, -.42, .42, 1.25]) box(bms, .08, .22, 1.47, mat.blueDark, x, -.13, 0, .015);
  for (const x of [-1.45, 1.45]) box(bms, .14, .47, .16, mat.blue, x, .25, .23, .025);
  const pcb = part('bmsBoard', 'pcb', 'pcb', [0, 2.62, .42], [.1, .58, .62], [.4, .3, .15]);
  box(pcb, 3.45, 1.64, .065, mat.pcb, 0, 0, 0, .03);
  for (let i = 0; i < 5; i++) {
    box(pcb, .34, .28, .13, mat.chip, -1.35 + i * .57, .45, .1, .015);
    for (let j = 0; j < 4; j++) box(pcb, .025, .13, .02, mat.edge, -1.45 + i * .57 + j * .065, .24, .08, .003, 'pcb');
  }
  for (const x of [-1.15, -.66]) {
    cyl(pcb, .13, .2, mat.edge, x, -.44, .15, 'z', 'pcb');
    cyl(pcb, .105, .012, mat.chip, x, -.44, .26, 'z', 'pcb');
  }
  box(pcb, .52, .43, .08, mat.chip, -.35, .0, .08, .012);
  box(pcb, .85, 1.13, .16, mat.edge, 1.02, -.08, .12, .02, 'pcb');
  for (let i = 0; i < 9; i++) box(pcb, .034, 1.07, .16, mat.edge, .65 + i * .09, -.08, .25, .005, 'pcb');
  for (let i = 0; i < 24; i++) {
    const x = -1.45 + (i % 8) * .27, y = -.66 + Math.floor(i / 8) * .30;
    box(pcb, .09, .055, .035, i % 3 ? mat.chip : mat.trace, x, y, .065, .004, 'pcb');
    box(pcb, .009, .12, .004, mat.trace, x + .07, y, .036, 0, 'pcb');
  }
  for (const x of [-1.58, 1.58]) for (const y of [-.69, .69]) screw(pcb, x, y, .06, 'z', 'pcb');
  box(pcb, .58, .23, .19, mat.white, -.80, .69, .12, .02, 'pcb');

  // Two module levels. The count is only illustrative and is not an electrical spec.
  for (const [level, y] of [['upper', -.19], ['lower', -2.88]]) {
    const motion = level === 'upper' ? [.4, .08, .68] : [.4, -.03, .42];
    const cellGroup = part(`${level}Cells`, 'cells', 'cells', [0, y, -.05], motion, [-.5, 0, .91]);
    const feet = part(`${level}Locator`, 'p2', 'plastic', [0, y - .93, -.05], [0, -.18, 1.85], [-1.6, 0, .9], { follow: `${level}Cells` });
    box(feet, 3.78, .13, 1.98, mat.blue, 0, 0, 0, .035);
    for (const z of [-.96, .96]) box(feet, 3.78, .22, .09, mat.blue, 0, .12, z, .02);
    const separators = part(`${level}Separators`, 'p2', 'plastic', [0, y, -.05], [-2.25, .05, 1.15], [1.7, .2, .86], { follow: `${level}Cells` });
    const covers = part(`${level}Covers`, 'p2', 'plastic', [0, y + 1.02, -.05], [0, .49, 1.85], [1.45, 0, .72], { follow: `${level}Cells` });
    const bars = part(`${level}Busbars`, 'busbar', 'metal', [0, y + .92, -.05], [0, .24, .30], [-1.0, 0, .65], { follow: `${level}Cells` });
    for (let i = 0; i < 8; i++) {
      const x = (i - 3.5) * .46;
      const body = box(cellGroup, .415, 1.72, 1.72, mat.silver, x, 0, 0, .045); body.name = `${level}Cell${i}`;
      box(cellGroup, .37, .028, 1.66, mat.edge, x, .87, 0, .01, 'cells');
      for (const z of [-.53, .53]) {
        cyl(cellGroup, .083, .075, mat.copper, x, .925, z, 'y', 'cells');
        cyl(bars, .065, .04, mat.edge, x, .044, z, 'y', 'busbar');
      }
      for (const z of [-.84, .84]) box(cellGroup, .018, 1.61, .018, mat.edge, x - .166, 0, z, .004, 'cells');
      if (i < 7) box(separators, .033, 1.77, 1.77, mat.blue, x + .23, 0, 0, .008);
      // Each hood is an open-bottom channel over the copper bridges.
      for (const z of [-.54, .54]) {
        box(covers, .43, .085, .39, mat.blue, x, .12, z, .025);
        for (const edge of [-.18, .18]) box(covers, .43, .17, .045, mat.blue, x, .01, z + edge, .012);
      }
      box(feet, .036, .23, 1.78, mat.blueDark, x + .23, .10, 0, .01);
      if (i < 7) box(bars, .47, .035, .17, mat.copper, x + .23, .015, i % 2 ? -.53 : .53, .012);
    }
    // Unnumbered retaining straps and module end plates.
    for (const x of [-1.89, 1.89]) {
      box(cellGroup, .10, 1.83, 1.9, mat.edge, x, -.02, 0, .025, 'cells');
      for (const z of [-.85, .85]) screw(cellGroup, x, .68, z + .09, 'z', 'cells');
    }
    for (const z of [-.96, .96]) box(cellGroup, 3.85, .10, .055, mat.edge, 0, -.62, z, .012, 'cells');
  }

  // Shells and conductive terminals have separate picking and motion identities.
  for (const [i, y] of [3.05, 2.16].entries()) {
    const shellId = `connector${i}`;
    const plug = part(shellId, 'p4', 'plastic', [2.26, y, .22], [.78, 0, .2], [.56, 0, .10], { follow: 'enclosure' });
    // Square orange flange with a real hollow barrel.
    const flange = new THREE.Shape(); flange.moveTo(-.41, -.41); flange.lineTo(.41, -.41); flange.lineTo(.41, .41); flange.lineTo(-.41, .41); flange.closePath();
    const aperture = new THREE.Path(); aperture.absarc(0, 0, .23, 0, Math.PI * 2, true); flange.holes.push(aperture);
    const g = new THREE.ExtrudeGeometry(flange, { depth: .13, bevelEnabled: true, bevelSize: .035, bevelThickness: .025, bevelSegments: 2 });
    const f = mesh(plug, g, mat.orange); f.rotation.y = Math.PI / 2;
    tube(plug, .34, .23, .5, mat.orange, [.34, 0, 0]);
    tube(plug, .37, .23, .07, mat.orange, [.59, 0, 0]);
    for (const a of [-1, 1]) for (const b of [-1, 1]) cyl(plug, .044, .04, mat.edge, .18, a * .31, b * .31, 'x', 'cabinet');
    const contacts = part(`contact${i}`, 'contacts', 'metal', [2.28, y, .22], [0, 0, 0], [.54, 0, 0], { follow: 'enclosure', phase: 'fixed' });
    tube(contacts, .22, .17, .11, mat.dark, [.10, 0, 0], 'x', 'contacts');
    cyl(contacts, .105, .48, mat.copper, .34, 0, 0, 'x', 'contacts');
    cyl(contacts, .085, .018, mat.edge, .589, 0, 0, 'x', 'contacts');
  }
  const harness = part('harness', 'wiring', 'wiring', [0, 0, 0], [0, 0, 0], [1.75, .4, -.4], { phase: 'fixed' });
  for (let i = 0; i < 3; i++) {
    wire(harness, [[1.63 + i * .10, -3.7, -.94], [1.75 + i * .1, -1.7, -.95], [1.75 + i * .1, .7, -.95], [1.48 + i * .1, 3.5, -.9], [.9 + i * .15, 3.55, -.6]], i % 2 ? mat.red : mat.wire, .045);
  }
  for (const y of [-2.0, .6, 2.9]) box(harness, .39, .10, .13, mat.edge, 1.81, y, -.94, .02, 'wiring');
  for (let i = 0; i < 8; i++) wire(harness, [[-1.6 + i * .46, .83, -.85], [-1.6 + i * .46, 1.06 + i * .015, -.95], [1.65, 1.14 + i * .02, -.97]], i % 2 ? mat.amber : mat.wire, .012);

  const clones = new Map();
  root.traverse(o => {
    if (!o.isMesh) return;
    const key = `${o.userData.partId}:${o.material.uuid}`;
    if (!clones.has(key)) clones.set(key, o.material.clone());
    o.material = clones.get(key);
    o.userData.highlightable = o.userData.kind === 'plastic' && /^p[1-4]$/.test(o.userData.partId);
  });
  applySurfaceFinishes(root);
  return { root, parts };
}
