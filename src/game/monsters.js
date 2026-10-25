import * as THREE from 'three';
import { MONSTERS } from './config.js';
import { Avatar } from './avatar.js';

// 몬스터 4종: 모양(makeModel)과 행동(think).
// 상태: search(탐색) → chase(추격) → windup(공격 예고: 이때 피할 수 있다) → attack(공격) → recover(회복) → chase …
//       hit(피격 경직), dead(사망)
export const STATES = ['search', 'chase', 'windup', 'attack', 'recover', 'hit', 'dead'];

const mats = new Map();
const lam = (c, emissive = 0) => { const k = c + '|' + emissive; if (!mats.has(k)) mats.set(k, new THREE.MeshLambertMaterial({ color: c, emissive, side: THREE.DoubleSide })); return mats.get(k); };
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a });

// ───────────── 모양 ─────────────
export function makeModel(kind) {
  const root = new THREE.Group();
  const add = (geo, m, x, y, z, parent) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };

  if (kind === 'zombie' || kind === 'giant') {
    const giant = kind === 'giant';
    const shirts = [0x6b5b4b, 0x4b5b6b, 0x5b6b4b, 0x7b4b4b];
    const av = new Avatar(giant ? { zombie: true, skin: 0x6c7a52, shirt: 0x3d2f24, pants: 0x2a2420 } : { zombie: true, skin: 0x8fae7a, shirt: shirts[Math.floor(Math.random() * 4)], pants: 0x3a3a3a });
    root.add(av.root);
    let ring = null;
    if (giant) {
      av.root.scale.setScalar(MONSTERS.giant.scale);
      // 내려찍기 범위 표시 (예고 동안 점점 진해진다)
      ring = new THREE.Mesh(new THREE.RingGeometry(MONSTERS.giant.aoe - 0.35, MONSTERS.giant.aoe, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0, depthWrite: false }));
      ring.position.set(0, 0.15, -2.2); root.add(ring);
      const club = add(new THREE.CylinderGeometry(0.07, 0.12, 0.9, 8), lam(0x5a3b22), 0, -0.75, 0.1, av.armR); club.rotation.x = 0.2;
    }
    return { root, animate(dt, m) {
      const w = m.state === 'windup' ? m.wp : 0, atk = m.state === 'attack' || (m.state === 'recover' && m.st < 0.2);
      const dead = m.state === 'dead' ? Math.min(1, m.st * 2.5) : 0;
      av.animate(dt, m.state === 'dead' ? 0 : m.mv, giant ? 0 : Math.max(w, atk ? 1 : 0), dead);
      if (giant) {
        // 예고: 두 팔을 머리 위로 → 내려찍기
        if (w > 0) { av.armL.rotation.x = av.armR.rotation.x = -1.35 - 1.6 * w; av.body.rotation.x = 0.25 * w; }
        else if (atk) { av.armL.rotation.x = av.armR.rotation.x = -0.9; av.body.rotation.x = -0.35; }
        ring.material.opacity = w > 0 ? 0.25 + 0.6 * w : 0;
      } else if (w > 0) { av.armL.rotation.x = av.armR.rotation.x = -1.35 - 1.2 * w; } // 좀비: 팔을 치켜든다
      root.visible = m.state !== 'dead' || m.st < 2.4;
    } };
  }

  if (kind === 'spider') {
    const body = new THREE.Group(); root.add(body);
    const shell = lam(0x2a1f1a), hair = lam(0x3b2a20), mark = lam(0x9a1a12);
    add(new THREE.SphereGeometry(1, 14, 10).scale(0.32, 0.24, 0.38), shell, 0, 0.62, -0.25, body);
    add(new THREE.SphereGeometry(1, 14, 10).scale(0.5, 0.4, 0.6), hair, 0, 0.75, 0.48, body);
    add(new THREE.BoxGeometry(0.12, 0.02, 0.22), mark, 0, 1.14, 0.48, body);
    for (const x of [-0.09, -0.03, 0.03, 0.09]) add(new THREE.SphereGeometry(0.035, 6, 4), eyeMat, x, 0.72, -0.58, body);
    for (const x of [-0.06, 0.06]) { const f = add(new THREE.ConeGeometry(0.03, 0.14, 5), shell, x, 0.5, -0.6, body); f.rotation.x = Math.PI; }
    const upper = new THREE.BoxGeometry(0.75, 0.07, 0.07).translate(0.375, 0, 0), lower = new THREE.BoxGeometry(0.06, 1.1, 0.06).translate(0, -0.55, 0);
    const legs = [];
    for (const side of [1, -1]) for (let i = 0; i < 4; i++) {
      const hip = new THREE.Group(); hip.position.set(side * 0.22, 0.64, -0.38 + i * 0.16); hip.scale.x = side;
      const base = 0.8 - i * 0.53; hip.rotation.y = side * base; // 앞다리는 앞으로, 뒷다리는 뒤로
      const u = add(upper, hair, 0, 0, 0, hip); u.rotation.z = 0.6;
      const l = add(lower, hair, 0.62, 0.42, 0, hip); l.rotation.z = 0.35;
      body.add(hip); legs.push({ hip, side, base, i, front: i === 0 });
    }
    let phase = Math.random() * 6;
    return { root, animate(dt, m) {
      phase += dt * (3 + m.mv * 2.2);
      const w = m.state === 'windup' ? m.wp : 0, leap = m.state === 'attack', dead = m.state === 'dead';
      for (const g of legs) {
        const p = phase + g.i * 1.6 + (g.side > 0 ? 0 : Math.PI);
        g.hip.rotation.y = g.side * (g.base + (dead ? 0 : Math.sin(p) * 0.22 * Math.min(1, m.mv / 2)));
        g.hip.rotation.z = g.side * (dead ? -0.9 : leap ? 0.35 : g.front && w > 0 ? 0.7 * w : Math.max(0, Math.cos(p)) * 0.15 * Math.min(1, m.mv / 2));
      }
      body.position.y = dead ? -0.45 : -0.2 * w; // 예고: 몸을 낮추고 앞다리를 든다
      body.rotation.x = leap ? -0.25 : 0.12 * w;
      root.visible = !dead || m.st < 2.4;
    } };
  }

  // bat
  const body = new THREE.Group(); body.scale.setScalar(1.5); root.add(body); // 날개 폭 약 5 m
  const fur = lam(0x3a2f35), skin = lam(0x4a3a40);
  add(new THREE.SphereGeometry(1, 12, 8).scale(0.24, 0.22, 0.42), fur, 0, 0, 0.05, body);
  add(new THREE.SphereGeometry(0.17, 10, 8), fur, 0, 0.08, -0.38, body);
  for (const x of [-0.08, 0.08]) { add(new THREE.ConeGeometry(0.06, 0.2, 5), skin, x, 0.28, -0.38, body); add(new THREE.SphereGeometry(0.03, 6, 4), eyeMat, x * 0.8, 0.12, -0.52, body); }
  const shape = new THREE.Shape([[0, 0.12], [0.7, 0.2], [1.4, 0.12], [1.7, -0.1], [1.25, -0.25], [0.95, -0.15], [0.7, -0.4], [0.4, -0.28], [0, -0.35]].map(([x, y]) => new THREE.Vector2(x, y)));
  const wingGeo = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
  const wings = [1, -1].map(side => { const g = new THREE.Group(); g.position.set(side * 0.18, 0.05, -0.1); g.scale.x = side; add(wingGeo, skin, 0, 0, 0, g); body.add(g); return { g, side }; });
  let phase = Math.random() * 6;
  return { root, animate(dt, m) {
    const w = m.state === 'windup' ? m.wp : 0, dive = m.state === 'attack', dead = m.state === 'dead';
    phase += dt * (dead ? 0 : dive ? 4 : 13);
    const flap = dead ? -0.3 : dive ? -0.9 : w > 0 ? 0.9 * w + Math.sin(phase) * 0.15 : Math.sin(phase) * 0.75;
    for (const { g, side } of wings) g.rotation.z = flap * side;
    body.rotation.x = dive ? -0.6 : w > 0 ? 0.5 * w : 0.1;
    root.visible = !dead || m.st < 2.4;
  } };
}

// ───────────── 행동 (방장만 실행) ─────────────
/** 새 몬스터 상태. mult: 난이도·라운드 배율 { hp, dmg, speed, cd, windup } */
export function createMonster(kind, id, x, y, z, mult) {
  const d = MONSTERS[kind];
  return { id, kind, def: d, x, y, z, yaw: Math.random() * 6, hp: d.hp * mult.hp, maxHp: d.hp * mult.hp, dmg: d.dmg * mult.dmg,
    speed: d.speed * mult.speed * (0.9 + Math.random() * 0.2), cdMul: mult.cd, windMul: mult.windup,
    state: 'search', st: 0, cd: 1 + Math.random(), wp: 0, mv: 0, vx: 0, vy: 0, vz: 0, orb: Math.random() * 6, voiceT: 2 + Math.random() * 6 };
}

function setState(m, s) { m.state = s; m.st = 0; }

/** 피격: 추격·탐색 중이면 잠깐 멈칫한다 (거인은 헤드샷에만) */
export function onHit(m, head) {
  if (m.state === 'dead') return;
  if ((m.state === 'chase' || m.state === 'search') && (m.kind !== 'giant' || head)) setState(m, 'hit');
}

/** W: { players: 살아 있는 플레이어, monsters, nav, physics, groundAt, hurt(p, dmg, m), sound(kind, x, y) } */
export function think(m, dt, W) {
  const d = m.def; m.st += dt; m.cd -= dt;
  if (m.state === 'dead') { if (m.kind === 'bat') { m.vz -= 12 * dt; m.z = Math.max(W.groundAt(m.x, m.y) + 0.2, m.z + m.vz * dt); } return; }
  let t = null, td = Infinity;
  for (const p of W.players) { const dd = Math.hypot(p.x - m.x, p.y - m.y); if (dd < td) { td = dd; t = p; } }
  const flyer = m.kind === 'bat', ground = W.groundAt(m.x, m.y, flyer ? undefined : m.z);
  if (!t) { m.mv = 0; if (flyer) m.z += (ground + d.alt - m.z) * Math.min(1, dt); return; }
  const los = td < 70 && !W.physics.blocked(m.x, m.y, t.x, t.y);
  if ((m.voiceT -= dt) <= 0) { m.voiceT = 4 + Math.random() * 7; if (m.kind === 'zombie') W.sound('groan', m.x, m.y); }
  const toT = () => [(t.x - m.x) / (td || 1), (t.y - m.y) / (td || 1)];
  const toward = ([gx, gy]) => { const l = Math.hypot(gx - m.x, gy - m.y) || 1; return [(gx - m.x) / l, (gy - m.y) / l]; };
  // 목표가 같은 건물 위층이면 계단으로, 아니면 보이면 곧장·안 보이면 길찾기
  const path = () => { const sg = !flyer && W.stairGoal?.(m.x, m.y, m.z, t.x, t.y, t.z); return sg ? toward(sg) : (los && td < 14) ? toT() : (W.nav.dirAt(m.x, m.y) ?? toT()); };
  let mx = 0, my = 0, sp = 0;

  switch (m.state) {
    case 'search': // 아직 못 봤다: 냄새를 따라 천천히
      [mx, my] = path(); sp = m.speed * 0.85;
      if (los || td < 50) setState(m, 'chase');
      break;
    case 'hit':
      [mx, my] = path(); sp = m.speed * 0.15;
      if (m.st > 0.2) setState(m, 'chase');
      break;
    case 'chase': {
      if (flyer) { // 박쥐: 목표 주위를 돌다가 급강하
        m.orb += dt * 0.9;
        const gx = t.x + Math.cos(m.orb) * d.orbit, gy = t.y + Math.sin(m.orb) * d.orbit, gd = Math.hypot(gx - m.x, gy - m.y) || 1;
        if (los || td < 20) { mx = (gx - m.x) / gd; my = (gy - m.y) / gd; } else [mx, my] = path();
        sp = m.speed * Math.min(1, gd / 3 + 0.3);
      } else {
        [mx, my] = path();
        const stop = m.kind === 'spider' ? 0.9 : d.range * 0.7;
        sp = td < stop ? 0 : m.speed;
      }
      const dz = Math.abs(t.z - (flyer ? ground : m.z));
      const ready = m.cd <= 0 && los && (
        m.kind === 'zombie' ? td <= d.range && dz < 2 :
        m.kind === 'giant' ? td <= d.range :
        m.kind === 'spider' ? td <= d.leap && dz < 3 :
        td <= d.orbit + 4);
      if (ready) {
        setState(m, 'windup');
        m.aim = { x: t.x, y: t.y, z: t.z + (flyer ? 1.1 : 0), id: t.id }; // 거미·박쥐·거인은 예고 시작 때 위치를 노린다 → 움직이면 피한다
        if (m.kind === 'giant') { const k = Math.min(2.2, td); m.aim.x = m.x + (t.x - m.x) / (td || 1) * k; m.aim.y = m.y + (t.y - m.y) / (td || 1) * k; }
        W.sound({ zombie: 'groan', spider: 'hiss', giant: 'roar', bat: 'screech' }[m.kind], m.x, m.y);
      }
      break;
    }
    case 'windup': {
      const len = d.windup * m.windMul; m.wp = Math.min(1, m.st / len);
      if (m.st < len) break;
      setState(m, 'attack'); m.hitDone = false; m.wp = 0;
      if (m.kind === 'zombie') { // 앞을 할퀸다: 그 사이 사거리 밖으로 물러나면 피한다
        if (td <= d.range + 0.3 && !W.physics.blocked(m.x, m.y, t.x, t.y)) W.hurt(t, m.dmg, m);
        setState(m, 'recover');
      } else if (m.kind === 'giant') { // 표시된 원 안에 있으면 맞는다
        for (const p of W.players) if (Math.hypot(p.x - m.aim.x, p.y - m.aim.y) < d.aoe && Math.abs(p.z - m.z) < 3) W.hurt(p, m.dmg, m);
        W.sound('slam', m.x, m.y); W.shake?.(m.aim.x, m.aim.y);
        setState(m, 'recover');
      } else { // 거미 도약 · 박쥐 급강하: 노린 지점으로 곧장
        const az = flyer ? m.aim.z - m.z : 0, ad = Math.hypot(m.aim.x - m.x, m.aim.y - m.y, az) || 1, v = flyer ? d.dive : d.leapSpeed;
        m.vx = (m.aim.x - m.x) / ad * v; m.vy = (m.aim.y - m.y) / ad * v; m.vz = az / ad * v;
        m.atkLen = Math.min(ad / v + (flyer ? 0.35 : 0.15), flyer ? 1.6 : 0.95);
        m.leapZ = m.z;
      }
      break;
    }
    case 'attack': { // 도약·급강하 중
      const nx = m.x + m.vx * dt, ny = m.y + m.vy * dt, pos = { x: nx, y: ny };
      W.physics.resolve(pos, d.radius);
      const bumped = Math.hypot(pos.x - nx, pos.y - ny) > 0.01;
      m.x = pos.x; m.y = pos.y;
      const p = Math.min(1, m.st / m.atkLen), g = W.groundAt(m.x, m.y, flyer ? undefined : m.leapZ);
      if (flyer) m.z = Math.max(g + 0.7, m.z + m.vz * dt);
      else m.z = g + 4 * 1.1 * p * (1 - p);
      if (!m.hitDone) for (const pl of W.players) {
        const dz = flyer ? Math.abs(pl.z + 1.1 - m.z) : Math.abs(pl.z - g);
        if (Math.hypot(pl.x - m.x, pl.y - m.y) < d.range && dz < (flyer ? 1.4 : 1.5)) { W.hurt(pl, m.dmg, m); m.hitDone = true; break; }
      }
      m.mv = Math.hypot(m.vx, m.vy); m.yaw = Math.atan2(-m.vx, m.vy);
      if (m.st >= m.atkLen || bumped) { setState(m, 'recover'); if (!flyer) m.z = g; }
      return;
    }
    case 'recover':
      if (m.st > (m.kind === 'giant' ? 1.0 : m.kind === 'bat' ? 0.8 : 0.45)) { setState(m, 'chase'); m.cd = d.cd * m.cdMul * (0.8 + Math.random() * 0.4); }
      if (flyer) { [mx, my] = toT(); mx = -mx; my = -my; sp = m.speed * 0.5; } // 박쥐는 다시 날아오른다
      break;
  }

  // 이동: 서로 겹치지 않게 밀고, 건물·맵 경계에 막힌다
  for (const o of W.monsters) {
    if (o === m || o.state === 'dead' || (o.kind === 'bat') !== flyer) continue;
    const ox = m.x - o.x, oy = m.y - o.y, od = Math.hypot(ox, oy), min = d.radius + o.def.radius;
    if (od < min && od > 1e-4) { mx += ox / od * 0.7; my += oy / od * 0.7; if (!sp) sp = m.speed * 0.3; }
  }
  const l = Math.hypot(mx, my);
  if (l > 1e-4 && sp > 0) {
    let ux = mx / l, uy = my / l;
    if (m.detourT > 0) { // 막혀서 옆으로 비켜 가는 중
      m.detourT -= dt;
      const px = -uy * m.detour, py = ux * m.detour; ux = ux * 0.4 + px; uy = uy * 0.4 + py;
      const k = Math.hypot(ux, uy); ux /= k; uy /= k;
    }
    const pos = { x: m.x + ux * sp * dt, y: m.y + uy * sp * dt };
    W.physics.resolve(pos, d.radius);
    m.mv = Math.hypot(pos.x - m.x, pos.y - m.y) / dt; m.x = pos.x; m.y = pos.y;
  } else m.mv = 0;
  // 1초마다 진행 확인: 나무·담에 걸려 거의 못 움직였으면 옆으로 돌아간다 (번갈아 양쪽). 계속 막히면 다른 곳으로 옮긴다
  if ((m.chkT = (m.chkT ?? 1) - dt) <= 0) {
    m.chkT = 1;
    const want = m.state === 'chase' || m.state === 'search' ? sp : 0;
    if (want > 0 && m.chk && Math.hypot(m.x - m.chk[0], m.y - m.chk[1]) < want * 0.35) {
      m.detour = m.detour === 1 ? -1 : 1; m.detourT = 1 + Math.random(); m.stuckN = (m.stuckN ?? 0) + 1;
      if (m.stuckN >= 6 && td > 30 && !los) { W.relocate?.(m); m.stuckN = 0; }
    } else if (!m.detourT || m.detourT <= 0) m.stuckN = 0;
    m.chk = [m.x, m.y];
  }
  const g = W.groundAt(m.x, m.y, flyer ? undefined : m.z);
  if (flyer) { const goal = g + (m.state === 'recover' ? d.alt + 1 : d.alt + Math.sin(m.orb * 2) * 1.2); m.z += (goal - m.z) * Math.min(1, dt * 1.8); }
  else m.z = g;
  // 바라보는 방향 (yaw 0 = 북쪽)
  const fx = m.state === 'windup' && m.aim ? m.aim.x : t.x, fy = m.state === 'windup' && m.aim ? m.aim.y : t.y;
  const want = Math.atan2(-(fx - m.x), fy - m.y);
  m.yaw += Math.atan2(Math.sin(want - m.yaw), Math.cos(want - m.yaw)) * Math.min(1, dt * (m.kind === 'giant' ? 3 : 8));
}
