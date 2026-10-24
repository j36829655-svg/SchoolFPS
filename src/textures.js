import * as THREE from 'three';

// assets/tex 의 CC0 실사 텍스처(ambientCG). 시작할 때 한 번 불러 둔다.
const NAMES = ['grass', 'asphalt', 'plaster', 'woodpanel', 'concrete', 'gravel', 'dirt', 'paving', 'metalroof'];
export const IMG = {};

export async function loadTextures() {
  await Promise.all(NAMES.map(n => new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => { IMG[n] = img; ok(); };
    img.onerror = fail;
    img.src = `assets/tex/${n}.jpg`;
  })));
}

/** UV가 m 단위인 면에 meters m 마다 한 번 반복되는 텍스처 */
export function tiled(name, meters) {
  const t = new THREE.Texture(IMG[name]);
  t.needsUpdate = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / meters, 1 / meters);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
