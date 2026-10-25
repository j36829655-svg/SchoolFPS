import * as THREE from 'three';

// 1인칭 총 모델: config.js 의 m(모양 값)으로 몸통·총열·탄창·개머리·조준기·손을 조립한다.
// 좌표: x 오른쪽, y 위, -z 앞(총구 방향). 원점 = 손잡이 윗부분(방아쇠 근처), 몸통 바닥이 y = 0.
const mats = new Map();
function mat(color, rough = 0.6, metal = 0.25) {
  const k = `${color}|${rough}|${metal}`;
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
  return mats.get(k);
}
const SKIN = 0xd9a77e, SLEEVE = 0x2f3a2c, GLOVE = 0x26282a;

export function buildGun(w) {
  const m = w.m, g = new THREE.Group();
  const main = mat(m.col), wood = m.col2 ? mat(m.col2, 0.75, m.col2 > 0x600000 ? 0.05 : 0.4) : main, dark = mat(0x141516, 0.55, 0.5);
  const box = (sx, sy, sz, mt, x, y, z, rx = 0, parent = g, ry = 0) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mt); o.position.set(x, y, z); o.rotation.set(rx, ry, 0); parent.add(o); return o;
  };
  const cyl = (r, len, mt, x, y, z, parent = g, seg = 12) => {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2), mt); o.position.set(x, y, z); parent.add(o); return o;
  };
  let muzzleZ, boreY, sightY, leftZ, leftY, slide = null, pump = null;

  if (m.pistol) {
    const { L, H } = m;
    box(0.028, H, L * 0.82, wood, 0, H / 2, -L * 0.82 / 2 + 0.045);           // 프레임
    slide = new THREE.Group(); g.add(slide);
    box(0.03, m.slideH, L, main, 0, H + m.slideH / 2, -L / 2 + 0.055, 0, slide); // 슬라이드
    box(0.031, 0.008, 0.05, dark, 0, H + m.slideH * 0.55, -0.0, 0, slide);       // 탄피 배출구
    box(0.03, 0.12, 0.05, wood, 0, -0.055, 0.025, 0.22);                         // 손잡이
    box(0.006, 0.006, 0.045, wood, 0, -0.016, -0.035);                           // 방아쇠울
    box(0.005, 0.009, 0.006, dark, 0, H + m.slideH + 0.004, -L + 0.065, 0, slide); // 가늠쇠
    box(0.022, 0.009, 0.007, dark, 0, H + m.slideH + 0.004, 0.045, 0, slide);       // 가늠자
    muzzleZ = -L + 0.055; boreY = H + m.slideH * 0.4; sightY = H + m.slideH + 0.008;
    leftZ = 0.03; leftY = -0.07;
  } else {
    const { L, H, rear } = m, W = m.bullpup ? 0.055 : m.bipod ? 0.066 : 0.05, front = rear - L;
    box(W, H, L, main, 0, H / 2, rear - L / 2);                                   // 몸통
    box(0.032, 0.11, 0.045, dark, 0, -0.05, 0.015, 0.28);                         // 손잡이
    box(0.006, 0.006, 0.05, dark, 0, -0.016, -0.03);                              // 방아쇠울
    boreY = H * 0.68;
    // 총열 덮개
    let hgLen = 0;
    if (m.hg) {
      const [len, h, type] = m.hg; hgLen = len; const zc = front - len / 2;
      if (type === 'round') cyl(h / 2, len, main, 0, boreY - 0.004, zc, g, 14);
      else if (type === 'wood') { box(W * 0.92, h, len, wood, 0, boreY - 0.012, zc); cyl(0.009, len * 0.9, dark, 0, boreY + h * 0.55, zc); }
      else if (type === 'rail') { box(W, h, len, main, 0, H - h / 2, zc); box(W * 0.45, 0.008, len, dark, 0, H + 0.004, zc); box(W + 0.008, 0.008, len * 0.9, dark, 0, H - h / 2, zc); }
      else if (type === 'shield') { box(W * 0.95, h, len, main, 0, H - h / 2, zc); box(W * 0.7, 0.012, len * 1.1, dark, 0, H + 0.006, zc); }
      else box(W * 0.96, h, len, main, 0, H - h / 2, zc);
    }
    const [bLen, bR] = m.barrel, bz = front - hgLen;
    cyl(bR, bLen + hgLen, dark, 0, boreY, bz + (hgLen - bLen) / 2);              // 총열 (덮개 안쪽부터)
    cyl(bR * 1.45, 0.035, dark, 0, boreY, bz - bLen + 0.0175);                    // 소염기
    muzzleZ = bz - bLen;
    // 탄창
    const [mt, ml] = m.mag || [];
    const magZ = m.bullpup ? 0.12 : -0.075;
    if (mt === 'straight' || mt === 'bullpup') box(0.026, ml, 0.062, dark, 0, -ml / 2 + 0.01, magZ - ml * 0.05, 0.1);
    else if (mt === 'curved') {
      const seg = ml / 4; let y = 0.01, z = magZ;
      for (let i = 0; i < 4; i++) { const a = 0.06 + i * 0.13; y -= seg / 2 * Math.cos(a); z -= seg / 2 * Math.sin(a); box(0.026, seg * 1.04, 0.062, dark, 0, y, z, a); y -= seg / 2 * Math.cos(a); z -= seg / 2 * Math.sin(a); }
    } else if (mt === 'top') box(0.046, 0.03, ml, mat(0x3d4038, 0.3, 0.1), 0, H + 0.015, rear - L * 0.5);
    else if (mt === 'box') { box(0.08, 0.1, 0.11, mat(0x4a4d3e, 0.8, 0.1), -0.01, -0.055, magZ - 0.02); box(0.02, 0.03, 0.02, dark, 0.02, 0.0, magZ - 0.02); }
    else if (mt === 'tube') cyl(0.012, ml, dark, 0, boreY - 0.028, front - ml / 2);
    // 개머리
    const st = m.stock;
    if (st === 'fold') { for (const x of [-0.018, 0.018]) cyl(0.004, 0.2, dark, x, H * 0.62, rear + 0.1); box(0.045, 0.07, 0.015, dark, 0, H * 0.45, rear + 0.2); }
    else if (st === 'skeleton') { box(0.02, 0.016, 0.22, main, 0, H * 0.78, rear + 0.11); box(0.02, 0.016, 0.24, main, 0, H * 0.05, rear + 0.11, -0.22); box(0.032, 0.11, 0.022, main, 0, H * 0.35, rear + 0.215); }
    else if (st === 'wood') box(0.042, 0.065, 0.27, wood, 0, H * 0.42 - 0.017, rear + 0.13, 0.13);
    else if (st === 'tube') { cyl(0.014, 0.18, dark, 0, H * 0.62, rear + 0.09); box(0.042, 0.075, 0.1, main, 0, H * 0.5, rear + 0.17); }
    else if (st === 'solid') { box(0.045, 0.07, 0.22, main, 0, H * 0.48, rear + 0.11); box(0.03, 0.02, 0.12, dark, 0, H * 0.48 + 0.044, rear + 0.13); }
    else if (st === 'thumb') { box(0.035, 0.03, 0.26, wood, 0, H * 0.8, rear + 0.13); box(0.035, 0.13, 0.03, wood, 0, H * 0.25, rear + 0.25); box(0.03, 0.025, 0.2, wood, 0, -0.03, rear + 0.13, -0.3); }
    else if (m.bullpup) box(0.05, H * 1.05, 0.02, dark, 0, H * 0.5, rear + 0.01);
    // 조준기
    const sz = rear - L * 0.4, s = m.sight;
    if (s === 'iron') { box(0.004, 0.028, 0.006, dark, 0, H + 0.014, muzzleZ + 0.05); box(0.018, 0.016, 0.01, dark, 0, H + 0.008, rear - 0.04); sightY = H + 0.018; }
    else if (s === 'drum') { cyl(0.012, 0.02, dark, 0, H + 0.016, rear - 0.03); box(0.016, 0.03, 0.008, dark, 0, H + 0.015, front - 0.02); sightY = H + 0.022; }
    else if (s === 'red') { box(0.03, 0.036, 0.05, dark, 0, H + 0.02, sz); box(0.022, 0.026, 0.002, new THREE.MeshBasicMaterial({ color: 0x334455, transparent: true, opacity: 0.35 }), 0, H + 0.024, sz + 0.026); box(0.003, 0.003, 0.002, new THREE.MeshBasicMaterial({ color: 0xff2020 }), 0, H + 0.026, sz - 0.02); sightY = H + 0.026; }
    else if (s === 'scope') { cyl(0.019, 0.26, dark, 0, H + 0.042, rear - L * 0.45); cyl(0.026, 0.05, dark, 0, H + 0.042, rear - L * 0.45 - 0.13); cyl(0.024, 0.04, dark, 0, H + 0.042, rear - L * 0.45 + 0.13); for (const dz of [-0.06, 0.06]) box(0.02, 0.025, 0.015, dark, 0, H + 0.012, rear - L * 0.45 + dz); sightY = H + 0.042; }
    else if (s === 'handle') { box(0.022, 0.016, L * 0.62, main, 0, H + 0.04, rear - L * 0.5); for (const f of [0.15, 0.85]) box(0.016, 0.034, 0.02, main, 0, H + 0.017, rear - L * f); sightY = H + 0.056; }
    else if (s === 'p90') { box(0.036, 0.034, 0.1, dark, 0, H + 0.047, rear - L * 0.55); sightY = H + 0.06; box(0.03, 0.06, 0.05, main, 0, -0.04, front + 0.04); }
    else if (s === 'bead') { const b = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 4), mat(0xcccccc, 0.3, 0.8)); b.position.set(0, boreY + 0.014, muzzleZ + 0.01); g.add(b); box(0.006, 0.004, -muzzleZ, dark, 0, boreY + 0.012, muzzleZ / 2); sightY = boreY + 0.016; }
    else sightY = H + 0.02;
    // 펌프(산탄총 앞손잡이) — 왼손이 여기에 붙어 같이 움직인다
    if (m.pump) { pump = new THREE.Group(); g.add(pump); box(0.042, 0.036, 0.13, wood, 0, boreY - 0.03, front - 0.16, 0, pump); leftZ = front - 0.16; }
    if (m.bipod) for (const x of [-0.015, 0.015]) box(0.006, 0.006, 0.2, dark, x, boreY - 0.03, muzzleZ + 0.16, 0.05);
    leftZ ??= m.bullpup ? front + 0.07 : m.hg ? front - m.hg[0] * 0.5 : front - 0.05;
    leftY = boreY - 0.04;
  }

  // 손과 팔
  const skin = mat(w.id === 'glock' || w.id === 'deagle' ? SKIN : GLOVE, 0.8, 0), sleeve = mat(SLEEVE, 0.9, 0);
  box(0.045, 0.085, 0.07, skin, 0.004, -0.045, 0.022, 0.22);
  box(0.08, 0.08, 0.36, sleeve, 0.06, -0.15, 0.21, 0.5, g, -0.12);
  const lh = new THREE.Group(); (pump || g).add(lh); lh.position.set(-0.006, leftY, leftZ);
  box(0.05, 0.045, 0.09, skin, 0, 0, 0, 0, lh);
  box(0.075, 0.075, 0.36, sleeve, -0.1, -0.09, 0.17, 0.35, lh, 0.55);

  g.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; } });
  return { group: g, muzzle: new THREE.Vector3(0, boreY, muzzleZ), sightY, slide, pump, pistol: !!m.pistol };
}
