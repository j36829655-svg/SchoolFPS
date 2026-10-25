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
  // 칼: 모두 기본으로 가진다. 탄약 없이 가까이(range m) 휘두른다
  { id: 'knife', name: '전술 칼', kind: '근접', mode: 'melee', melee: true, dmg: 55, rpm: 110, mag: 0, reserve: 0, reload: 0, spread: 0, recoil: 0, range: 2.3, falloff: 1, head: 1.5, ads: 75, flash: 0, m: { knife: true }, snd: [0, 0, 0, 0] },
];
export const WEAPON = Object.fromEntries(WEAPONS.map((w, i) => [w.id, { ...w, slot: i }]));
export const LOADOUT = 2; // 시작할 때 고르는 총 수
export const SLOT_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'KeyV'];

/* 몬스터 — 각자 역할이 다르다
   attack: melee(할퀴기) leap(도약) slam(내려찍기 범위) dive(급강하) spit(멀리서 침 뱉기) explode(자폭 범위)
   hp·dmg·speed(m/s)·range(공격 거리)·cd(공격 주기)·windup(예고 동작 시간, 이 동안 피할 수 있다)
   rush: 사람을 보면 이 배율로 빨라진다 · from: 처음 나오는 라운드 · share: 무리 속 비중(좀비는 나머지)
   hits: 맞는 부위 [높이, 반지름, 머리?] — 박쥐는 몸 중심 기준 · drop: 보급 상자 떨어뜨릴 확률 배율 */
export const MONSTERS = {
  // 기본 무리. 느리지만 많다
  zombie: { name: '좀비', attack: 'melee', hp: 70, speed: 3.0, dmg: 12, range: 1.6, cd: 1.1, windup: 0.4, score: 100, radius: 0.35, drop: 1, from: 1,
    hits: [[1.72, 0.22, true], [1.18, 0.4], [0.55, 0.32]] },
  // 빠르고 약하다. 멀리서 달려와 빈틈을 노린다
  runner: { name: '질주 좀비', attack: 'melee', hp: 40, speed: 5.6, dmg: 9, range: 1.5, cd: 0.8, windup: 0.25, score: 120, radius: 0.32, drop: 0.7, from: 1, share: 0.22,
    hits: [[1.66, 0.21, true], [1.12, 0.36], [0.52, 0.3]] },
  // 사람을 보면 두 배 가까이 빨라져 덮치고, 몸을 낮췄다가 뛰어오른다
  spider: { name: '거대 거미', attack: 'leap', hp: 55, speed: 6.0, rush: 1.9, dmg: 16, range: 1.4, cd: 2.2, windup: 0.55, leap: 9, leapSpeed: 14, score: 150, radius: 0.6, drop: 1.2, from: 1, share: 0.16,
    hits: [[0.78, 0.26, true], [0.6, 0.6]] },
  // 공중에서 맴돌다 급강하
  bat: { name: '거대 박쥐', attack: 'dive', hp: 40, speed: 9.0, dmg: 14, range: 1.7, cd: 2.4, windup: 0.65, alt: 7, orbit: 9, dive: 18, score: 175, radius: 0.5, drop: 0.8, from: 1, share: 0.13,
    hits: [[0.18, 0.4, true], [0, 0.75]] },
  // 셋이 무리 지어 다니며 짧게 물어뜯는다
  hound: { name: '좀비 개', attack: 'leap', hp: 38, speed: 7.2, rush: 1.15, dmg: 10, range: 1.3, cd: 1.3, windup: 0.3, leap: 4.5, leapSpeed: 12, score: 130, radius: 0.4, drop: 0.6, from: 1, share: 0.18, pack: 3,
    hits: [[0.75, 0.2, true], [0.55, 0.38]] },
  // 거리를 두고 산성 침을 던진다. 날아오는 침은 피할 수 있다
  spitter: { name: '독 뱉는 좀비', attack: 'spit', hp: 55, speed: 3.4, dmg: 14, range: 20, keep: 11, cd: 2.4, windup: 0.6, shot: 15, score: 170, radius: 0.36, drop: 1, from: 1, share: 0.12,
    hits: [[1.7, 0.22, true], [1.15, 0.4], [0.55, 0.32]] },
  // 다가와서 부풀어 오르다 터진다. 총으로 먼저 터뜨리면 주변 몬스터도 휘말린다
  bomber: { name: '자폭 좀비', attack: 'explode', hp: 90, speed: 3.6, dmg: 40, range: 2.2, aoe: 4.5, cd: 0, windup: 0.9, score: 160, radius: 0.48, drop: 0.8, from: 1, share: 0.09,
    hits: [[1.75, 0.24, true], [1.15, 0.55], [0.55, 0.36]] },
  // 보스. 느리지만 표시된 원 안을 크게 내려찍는다
  giant: { name: '거인', attack: 'slam', hp: 1200, speed: 2.1, dmg: 38, range: 3.6, cd: 2.6, windup: 1.1, aoe: 4.2, score: 1200, radius: 0.95, drop: 5, boss: true, scale: 2.3,
    hits: [[3.95, 0.5, true], [2.7, 0.95], [1.3, 0.75]] },
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
  scale: r => ({ hp: 1 + 0.1 * (r - 1), dmg: 1 + 0.05 * (r - 1), speed: 1 + Math.min(0.35, 0.03 * (r - 1)), cd: Math.max(0.6, 1 - 0.03 * (r - 1)), windup: Math.max(0.75, 1 - 0.02 * (r - 1)) }),
};

/** 라운드 r의 출현 목록 (종류 이름 배열, 나오는 순서대로) */
export function roundPlan(r, diff, players = 1) {
  const n = Math.round((6 + 3 * r) * diff.count * (1 + 0.6 * (players - 1)));
  const boss = r >= ROUND.bossEvery && r % ROUND.bossEvery === 0;
  // 나올 수 있는 특수 몬스터 비중 (난이도 special 배율). 라운드마다 한 종류가 주력이 된다
  const specials = Object.entries(MONSTERS).filter(([k, d]) => d.share && r >= d.from);
  const theme = specials.length ? specials[r % specials.length][0] : null;
  const counts = {}; let used = 0;
  for (const [k, d] of specials) {
    const c = Math.round(n * Math.min(0.35, d.share * diff.special * (k === theme ? 1.7 : 1) * (1 + 0.04 * (r - d.from))));
    counts[k] = d.pack ? Math.max(d.pack, Math.round(c / d.pack) * d.pack) : c; used += counts[k];
  }
  if (used > n * 0.7) { // 특수 몬스터는 많아도 70%까지: 좀비 무리가 기본
    const k = n * 0.7 / used; used = 0;
    for (const [s, c] of Object.entries(counts)) { const g = MONSTERS[s].pack ?? 1; counts[s] = Math.round(c * k / g) * g; used += counts[s]; }
  }
  const out = [];
  for (let i = 0; i < Math.max(3, Math.round((n - used) * (boss ? 0.6 : 1))); i++) out.push('zombie');
  for (const [k, c] of Object.entries(counts)) {
    const g = MONSTERS[k].pack ?? 1; // 개는 셋씩 붙어서 나온다
    for (let i = 0; i < c; i += g) out.splice(Math.floor(Math.random() * (out.length + 1)), 0, ...Array(Math.min(g, c - i)).fill(k));
  }
  let giant = 0;
  if (boss) giant = 1 + Math.floor((r - ROUND.bossEvery) / (ROUND.bossEvery * 2)) + (players > 2 ? 1 : 0);
  else if (r >= 8 && r % 4 === 0) giant = 1; // 보스전이 아니어도 가끔 거인이 섞인다
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
