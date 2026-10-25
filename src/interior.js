import { signedDist } from './terrain.js';

// 건물 내부: 출입문, 층 높이, 계단 배치를 한 번 계산해 Blender(모양)와 게임(충돌·바닥 높이)이 같이 쓴다.
// 계단은 두 줄 왕복식: 짝수 층 계단은 A줄(v0~vm)에서 +u 방향, 홀수 층 계단은 B줄(vm~v1)에서 -u 방향으로 오른다.
export const T = 0.3;              // 벽 두께
const LANE = 1.2, LANDING = 0.9, SLOPE = 0.6;
export const INTERIORS = [];

/** 건물 사양(BUILDING_SPECS 항목) → 내부 배치. 너무 작은 건물은 null (통째로 막힌 채 둔다)
 *  others: 다른 건물·구조물 외곽선 (문 앞이 막히지 않게) */
export function planInterior(spec, others = []) {
  const { pts, ground, floors, obb: o } = spec;
  if (Math.min(o.L, o.W) < 4) return null;
  const roofZ = ground + (spec.roofType !== 'flat' ? spec.eave : spec.h - 0.6);
  const fh = Math.max(2.6, (roofZ - ground) / floors); // build.py 의 층 높이와 같은 식
  // 출입문: 문 앞 2 m 가 다른 건물에 닿지 않는 벽 중 가장 긴 벽의 가운데, 폭 2 m
  const edges = pts.map((A, i) => { const B = pts[(i + 1) % pts.length], L = Math.hypot(B[0] - A[0], B[1] - A[1]); return { i, L, A, t: [(B[0] - A[0]) / L, (B[1] - A[1]) / L] }; })
    .filter(e => e.L >= 3).sort((a, b) => b.L - a.L);
  const clear = e => [-0.9, 0, 0.9].every(s => { const u = e.L / 2 + s, x = e.A[0] + e.t[0] * u + e.t[1] * 2, y = e.A[1] + e.t[1] * u - e.t[0] * 2; return others.every(p => p === pts || signedDist(x, y, p) > 0.6); });
  const e = edges.find(clear);
  if (!e) return null;
  const door = { edge: e.i, u0: e.L / 2 - 1, u1: e.L / 2 + 1, h: 2.3 };
  const I = { pts, ground, floors, fh, roofZ, door, stair: null, o, t: T };
  if (floors > 1) {
    // 벽 쪽 구석부터 가운데까지 차례로 넣어 보고, 계단+양끝 층계참이 건물 안에 들어가는 첫 자리를 쓴다 (ㄱ자 건물도)
    const run = fh / SLOPE, inside = (u, v) => { const [x, y] = toWorld(I, u, v); return signedDist(x, y, pts) < -(T + 0.02); };
    search: for (const uf of [1, -1, 0.5, -0.5, 0]) for (const vf of [1, -1, 0.5, -0.5, 0]) {
      const uc = uf * (o.L / 2 - T - LANDING - run / 2), vc = vf * (o.W / 2 - T - 0.05 - LANE);
      const u0 = uc - run / 2, u1 = uc + run / 2, v0 = vc - LANE, v1 = vc + LANE;
      if ([[u0 - LANDING, v0], [u0 - LANDING, v1], [u1 + LANDING, v0], [u1 + LANDING, v1], [uc, vc]].every(([u, v]) => inside(u, v))) { I.stair = { u0, u1, v0, vm: vc, v1 }; break search; }
    }
  }
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, y] of pts) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
  I.bb = [a, b, c, d];
  INTERIORS.push(I);
  return I;
}

const toWorld = (I, u, v) => [I.o.cx + u * I.o.ux - v * I.o.uy, I.o.cy + u * I.o.uy + v * I.o.ux];
const toLocal = (I, x, y) => { const dx = x - I.o.cx, dy = y - I.o.cy; return [dx * I.o.ux + dy * I.o.uy, -dx * I.o.uy + dy * I.o.ux]; };
function find(x, y) {
  for (const I of INTERIORS) if (x > I.bb[0] && x < I.bb[2] && y > I.bb[1] && y < I.bb[3] && signedDist(x, y, I.pts) < 0.05) return I; // 벽 두께·문턱까지 건물 바닥으로 본다
  return null;
}
/** k층 바닥판(k ≥ 1)의 계단 구멍: 바로 아래 계단(k-1)이 있는 줄 */
function hole(I, k, u, v) {
  const s = I.stair; if (!s || u < s.u0 || u > s.u1) return false;
  return (k - 1) % 2 === 0 ? v >= s.v0 && v <= s.vm : v >= s.vm && v <= s.v1;
}
/** k층 계단 위 높이 (그 줄 위가 아니면 null) */
function ramp(I, k, u, v) {
  const s = I.stair; if (!s || u < s.u0 || u > s.u1) return null;
  const a = k % 2 === 0;
  if (a ? v < s.v0 || v > s.vm : v < s.vm || v > s.v1) return null;
  const t = (a ? u - s.u0 : s.u1 - u) / (s.u1 - s.u0);
  return I.ground + (k + t) * I.fh;
}

/** 건물 안이면 발밑 바닥 높이 (z = 지금 발 높이, 0.65 m 이하 턱은 올라선다). z 없으면 1층. 건물 밖이면 null */
export function floorAt(x, y, z) {
  const I = find(x, y); if (!I) return null;
  let best = I.ground + 0.03;
  if (z === undefined) return best;
  const [u, v] = toLocal(I, x, y), lim = z + 0.65;
  for (let k = 1; k < I.floors; k++) { const h = I.ground + k * I.fh; if (h <= lim && h > best && !hole(I, k, u, v)) best = h; }
  for (let k = 0; k < I.floors - 1; k++) { const h = ramp(I, k, u, v); if (h !== null && h <= lim && h > best) best = h; }
  return best;
}
/** 머리 위 천장 높이 (건물 밖이면 Infinity) */
export function ceilAt(x, y, z) {
  const I = find(x, y); if (!I) return Infinity;
  const [u, v] = toLocal(I, x, y);
  let c = I.roofZ;
  for (let k = 1; k < I.floors; k++) { const h = I.ground + k * I.fh; if (h > z + 0.65 && h < c && !hole(I, k, u, v)) c = h; }
  return c;
}

/** 벽 충돌체: 벽마다 두께 T 사각형, 출입문 자리는 비운다. 반환: 사각형 목록 (길찾기용) */
export function wallColliders(I) {
  const out = [], { pts } = I;
  pts.forEach((A, i) => {
    const B = pts[(i + 1) % pts.length], L = Math.hypot(B[0] - A[0], B[1] - A[1]); if (L < 0.05) return;
    const t = [(B[0] - A[0]) / L, (B[1] - A[1]) / L], m = [-t[1], t[0]]; // m: 안쪽 (반시계 외곽선의 왼쪽)
    const segs = I.door?.edge === i ? [[0, I.door.u0], [I.door.u1, L]] : [[0, L]];
    for (const [a, b] of segs) if (b - a > 0.05)
      out.push([[A[0] + t[0] * a, A[1] + t[1] * a], [A[0] + t[0] * b, A[1] + t[1] * b], [A[0] + t[0] * b + m[0] * T, A[1] + t[1] * b + m[1] * T], [A[0] + t[0] * a + m[0] * T, A[1] + t[1] * a + m[1] * T]]);
  });
  return out;
}
/** 출입문 안팎 지점 (길찾기 격자에서 문을 열어 두는 데 쓴다) */
export function doorPoints(I) {
  const A = I.pts[I.door.edge], B = I.pts[(I.door.edge + 1) % I.pts.length], L = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const t = [(B[0] - A[0]) / L, (B[1] - A[1]) / L], u = (I.door.u0 + I.door.u1) / 2;
  return [-1.5, 0, 1.5].map(k => [A[0] + t[0] * u - t[1] * k, A[1] + t[1] * u + t[0] * k]);
}

/** 위층에 있는 목표를 쫓을 때 갈 곳: 계단 아래 → 계단 위. 같은 건물이 아니거나 계단이 없으면 null */
export function stairGoal(x, y, z, tx, ty, tz) {
  const I = find(x, y);
  if (!I?.stair || tz - z < 0.3 || find(tx, ty) !== I) return null;
  const s = I.stair, k = Math.max(0, Math.min(I.floors - 2, Math.floor((z - I.ground + 0.2) / I.fh))), a = k % 2 === 0;
  const [u, v] = toLocal(I, x, y), lane = a ? (s.v0 + s.vm) / 2 : (s.vm + s.v1) / 2;
  const bu = a ? s.u0 - 0.5 : s.u1 + 0.5;
  const onRamp = ramp(I, k, u, v) !== null && z > I.ground + k * I.fh + 0.15;
  if (!onRamp && tz - z < 1.5) return null; // 같은 층이면 그냥 쫓는다
  const on = onRamp || Math.hypot(u - bu, v - lane) < 0.8; // 계단 위이거나 바로 앞이면 꼭대기로
  return toWorld(I, on ? (a ? s.u1 + 0.7 : s.u0 - 0.7) : bu, lane);
}
