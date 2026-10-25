import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// 1인칭 총 모델: config.js 의 m(모양 값)으로 몸통·총열·탄창·개머리·조준기·손을 조립한다.
// 좌표: x 오른쪽, y 위, -z 앞(총구 방향). 원점 = 손잡이 윗부분(방아쇠 근처), 몸통 바닥이 y = 0.
// 모서리를 둥글린 상자, 금속·폴리머·나무 재질을 나눠 실제 총처럼 보이게 한다.
const mats = new Map(), geos = new Map();
function mat(color, rough, metal, extra = {}) {
  const k = `${color}|${rough}|${metal}|${JSON.stringify(extra)}`;
  if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }));
  return mats.get(k);
}
const METAL = () => mat(0x1c1e21, 0.42, 0.55), POLY = () => mat(0x18191b, 0.85, 0.05), RUBBER = () => mat(0x111112, 0.95, 0);
const GLOVE = () => mat(0x2b2d31, 0.92, 0), SLEEVE = () => mat(0x3d4a37, 1, 0), GLASS = () => mat(0x6f9fd8, 0.05, 0.9, { transparent: true, opacity: 0.22, depthWrite: false });
const RED = new THREE.MeshBasicMaterial({ color: 0xff2020 });
const UP = new THREE.Vector3(0, 1, 0);

export function buildGun(w) {
  const m = w.m, g = new THREE.Group();
  const dark = m.col < 0x404040;
  const main = mat(m.col, dark ? 0.55 : 0.7, dark ? 0.3 : 0.1); // 금속성이 높으면 하늘이 비쳐 허옇게 보인다
  const wood = m.col2 && m.col2 > 0x600000 ? mat(m.col2, 0.6, 0) : m.col2 ? mat(m.col2, 0.5, 0.4) : POLY();
  const rb = (sx, sy, sz, mt, x, y, z, rx = 0, parent = g, ry = 0) => {
    const r = Math.min(sx, sy, sz) * 0.3, k = `${sx}|${sy}|${sz}`;
    if (!geos.has(k)) geos.set(k, new RoundedBoxGeometry(sx, sy, sz, 2, r));
    const o = new THREE.Mesh(geos.get(k), mt); o.position.set(x, y, z); o.rotation.set(rx, ry, 0); parent.add(o); return o;
  };
  const cyl = (r, len, mt, x, y, z, parent = g, r2 = r, open = false) => {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, len, 16, 1, open).rotateX(Math.PI / 2), mt); o.position.set(x, y, z); parent.add(o); return o;
  };
  const out = { group: g, pistol: !!m.pistol, knife: !!m.knife };

  if (m.knife) { // 칼: 손잡이 + 코등이 + 날(옆모양을 그려 두께를 준다)
    rb(0.028, 0.032, 0.11, POLY(), 0, 0, 0.02);
    rb(0.05, 0.014, 0.012, METAL(), 0, 0.004, -0.04);
    const s = new THREE.Shape(); s.moveTo(0, -0.012); s.lineTo(0.15, -0.006); s.quadraticCurveTo(0.175, 0.004, 0.168, 0.016); s.lineTo(0, 0.016); s.closePath();
    const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 1 }).translate(0, 0, -0.002).rotateY(Math.PI / 2), mat(0xc4c8cc, 0.22, 1));
    blade.position.set(0, 0.002, -0.045); g.add(blade);
    out.muzzle = new THREE.Vector3(0, 0, -0.2); out.sightY = 0.05;
    out.rhand = hand(g, new THREE.Vector3(0, -0.005, 0.02), new THREE.Vector3(0.1, -0.3, 0.33), false);
    return finish(out);
  }

  let boreY, leftZ, leftY, magZ, magDrop;
  if (m.pistol) {
    const { L, H } = m, sH = m.slideH;
    rb(0.027, H, L * 0.8, wood, 0, H / 2, -L * 0.8 / 2 + 0.045);                           // 프레임
    const slide = out.slide = new THREE.Group(); g.add(slide);
    rb(0.03, sH, L, main, 0, H + sH / 2, -L / 2 + 0.055, 0, slide);                       // 슬라이드
    for (let i = 0; i < 4; i++) rb(0.031, sH * 0.7, 0.003, METAL(), 0, H + sH / 2, 0.035 - i * 0.008, 0, slide); // 뒤쪽 미끄럼 방지 홈
    rb(0.006, sH * 0.45, 0.045, METAL(), 0.013, H + sH * 0.62, -0.01, 0, slide);          // 탄피 배출구
    cyl(0.006, 0.01, METAL(), 0, H + sH * 0.4, -L + 0.052, slide);                       // 총구
    rb(0.005, 0.008, 0.006, METAL(), 0, H + sH + 0.004, -L + 0.065, 0, slide);           // 가늠쇠
    for (const x of [-0.007, 0.007]) rb(0.005, 0.008, 0.007, METAL(), x, H + sH + 0.004, 0.045, 0, slide); // 가늠자
    rb(0.03, 0.115, 0.05, wood, 0, -0.055, 0.025, 0.22);                                  // 손잡이
    rb(0.006, 0.006, 0.045, wood, 0, -0.017, -0.035); rb(0.004, 0.016, 0.005, METAL(), 0, -0.008, -0.03, -0.3); // 방아쇠울·방아쇠
    out.mag = new THREE.Group(); g.add(out.mag); rb(0.026, 0.012, 0.045, POLY(), 0, -0.118, 0.037, 0.22, out.mag); // 탄창 바닥
    boreY = H + sH * 0.4; out.muzzle = new THREE.Vector3(0, boreY, -L + 0.05); out.sightY = H + sH + 0.008;
    leftZ = 0.03; leftY = -0.07; magZ = 0.04; magDrop = -0.14;
  } else {
    const { L, H, rear } = m, W = m.bullpup ? 0.056 : m.bipod ? 0.066 : 0.052, front = rear - L;
    rb(W, H * 0.58, L, main, 0, H * 0.71, rear - L / 2);                                   // 윗몸통
    rb(W * 0.9, H * 0.5, L * (m.bullpup ? 0.95 : 0.7), main, 0, H * 0.26, rear - L * (m.bullpup ? 0.5 : 0.42)); // 아랫몸통
    rb(0.004, H * 0.22, 0.06, METAL(), W / 2, H * 0.7, rear - L * 0.45);                   // 탄피 배출구
    rb(0.014, 0.012, 0.028, METAL(), W / 2 + 0.006, H * 0.82, rear - L * 0.22);             // 장전 손잡이
    rb(W * 0.42, 0.008, L * 0.7, METAL(), 0, H + 0.004, rear - L * 0.45);                   // 레일
    for (let i = 0; i < 7; i++) rb(W * 0.5, 0.006, 0.006, METAL(), 0, H + 0.009, rear - L * 0.12 - i * L * 0.09);
    rb(0.03, 0.105, 0.042, POLY(), 0, -0.048, 0.012, 0.3);                                 // 손잡이
    rb(0.008, 0.006, 0.055, POLY(), 0, -0.022, -0.028); rb(0.008, 0.022, 0.006, POLY(), 0, -0.012, -0.056); // 방아쇠울
    rb(0.005, 0.018, 0.006, METAL(), 0, -0.01, -0.03, -0.3);                                // 방아쇠
    boreY = H * 0.68;
    let hgLen = 0;
    if (m.hg) {
      const [len, h, type] = m.hg; hgLen = len; const zc = front - len / 2;
      if (type === 'round') cyl(h / 2, len, main, 0, boreY - 0.004, zc, g, h / 2 * 1.05);
      else if (type === 'wood') { rb(W * 0.92, h, len, wood, 0, boreY - 0.012, zc); cyl(0.009, len * 0.9, METAL(), 0, boreY + h * 0.55, zc); }
      else {
        rb(W * 1.02, h, len, type === 'box' ? main : main, 0, H - h / 2, zc);
        if (type === 'rail' || type === 'shield') { rb(W * 0.42, 0.008, len, METAL(), 0, H + 0.004, zc); for (const s of [-1, 1]) rb(0.008, 0.008, len * 0.85, METAL(), s * (W / 2 + 0.004), H - h / 2, zc); }
      }
      for (let i = 0; i < 3; i++) for (const s of [-1, 1]) rb(0.003, h * 0.3, len * 0.18, METAL(), s * (W / 2 + 0.001), H - h * 0.55, front - len * (0.2 + i * 0.27)); // 통풍구
    }
    const [bLen, bR] = m.barrel, bz = front - hgLen;
    cyl(bR, bLen + hgLen, METAL(), 0, boreY, bz + (hgLen - bLen) / 2);                    // 총열
    rb(0.022, 0.026, 0.02, METAL(), 0, boreY + 0.004, bz - 0.01);                          // 가스 블록
    cyl(bR * 1.5, 0.045, METAL(), 0, boreY, bz - bLen + 0.022);                            // 소염기
    for (const k of [0.008, 0.024]) cyl(bR * 1.58, 0.004, RUBBER(), 0, boreY, bz - bLen + k);
    out.muzzle = new THREE.Vector3(0, boreY, bz - bLen);
    // 탄창 (재장전 때 따로 움직인다)
    const [mt, ml] = m.mag || [];
    magZ = m.bullpup ? 0.12 : -0.075; magDrop = -ml - 0.05;
    const mg = out.mag = new THREE.Group(); g.add(mg); mg.position.z = magZ;
    if (mt === 'straight' || mt === 'bullpup') { rb(0.026, ml, 0.062, POLY(), 0, -ml / 2 + 0.01, -ml * 0.05, 0.1, mg); rb(0.03, 0.01, 0.068, POLY(), 0, -ml + 0.01, -ml * 0.1, 0.1, mg); }
    else if (mt === 'curved') {
      const seg = ml / 4; let y = 0.01, z = 0;
      for (let i = 0; i < 4; i++) { const a = 0.06 + i * 0.13; y -= seg / 2 * Math.cos(a); z -= seg / 2 * Math.sin(a); rb(0.026, seg * 1.05, 0.062, POLY(), 0, y, z, a, mg); y -= seg / 2 * Math.cos(a); z -= seg / 2 * Math.sin(a); }
      rb(0.03, 0.01, 0.066, POLY(), 0, y, z, 0.5, mg);
    } else if (mt === 'top') { mg.position.set(0, 0, 0); rb(0.046, 0.03, ml, mat(0x3d4038, 0.3, 0.1, { transparent: true, opacity: 0.85 }), 0, H + 0.015, rear - L * 0.5, 0, mg); magDrop = 0.05; }
    else if (mt === 'box') { rb(0.08, 0.1, 0.11, mat(0x4a4d3e, 0.85, 0.05), -0.01, -0.055, -0.02, 0, mg); rb(0.02, 0.03, 0.02, METAL(), 0.02, 0, -0.02, 0, mg); }
    else if (mt === 'tube') { mg.position.set(0, 0, 0); cyl(0.012, ml, METAL(), 0, boreY - 0.028, front - ml / 2, mg); magDrop = 0; }
    // 개머리
    const st = m.stock, pad = (x, y, z, h) => rb(0.042, h, 0.018, RUBBER(), x, y, z);
    if (st === 'fold') { for (const x of [-0.018, 0.018]) cyl(0.004, 0.2, METAL(), x, H * 0.62, rear + 0.1); pad(0, H * 0.45, rear + 0.2, 0.07); }
    else if (st === 'skeleton') { rb(0.02, 0.016, 0.22, main, 0, H * 0.78, rear + 0.11); rb(0.02, 0.016, 0.24, main, 0, H * 0.05, rear + 0.11, -0.22); pad(0, H * 0.35, rear + 0.215, 0.11); }
    else if (st === 'wood') { rb(0.042, 0.065, 0.27, wood, 0, H * 0.42 - 0.017, rear + 0.13, 0.13); pad(0, H * 0.42 - 0.035, rear + 0.27, 0.075); }
    else if (st === 'tube') { cyl(0.014, 0.18, METAL(), 0, H * 0.62, rear + 0.09); rb(0.042, 0.075, 0.1, POLY(), 0, H * 0.5, rear + 0.17); pad(0, H * 0.5, rear + 0.225, 0.08); }
    else if (st === 'solid') { rb(0.045, 0.07, 0.22, main, 0, H * 0.48, rear + 0.11); rb(0.03, 0.02, 0.12, POLY(), 0, H * 0.48 + 0.044, rear + 0.13); pad(0, H * 0.48, rear + 0.225, 0.075); }
    else if (st === 'thumb') { rb(0.035, 0.03, 0.26, wood, 0, H * 0.8, rear + 0.13); rb(0.035, 0.13, 0.03, wood, 0, H * 0.25, rear + 0.25); rb(0.03, 0.025, 0.2, wood, 0, -0.03, rear + 0.13, -0.3); }
    else if (m.bullpup) pad(0, H * 0.5, rear + 0.01, H * 1.05);
    // 조준기: 도트는 속이 빈 통이라 조준해도 앞이 보인다
    const sz = rear - L * 0.4, s = m.sight;
    if (s === 'red') {
      rb(0.026, 0.012, 0.04, METAL(), 0, H + 0.014, sz);
      const cy = H + 0.036; cyl(0.019, 0.05, METAL(), 0, cy, sz, g, 0.019, true);
      cyl(0.0195, 0.006, METAL(), 0, cy, sz - 0.025, g, 0.0195, true); cyl(0.0195, 0.006, METAL(), 0, cy, sz + 0.025, g, 0.0195, true);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.018, 20), GLASS()); lens.position.set(0, cy, sz - 0.02); g.add(lens);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0012, 6, 4), RED); dot.position.set(0, cy, sz - 0.02); g.add(dot);
      out.sightY = cy;
    } else if (s === 'scope') {
      const cy = H + 0.045, zc = rear - L * 0.45;
      cyl(0.017, 0.24, METAL(), 0, cy, zc); cyl(0.026, 0.06, METAL(), 0, cy, zc - 0.14, g, 0.026); cyl(0.024, 0.05, METAL(), 0, cy, zc + 0.13, g, 0.02);
      for (const dz of [-0.075, 0.07]) { const l = new THREE.Mesh(new THREE.CircleGeometry(0.023, 20), GLASS()); l.position.set(0, cy, zc + dz * 2.3); g.add(l); }
      rb(0.012, 0.03, 0.012, METAL(), 0, cy + 0.024, zc); rb(0.03, 0.012, 0.012, METAL(), 0.024, cy, zc);
      for (const dz of [-0.06, 0.06]) rb(0.02, 0.03, 0.015, METAL(), 0, H + 0.015, zc + dz);
      out.sightY = cy;
    } else out.sightY = H + 0.02;
    if (m.pump) { out.pump = new THREE.Group(); g.add(out.pump); rb(0.044, 0.038, 0.13, wood, 0, boreY - 0.03, front - 0.16, 0, out.pump); for (let i = 0; i < 5; i++) rb(0.046, 0.004, 0.006, RUBBER(), 0, boreY - 0.03, front - 0.11 - i * 0.022, 0, out.pump); leftZ = front - 0.16; }
    if (m.bipod) for (const x of [-0.015, 0.015]) rb(0.007, 0.007, 0.2, METAL(), x, boreY - 0.03, out.muzzle.z + 0.16, 0.05);
    leftZ ??= m.bullpup ? front + 0.07 : m.hg ? front - m.hg[0] * 0.5 : front - 0.05;
    leftY = boreY - 0.045;
  }
  // 오른손은 손잡이를 감싸고, 왼손은 앞손잡이(권총은 오른손 아래)를 받친다. 팔은 화면 아래 바깥으로
  out.rhand = hand(g, new THREE.Vector3(0.002, -0.045, 0.02), new THREE.Vector3(0.1, -0.3, 0.34), false);
  out.lhand = new THREE.Group(); (out.pump || g).add(out.lhand); out.lhand.position.set(m.pistol ? -0.012 : 0, leftY, leftZ);
  hand(out.lhand, new THREE.Vector3(0, 0, 0), new THREE.Vector3(m.pistol ? -0.16 : -0.22, m.pistol ? -0.24 : -0.26, 0.3), true);
  out.lhandHome = out.lhand.position.clone();
  out.magPos = new THREE.Vector3(-0.005, (magDrop ?? -0.1) * 0.6, (magZ ?? 0));
  out.magDrop = magDrop ?? -0.1;
  out.boreY = boreY;
  return finish(out);
}

/** 손(손바닥·손가락 넷·엄지) + 팔뚝 + 소매. at: 손 위치, elbow: 팔꿈치 쪽 끝 (같은 좌표계) */
function hand(parent, at, elbow, left) {
  const h = new THREE.Group(); parent.add(h); h.position.copy(at);
  const cap = (r, len, x, y, z, rx = 0, rz = 0) => { const o = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, 8), GLOVE()); o.position.set(x, y, z); o.rotation.set(rx, 0, rz); h.add(o); return o; };
  const s = left ? -1 : 1;
  cap(0.021, 0.04, s * 0.018, 0, 0.004);                                           // 손바닥 (손잡이 옆)
  for (let i = 0; i < 4; i++) cap(0.0085, 0.022, -s * 0.004, 0.022 - i * 0.017, -0.026, 0, Math.PI / 2); // 손가락 (앞을 감쌈)
  cap(0.009, 0.026, -s * 0.016, 0.03, 0.0, -0.9);                                   // 엄지
  limb(parent, at.clone().add(new THREE.Vector3(s * 0.016, -0.02, 0.025)), elbow, 0.03, 0.042, GLOVE(), SLEEVE());
  return h;
}
/** 손목에서 팔꿈치까지: 손목 쪽은 장갑, 나머지는 소매 */
function limb(parent, a, b, r0, r1, m0, m1) {
  const dir = b.clone().sub(a), len = dir.length(); dir.normalize();
  const cut = Math.min(0.06, len * 0.3);
  for (const [p, q, ra, rb, mt] of [[a, a.clone().addScaledVector(dir, cut), r0, r0 * 1.05, m0], [a.clone().addScaledVector(dir, cut), b, r1 * 0.95, r1, m1]]) {
    const l = p.distanceTo(q), o = new THREE.Mesh(new THREE.CylinderGeometry(rb, ra, l, 12), mt);
    o.position.copy(p).add(q).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(UP, dir); parent.add(o);
  }
}
/** 총 고르기 화면용 옆모습 그림 (손은 숨긴다). 반환: { id: dataURL } */
export function gunThumbs(list, env = null, W = 168, H = 64) {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setPixelRatio(1); r.setSize(W, H);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  const s = new THREE.Scene(); s.environment = env;
  s.add(new THREE.HemisphereLight(0xffffff, 0x556677, 1.5)); const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(3, 4, 2); s.add(d);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10); cam.position.set(4, 0, 0); cam.lookAt(0, 0, 0); // 총구가 오른쪽
  const out = {}, hide = [GLOVE(), SLEEVE()];
  for (const w of list) {
    const { group } = buildGun(w), box = new THREE.Box3();
    group.updateMatrixWorld(true);
    group.traverse(o => { if (!o.isMesh) return; if (hide.includes(o.material)) o.visible = false; else box.union(new THREE.Box3().setFromObject(o)); });
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3()), half = Math.max(sz.z / 2 * H / W, sz.y / 2) * 1.08;
    group.position.sub(c); cam.top = half; cam.bottom = -half; cam.left = -half * W / H; cam.right = half * W / H; cam.updateProjectionMatrix();
    s.add(group); r.render(s, cam); out[w.id] = r.domElement.toDataURL(); s.remove(group);
  }
  r.dispose(); r.forceContextLoss();
  return out;
}

function finish(out) {
  out.group.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false; } });
  return out;
}
