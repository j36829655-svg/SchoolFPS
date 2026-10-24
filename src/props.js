import * as THREE from 'three';
import { CAMPUS } from './data/campus.js';
import { PROPS, HEDGES, GUARDRAILS, AZALEA_ROADS, CARS, PAVINGS, SIDEWALKS, SHRUB_BALLS, STREET, BRICK_WALLS, PARTS } from './data/details.js';
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

let clashes = () => false; // buildProps 안에서 실제 도로·건물로 채운다

export function buildProps(scene, physics, terrain) {
  const hAt = (x, y) => terrain.heightAt(x, y);
  const place = (obj, x, y, deg = 0) => { obj.position.set(x, hAt(x, y), -y); obj.rotation.y = deg * Math.PI / 180; scene.add(obj); return obj; };

  // 손으로 찍은 소품 좌표가 실제 도로·건물·연못 위에 오면 놓지 않는다 (도로 중앙 벽돌담·관목 같은 오류 방지)
  const roadSegs = CAMPUS.roads.flatMap(r => r.pts.slice(1).map((p, i) => [...r.pts[i], ...p, r.w / 2]));
  const solids = [...CAMPUS.buildings, ...PARTS, ...CAMPUS.greenhouses].map(b => b.pts).concat(CAMPUS.grounds.filter(g => g.type === 'water').map(g => g.pts));
  clashes = (x, y, m) => roadSegs.some(([ax, ay, bx, by, hw]) => segDist(x, y, ax, ay, bx, by) < hw + m) || solids.some(p => signedDist(x, y, p) < m);
  const solid = { rock: 1.4, booth: 0.6, pine: 0.35, metaseq: 0.45, signpost: 0.15, stoneSign: 0.6 };
  for (const [kind, x, y, deg] of PROPS) {
    if (!['steps', 'stoneSign', 'deck'].includes(kind) && clashes(x, y, 0.8)) continue;
    place(BUILDERS[kind](), x, y, deg);
    if (solid[kind]) physics.addCircle(x, y, solid[kind]);
  }

  for (const p of PAVINGS) scene.add(paving(p, terrain));
  for (const s of SIDEWALKS) scene.add(strip(s.pts, s.w, new THREE.MeshLambertMaterial({ color: s.color, polygonOffset: true, polygonOffsetFactor: -4 }), terrain, 0.14));

  // 산울타리
  for (const line of HEDGES) segments(densify(line, 2), (ax, ay, bx, by, len, ang) => {
    if (clashes((ax + bx) / 2, (ay + by) / 2, 0.6)) return;
    const m = box(len, 0.95, 0.9, MAT.hedge); m.position.set((ax + bx) / 2, hAt((ax + bx) / 2, (ay + by) / 2) + 0.45, -(ay + by) / 2); m.rotation.y = ang; scene.add(m);
    physics.addPolygon(thick(ax, ay, bx, by, 0.45));
  });

  // 가드레일 (기둥 + 판)
  for (const gr of GUARDRAILS) segments(guardrailLine(gr), (ax, ay, bx, by, len, ang) => {
    const n = Math.ceil(len / 2.5);
    for (let i = 0; i <= n; i++) { const x = ax + (bx - ax) * i / n, y = ay + (by - ay) * i / n; place(cyl(0.06, 0.06, 0.8, MAT.metal, 0, 0.4, 0), x, y); }
    const r = box(len, 0.3, 0.06, MAT.rail); r.position.set((ax + bx) / 2, hAt((ax + bx) / 2, (ay + by) / 2) + 0.65, -(ay + by) / 2); r.rotation.y = ang; scene.add(r);
    physics.addPolygon(thick(ax, ay, bx, by, 0.15));
  });

  // 철쭉 (분홍 덤불, 인스턴스)
  const azaleas = [];
  for (const az of AZALEA_ROADS) { const r = CAMPUS.roads.find(x => x.name === az.road), [bx0, by0, bx1, by1] = az.box; segments(densify(r.pts, 3).filter(([x, y]) => x >= bx0 && y >= by0 && x <= bx1 && y <= by1), (ax, ay, bx, by, len) => {
    const ux = (bx - ax) / len, uy = (by - ay) / len;
    for (let t = 2; t < len - 2; t += 2.2) for (const side of [-1, 1]) {
      if (Math.sin(t * 3.1 + side * 7 + ax) > 0.55) continue;
      const off = r.w / 2 + 1.6; azaleas.push([ax + ux * t - uy * side * off, ay + uy * t + ux * side * off]);
    }
  }); }
  instanced(scene, new THREE.IcosahedronGeometry(0.55, 1), new THREE.MeshLambertMaterial({ color: 0xd9559a }), azaleas, ([x, y], m, i) =>
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
    if (clashes(x, y, 1)) return;
    const mat = M(colors[i % colors.length]);
    const car = grp(box(4.4, 0.75, 1.8, mat, 0, 0.6, 0), box(2.4, 0.6, 1.6, mat, -0.2, 1.25, 0), box(2.3, 0.45, 1.62, new THREE.MeshLambertMaterial({ color: 0x1d2630 }), -0.2, 1.27, 0));
    for (const [wx, wz] of [[1.4, 0.85], [-1.4, 0.85], [1.4, -0.85], [-1.4, -0.85]]) { const w = cyl(0.33, 0.33, 0.25, M(0x111111), wx, 0.33, wz, 10); w.rotation.x = Math.PI / 2; car.add(w); }
    place(car, x, y, deg);
    physics.addPolygon(rectAt(x, y, 4.4, 1.8, deg));
  });

  roadside(scene, physics, terrain);

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
    m.compose(new THREE.Vector3(x, waterY + 0.45, -y), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(x) * 0.2, 0, Math.cos(y) * 0.2)), new THREE.Vector3(1, 0.6 + (k % 3) * 0.15, 1)));

  // 수련 잎과 분수 (웹 사진 010·184)
  const [pb0, pb1, pb2, pb3] = pond.reduce(([a, b, c, d], [x, y]) => [Math.min(a, x), Math.min(b, y), Math.max(c, x), Math.max(d, y)], [Infinity, Infinity, -Infinity, -Infinity]);
  const pads = [];
  for (let i = 0; i < 900 && pads.length < 260; i++) {
    const x = pb0 + (pb2 - pb0) * ((i * 0.618034) % 1), y = pb1 + (pb3 - pb1) * ((i * 0.381966 + 0.13) % 1);
    const d = signedDist(x, y, pond);
    if (d < -1.2 && (d > -9 || (i % 5) === 0)) pads.push([x, y, 0.45 + ((i * 37) % 10) / 16]); // 물가 쪽에 몰려 있다
  }
  instanced(scene, new THREE.CircleGeometry(1, 9).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x4f7a3a, side: THREE.DoubleSide }), pads, ([x, y, s], m) =>
    m.compose(new THREE.Vector3(x, waterY + 0.03, -y), new THREE.Quaternion(), new THREE.Vector3(s, 1, s)));
  const [fx, fy] = pond.reduce(([sx, sy], [x, y]) => [sx + x / pond.length, sy + y / pond.length], [0, 0]);
  const spray = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.2, 12, 1, true), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
  spray.rotation.x = Math.PI; spray.position.set(fx, waterY + 1.6, -fy); scene.add(spray);
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

/** 길가: 경계석, 가로수, 다듬은 관목, 벽돌 담 (로드뷰 01·02·11·12·17·21) */
function roadside(scene, physics, terrain) {
  const hAt = (x, y) => terrain.heightAt(x, y);
  const road = CAMPUS.roads.find(r => r.name === STREET.road);
  const blockers = [...CAMPUS.buildings.map(b => b.pts), ...PARTS.map(p => p.pts), ...CAMPUS.grounds.map(g => g.pts)];
  const clear = (x, y, m) => blockers.every(p => signedDist(x, y, p) > m);

  // 경계석: 도로 양쪽 가장자리를 따라 15cm 높이 회색 돌
  const curbMat = new THREE.MeshLambertMaterial({ color: 0xb3b1aa });
  const curbs = [];
  segments(road.pts, (ax, ay, bx, by, len, ang) => {
    const ux = (bx - ax) / len, uy = (by - ay) / len;
    for (let t = 0; t < len; t += 1) for (const side of [-1, 1]) {
      const x = ax + ux * (t + 0.5) - uy * side * (road.w / 2 + 0.1), y = ay + uy * (t + 0.5) + ux * side * (road.w / 2 + 0.1);
      curbs.push([x, y, ang]);
    }
  });
  instanced(scene, new THREE.BoxGeometry(1, 0.18, 0.18), curbMat, curbs, ([x, y, ang], m) =>
    m.compose(new THREE.Vector3(x, hAt(x, y) + 0.09, -y), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang), new THREE.Vector3(1, 1, 1)));

  // 가로수: 은행나무처럼 위로 길쭉한 수관
  const trees = !STREET.treeEvery ? [] : alongPolyline(road.pts, STREET.treeEvery, road.w / 2 + 2.2, 4).concat(alongPolyline(road.pts, STREET.treeEvery, -(road.w / 2 + 2.2), 8))
    .filter(([x, y]) => clear(x, y, 2.5));
  const crown = new THREE.IcosahedronGeometry(1, 1).scale(1.8, 3.2, 1.8);
  instanced(scene, crown, new THREE.MeshLambertMaterial({ color: 0x8fb04f }), trees, ([x, y], m, i) =>
    m.compose(new THREE.Vector3(x, hAt(x, y) + 5.2, -y), new THREE.Quaternion(), new THREE.Vector3(1, 0.9 + (i % 4) * 0.08, 1)));
  instanced(scene, new THREE.CylinderGeometry(0.14, 0.2, 4, 6), MAT.darkWood, trees, ([x, y], m) =>
    m.compose(new THREE.Vector3(x, hAt(x, y) + 2, -y), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)));
  for (const [x, y] of trees) physics.addCircle(x, y, 0.25);

  // 둥글게 다듬은 관목
  instanced(scene, new THREE.IcosahedronGeometry(1, 2), new THREE.MeshLambertMaterial({ color: 0x3f6b35 }), SHRUB_BALLS.filter(([x, y, s]) => !clashes(x, y, s + 0.3)), ([x, y, s], m) =>
    m.compose(new THREE.Vector3(x, hAt(x, y) + s * 0.55, -y), new THREE.Quaternion(), new THREE.Vector3(s, s * 0.7, s)));
  for (const [x, y, s] of SHRUB_BALLS) if (!clashes(x, y, s + 0.3)) physics.addCircle(x, y, s * 0.9);

  // 붉은 벽돌 담
  const brickMat = new THREE.MeshLambertMaterial({ color: 0x9a4a36, map: brickTexture() });
  for (const line of BRICK_WALLS) segments(densify(line, 2), (ax, ay, bx, by, len, ang) => {
    if (clashes((ax + bx) / 2, (ay + by) / 2, 0.4)) return;
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, 0.3), brickMat);
    m.position.set((ax + bx) / 2, hAt((ax + bx) / 2, (ay + by) / 2) + 0.45, -(ay + by) / 2); m.rotation.y = ang; scene.add(m);
    physics.addPolygon(thick(ax, ay, bx, by, 0.15));
  });
}

function brickTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#c9c4bd'; g.lineWidth = 2;
  for (let y = 0; y < 64; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y); g.stroke(); for (let x = (y / 8) % 2 * 8; x < 64; x += 16) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 8); g.stroke(); } }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 1); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 도로 선(box 범위 안)을 도로 가장자리 + 0.7m 만큼 옆으로 옮긴 선. 기준점(toward/away)으로 어느 쪽인지 고른다 */
function guardrailLine({ road, box, toward, away }) {
  const r = CAMPUS.roads.find(x => x.name === road);
  const pts = densify(r.pts, 3).filter(([x, y]) => x >= box[0] && y >= box[1] && x <= box[2] && y <= box[3]);
  if (pts.length < 2) return [];
  const off = r.w / 2 + 0.7;
  const shift = s => pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [p[0] - dy / l * off * s, p[1] + dx / l * off * s];
  });
  const L = shift(1), R = shift(-1), ref = toward ?? away, mid = l => l[Math.floor(l.length / 2)];
  const dl = Math.hypot(mid(L)[0] - ref[0], mid(L)[1] - ref[1]), dr = Math.hypot(mid(R)[0] - ref[0], mid(R)[1] - ref[1]);
  return (dl < dr) === !!toward ? L : R;
}

/** 폴리라인을 step m 간격 점으로 촘촘하게 */
function densify(pts, step) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 0; k < n; k++) out.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
