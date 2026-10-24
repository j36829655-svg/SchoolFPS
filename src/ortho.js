import * as THREE from 'three';

// 브이월드 항공사진(공공데이터, © 국토교통부 브이월드)을 실행할 때 받아 지형에 입힌다.
// 키는 등록한 사이트 주소에서만 동작하는 공개용 키라 코드에 넣어도 된다.
const VWORLD_KEY = 'F561D07B-0141-4794-B0AF-253AAA0E0FEB';
const Z = 19, TILE = 256, N = 2 ** Z;
const LAT0 = 36.9178469, LON0 = 126.4636158, M_LON = 111320 * Math.cos(LAT0 * Math.PI / 180), M_LAT = 110574;

const toPx = (x, y) => {
  const lon = LON0 + x / M_LON, lat = LAT0 + y / M_LAT, r = lat * Math.PI / 180;
  return [(lon + 180) / 360 * N * TILE, (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * N * TILE];
};

/** 지형 범위(m)를 덮는 타일을 받아 한 장의 텍스처로 합친다. 실패하면 null */
export async function loadOrtho([x0, y0, x1, y1], onProgress) {
  const [px0, py0] = toPx(x0, y1), [px1, py1] = toPx(x1, y0); // 북서 · 남동
  const tx0 = Math.floor(px0 / TILE), ty0 = Math.floor(py0 / TILE), tx1 = Math.floor(px1 / TILE), ty1 = Math.floor(py1 / TILE);
  const cols = tx1 - tx0 + 1, rows = ty1 - ty0 + 1;
  const canvas = document.createElement('canvas');
  canvas.width = cols * TILE; canvas.height = rows * TILE;
  const g = canvas.getContext('2d');
  let ok = 0, done = 0;
  const jobs = [];
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) jobs.push(new Promise(res => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { g.drawImage(img, (tx - tx0) * TILE, (ty - ty0) * TILE); ok++; onProgress?.(++done, jobs.length); res(); };
    img.onerror = () => { onProgress?.(++done, jobs.length); res(); };
    img.src = `https://api.vworld.kr/req/wmts/1.0.0/${VWORLD_KEY}/Satellite/${Z}/${ty}/${tx}.jpeg`;
  }));
  await Promise.all(jobs);
  if (ok < jobs.length * 0.5) return null;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const W = cols * TILE, H = rows * TILE, ox = tx0 * TILE, oy = ty0 * TILE;
  // 색 샘플링용으로 1/4 크기(약 1m/픽셀) 평균 이미지를 만들어 둔다
  const sw = W / 4, sh = H / 4, small = document.createElement('canvas');
  small.width = sw; small.height = sh;
  const sg = small.getContext('2d', { willReadFrequently: true });
  sg.drawImage(canvas, 0, 0, sw, sh);
  const px = sg.getImageData(0, 0, sw, sh).data;
  return {
    tex,
    uvAt: (x, y) => { const [u, v] = toPx(x, y); return [(u - ox) / W, 1 - (v - oy) / H]; },
    /** (x, y) m 지점의 평균 색 [r, g, b] */
    sample: (x, y) => {
      const [u, v] = toPx(x, y), i = Math.floor((u - ox) / 4), j = Math.floor((v - oy) / 4);
      if (i < 0 || j < 0 || i >= sw || j >= sh) return [0, 0, 0];
      const k = (j * sw + i) * 4;
      return [px[k], px[k + 1], px[k + 2]];
    },
  };
}

/** 지형 메시에 항공사진을 입히고, 가까이서 보면 잔디 질감이 살짝 겹쳐 보이게 한다 */
export function applyOrtho(mesh, ortho, detail) {
  const geo = mesh.geometry, pos = geo.attributes.position, uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) uv.set(ortho.uvAt(pos.getX(i), -pos.getZ(i)), i * 2);
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const mat = new THREE.MeshLambertMaterial({ map: ortho.tex });
  mat.onBeforeCompile = sh => {
    sh.uniforms.detailMap = { value: detail };
    sh.vertexShader = 'varying vec2 vDetailUv;\n' + sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvDetailUv = position.xz / 2.5;');
    sh.fragmentShader = 'uniform sampler2D detailMap;\nvarying vec2 vDetailUv;\n' + sh.fragmentShader.replace('#include <map_fragment>',
      '#include <map_fragment>\nvec3 det = texture2D(detailMap, vDetailUv).rgb;\ndiffuseColor.rgb *= mix(vec3(1.0), det / max(dot(det, vec3(0.333)), 0.05), 0.35);');
  };
  mesh.material = mat;
}
