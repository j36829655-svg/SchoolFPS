// 로드뷰 사진을 보고 넣은 세부 요소 (단위 m, x 동쪽 / y 북쪽, 각도는 도: 0 = 동쪽, 반시계)

/** 중심 (cx, cy), 길이 L(각도 방향) × 폭 W 의 회전 사각형 꼭짓점 */
export function rect(cx, cy, L, W, deg) {
  const a = deg * Math.PI / 180, ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([s, t]) => [cx + s * ux * L / 2 + t * vx * W / 2, cy + s * uy * L / 2 + t * vy * W / 2]);
}

// 건물 값 덮어쓰기 (로드뷰에서 확인한 외관)
export const OVERRIDES = {
  amen: { style: 'ribbon' },
  taecho: { style: 'ribbon', h: 11, floors: 2, roof: '#4d5560', endGlass: true }, // 흰 2층 띠창 + 낮은 짙은 금속 아치 지붕, 끝면은 청록 유리 (로드뷰 02·03)
  main_east: { solar: true, style: 'metalband', wall: '#8e959b' },  // 회색 골강판 + 위층 유리 띠 + 색 세로창 (웹 사진 020)
  main_west: { solar: true },                                        // 항공사진에 보이는 지붕 태양광 패널
  house_b: { style: 'grid', wall: '#e6e6e2' },                       // 일반 2층 건물 (교회 탑은 남자기숙사 끝에 붙어 있음)
  remnant: { h: 8.5, floors: 2, railing: true },                     // 2층 + 3층 높이 유리 탑(아래 parts) + 옥상 난간 (로드뷰 09)
  girls_dorm: { style: 'grid', h: 17, floors: 5, wall: '#eeeeec' },  // 흰 5층 (드론 사진 131·176·184)
  // 사랑·소망·믿음동: 4층 평지붕, 긴 면은 갈색 나무 판, 도로 쪽 끝면은 콘크리트 격자 (로드뷰 15, 17, 22)
  sarang: { roofType: 'flat', h: 13.5, floors: 4, style: 'dormSide', endStyle: 'dormEnd', wall: '#b9b9b4', roof: '#7f8f7a' },
  somang: { roofType: 'flat', h: 13.5, floors: 4, style: 'dormSide', endStyle: 'dormEnd', wall: '#b9b9b4', roof: '#7f8f7a' },
  mideum: { roofType: 'flat', h: 13.5, floors: 4, style: 'dormSide', endStyle: 'dormEnd', wall: '#b9b9b4', roof: '#7f8f7a' },
  library: { h: 5.2 },
};

// 건물에 붙는 부속 덩어리. parent 건물의 터 높이에서 시작한다
export const PARTS = [
  { parent: 'remnant', pts: rect(-1, -39, 9, 8, -71.6), h: 11.5, floors: 3, roofType: 'flat', style: 'tower', wall: '#4f86c6', accent: '#9a4a2c', roof: '#d9dcdf' },
  { parent: 'remnant', pts: rect(0.6, -49.6, 6, 1.6, 45), h: 7.5, floors: 1, roofType: 'flat', style: 'rustframe', wall: '#9a4a2c', accent: '#9a4a2c', roof: '#9a4a2c' },
  { parent: 'taecho', pts: rect(-83.6, -138.6, 3.8, 3.8, 50.3), h: 9.5, floors: 2, roofType: 'flat', style: 'curtain', wall: '#d8dde2', accent: '#3f6f7f', roof: '#d9dcdf' }, // 남쪽 모서리 유리 계단실 (로드뷰 02)
  // 남자기숙사 남쪽 끝의 교회 탑: 석재 벽, 큰 가로 루버 패널, 유리 맨 위층, 캔틸레버 지붕 (웹 사진 004, 사용자 확인)
  { parent: 'main_east', pts: rect(-92.41, -74.05, 13.8, 10.2, 31.3), h: 16, floors: 4, roofType: 'flat', style: 'church', wall: '#d4d0c6', accent: '#6b7a8a', roof: '#c9cccf', canopy: true },
  { parent: 'library', pts: rect(35.5, -4, 6, 6, -53), h: 5.8, floors: 1, roofType: 'gable', style: 'cottage', wall: '#f3f1ea', accent: '#6b7a8a', roof: '#4b5057' },
  { parent: 'sarang', pts: rect(119.4, 110, 3.5, 3.5, 40), h: 14, floors: 4, roofType: 'flat', style: 'concrete', wall: '#b4b4ae', roof: '#9a9a95' },
  { parent: 'somang', pts: rect(117.4, 84.5, 3.5, 3.5, 40), h: 14, floors: 4, roofType: 'flat', style: 'concrete', wall: '#b4b4ae', roof: '#9a9a95' },
  { parent: 'mideum', pts: rect(115.3, 59.9, 3.5, 3.5, 37), h: 14, floors: 4, roofType: 'flat', style: 'concrete', wall: '#b4b4ae', roof: '#9a9a95' },
  { parent: 'girls_dorm', pts: rect(126.9, -59.2, 9.4, 4.2, -64.3), h: 17, floors: 5, roofType: 'flat', style: 'glass', wall: '#eeeeec', accent: '#4f86c6', roof: '#eef0f1' },
  { parent: 'girls_dorm', pts: rect(109.27, -78.29, 5.23, 4.19, 10), h: 19.5, floors: 5, roofType: 'flat', style: 'glass', wall: '#eeeeec', accent: '#4f86c6', roof: '#eef0f1' }, // 앞면 가운데 유리 계단 탑 (드론 사진)
];

// 바닥 포장
export const PAVINGS = [
  { kind: 'brick', pts: [[4, -45], [-4, -53], [0, -58], [10, -49], [9, -42]] },            // 렘넌트 앞 벽돌 광장
  { kind: 'gravel', pts: [[124, 55], [134, 55], [137, 100], [128, 100]] },                 // 기숙사 옆 자갈 주차장
  { kind: 'gravel', pts: [[146, 140], [158, 142], [160, 156], [150, 156]] },               // 어린이집 앞 자갈 마당
];
export const SIDEWALKS = [
  { color: '#b5654a', w: 2.2, pts: [[49, -160], [58, -142], [59, -126], [55, -117]] }, // 연못 동쪽 붉은 벽돌 보행로 → 원형 광장 (드론 사진 184)
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
// 가드레일: 도로 선을 따라 바깥쪽에 세운다 (실제 좌표). box = 이 범위 안의 도로 구간, toward/away = 어느 쪽에 세울지 기준점
export const GUARDRAILS = [
  { road: '영전1길', box: [-25, -205, 75, -140], toward: [15, -130] }, // 연못 남쪽 (로드뷰 06)
  { road: '영전1길', box: [115, -140, 165, -10], away: [80, -50] },    // 동쪽 도로 바깥 (로드뷰 07)
];
// 철쭉: 이 도로 구간 양옆에 심는다
export const AZALEA_ROADS = [{ road: '교내 도로', box: [25, -45, 100, 25] }]; // 도서관~살롬하우스 구간 양옆 (실제 좌표, 로드뷰 12·21)

// 주차된 차: [x, y, 방향(도)]
export const CARS = [
  ...[-62, -58, -54, -50, -46, -42, -38, -34, -30, -26, -22].flatMap((x, i) => [[x, -141, 90], ...(i % 3 ? [[x, -152, 270]] : []), ...(i % 2 ? [[x, -160, 90]] : [])]),
  [129, 62, 90], [129, 68, 90], [130, 80, 90], [131, 92, 90], [152, 150, 0], [156, 146, 10], [10, -40, 52],
];

// 둥글게 다듬은 관목 (로드뷰 11, 21)
export const SHRUB_BALLS = [[33, -12, 2.2], [26, -14, 1.2], [20, -12, 1.1], [48, -20, 1.0], [52, -16, 0.9], [-36, -98, 1.0], [-48, -112, 1.1], [0, -64, 1.0], [6, -60, 0.9]];
// 교내 도로 가로수 간격(m)과 경계석 (로드뷰 12, 17)
export const STREET = { road: '교내 도로', treeEvery: 0, curb: true }; // 가로수는 항공사진에서 뽑은 실제 나무를 쓴다 (0 = 인공 가로수 없음)
// 입구 길 서쪽 붉은 벽돌 담 (로드뷰 01, 02)
export const BRICK_WALLS = [[[-82, -186], [-79, -170], [-73, -152]]];
