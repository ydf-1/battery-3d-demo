import * as THREE from 'three';

// Tiny deterministic surface-height maps. They contain no color, lettering or
// image assets; the approved material colors remain on the materials themselves.
// Geometry inspection also runs in Node, where a DOM is intentionally absent.
let surfaceMaps;
function getSurfaceMaps() {
  if (typeof document === 'undefined') return null;
  if (surfaceMaps) return surfaceMaps;
  function makeMap(mode, seed, repeat) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const pixels = ctx.createImageData(128, 128);
    let state = seed >>> 0;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    const grain = Array.from({ length: 128 }, () => (random() - .5) * 18);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
      const value = mode === 'brush'
        ? 128 + grain[x] + (random() - .5) * 2
        : 128 + (random() - .5) * 16;
      const index = (y * 128 + x) * 4;
      pixels.data[index] = pixels.data[index + 1] = pixels.data[index + 2] = value;
      pixels.data[index + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.name = `procedural-${mode}-surface`;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(...repeat);
    texture.colorSpace = THREE.NoColorSpace;
    texture.anisotropy = 4;
    return texture;
  }
  surfaceMaps = {
    molded: makeMap('grain', 71491, [4, 4]),
    brushed: makeMap('brush', 28093, [3, 2]),
    coated: makeMap('grain', 39337, [3, 3])
  };
  return surfaceMaps;
}

export function applySurfaceFinishes(root) {
  const maps = getSurfaceMaps(), finished = new Set();
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!material?.isMeshStandardMaterial || finished.has(material)) continue;
      finished.add(material);
      const kind = material.userData.kind;
      const { r, g, b } = material.color;
      const brightness = Math.max(r, g, b), spread = brightness - Math.min(r, g, b);
      let texture = null, bumpScale = 0;
      if (kind === 'plastic') {
        const dark = brightness < .035;
        material.metalness = 0;
        material.roughness = dark ? .67 : .37;
        material.envMapIntensity = dark ? .6 : .45;
        material.userData.surfaceFinish = dark ? 'matte-molded' : 'satin-molded';
        texture = maps?.molded; bumpScale = dark ? .0013 : .0007;
      } else if (kind === 'cells') {
        material.metalness = .88;
        material.roughness = .25;
        material.envMapIntensity = 1.05;
        material.userData.surfaceFinish = 'brushed-cell-can';
        texture = maps?.brushed; bumpScale = .0008;
      } else if (kind === 'metal') {
        if (brightness > .65 && spread < .10 && material.metalness < .5) {
          // White cabinet panels are coated sheet metal, not bare aluminum.
          material.metalness = .12;
          material.roughness = .39;
          material.envMapIntensity = .85;
          material.userData.surfaceFinish = 'powder-coated';
          texture = maps?.coated; bumpScale = .0009;
        } else if (material.metalness > .6 && brightness > .10) {
          material.metalness = Math.max(material.metalness, .88);
          material.roughness = spread > .20 ? .26 : .28;
          material.envMapIntensity = 1.02;
          material.userData.surfaceFinish = spread > .20 ? 'satin-copper' : 'brushed-metal';
          texture = maps?.brushed; bumpScale = .00065;
        }
      } else if (kind === 'pcb') {
        material.metalness = Math.min(material.metalness, .06);
        const greenMask = g > r * 1.35 && g > b * 1.15;
        material.roughness = greenMask ? .72 : .62;
        material.envMapIntensity = greenMask ? .12 : .25;
        material.userData.surfaceFinish = greenMask ? 'solder-mask' : 'electronic-component';
      }
      if (texture) { material.bumpMap = texture; material.bumpScale = bumpScale; }
      material.needsUpdate = true;
    }
  });
}
