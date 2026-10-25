// 게임 밸런스 수치는 전부 여기서 고친다: 총기, 몬스터, 난이도, 라운드, 보급.

/* 총기
   mode: semi(단발) auto(연사) burst(점사) pump(펌프)
   spread: 허리 사격 퍼짐(라디안), ads: 조준 시 시야각, recoil: 한 발당 위로 튀는 정도(라디안)
   range: 이 거리까지 피해 100%, 그 뒤로 2배 거리에서 falloff 배율까지 줄어든다
   reserve: 처음 예비 탄약 (최대치는 2배), head: 헤드샷 배율
   m: 1인칭 모델 모양 (gunmodel.js), snd: [음색 주파수, 울림 길이(초), 크기, 저음 주파수] */
export const WEAPONS = [
  { id: 'glock', name: 'Glock 17', kind: '권총', mode: 'semi', dmg: 25, rpm: 350, mag: 17, reserve: 85, reload: 1.4, spread: 0.014, recoil: 0.014, range: 40, falloff: 0.5, head: 2, ads: 62, flash: 0.12,
    m: { pistol: true, L: 0.19, H: 0.034, slideH: 0.03, col: 0x232528, col2: 0x2e3135, sight: 'iron' }, snd: [3400, 0.11, 0.55, 150] },
  { id: 'deagle', name: 'Desert Eagle', kind: '권총', mode: 'semi', dmg: 65, rpm: 200, mag: 7, reserve: 35, reload: 1.9, spread: 0.02, recoil: 0.05, range: 55, falloff: 0.5, head: 2, ads: 60, flash: 0.2,
    m: { pistol: true, L: 0.26, H: 0.04, slideH: 0.036, col: 0x9ea3a8, col2: 0x2a2a2a, sight: 'iron' }, snd: [2300, 0.22, 0.85, 90] },
  { id: 'mp5', name: 'MP5', kind: '기관단총', mode: 'auto', dmg: 22, rpm: 800, mag: 30, reserve: 150, reload: 2.0, spread: 0.022, recoil: 0.008, range: 40, falloff: 0.45, head: 2, ads: 58, flash: 0.1,
    m: { L: 0.24, H: 0.058, rear: 0.07, barrel: [0.07, 0.011], hg: [0.13, 0.05, 'round'], mag: ['curved', 0.2], stock: 'fold', sight: 'red', col: 0x1f2124 }, snd: [2800, 0.08, 0.45, 140] },
  { id: 'ump45', name: 'UMP45', kind: '기관단총', mode: 'auto', dmg: 30, rpm: 600, mag: 25, reserve: 125, reload: 2.2, spread: 0.024, recoil: 0.012, range: 45, falloff: 0.45, head: 2, ads: 56, flash: 0.12,
    m: { L: 0.3, H: 0.072, rear: 0.08, barrel: [0.05, 0.012], hg: [0.08, 0.06, 'box'], mag: ['straight', 0.18], stock: 'skeleton', sight: 'red', col: 0x2b2d2f }, snd: [2400, 0.1, 0.55, 120] },
  { id: 'p90', name: 'P90', kind: '기관단총', mode: 'auto', dmg: 20, rpm: 900, mag: 50, reserve: 200, reload: 2.6, spread: 0.024, recoil: 0.007, range: 40, falloff: 0.45, head: 2, ads: 56, flash: 0.1,
    m: { bullpup: true, L: 0.48, H: 0.085, rear: 0.2, barrel: [0.06, 0.011], mag: ['top', 0.3], sight: 'red', col: 0x3a3c36 }, snd: [3000, 0.07, 0.42, 160] },
  { id: 'ak47', name: 'AK-47', kind: '돌격소총', mode: 'auto', dmg: 35, rpm: 600, mag: 30, reserve: 120, reload: 2.5, spread: 0.03, recoil: 0.022, range: 80, falloff: 0.55, head: 2, ads: 52, flash: 0.18,
    m: { L: 0.3, H: 0.06, rear: 0.09, barrel: [0.3, 0.011], hg: [0.2, 0.052, 'wood'], mag: ['curved', 0.25], stock: 'wood', sight: 'red', col: 0x2a2b2d, col2: 0x7a4a28 }, snd: [1900, 0.16, 0.8, 90] },
  { id: 'm4a1', name: 'M4A1', kind: '돌격소총', mode: 'auto', dmg: 28, rpm: 750, mag: 30, reserve: 150, reload: 2.2, spread: 0.02, recoil: 0.013, range: 85, falloff: 0.55, head: 2, ads: 50, flash: 0.15,
    m: { L: 0.25, H: 0.062, rear: 0.08, barrel: [0.26, 0.01], hg: [0.2, 0.056, 'rail'], mag: ['straight', 0.2], stock: 'tube', sight: 'red', col: 0x1c1d1f }, snd: [2300, 0.13, 0.7, 110] },
  { id: 'scarh', name: 'SCAR-H', kind: '전투소총', mode: 'auto', dmg: 45, rpm: 550, mag: 20, reserve: 100, reload: 2.6, spread: 0.024, recoil: 0.028, range: 100, falloff: 0.6, head: 2, ads: 48, flash: 0.2,
    m: { L: 0.36, H: 0.07, rear: 0.09, barrel: [0.22, 0.012], hg: [0.16, 0.06, 'rail'], mag: ['straight', 0.15], stock: 'solid', sight: 'red', col: 0xb39a6c, col2: 0x2a2a2a }, snd: [1700, 0.2, 0.9, 80] },
  { id: 'famas', name: 'FAMAS', kind: '돌격소총', mode: 'burst', burst: 3, burstDelay: 0.32, dmg: 27, rpm: 900, mag: 25, reserve: 125, reload: 2.4, spread: 0.016, recoil: 0.011, range: 80, falloff: 0.55, head: 2, ads: 50, flash: 0.14,
    m: { bullpup: true, L: 0.5, H: 0.075, rear: 0.24, barrel: [0.14, 0.01], mag: ['bullpup', 0.17], sight: 'red', col: 0x2b2e2b }, snd: [2500, 0.12, 0.65, 110] },
  { id: 'r870', name: 'Remington 870', kind: '산탄총', mode: 'pump', pellets: 8, dmg: 15, rpm: 60, mag: 8, reserve: 32, reload: 0.5, shell: true, spread: 0.075, adsSpread: 0.055, recoil: 0.06, range: 14, falloff: 0.15, head: 1.5, ads: 60, flash: 0.28,
    m: { L: 0.2, H: 0.06, rear: 0.07, barrel: [0.5, 0.011], mag: ['tube', 0.42], pump: true, stock: 'wood', sight: 'red', col: 0x1d1d1e, col2: 0x6b3f22 }, snd: [1300, 0.35, 1, 65] },
  { id: 'svd', name: 'SVD', kind: '저격소총', mode: 'semi', dmg: 100, rpm: 120, mag: 10, reserve: 40, reload: 2.8, spread: 0.035, adsSpread: 0.0004, recoil: 0.055, range: 220, falloff: 0.7, head: 2.5, ads: 22, scope: true, flash: 0.2,
    m: { L: 0.28, H: 0.06, rear: 0.09, barrel: [0.5, 0.009], hg: [0.2, 0.05, 'wood'], mag: ['straight', 0.12], stock: 'thumb', sight: 'scope', col: 0x26282a, col2: 0x7a4a28 }, snd: [1600, 0.45, 1, 70] },
  { id: 'm249', name: 'M249', kind: '경기관총', mode: 'auto', dmg: 25, rpm: 750, mag: 100, reserve: 200, reload: 4.5, spread: 0.034, recoil: 0.011, range: 75, falloff: 0.55, head: 2, ads: 55, flash: 0.18, moveMul: 0.85,
    m: { L: 0.34, H: 0.09, rear: 0.09, barrel: [0.38, 0.014], hg: [0.16, 0.07, 'shield'], mag: ['box', 0.12], stock: 'solid', sight: 'red', bipod: true, col: 0x262729 }, snd: [2000, 0.13, 0.75, 95] },
];
export const WEAPON = Object.fromEntries(WEAPONS.map((w, i) => [w.id, { ...w, slot: i }]));
export const LOADOUT = 2; // 시작할 때 고르는 총 수
export const SLOT_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'];

/* 몬스터
   hp·dmg·speed(m/s)·range(공격 거리)·cd(공격 주기)·windup(예고 동작 시간, 이 동안 피할 수 있다)
   hits: 맞는 부위 [높이, 반지름, 머리?] — 박쥐는 몸 중심 기준
   drop: 보급 상자 떨어뜨릴 확률 배율 */
export const MONSTERS = {
  zombie: { name: '좀비', hp: 70, speed: 2.4, dmg: 12, range: 1.6, cd: 1.2, windup: 0.4, score: 100, radius: 0.35, drop: 1,
    hits: [[1.72, 0.22, true], [1.18, 0.4], [0.55, 0.32]] },
  spider: { name: '거대 거미', hp: 55, speed: 5.6, dmg: 16, range: 1.4, cd: 2.4, windup: 0.6, leap: 9, leapSpeed: 13, score: 150, radius: 0.6, drop: 1.2,
    hits: [[0.78, 0.26, true], [0.6, 0.6]] },
  giant: { name: '거인', hp: 1200, speed: 1.6, dmg: 38, range: 3.6, cd: 2.8, windup: 1.2, aoe: 4.2, score: 1200, radius: 0.95, drop: 5, boss: true, scale: 2.3,
    hits: [[3.95, 0.5, true], [2.7, 0.95], [1.3, 0.75]] },
  bat: { name: '거대 박쥐', hp: 40, speed: 7.5, dmg: 14, range: 1.7, cd: 2.6, windup: 0.7, alt: 7, orbit: 9, dive: 16, score: 175, radius: 0.5, drop: 0.8,
    hits: [[0.18, 0.4, true], [0, 0.75]] },
};
export const KINDS = Object.keys(MONSTERS);

/* 난이도: 적 체력·공격력·출현량, 특수 몬스터 비중, 보급량, 처치 시 보급 상자 확률, 점수 배율 */
export const DIFFICULTY = {
  easy:   { name: '쉬움',   hp: 0.7,  dmg: 0.6, count: 0.7, special: 0.7,  supply: 1.6, drop: 0.22, score: 0.8 },
  normal: { name: '보통',   hp: 1,    dmg: 1,   count: 1,   special: 1,    supply: 1,   drop: 0.14, score: 1 },
  hard:   { name: '어려움', hp: 1.35, dmg: 1.4, count: 1.3, special: 1.45, supply: 0.6, drop: 0.08, score: 1.5 },
};

/* 라운드 */
export const ROUND = {
  prep: 10,          // 첫 라운드 전 준비 시간(초)
  rest: 15,          // 라운드 사이 정비 시간(초)
  bossEvery: 5,      // 5, 10, 15… 라운드는 거인 보스전
  maxAlive: 40,      // 동시에 나와 있는 최대 몬스터 수
  startGuns: ['glock', 'mp5'],
  unlock: ['ump45', 'r870', 'ak47', 'm4a1', 'deagle', 'p90', 'famas', 'scarh', 'svd', 'm249'], // 라운드를 깰 때마다 하나씩
  clearBonus: r => 250 * r,
  /** 라운드가 오를수록 강해지는 정도 (체력만이 아니라 속도, 공격 주기, 예고 시간도) */
  scale: r => ({ hp: 1 + 0.1 * (r - 1), dmg: 1 + 0.05 * (r - 1), speed: 1 + Math.min(0.25, 0.025 * (r - 1)), cd: Math.max(0.6, 1 - 0.03 * (r - 1)), windup: Math.max(0.75, 1 - 0.02 * (r - 1)) }),
};

/** 라운드 r의 출현 목록 (종류 이름 배열, 나오는 순서대로) */
export function roundPlan(r, diff, players = 1) {
  const n = Math.round((6 + 3 * r) * diff.count * (1 + 0.6 * (players - 1)));
  const out = [];
  const boss = r >= ROUND.bossEvery && r % ROUND.bossEvery === 0;
  let spider = 0, bat = 0, giant = 0;
  if (r >= 3 && r <= 4) { const s = Math.round(n * 0.25 * diff.special); spider = r === 3 ? Math.ceil(s * 0.7) : Math.floor(s * 0.4); bat = s - spider; }
  else if (r >= 5) {
    const share = Math.min(0.6, (0.25 + 0.03 * (r - 5)) * diff.special), s = Math.round(n * share);
    // 라운드마다 주력 조합이 바뀐다: 거미 떼 → 박쥐 떼 → 섞인 무리
    const theme = r % 3, sp = theme === 0 ? 0.75 : theme === 1 ? 0.25 : 0.5;
    spider = Math.round(s * sp); bat = s - spider;
  }
  if (boss) giant = 1 + Math.floor((r - ROUND.bossEvery) / (ROUND.bossEvery * 2)) + (players > 2 ? 1 : 0);
  else if (r >= 8 && r % 4 === 0) giant = 1; // 보스전이 아니어도 가끔 거인이 섞인다
  const zombies = Math.max(3, Math.round((n - spider - bat) * (boss ? 0.6 : 1)));
  for (let i = 0; i < zombies; i++) out.push('zombie');
  for (let i = 0; i < spider; i++) out.splice(Math.floor(Math.random() * (out.length + 1)), 0, 'spider');
  for (let i = 0; i < bat; i++) out.splice(Math.floor(Math.random() * (out.length + 1)), 0, 'bat');
  for (let i = 0; i < giant; i++) out.splice(Math.floor(out.length * (0.25 + 0.4 * i / giant)), 0, 'giant'); // 거인은 라운드 초반 이후
  return out;
}

/* 보급: 탄약 상자(지금 무기 +2탄창, 나머지 +1탄창), 구급 상자 */
export const PICKUPS = {
  ammo: { name: '탄약 상자', mags: 2, others: 1 },
  health: { name: '구급 상자', heal: 35 },
  perRest: 2,        // 정비 시간마다 사람 수만큼 + 이만큼 (난이도 supply 배율)
  life: 60,          // 바닥에 남아 있는 시간(초)
};

export const PLAYER = { hp: 100, pvpGoal: 15, respawn: 3 };
