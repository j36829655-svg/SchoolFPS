import * as THREE from 'three';
import { CAMPUS } from './data/campus.js';
import { TREES } from './data/trees.js';
import { Terrain, signedDist } from './terrain.js';
import { VW_BUILDINGS } from './data/vworld_buildings.js';
import { OVERRIDES, PARTS } from './data/details.js';
import { buildProps } from './props.js';
import { IMG, tiled } from './textures.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const UP = new THREE.Vector3(0, 1, 0);

// 캠퍼스 데이터 → 3D 장면 + 충돌체. 데이터 좌표 (x 동, y 북) → 3D (x, 높이, -y)

const GROUND_COLORS = { dirt: 0xc9a77a, futsal: 0x3f9a5a, court: 0x3aa58f, asphalt: 0x6f7378, farm: 0x8a6a48 };
const ROAD_COLORS = { asphalt: 0x5f6368, concrete: 0xa9a9a4, dirt: 0xb69772 };

// 로드뷰에서 확인한 외관 → 외벽 스타일
const STYLE_BY_ID = {
  amen: 'ribbon', taecho: 'ribbon', main_east: 'ribbon', main_west: 'ribbon', gym: 'ribbon',
  remnant: 'remnant', girls_dorm: 'glass', house_b: 'grid', teal_hall: 'grid', main_annex: 'grid',
  kinder: 'brick', sarang: 'dorm', somang: 'dorm', mideum: 'dorm',
  small_mid: 'shed', blue_shed: 'shed', main_sw: 'shed', shed_n: 'shed',
};
const BAY = { ribbon: 2, grid: 3, glass: 1.5, remnant: 4, cottage: 4, dorm: 3.5, brick: 3, shed: 3, curtain: 1.5, louver: 1.2, tower: 1.5, concrete: 3.5, rustframe: 6, dormSide: 3, dormEnd: 3.4 };
const PITCH = { gable: 0.3, hip: 0.15, arch: 0.22 };

const v3 = (x, z, y) => new THREE.Vector3(x, z, -y);

// Blender로 만든 건물 모델(id → Object3D)과, Blender에 넘길 건물 사양 목록
let MODELS = null;
const WATER = () => CAMPUS.grounds.filter(g => g.type === 'water').map(g => g.pts);
export const BUILDING_SPECS = [];

/** ortho: 브이월드 항공사진(있으면 지형에 입히고 나무 위치를 사진에서 뽑는다) */
export function buildWorld(scene, physics, ortho = null, models = null) {
  MODELS = models;
  PARTS.forEach((p, i) => { p.id ??= `part_${p.parent}_${i}`; });
  const terrain = new Terrain();

  // 1) 지형 평탄화: 연못 → 운동장/코트 → 건물 터 순서
  for (const b of CAMPUS.buildings) Object.assign(b, OVERRIDES[b.id]);
  const levels = new Map();
  for (const g of CAMPUS.grounds) {
    const opt = g.type === 'water' ? { margin: 0, blend: 5, offset: -1.6 } : { margin: 1, blend: 6 };
    levels.set(g, terrain.flatten(g.pts, opt));
  }
  for (const b of CAMPUS.buildings) levels.set(b, terrain.flatten(b.pts, { margin: 2, blend: 6 }));
  const extra = extraBuildings();
  for (const b of extra) levels.set(b, terrain.flatten(b.pts, { margin: 1.5, blend: 5 }));
  for (const g of CAMPUS.greenhouses) levels.set(g, terrain.flatten(g.pts, { margin: 1, blend: 4 }));
  const a = CAMPUS.amphitheater;
  const amphiPts = circlePts(a.center, a.r + 2, 16);
  levels.set(a, terrain.flatten(amphiPts, { margin: 0, blend: 5 }));

  scene.add(terrainMesh(terrain));
  ortho?.apply(terrain.mesh);

  // 2) 지면 구역
  for (const g of CAMPUS.grounds) {
    const y = levels.get(g);
    if (g.type === 'water') {
      const water = decal(g.pts, y + 1.3, new THREE.MeshLambertMaterial({ color: 0x3d6f86, transparent: true, opacity: 0.88 }));
      scene.add(water);
      physics.addPolygon(g.pts);
    } else {
      const lines = g.type === 'futsal' || g.type === 'court' || g.name === '대운동장';
      const surface = { dirt: ['dirt', 5, 0xffffff], asphalt: ['asphalt', 4, 0xffffff], farm: ['dirt', 3, 0xa88a6a] }[g.type];
      const mat = lines ? new THREE.MeshLambertMaterial({ color: GROUND_COLORS[g.type], map: courtLines(g.type) })
        : new THREE.MeshLambertMaterial({ color: surface?.[2] ?? GROUND_COLORS[g.type], map: surface ? tiled(surface[0], surface[1]) : null });
      if (ortho && !lines) continue; // 항공사진에 실제 흙·아스팔트가 이미 보인다
      scene.add(decal(g.pts, y + 0.04, mat, lines));
    }
  }

  for (const r of CAMPUS.roads) scene.add(road(r.pts, r.w, ROAD_COLORS[r.type] ?? 0x777777, terrain));

  // 3) 건물
  for (const b of CAMPUS.buildings) {
    scene.add(building(b, levels.get(b)));
    physics.addPolygon(b.pts);
  }
  for (const g of CAMPUS.greenhouses) {
    scene.add(greenhouse(g, levels.get(g)));
    physics.addPolygon(g.pts);
  }
  scene.add(amphitheater(a, levels.get(a)));

  for (const p of PARTS) {
    scene.add(building(p, levels.get(CAMPUS.buildings.find(b => b.id === p.parent))));
    physics.addPolygon(p.pts);
  }

  for (const b of extra) { scene.add(building(b, levels.get(b))); physics.addPolygon(b.pts); }

  const footprints = [...CAMPUS.buildings, ...extra, ...PARTS, ...CAMPUS.greenhouses].map(b => b.pts);
  addTrees(scene, physics, terrain, footprints, ortho ? treesFromOrtho(ortho, terrain, footprints) : null);
  buildProps(scene, physics, terrain);
  return terrain;
}

// ───────────── 지형 ─────────────

function terrainMesh(t) {
  const { nx, ny } = t, n = nx * ny;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  const c = new THREE.Color();
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = t.x0 + i * 2.5, y = t.y0 + j * 2.5, h = t.h[k];
    pos.set([x, h, -y], k * 3);
    uv.set([x, y], k * 2);
    // 잔디 텍스처에 곱할 색: 얼룩 + 경사가 급하면 흙빛
    const slope = Math.abs(t.heightAt(x + 2.5, y) - t.heightAt(x - 2.5, y)) + Math.abs(t.heightAt(x, y + 2.5) - t.heightAt(x, y - 2.5));
    const noise = (Math.sin(x * 0.37 + y * 0.11) + Math.sin(x * 0.13 - y * 0.41)) * 0.06;
    c.setRGB(0.92 + noise + slope * 0.03, 0.95 + noise - slope * 0.02, 0.82 + noise, THREE.SRGBColorSpace);
    col.set([c.r, c.g, c.b], k * 3);
  }
  const idx = [];
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, cc = a + nx, d = cc + 1;
    idx.push(a, b, cc, b, d, cc);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, map: tiled('grass', 3) }));
  t.mesh = mesh;
  return mesh;
}

function decal(pts, y, mat, obbUV = false) {
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, py]) => new THREE.Vector2(x, py))));
  if (obbUV) {
    const o = obb(pts), p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const dx = p.getX(i) - o.cx, dy = p.getY(i) - o.cy;
      uv.setXY(i, (dx * o.ux + dy * o.uy) / o.L + 0.5, (dx * -o.uy + dy * o.ux) / o.W + 0.5);
    }
  }
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.position.y = y;
  return m;
}

function road(pts, w, color, terrain) {
  // 폴리라인을 3m 간격으로 쪼개 지형을 따라 까는 띠
  const dense = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 3));
    for (let k = 0; k < n; k++) dense.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]);
  }
  dense.push(pts[pts.length - 1]);
  const pos = [], idx = [], uv = [];
  let along = 0;
  dense.forEach(([x, y], i) => {
    const p = dense[Math.max(0, i - 1)], q = dense[Math.min(dense.length - 1, i + 1)];
    let dx = q[0] - p[0], dy = q[1] - p[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const nx = -dy * w / 2, ny = dx * w / 2;
    if (i) along += Math.hypot(x - dense[i - 1][0], y - dense[i - 1][1]);
    for (const [px, py] of [[x + nx, y + ny], [x - nx, y - ny]]) pos.push(px, terrain.heightAt(px, py) + 0.1, -py);
    uv.push(0, along, w, along);
    // 연못을 지나는 구간은 그리지 않는다 (물 밑에 길이 비쳐 보이는 오류 방지)
    if (i && !WATER().some(p => signedDist((x + dense[i - 1][0]) / 2, (y + dense[i - 1][1]) / 2, p) < 1)) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const map = tiled(color === ROAD_COLORS.asphalt ? 'asphalt' : color === ROAD_COLORS.dirt ? 'dirt' : 'concrete', 4);
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: color === ROAD_COLORS.asphalt ? 0xd0d0d0 : 0xffffff, map, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
}

// ───────────── 건물 ─────────────

function building(b, ground) {
  return markSolid(buildingInner(b, ground));
}

/** 총알이 맞는 면으로 표시 (main.js 가 모아서 레이캐스트에 쓴다) */
function markSolid(g) { g.traverse(o => { if (o.isMesh) o.userData.solid = true; }); return g; }

function buildingInner(b, ground) {
  const group = new THREE.Group();
  const style = b.style ?? STYLE_BY_ID[b.id] ?? (b.roofType === 'gable' ? 'cottage' : 'grid');
  const sloped = b.roofType !== 'flat';
  const o = obb(b.pts);
  const rise = sloped ? Math.min(PITCH[b.roofType] * o.W, b.h * 0.45) : 0;
  const eave = b.h - rise;
  const top = ground + (sloped ? eave : b.h);

  BUILDING_SPECS.push({ id: b.id, pts: ccw(b.pts), ground, h: b.h, eave, rise, floors: Math.max(1, b.floors), style, endStyle: b.endStyle ?? null,
    roofType: b.roofType, wall: b.wall, roof: b.roof, accent: b.accent, endGlass: !!b.endGlass, canopy: !!b.canopy, obb: o });

  // Blender 모델이 있으면 그것을 쓰고, 지붕 위 설비(태양광·난간)만 덧붙인다
  group.userData.building = true;
  const model = MODELS?.get(b.id);
  if (model) {
    group.add(model);
    if (b.solar) group.add(solarPanels(b.pts, o, top - 0.6));
    if (b.railing) group.add(roofRailing(b.pts, top));
    return group;
  }

  const floorH = Math.max(2.6, (sloped ? eave : b.h - 0.6) / Math.max(1, b.floors));
  const sideMat = facadeMaterial(style, b.wall, b.accent, BAY[style], floorH);
  // 짧은 면(마구리)이 다른 건물: 기숙사처럼 끝면만 콘크리트 격자인 경우
  const endMat = b.endStyle ? facadeMaterial(b.endStyle, b.wall, b.accent, BAY[b.endStyle], floorH) : sideMat;
  group.add(walls(b.pts, ground - 0.6, top, ground, sideMat, endMat, o.L * 0.7));

  const roofMat = new THREE.MeshStandardMaterial({ color: b.roof, map: tiled(sloped ? 'metalroof' : 'concrete', sloped ? 4 : 6), roughness: sloped ? 0.8 : 0.9, metalness: sloped ? 0.1 : 0, side: THREE.DoubleSide });
  if (!sloped) {
    group.add(decal(b.pts, top - 0.6, roofMat)); // 0.6m 파라펫 안쪽 평지붕
    if (b.solar) group.add(solarPanels(b.pts, o, top - 0.6));
    if (b.railing) group.add(roofRailing(b.pts, top));
  } else {
    // 박공 삼각면: 유리(태초관) / 지붕색(도서관 같은 단층집, 로드뷰에서 짙은 회색) / 벽색
    const gableMat = b.endGlass ? new THREE.MeshLambertMaterial({ color: 0x6fa8a8, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
      : new THREE.MeshLambertMaterial({ color: style === 'cottage' ? b.roof : b.wall, side: THREE.DoubleSide });
    group.add(slopedRoof(o, ground + eave, rise, b.roofType, roofMat, gableMat));
  }
  return group;
}

/** 외벽. endLen 보다 짧은 면은 endMat(그룹 1)을 쓴다 */
function walls(pts, z0, z1, vBase, mat, endMat = mat, endLen = 0) {
  const p = ccw(pts), pos = [], uv = [], ends = [];
  let u = 0;
  for (let i = 0; i < p.length; i++) {
    const [ax, ay] = p[i], [bx, by] = p[(i + 1) % p.length], len = Math.hypot(bx - ax, by - ay);
    const A0 = [ax, z0, -ay], B0 = [bx, z0, -by], B1 = [bx, z1, -by], A1 = [ax, z1, -ay];
    const v0 = z0 - vBase, v1 = z1 - vBase;
    const quad = [...A0, ...B0, ...B1, ...A0, ...B1, ...A1], quv = [u, v0, u + len, v0, u + len, v1, u, v0, u + len, v1, u, v1];
    if (len < endLen) { ends.push(quad, quv); } else { pos.push(...quad); uv.push(...quv); }
    u += len;
  }
  const nSide = pos.length / 3;
  for (let i = 0; i < ends.length; i += 2) { pos.push(...ends[i]); uv.push(...ends[i + 1]); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.addGroup(0, nSide, 0);
  geo.addGroup(nSide, pos.length / 3 - nSide, 1);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, [mat, endMat]);
}

/** 박공(gable) · 모임(hip) · 아치(arch) 지붕 — 건물을 감싸는 회전 사각형 기준 */
function slopedRoof(o, eaveZ, rise, type, roofMat, gableMat) {
  const ov = 0.4, hl = o.L / 2 + ov, hw = o.W / 2 + ov;
  const P = (u, v, z) => { const x = o.cx + u * o.ux - v * o.uy, y = o.cy + u * o.uy + v * o.ux; return [x, z, -y]; };
  const roof = [], ends = [];
  const tri = (arr, a, b, c) => arr.push(...a, ...b, ...c);
  const quad = (arr, a, b, c, d) => { tri(arr, a, b, c); tri(arr, a, c, d); };
  const top = eaveZ + rise, low = eaveZ - ov * rise / (o.W / 2);

  if (type === 'arch') {
    const seg = 10;
    for (let s = 0; s < seg; s++) {
      const t0 = Math.PI * s / seg, t1 = Math.PI * (s + 1) / seg;
      const v0 = -Math.cos(t0) * o.W / 2, v1 = -Math.cos(t1) * o.W / 2, z0 = eaveZ + Math.sin(t0) * rise, z1 = eaveZ + Math.sin(t1) * rise;
      quad(roof, P(-hl, v0, z0), P(hl, v0, z0), P(hl, v1, z1), P(-hl, v1, z1));
      for (const u of [-o.L / 2, o.L / 2]) tri(ends, P(u, 0, eaveZ), P(u, v0, z0), P(u, v1, z1));
    }
  } else {
    const r = type === 'hip' ? Math.max(0, o.L / 2 - o.W / 2) : hl; // 용마루 반길이
    quad(roof, P(-hl, -hw, low), P(hl, -hw, low), P(r, 0, top), P(-r, 0, top));
    quad(roof, P(hl, hw, low), P(-hl, hw, low), P(-r, 0, top), P(r, 0, top));
    if (type === 'hip') {
      tri(roof, P(hl, -hw, low), P(hl, hw, low), P(r, 0, top));
      tri(roof, P(-hl, hw, low), P(-hl, -hw, low), P(-r, 0, top));
    } else {
      for (const u of [-o.L / 2, o.L / 2]) tri(ends, P(u, -o.W / 2, eaveZ), P(u, o.W / 2, eaveZ), P(u, 0, top));
    }
  }
  const g = new THREE.Group();
  g.add(mesh(roof, roofMat));
  if (ends.length) g.add(mesh(ends, gableMat));
  return g;
}

function greenhouse(gh, ground) {
  const o = obb(gh.pts);
  const mat = new THREE.MeshLambertMaterial({ color: gh.color, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  return slopedRoof({ ...o, L: o.L - 0.8, W: o.W - 0.8 }, ground, Math.min(3.2, o.W * 0.5), 'arch', mat, mat);
}

/** 원형 광장: 둥근 무대 + 연못 쪽으로 열린 반원형 계단 객석 (석재 단 + 나무 좌석, 드론 사진 184) */
function amphitheater(a, ground) {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0xb8b2a6, map: tiled('concrete', 3), roughness: 0.9 });
  const wood = new THREE.MeshStandardMaterial({ color: 0xc09a68, map: tiled('woodpanel', 2), roughness: 0.8 });
  const pond = CAMPUS.grounds.find(x => x.type === 'water').pts;
  const [px, py] = pond.reduce(([sx, sy], [x, y]) => [sx + x / pond.length, sy + y / pond.length], [0, 0]);
  const face = Math.atan2(py - a.center[1], px - a.center[0]) + Math.PI; // 객석은 연못 반대편
  const steps = 6, inner = a.r * 0.42, span = THREE.MathUtils.degToRad(100);
  for (let s = 0; s < steps; s++) {
    const r0 = inner + (a.r - inner) * s / steps, r1 = inner + (a.r - inner) * (s + 1) / steps;
    const sh = new THREE.Shape();
    sh.absarc(0, 0, r1, face - span, face + span, false);
    sh.absarc(0, 0, r0, face + span, face - span, true);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.42 * (s + 1), bevelEnabled: false, curveSegments: 24 });
    geo.rotateX(-Math.PI / 2);
    const tier = new THREE.Mesh(geo, [wood, stone]); // 윗면 나무 좌석, 옆면 석재
    tier.position.set(a.center[0], ground - 0.05, -a.center[1]);
    g.add(tier);
  }
  const stage = new THREE.Mesh(new THREE.CylinderGeometry(inner, inner, 0.25, 40), new THREE.MeshStandardMaterial({ color: 0xd8d2c4, map: tiled('paving', 2), roughness: 0.85 }));
  stage.position.set(a.center[0], ground + 0.1, -a.center[1]);
  g.add(stage);
  return g;
}

// ───────────── 외벽 텍스처 (한 칸 = BAY m × 한 층) ─────────────

const texCache = new Map();
function facadeMaterial(style, wall, accent, bay, floorH) {
  const key = [style, wall, accent, bay, floorH.toFixed(2)].join();
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const glass = '#3f5f7a';
  g.fillStyle = wall; g.fillRect(0, 0, 128, 128);
  // 캔버스 위쪽 = 층의 위쪽
  switch (style) {
    case 'ribbon': // 흰 벽 + 가로로 이어진 띠창 (아멘관, 본관)
      g.fillStyle = glass; g.fillRect(0, 34, 128, 50);
      g.fillStyle = '#d8dde2'; for (let x = 0; x < 128; x += 32) g.fillRect(x, 34, 3, 50);
      break;
    case 'glass': // 커튼월 유리 (여자기숙사)
      g.fillStyle = accent; g.fillRect(0, 0, 128, 104);
      g.fillStyle = '#c9d6e2'; g.fillRect(0, 0, 4, 104); g.fillRect(0, 50, 128, 3);
      break;
    case 'remnant': // 흰 벽 + 적갈색 프레임 + 파란 유리 (렘넌트)
      win(g, 70, 30, 40, 50);
      break;
    case 'cottage': // 흰 사이딩 + 창문 (도서관 등 단층)
      g.strokeStyle = 'rgba(0,0,0,0.08)'; for (let y = 4; y < 128; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
      g.fillStyle = '#ffffff'; g.fillRect(40, 30, 48, 52);
      g.fillStyle = glass; g.fillRect(44, 34, 40, 44);
      g.fillStyle = '#ffffff'; g.fillRect(63, 34, 2, 44);
      break;
    case 'dorm': // 노출 콘크리트 기둥 + 갈색 나무 판 + 창 (사랑·소망·믿음동)
      g.fillStyle = accent; g.fillRect(64, 8, 56, 100);
      g.fillStyle = '#2f3a40'; g.fillRect(14, 22, 40, 60);
      g.fillStyle = '#9a9a95'; g.fillRect(0, 104, 128, 24); g.fillRect(0, 0, 8, 128);
      break;
    case 'brick': // 회색 벽돌 (어린이집)
      g.strokeStyle = 'rgba(0,0,0,0.18)';
      for (let y = 0; y < 128; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); for (let x = (y / 8) % 2 * 8; x < 128; x += 16) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 8); g.stroke(); } }
      win(g, 38, 32, 52, 46);
      break;
    case 'rustframe': // 렘넌트 입구의 적갈색 프레임 + 유리
      g.fillStyle = accent; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#4f86c6'; g.fillRect(24, 16, 80, 96);
      break;
    case 'dormSide': // 기숙사 긴 면: 갈색 나무 판 + 작은 창 + 콘크리트 슬래브 (로드뷰 22)
      g.drawImage(IMG.woodpanel, 0, 0, 128, 128);
      g.fillStyle = 'rgba(150,85,45,0.22)'; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#a9a9a3'; g.fillRect(0, 112, 128, 16);
      win(g, 46, 36, 36, 40);
      break;
    case 'dormEnd': // 기숙사 끝면: 노출 콘크리트 격자 + 큰 창 + 창 아래 나무 판
      g.fillStyle = '#2e3a42'; g.fillRect(12, 14, 104, 58);
      g.fillStyle = '#9aa7b0'; g.fillRect(62, 14, 3, 58);
      g.drawImage(IMG.woodpanel, 0, 0, 128, 40, 12, 76, 104, 30);
      g.fillStyle = '#b9b9b4'; g.fillRect(0, 110, 128, 18);
      break;
    case 'curtain': // 유리 벽
      g.fillStyle = accent; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#c3d3db'; g.fillRect(0, 0, 5, 128); g.fillRect(0, 0, 128, 5);
      break;
    case 'louver': // 회색 벽 + 짙은 세로 루버 (아멘관 북쪽 건물)
      g.fillStyle = '#2f3a44'; g.fillRect(0, 20, 128, 80);
      g.fillStyle = '#b8bcc0'; for (let x = 0; x < 128; x += 16) g.fillRect(x, 20, 7, 80);
      break;
    case 'tower': // 파란 유리 + 적갈색 가로 띠 (렘넌트 유리 탑)
      g.fillStyle = wall; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#a9c4de'; g.fillRect(0, 0, 3, 128); g.fillRect(0, 64, 128, 2);
      g.fillStyle = accent; g.fillRect(0, 112, 128, 16);
      break;
    case 'concrete': // 노출 콘크리트 (기숙사 프레임 탑)
      g.strokeStyle = 'rgba(0,0,0,0.1)'; for (let y = 0; y < 128; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
      for (let i = 0; i < 12; i++) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.beginPath(); g.arc((i * 41) % 128, (i * 23) % 128, 1.5, 0, 7); g.fill(); }
      break;
    case 'shed':
      g.strokeStyle = 'rgba(0,0,0,0.12)'; for (let x = 0; x < 128; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); }
      break;
    default: // grid: 일반 창
      win(g, 34, 28, 60, 56);
  }
  // 실사 질감(회벽·콘크리트)을 곱하고, 층마다 슬래브 그림자 선
  g.globalCompositeOperation = 'multiply';
  if (style !== 'dormSide') g.drawImage(IMG[['dorm', 'concrete', 'shed', 'brick', 'dormEnd', 'dormSide'].includes(style) ? 'concrete' : 'plaster'], 0, 0, 128, 128);
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, 124, 128, 4);
  // 유리 픽셀은 위쪽을 하늘빛으로 밝히고, 반사(매끈·금속성)가 되도록 roughness/metalness 맵을 만든다
  const d = g.getImageData(0, 0, 128, 128), oc = document.createElement('canvas'); oc.width = oc.height = 128;
  const og = oc.getContext('2d'), o = og.createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) {
    const r = d.data[i], gg = d.data[i + 1], b = d.data[i + 2], isGlass = b > r + 18 && b >= gg - 5 && r + gg + b < 480;
    if (isGlass) { const k = (1 - (i >> 9) / 128) * 40; d.data[i] += k; d.data[i + 1] += k; d.data[i + 2] += k * 1.2; }
    o.data[i] = 255; o.data[i + 1] = isGlass ? 25 : 225; o.data[i + 2] = isGlass ? 170 : 0; o.data[i + 3] = 255;
  }
  g.putImageData(d, 0, 0); og.putImageData(o, 0, 0);
  const prep = t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / bay, 1 / floorH); t.anisotropy = 4; return t; };
  const tex = prep(new THREE.CanvasTexture(c)), orm = prep(new THREE.CanvasTexture(oc));
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughnessMap: orm, metalnessMap: orm, side: THREE.DoubleSide });
  texCache.set(key, mat);
  return mat;
}

function courtLines(type) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  // 텍스처는 재질 색과 곱해지므로 바탕은 약간 어둡게, 선은 흰색으로 그려 선이 밝게 보이게 한다
  g.fillStyle = '#d9d9d9'; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#ffffff'; g.lineWidth = 3;
  g.strokeRect(10, 8, 236, 112);
  g.beginPath(); g.moveTo(128, 8); g.lineTo(128, 120); g.stroke();
  g.beginPath(); g.arc(128, 64, 18, 0, Math.PI * 2); g.stroke();
  if (type !== 'dirt') { g.strokeRect(10, 36, 30, 56); g.strokeRect(216, 36, 30, 56); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// ───────────── 나무 ─────────────

function addTrees(scene, physics, terrain, footprints, fromOrtho) {
  // 침엽수: 원뿔 3단, 활엽수: 덩어리 4개를 합친 수관
  const layer = (r, h, y) => new THREE.ConeGeometry(r, h, 8).translate(0, y, 0);
  const blob = (r, x, y, z) => new THREE.IcosahedronGeometry(r, 1).translate(x, y, z);
  const kinds = [
    { crown: mergeGeometries([layer(2.4, 3.6, -1.6), layer(1.9, 3.2, 0.4), layer(1.2, 2.8, 2.2)]), color: 0x2f5a35, crownY: 6.5, list: [] },
    { crown: mergeGeometries([blob(2.2, 0, 0, 0), blob(1.7, 1.4, 0.6, 0.4), blob(1.6, -1.2, 0.8, -0.6), blob(1.4, 0.2, 1.7, 0.9)]), color: 0x4f7d3a, crownY: 5.2, list: [] },
  ];
  // 브이월드 건물 자리에 걸친 나무는 뺀다
  if (fromOrtho) for (const t of fromOrtho) kinds[t[2]].list.push(t);
  else for (const t of TREES) if (footprints.every(p => signedDist(t[0], t[1], p) > 1)) kinds[t[2]].list.push(t);

  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 4, 6), new THREE.MeshLambertMaterial({ color: 0x5b4330 }), kinds[0].list.length + kinds[1].list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let ti = 0;
  for (const k of kinds) {
    const crowns = new THREE.InstancedMesh(k.crown, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), k.list.length);
    const base = new THREE.Color(k.color), tint = new THREE.Color();
    k.list.forEach(([x, y, , sc], i) => {
      const h = terrain.heightAt(x, y);
      q.setFromAxisAngle(UP, (x * 7.3 + y * 3.1) % 6.28);
      crowns.setMatrixAt(i, m.compose(p.set(x, h + k.crownY * sc, -y), q, s.set(sc, sc * (0.9 + (i % 5) * 0.06), sc)));
      crowns.setColorAt(i, tint.copy(base).offsetHSL(((i * 37) % 11 - 5) * 0.006, 0, ((i * 13) % 9 - 4) * 0.018));
      q.identity();
      trunks.setMatrixAt(ti++, m.compose(p.set(x, h + 2 * sc, -y), q, s.set(sc, sc, sc)));
      physics.addCircle(x, y, 0.35 * sc);
    });
    scene.add(crowns);
  }
  scene.add(trunks);
}

// ───────────── 도우미 ─────────────

function mesh(arr, mat) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  const uv = []; for (let i = 0; i < arr.length; i += 3) uv.push(arr[i], arr[i + 2]); // 위에서 내려다본 평면 투영 (m)
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

function ccw(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; a += x1 * y2 - x2 * y1; }
  return a < 0 ? [...pts].reverse() : pts;
}

function circlePts([cx, cy], r, n) {
  return Array.from({ length: n }, (_, i) => [cx + Math.cos(i / n * Math.PI * 2) * r, cy + Math.sin(i / n * Math.PI * 2) * r]);
}

/** 최소 넓이 회전 사각형: 중심, 긴 축 방향(ux,uy), 길이 L ≥ 폭 W */
function obb(pts) {
  let best = null;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
    const l = Math.hypot(bx - ax, by - ay); if (!l) continue;
    const ux = (bx - ax) / l, uy = (by - ay) / l;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, y] of pts) { const u = x * ux + y * uy, v = -x * uy + y * ux; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area) best = { area, ux, uy, u0, u1, v0, v1 };
  }
  let { ux, uy, u0, u1, v0, v1 } = best;
  const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
  const cx = cu * ux - cv * uy, cy = cu * uy + cv * ux;
  let L = u1 - u0, W = v1 - v0;
  if (W > L) { [L, W] = [W, L]; [ux, uy] = [-uy, ux]; }
  return { cx, cy, ux, uy, L, W };
}

/** 창: 밝은 창틀 + 유리(위가 밝은 하늘 반사) + 가운데 창살 + 아래 창턱 그림자 */
function win(g, x, y, w, h) {
  g.fillStyle = '#e4e6e8'; g.fillRect(x - 3, y - 3, w + 6, h + 6);
  const grd = g.createLinearGradient(0, y, 0, y + h);
  grd.addColorStop(0, '#4f6f8f'); grd.addColorStop(1, '#2a3d52');
  g.fillStyle = grd; g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x, y, w, 3);
  g.fillStyle = '#e4e6e8'; g.fillRect(x + w / 2 - 1.5, y, 3, h);
  g.fillStyle = '#f4f4f2'; g.fillRect(x - 5, y + h + 3, w + 10, 3);
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x - 5, y + h + 6, w + 10, 3);
}

/** 브이월드에만 있는 건물(마을 집, 창고 등): 측량 외곽선 + 층수로 만든 기본 건물 */
function extraBuildings() {
  const used = new Set(CAMPUS.buildings.map(b => b.vw));
  const out = [];
  VW_BUILDINGS.forEach(([floors, height, pts], i) => {
    if (used.has(i)) return;
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    // 이미 있는 건물과 겹치면 생략 (꼭짓점이 안에 들어가거나 중심이 겹치는 경우)
    if (CAMPUS.buildings.some(b => signedDist(cx, cy, b.pts) < 1 || pts.some(([x, y]) => signedDist(x, y, b.pts) < -0.5))) return;
    let area = 0; for (let k = 0; k < pts.length; k++) { const [x1, y1] = pts[k], [x2, y2] = pts[(k + 1) % pts.length]; area += x1 * y2 - x2 * y1; }
    const small = Math.abs(area) / 2 < 150, f = Math.max(1, floors);
    out.push({ id: 'vw' + i, vw: i, pts, floors: f, h: height > 0 ? height : f * 3.2 + (small ? 1.8 : 0.6),
      roofType: small ? 'gable' : 'flat', wall: '#ecebe6', roof: small ? '#5a5f66' : '#c9cccf', accent: '#6b7a8a' });
  });
  return out;
}

/** 항공사진에서 나무 그늘(짙은 초록)인 곳에만 나무를 심는다. 건물·도로·운동장·연못 위는 제외 */
function treesFromOrtho(ortho, terrain, footprints) {
  const STEP = 5.5, out = []; // 간격이 넓을수록 나무가 적다 (3.6 → 5.5: 약 57% 감소)
  const x0 = terrain.x0, y0 = terrain.y0, x1 = x0 + (terrain.nx - 1) * 2.5, y1 = y0 + (terrain.ny - 1) * 2.5;
  const box = p => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const [x, y] of p) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); } return [a, b, c, d]; };
  const areas = [...footprints.map(p => ({ p, m: 1.5 })), ...CAMPUS.grounds.map(g => ({ p: g.pts, m: 0.5 })), { p: circlePts(CAMPUS.amphitheater.center, CAMPUS.amphitheater.r + 1, 12), m: 0 }]
    .map(o => ({ ...o, bb: box(o.p) }));
  const segs = [];
  for (const r of CAMPUS.roads) for (let i = 0; i < r.pts.length - 1; i++) segs.push([...r.pts[i], ...r.pts[i + 1], r.w / 2 + 1.5]);
  let n = 0;
  for (let y = y0 + 2; y < y1 - 2; y += STEP) for (let x = x0 + 2; x < x1 - 2; x += STEP) {
    n++;
    const jx = x + Math.sin(n * 12.9898) * 1.2, jy = y + Math.cos(n * 78.233) * 1.2;
    const [r, g, b] = ortho.sample(jx, jy), lum = (r + g + b) / 3;
    if (!(g > r + 7 && g > b + 4 && lum < 85 && lum > 18)) continue; // 짙은 숲 그늘만
    if (areas.some(({ p, m, bb }) => jx > bb[0] - m && jx < bb[2] + m && jy > bb[1] - m && jy < bb[3] + m && signedDist(jx, jy, p) < m)) continue;
    if (segs.some(([ax, ay, bx, by, w]) => segDist(jx, jy, ax, ay, bx, by) < w)) continue;
    out.push([jx, jy, lum < 58 ? 0 : 1, 0.75 + ((n * 7) % 10) / 16]);
  }
  return out;
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

/** 평지붕 위 태양광 패널 줄 (남쪽으로 기울어진 짙은 파란 판) */
function solarPanels(pts, o, roofZ) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x1f2f4a, roughness: 0.25, metalness: 0.5 });
  const items = [];
  for (let v = -o.W / 2 + 1.5; v < o.W / 2 - 1.2; v += 2.4) for (let u = -o.L / 2 + 1.5; u < o.L / 2 - 1.5; u += 2.1) {
    const x = o.cx + u * o.ux - v * o.uy, y = o.cy + u * o.uy + v * o.ux;
    if (signedDist(x, y, pts) < -1) items.push([x, y]);
  }
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(2, 0.06, 1.6), mat, items.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, Math.atan2(o.uy, o.ux), 0, 'YXZ'));
  items.forEach(([x, y], i) => mesh.setMatrixAt(i, m.compose(new THREE.Vector3(x, roofZ + 0.6, -y), q, new THREE.Vector3(1, 1, 1))));
  return mesh;
}

/** 옥상 가장자리 금속 난간 (기둥 + 위쪽 가로대) */
function roofRailing(pts, z) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x9aa1a8, roughness: 0.4, metalness: 0.6 }), g = new THREE.Group();
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length], len = Math.hypot(bx - ax, by - ay);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.05), mat);
    rail.position.set((ax + bx) / 2, z + 1.1, -(ay + by) / 2); rail.rotation.y = Math.atan2(by - ay, bx - ax); g.add(rail);
    for (let t = 0; t < len; t += 1.5) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.1, 0.04), mat);
      post.position.set(ax + (bx - ax) * t / len, z + 0.55, -(ay + (by - ay) * t / len)); g.add(post);
    }
  }
  return g;
}
