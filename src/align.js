import { CAMPUS } from './data/campus.js';
import { TREES } from './data/trees.js';
import * as D from './data/details.js';
import { VW_BUILDINGS } from './data/vworld_buildings.js';

// 위성사진으로 측정한 좌표를 브이월드 측량 좌표(실제 위치)에 맞추는 보정.
// 건물 30동을 브이월드 건물과 짝지어 최소제곱으로 구함: 실제 = 측정 × S + (TX, TY), 평균 오차 2.8m
export const ALIGN = { s: 0.9553, tx: -1.38, ty: 2.59 };

// 측정한 건물 id → 브이월드 건물 번호 (VW_BUILDINGS 순서)
export const VW_MATCH = {
  main_west: 94, amen: 3, taecho: 23, dreamfamily: 84, gym: 60, remnant: 22, house_a: 81, house_b: 75, library: 28,
  lib_south: 88, mid_n: 40, shalom: 90, girls_dorm: 89, se_long: 92, small_mid: 87, sarang: 32, somang: 24, mideum: 33,
  kinder: 96, ire1: 8, ire2: 6, ire3: 15, nw1: 26, nw2: 21, nw3: 82, nw4: 37, nw5: 30, west_house1: 83, west_house2: 63, red_house: 53,
};

// 로드뷰로 층수를 직접 확인한 건물 (브이월드 층수보다 우선)
const SEEN = new Set(['amen', 'taecho', 'house_b', 'remnant', 'library', 'lib_south', 'mid_n', 'shalom', 'sarang', 'somang', 'mideum', 'kinder', 'girls_dorm']);

let done = false;
/** 모든 데이터 좌표를 실제 좌표로 한 번만 변환한다 */
export function applyAlignment() {
  if (done) return; done = true;
  const { s, tx, ty } = ALIGN;
  const P = p => { p[0] = +(p[0] * s + tx).toFixed(2); p[1] = +(p[1] * s + ty).toFixed(2); };
  const pts = list => list.forEach(P);

  for (const b of CAMPUS.buildings) pts(b.pts);
  for (const g of CAMPUS.greenhouses) pts(g.pts);
  for (const g of CAMPUS.grounds) pts(g.pts);
  for (const r of CAMPUS.roads) pts(r.pts);
  P(CAMPUS.amphitheater.center); CAMPUS.amphitheater.r *= s;
  const [x0, y0, x1, y1] = CAMPUS.bounds;
  CAMPUS.bounds = [x0 * s + tx, y0 * s + ty, x1 * s + tx, y1 * s + ty];
  for (const t of TREES) P(t);

  for (const p of D.PARTS) pts(p.pts);
  for (const p of D.PAVINGS) pts(p.pts);
  for (const p of D.SIDEWALKS) pts(p.pts);
  for (const line of [...D.HEDGES, ...D.GUARDRAILS, ...D.AZALEA_ROADS, ...D.BRICK_WALLS]) pts(line);
  for (const p of D.PROPS) { const q = [p[1], p[2]]; P(q); p[1] = q[0]; p[2] = q[1]; }
  for (const c of D.CARS) P(c);
  for (const b of D.SHRUB_BALLS) P(b);

  // 짝지은 건물은 외곽선을 브이월드 측량값으로 교체 (층수는 로드뷰로 확인 못 한 건물만 브이월드 값 사용)
  for (const b of CAMPUS.buildings) {
    const i = VW_MATCH[b.id];
    if (i === undefined) continue;
    const [floors, , vpts] = VW_BUILDINGS[i];
    b.pts = vpts.map(p => [...p]);
    b.vw = i;
    if (!SEEN.has(b.id) && floors > 0 && floors !== b.floors) { b.h = b.h / Math.max(1, b.floors) * floors; b.floors = floors; }
  }
}
