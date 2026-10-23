import * as THREE from 'three';
import { CAMPUS } from './data/campus.js';
import { PROPS, HEDGES, GUARDRAILS, AZALEA_ROADS, CARS, PAVINGS, SIDEWALKS } from './data/details.js';
import { signedDist } from './terrain.js';

// 로드뷰에서 본 소품·조경. 모든 소품은 지형 높이에 놓이고, 부딪힐 만한 것은 충돌체를 가진다.

const M = c => new THREE.MeshLambertMaterial({ color: c });
const MAT = {
  wood: M(0x8a6240), darkWood: M(0x5b4330), metal: M(0x4a4f55), concrete: M(0xa8a8a2), red: M(0xc0262b),
  glass: new THREE.MeshLambertMaterial({ color: 0x9fb8c8, transparent: true, opacity: 0.5 }),
  rock: new THREE.MeshLambertMaterial({ color: 0xe8e6e0, flatShading: true }), hedge: new THREE.MeshLambertMaterial({ color: 0x3d6b33, flatShading: true }),
  pineLeaf: new THREE.MeshLambertMaterial({ color: 0x3e6b3a, flatShading: true }), metaLeaf: new THREE.MeshLambertMaterial({ color: 0x6f8f4a, flatShading: true }),
  white: M(0xf2f2ee), rail: M(0xc9cdd1), wire: new THREE.LineBasicMaterial({ color: 0x222222 }),
};
const box = (w, h, d, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };
const cyl = (r0, r1, h, mat, x = 0, y = 0, z = 0, seg = 8) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat); m.position.set(x, y, z); return m; };

const BUILDERS = {
  bench: () => grp(box(1.6, 0.06, 0.45, MAT.wood, 0, 0.45, 0), box(1.6, 0.4, 0.05, MAT.wood, 0, 0.72, -0.22),
    box(0.06, 0.45, 0.4, MAT.metal, -0.7, 0.22, 0), box(0.06, 0.45, 0.4, MAT.metal, 0.7, 0.22, 0)),
  table: () => grp(box(1.8, 0.06, 0.8, MAT.wood, 0, 0.75, 0), box(1.8, 0.05, 0.3, MAT.wood, 0, 0.45, 0.65), box(1.8, 0.05, 0.3, MAT.wood, 0, 0.45, -0.65),
    box(0.08, 0.75, 1.6, MAT.darkWood, -0.7, 0.37, 0), box(0.08, 0.75, 1.6, MAT.darkWood, 0.7, 0.37, 0)),
  booth: () => grp(box(0.95, 2.3, 0.95, MAT.red, 0, 1.15, 0), box(0.8, 1.5, 0.97, MAT.glass, 0, 1.3, 0), box(0.97, 1.5, 0.8, MAT.glass, 0, 1.3, 0), box(1.05, 0.12, 1.05, MAT.red, 0, 2.36, 0)),
  rock: () => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), MAT.rock); m.scale.set(2.2, 1.3, 1.1); m.position.y = 0.9; return m; },
  stoneSign: () => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 0), new THREE.MeshLambertMaterial({ color: 0x55585c, flatShading: true })); m.scale.set(1.4, 0.8, 0.5); m.position.y = 0.55; return m; },
  signpost: () => grp(cyl(0.07, 0.07, 2.4, MAT.darkWood, 0, 1.2, 0), box(0.7, 0.16, 0.04, MAT.wood, 0.3, 2.1, 0), box(0.7, 0.16, 0.04, MAT.wood, -0.25, 1.85, 0.03), box(0.7, 0.16, 0.04, MAT.wood, 0.25, 1.6, 0)),
  steps: () => grp(box(4, 0.2, 2.4, MAT.concrete, 0, 0.1, 0), box(4, 0.2, 1.6, MAT.concrete, 0, 0.3, -0.4), box(4, 0.2, 0.8, MAT.concrete, 0, 0.5, -0.8)),
  pine: () => { // 줄기가 굽고 옆으로 넓게 퍼진 소나무
    const g = grp(cyl(0.18, 0.3, 4.2, M(0x6b4a35), 0.3, 2.1, 0));
    g.children[0].rotation.z = -0.15;
    for (const [x, y, z, s] of [[0.6, 4.3, 0, 2.6], [-1.4, 3.6, 0.6, 1.8], [1.9, 3.4, -0.6, 1.7], [0.2, 5.1, 0.4, 1.6]]) {
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), MAT.pineLeaf); c.scale.set(s, s * 0.35, s * 0.8); c.position.set(x, y, z); g.add(c);
    }
    return g;
  },
  metaseq: () => { const g = grp(cyl(0.2, 0.4, 16, M(0x7a5038), 0, 8, 0)); const c = new THREE.Mesh(new THREE.ConeGeometry(2.4, 15, 8), MAT.metaLeaf); c.position.y = 10.5; g.add(c); return g; },
  deck: () => { // 어린이집 앞 데크 + 흰 난간
    const g = grp(box(20, 0.6, 2.5, MAT.concrete, 0, 0.3, 0));
    for (let x = -9.8; x <= 9.8; x += 1.4) g.add(box(0.06, 1, 0.06, MAT.white, x, 1.1, -1.2));
    g.add(box(20, 0.08, 0.08, MAT.white, 0, 1.6, -1.2));
    return g;
  },
};

function grp(...children) { const g = new THREE.Group(); children.forEach(c => g.add(c)); return g; }

export function buildProps(scene, physics, terrain) {
  const hAt = (x, y) => terrain.heightAt(x, y);
  const place = (obj, x, y, deg = 0) => { obj.position.set(x, hAt(x, y), -y); obj.rotation.y = deg * Math.PI / 180; scene.add(obj); return obj; };

  const solid = { rock: 1.4, booth: 0.6, pine: 0.35, metaseq: 0.45, signpost: 0.15, stoneSign: 0.6 };
  for (const [kind, x, y, deg] of PROPS) {
    place(BUILDERS[kind](), x, y, deg);
    if (solid[kind]) physics.addCircle(x, y, solid[kind]);
  }

  for (const p of PAVINGS) scene.add(paving(p, terrain));
  for (const s of SIDEWALKS) scene.add(strip(s.pts, s.w, new THREE.MeshLambertMaterial({ color: s.color, polygonOffset: true, polygonOffsetFactor: -4 }), terrain, 0.14));

  // 산울타리
  for (const line of HEDGES) segments(line, (ax, ay, bx, by, len, ang) => {
    const m = box(len, 0.95, 0.9, MAT.hedge); m.position.set((ax + bx) / 2, hAt((ax + bx) / 2, (ay + by) / 2) + 0.45, -(ay + by) / 2); m.rotation.y = ang; scene.add(m);
    physics.addPolygon(thick(ax, ay, bx, by, 0.45));
  });

  // 가드레일 (기둥 + 판)
  for (const line of GUARDRAILS) segments(line, (ax, ay, bx, by, len, ang) => {
    const n = Math.ceil(len / 2.5);
    for (let i = 0; i <= n; i++) { const x = ax + (bx - ax) * i / n, y = ay + (by - ay) * i / n; place(cyl(0.06, 0.06, 0.8, MAT.metal, 0, 0.4, 0), x, y); }
    const r = box(len, 0.3, 0.06, MAT.rail); r.position.set((ax + bx) / 2, hAt((ax + bx) / 2, (ay + by) / 2) + 0.65, -(ay + by) / 2); r.rotation.y = ang; scene.add(r);
    physics.addPolygon(thick(ax, ay, bx, by, 0.15));
  });

  // 철쭉 (분홍 덤불, 인스턴스)
  const azaleas = [];
  for (const road of AZALEA_ROADS) segments(road, (ax, ay, bx, by, len) => {
    const ux = (bx - ax) / len, uy = (by - ay) / len;
    for (let t = 2; t < len - 2; t += 2.2) for (const side of [-1, 1]) {
      if (Math.sin(t * 3.1 + side * 7 + ax) > 0.55) continue;
      azaleas.push([ax + ux * t - uy * side * 4.8, ay + uy * t + ux * side * 4.8]);
    }
  });
  instanced(scene, new THREE.IcosahedronGeometry(0.6, 0), new THREE.MeshLambertMaterial({ color: 0xe0559e, flatShading: true }), azaleas, ([x, y], m, i) =>
    m.compose(new THREE.Vector3(x, hAt(x, y) + 0.45, -y), new THREE.Quaternion(), new THREE.Vector3(1.2, 0.7 + (i % 3) * 0.1, 1)));

  // 전봇대 + 전선, 가로등 — 교내 도로를 따라
  const campusRoad = CAMPUS.roads.find(r => r.name === '교내 도로').pts;
  const poles = alongPolyline(campusRoad, 34, 5), lamps = alongPolyline(campusRoad, 40, -4.5, 17);
  let prev = null;
  for (const [x, y] of poles) {
    place(grp(cyl(0.14, 0.2, 10, MAT.concrete, 0, 5, 0), box(1.8, 0.12, 0.12, MAT.metal, 0, 9.2, 0)), x, y);
    physics.addCircle(x, y, 0.25);
    const top = new THREE.Vector3(x, hAt(x, y) + 9.1, -y);
    if (prev) for (const off of [-0.8, 0.8]) {
      const a = prev.clone().add(new THREE.Vector3(off, 0, 0)), b = top.clone().add(new THREE.Vector3(off, 0, 0));
      const mid = a.clone().lerp(b, 0.5); mid.y -= 0.9; // 늘어진 전선
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(8)), MAT.wire));
    }
    prev = top;
  }
  for (const [x, y, ang] of lamps) {
    const g = grp(cyl(0.07, 0.1, 5, MAT.metal, 0, 2.5, 0), box(1.2, 0.08, 0.08, MAT.metal, 0.6, 4.95, 0), box(0.5, 0.15, 0.25, MAT.white, 1.15, 4.85, 0));
    place(g, x, y, ang - 90);
    physics.addCircle(x, y, 0.15);
  }

  // 주차된 차
  const colors = [0xf2f2f2, 0xf2f2f2, 0x2a2d31, 0x9ea3a8, 0x2a2d31, 0x6b7076, 0xe9e9e9, 0x3b4a66];
  CARS.forEach(([x, y, deg], i) => {
    const mat = M(colors[i % colors.length]);
    const car = grp(box(4.4, 0.75, 1.8, mat, 0, 0.6, 0), box(2.4, 0.6, 1.6, mat, -0.2, 1.25, 0), box(2.3, 0.45, 1.62, new THREE.MeshLambertMaterial({ color: 0x1d2630 }), -0.2, 1.27, 0));
    for (const [wx, wz] of [[1.4, 0.85], [-1.4, 0.85], [1.4, -0.85], [-1.4, -0.85]]) { const w = cyl(0.33, 0.33, 0.25, M(0x111111), wx, 0.33, wz, 10); w.rotation.x = Math.PI / 2; car.add(w); }
    place(car, x, y, deg);
    physics.addPolygon(rectAt(x, y, 4.4, 1.8, deg));
  });

  // 연못 갈대: 물가를 따라 군데군데
  const pond = CAMPUS.grounds.find(g => g.name === '연못').pts;
  const reeds = [];
  segments(pond, (ax, ay, bx, by, len) => {
    for (let t = 0; t < len; t += 0.9) {
      if (Math.sin(t * 0.35 + ax * 0.2) < -0.1) continue;
      const x = ax + (bx - ax) * t / len, y = ay + (by - ay) * t / len;
      for (let k = 0; k < 6; k++) {
        const px = x + Math.sin(t * 7 + k * 2.1) * 2, py = y + Math.cos(t * 5 + k * 1.7) * 2;
        const d = signedDist(px, py, pond); if (d < -0.4 && d > -3) reeds.push([px, py, k]);
      }
    }
  }, true);
  const waterY = terrain.heightAt(-5, -130) + 1.3;
  instanced(scene, new THREE.ConeGeometry(0.06, 1.3, 3), new THREE.MeshLambertMaterial({ color: 0x9c9a5c }), reeds, ([x, y, k], m) =>
    m.compose(new THREE.Vector3(x, waterY + 0.45, -y), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(x) * 0.2, 0, Math.cos(y) * 0.2)), new THREE.Vector3(1, 0.8 + k * 0.2, 1)));
}

// ───────────── 도우미 ─────────────

function segments(pts, fn, closed = false) {
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length], len = Math.hypot(bx - ax, by - ay);
    fn(ax, ay, bx, by, len, Math.atan2(by - ay, bx - ax));
  }
}

function thick(ax, ay, bx, by, r) {
  const l = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / l * r, ny = (bx - ax) / l * r;
  return [[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny]];
}

function rectAt(x, y, L, W, deg) {
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [x + c * u * L / 2 - s * v * W / 2, y + s * u * L / 2 + c * v * W / 2]);
}

/** 폴리라인을 따라 every m 마다, 진행 방향 오른쪽 offset m 지점 [x, y, 각도] */
function alongPolyline(pts, every, offset, start = 8) {
  const out = []; let carry = start;
  segments(pts, (ax, ay, bx, by, len, ang) => {
    const ux = (bx - ax) / len, uy = (by - ay) / len;
    for (let t = carry; t < len; t += every) out.push([ax + ux * t + uy * offset, ay + uy * t - ux * offset, ang * 180 / Math.PI]);
    carry = (carry - len) % every; if (carry < 0) carry += every;
  });
  return out;
}

function instanced(scene, geo, mat, items, setMatrix) {
  const mesh = new THREE.InstancedMesh(geo, mat, items.length), m = new THREE.Matrix4();
  items.forEach((it, i) => mesh.setMatrixAt(i, setMatrix(it, m, i)));
  scene.add(mesh);
}

function strip(pts, w, mat, terrain, lift) {
  const pos = [], idx = [];
  const dense = [];
  segments(pts, (ax, ay, bx, by, len) => { const n = Math.max(1, Math.ceil(len / 2)); for (let k = 0; k < n; k++) dense.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]); });
  dense.push(pts[pts.length - 1]);
  dense.forEach(([x, y], i) => {
    const p = dense[Math.max(0, i - 1)], q = dense[Math.min(dense.length - 1, i + 1)];
    let dx = q[0] - p[0], dy = q[1] - p[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    for (const s of [1, -1]) { const px = x - dy * w / 2 * s, py = y + dx * w / 2 * s; pos.push(px, terrain.heightAt(px, py) + lift, -py); }
    if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  mat.side = THREE.DoubleSide;
  return new THREE.Mesh(geo, mat);
}

function paving({ kind, pts }, terrain) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  if (kind === 'brick') {
    g.fillStyle = '#b9b3a8'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#8f897f';
    for (let y = 0; y < 64; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y); g.stroke(); for (let x = (y / 8) % 2 * 8; x < 64; x += 16) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 8); g.stroke(); } }
  } else {
    g.fillStyle = '#a39d93'; g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 300; i++) { g.fillStyle = `hsl(30,6%,${45 + (i * 37) % 30}%)`; g.fillRect((i * 53) % 64, (i * 29) % 64, 2, 2); }
  }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1 / 4, 1 / 4); tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))));
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, terrain.heightAt(p.getX(i), -p.getZ(i)) + 0.12);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -3 }));
}
