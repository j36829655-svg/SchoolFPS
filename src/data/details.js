// 로드뷰 사진을 보고 넣은 세부 요소 (단위 m, x 동쪽 / y 북쪽, 각도는 도: 0 = 동쪽, 반시계)

/** 중심 (cx, cy), 길이 L(각도 방향) × 폭 W 의 회전 사각형 꼭짓점 */
export function rect(cx, cy, L, W, deg) {
  const a = deg * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([s, t]) => [cx + s * ux * L / 2 + t * vx * W / 2, cy + s * uy * L / 2 + t * vy * W / 2]);
}

// 건물 값 덮어쓰기 (로드뷰에서 확인한 외관)
export const OVERRIDES = {
  amen: { style: 'ribbon' },
  taecho: { style: 'ribbon', roof: '#4a9a8f', endGlass: true },      // 흰 2층 + 청록 곡면 유리 지붕, 유리 마구리
  house_b: { style: 'louver', wall: '#cfd2d4' },                     // 세로 루버가 있는 회색 2층
  remnant: { h: 8.5, floors: 2 },                                    // 2층 + 3층 높이 유리 탑(아래 parts)
  girls_dorm: { style: 'grid', wall: '#e6dcc6' },                    // 베이지 벽 + 유리 구역(parts)
};

// 건물에 붙는 부속 덩어리. parent 건물의 터 높이에서 시작한다
export const PARTS = [
  { parent: 'remnant', pts: rect(-1, -39, 9, 8, -71.6), h: 11.5, floors: 3, roofType: 'flat', style: 'tower', wall: '#4f86c6', accent: '#9a4a2c', roof: '#d9dcdf' },
  { parent: 'remnant', pts: rect(0.6, -49.6, 6, 1.6, 45), h: 7.5, floors: 1, roofType: 'flat', style: 'rustframe', wall: '#9a4a2c', accent: '#9a4a2c', roof: '#9a4a2c' },
  { parent: 'library', pts: rect(35.5, -4, 6, 6, -53), h: 5.8, floors: 1, roofType: 'gable', style: 'cottage', wall: '#f3f1ea', accent: '#6b7a8a', roof: '#4b5057' },
  { parent: 'sarang', pts: rect(119.4, 110, 3.5, 3.5, 40), h: 14, floors: 4, roofType: 'flat', style: 'concrete', wall: '#b4b4ae', roof: '#9a9a95' },
  { parent: 'somang', pts: rect(117.4, 84.5, 3.5, 3.5, 40), h: 14, floors: 4, roofType: 'flat', style: 'concrete', wall: '#b4b4ae', roof: '#9a9a95' },
  { parent: 'mideum', pts: rect(115.3, 59.9, 3.5, 3.5, 37), h: 14, floors: 4, roofType: 'flat', style: 'concrete', wall: '#b4b4ae', roof: '#9a9a95' },
  { parent: 'girls_dorm', pts: rect(121, -63, 8, 6, -38.7), h: 12, floors: 3, roofType: 'flat', style: 'glass', wall: '#e6dcc6', accent: '#4f86c6', roof: '#eef0f1' },
];

// 바닥 포장
export const PAVINGS = [
  { kind: 'brick', pts: [[4, -45], [-4, -53], [0, -58], [10, -49], [9, -42]] },            // 렘넌트 앞 벽돌 광장
  { kind: 'gravel', pts: [[124, 55], [134, 55], [137, 100], [128, 100]] },                 // 기숙사 옆 자갈 주차장
  { kind: 'gravel', pts: [[146, 140], [158, 142], [160, 156], [150, 156]] },               // 어린이집 앞 자갈 마당
];
export const SIDEWALKS = [
  { color: '#d9824a', w: 1.6, pts: [[-10, -68], [9, -44]] },                                // 렘넌트 앞 주황 보도
];

// 소품: [종류, x, y, 회전(도)]
export const PROPS = [
  ['rock', -40, -104, 30], ['booth', -44.5, -101, 20], ['signpost', -37.5, -100, 0], ['pine', -36, -103, 0],
  ['pine', -58, -138, 0], ['pine', -22, -84, 0], ['pine', 26, -160, 0], ['pine', -16, -163, 0], ['pine', 60, -12, 0],
  ['steps', 1, -50.5, -71.6], ['stoneSign', 4, -53, 20],
  ['bench', 0, -101, 180], ['bench', 22, -100, 185], ['bench', 46, -104, 200], ['bench', 56, -98, 180], ['bench', 67, -110, 270],
  ['bench', 10, -55, 220], ['bench', 44, -12, 140], ['bench', 100, -88, 0], ['bench', -30, -96, 135],
  ['table', 42, -4, 40], ['table', 39, -9.5, 40],
  ['metaseq', -4, -161, 0], ['metaseq', 0, -159, 0], ['metaseq', 4, -161.5, 0], ['metaseq', -25, -150, 0], ['metaseq', -28, -139, 0],
  ['deck', 133.1, 156.9, -57.7],
];

// 줄로 늘어선 것들
export const HEDGES = [
  [[-79, -167], [-71, -147], [-55, -124]],
  [[-72, -96], [-62, -103]],
  [[-12, -62], [4, -40]],
];
export const GUARDRAILS = [
  [[-12, -164], [63, -144]],
  [[117, -131], [141, -111], [150, -70], [144, -20]],
];
// 철쭉: 이 도로 구간 양옆에 심는다
export const AZALEA_ROADS = [[[36, -30], [68, -6], [91, 16]]];

// 주차된 차: [x, y, 방향(도)]
export const CARS = [
  ...[-62, -58, -54, -50, -46, -42, -38, -34, -30, -26, -22].flatMap((x, i) => [[x, -141, 90], ...(i % 3 ? [[x, -152, 270]] : []), ...(i % 2 ? [[x, -160, 90]] : [])]),
  [129, 62, 90], [129, 68, 90], [130, 80, 90], [131, 92, 90], [152, 150, 0], [156, 146, 10], [10, -40, 52],
];
