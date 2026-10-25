import * as THREE from 'three';
import { Avatar } from './avatar.js';
import { Arsenal, sfx, gunSound } from './weapon.js';
import { NavGrid } from './nav.js';
import { WEAPONS, WEAPON, MONSTERS, KINDS, DIFFICULTY, ROUND, roundPlan, PICKUPS, PLAYER } from './config.js';
import { makeModel, createMonster, think, onHit, STATES } from './monsters.js';
import { Minimap } from './minimap.js';
import { KEY_LABELS } from './hud.js';

// 게임 규칙: 무한 생존(혼자·협동), 페인트볼 대전(멀티). 혼자 할 때도 "방장" 코드 경로를 그대로 쓴다.
// 방장이 몬스터·체력·점수·보급을 결정하고, 각자는 자기 위치와 사격 결과를 보낸다.
const COLORS = ['#ff4fa3', '#3b82f6', '#f59e0b', '#10b981', '#a855f7', '#ef4444', '#06b6d4', '#84cc16'];
const TICK = 1 / 15;
const PVP_HITS = [[1.72, 0.22, true], [1.18, 0.4], [0.55, 0.32]];
const SURVIVE_AT = [20, -70]; // 생존 모드 시작·부활 지점 (캠퍼스 가운데)
const ALL_GUNS = WEAPONS.map(w => w.id);
const PICK_KINDS = ['ammo', 'health'];
const BLOOD = { zombie: 0x6b1a10, spider: 0x7a8a20, giant: 0x5a1010, bat: 0x6b1a10 };

export class Game {
  /** ctx: { scene, camera, physics, groundAt, teleport(x, y), bodyPos(), yaw(), pitch(), recoil(dp, dy), solids, signedDist, worldMeshes, bounds, ortho, campus } */
  constructor(ctx, hud) {
    this.ctx = ctx; this.hud = hud;
    this.arsenal = new Arsenal(ctx.camera, ctx.scene); this.arsenal.visible = false;
    this.nav = new NavGrid(ctx.bounds, ctx.solids, ctx.signedDist, ctx.physics);
    this.minimap = new Minimap(hud.mapEl, ctx.ortho, ctx.campus);
    this.ray = new THREE.Raycaster();
    this.active = false;
  }

  /** mode: 'zombie' | 'pvp', net: Net 또는 null(혼자), diff: 'easy' | 'normal' | 'hard' */
  start({ mode, net = null, name = '나', diff = 'normal' }) {
    this.stop();
    this.opts = { mode, name, diff };
    this.mode = mode; this.net = net; this.diffKey = diff; this.diff = DIFFICULTY[diff];
    this.isHost = !net || net.isHost;
    this.myId = net ? net.id : 'host';
    this.players = new Map(); this.monsters = new Map(); this.pickups = new Map();
    this.nextId = 1; this.round = 0; this.cleared = 0; this.phase = 'prep'; this.phaseT = ROUND.prep; this.queue = []; this.spawnCd = 0;
    this.msg = ''; this.msgT = 0; this.over = false; this.sendT = 0; this.navT = 0; this.now = 0; this.survive = 0; this.saved = null; this.mapT = 0;
    this.me = this.addPlayer(this.myId, name, COLORS[0]);
    this.arsenal.reset(mode === 'pvp' ? ALL_GUNS : ROUND.startGuns);
    this.arsenal.visible = true;
    this.active = true;
    this.hud.show(true); this.hud.results(null);
    if (net) {
      net.onMessage = (from, m) => this.onMessage(from, m);
      net.onLeave = id => {
        if (id === 'host' && !this.isHost) { this.onHostLeft?.(); return; }
        const p = this.players.get(id); this.removePlayer(id); this.hud.feed(`${p?.name ?? '누군가'} 나감`);
      };
      // 게임 중에 들어온 사람은 대기실을 거치지 않고 바로 같은 판으로 들어온다
      net.onJoin = id => { if (this.isHost) net.send({ t: 'start', mode: this.mode, diff: this.diffKey }, id); };
    }
    if (this.isHost) this.respawn(this.me);
  }
  /** 같은 설정으로 다시 시작 (방장만) */
  restart() { if (this.active && this.isHost) this.start({ ...this.opts, net: this.keepNet() }); }

  stop() {
    if (!this.active) return;
    for (const p of this.players.values()) if (p.avatar) this.ctx.scene.remove(p.avatar.root);
    for (const m of this.monsters.values()) this.ctx.scene.remove(m.model.root);
    for (const k of this.pickups.values()) this.ctx.scene.remove(k.mesh);
    this.net?.close(); this.net = null;
    this.active = false; this.arsenal.visible = false; this.arsenal.setFov(75);
    this.hud.show(false); this.hud.center(''); this.hud.results(null);
  }
  keepNet() { const n = this.net; this.net = null; return n; } // 다시 시작할 때 연결 유지

  addPlayer(id, name, color) {
    if (this.players.has(id)) return this.players.get(id);
    const p = { id, name, color, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, hp: PLAYER.hp, alive: true, kills: 0, deaths: 0, score: 0, speed: 0, hurtT: 0, respawnAt: 0, tx: 0, ty: 0, tz: 0 };
    if (id !== this.myId) { p.avatar = new Avatar({ shirt: new THREE.Color(color).getHex(), name }); this.ctx.scene.add(p.avatar.root); }
    this.players.set(id, p);
    return p;
  }
  removePlayer(id) { const p = this.players.get(id); if (p?.avatar) this.ctx.scene.remove(p.avatar.root); this.players.delete(id); }
  canMove() { return this.active && this.me.alive && !this.over; }
  /** 이동 속도 배율 (조준 중·무거운 총) */
  moveMul() { const d = this.arsenal.def; return (d?.moveMul ?? 1) * (1 - 0.4 * this.arsenal.aimT); }
  get zombieMode() { return this.mode === 'zombie'; }

  // ───────────── 매 프레임 ─────────────
  /** input: { trigger, aim, moving, sprint, reload, restart, board, slot, cycle } */
  update(dt, input) {
    if (!this.active) return;
    const me = this.me, pos = this.ctx.bodyPos(), A = this.arsenal;
    me.x = pos.x; me.y = pos.y; me.z = pos.z; me.yaw = this.ctx.yaw(); me.pitch = this.ctx.pitch(); me.speed = input.moving ? 4.5 : 0;
    const can = this.canMove();
    if (can && input.slot != null) A.selectSlot(input.slot);
    if (can && input.cycle) A.cycle(input.cycle);
    if (can && input.reload) A.startReload();
    if (A.update(dt, { trigger: input.trigger && can, aim: input.aim && can, moving: input.moving, sprint: input.sprint && input.moving })) this.fire(input.moving, input.sprint);
    if (A.recoil || A.recoilYaw) { this.ctx.recoil(A.recoil, A.recoilYaw); A.recoil = A.recoilYaw = 0; }

    if (this.isHost) this.hostUpdate(dt, input.restart); else this.clientUpdate(dt);
    this.animate(dt);
    this.drawHud(dt, input);
  }

  animate(dt) {
    const k = Math.min(1, dt * 12);
    for (const p of this.players.values()) {
      if (!p.avatar) continue;
      p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; p.z += (p.tz - p.z) * k;
      p.avatar.root.position.set(p.x, p.z, -p.y); p.avatar.root.rotation.y = p.yaw;
      p.deadT = p.alive ? 0 : (p.deadT ?? 0) + dt;
      p.avatar.root.visible = p.alive || p.deadT < 2;
      p.avatar.animate(dt, p.speed, 0, p.alive ? 0 : Math.min(1, p.deadT * 3));
    }
    for (const m of this.monsters.values()) {
      if (!this.isHost) { const j = Math.min(1, dt * 10); m.x += (m.tx - m.x) * j; m.y += (m.ty - m.y) * j; m.z += (m.tz - m.z) * j; m.st += dt; }
      m.model.root.position.set(m.x, m.z, -m.y); m.model.root.rotation.y = m.yaw;
      m.model.animate(dt, m);
    }
    for (const k2 of this.pickups.values()) { k2.spin = (k2.spin ?? Math.random() * 6) + dt * 1.5; k2.mesh.rotation.y = k2.spin; k2.mesh.position.set(k2.x, this.ctx.groundAt(k2.x, k2.y) + 0.35 + Math.sin(k2.spin * 2) * 0.08, -k2.y); }
  }

  drawHud(dt, input) {
    const me = this.me, A = this.arsenal, d = A.def, c = A.cur, hud = this.hud;
    hud.health(me.hp, PLAYER.hp);
    let status = '';
    if (A.reloading > 0) status = '재장전 중…';
    else if (c.ammo === 0 && c.reserve === 0) status = A.owned.length > 1 ? '탄약 없음 — 숫자 키로 무기 교체' : '탄약 없음';
    else if (c.ammo === 0) status = 'R: 재장전';
    else if (c.ammo <= d.mag * 0.25) status = '탄약 부족';
    if (status && status !== this.lastStatus && status !== '재장전 중…') hud.note(status, 1200);
    this.lastStatus = status;
    hud.weapon({ name: d.name, kind: d.kind, ammo: c.ammo, reserve: c.reserve, status, owned: A.owned.map(id => WEAPON[id].slot), cur: d.slot });
    const fov = this.ctx.camera.fov * Math.PI / 180, gap = Math.tan(A.spread(input.moving, input.sprint)) / Math.tan(fov / 2) * innerHeight / 2;
    hud.cross(gap, this.canMove(), A.scoped);
    hud.stats(this.zombieMode ? `킬 ${me.kills}<br>점수 ${me.score.toLocaleString()}` : `킬 ${me.kills} · 데스 ${me.deaths}`);
    hud.board([...this.players.values()].sort((a, b) => b.score - a.score || b.kills - a.kills), input.board, this.zombieMode);
    // 위쪽: 라운드·남은 적 / 대전 점수
    if (this.zombieMode) {
      const left = this.enemyCount(), t = Math.ceil(this.phaseT);
      hud.top(this.phase === 'prep' ? `준비 시간 ${t}초 · ${this.diff.name}` : this.phase === 'rest' ? `라운드 ${this.round} 클리어 · 정비 시간 ${t}초` : `라운드 ${this.round} · 남은 적 ${left}`);
      const boss = [...this.monsters.values()].find(m => m.kind === 'giant' && m.state !== 'dead');
      hud.boss(boss ? MONSTERS.giant.name : null, boss ? (boss.hpFrac ?? boss.hp / boss.maxHp) : 0);
    } else { hud.top(`페인트볼 대전 · ${PLAYER.pvpGoal}킬 먼저`); hud.boss(null); }
    hud.center(!me.alive && !this.over ? `쓰러졌어요\n${this.zombieMode ? '다음 라운드에 복귀' : '잠시 후 다시 등장'}` : this.over && this.zombieMode ? '' : this.msg);
    if (this.over && this.zombieMode) hud.results(this.result()); else hud.results(null);
    // 미니맵 (초당 10번)
    if ((this.mapT -= dt) <= 0) {
      this.mapT = 0.1;
      const dots = [];
      for (const k of this.pickups.values()) dots.push({ x: k.x, y: k.y, color: k.kind === 'ammo' ? '#facc15' : '#4ade80', r: 2.5 });
      for (const m of this.monsters.values()) if (m.state !== 'dead') dots.push({ x: m.x, y: m.y, color: { zombie: '#ef4444', spider: '#fb923c', giant: '#dc2626', bat: '#c084fc' }[m.kind], r: m.kind === 'giant' ? 6 : 3 });
      for (const p of this.players.values()) if (p !== me && p.alive) dots.push({ x: p.x, y: p.y, color: p.color, r: 4 });
      this.minimap.draw(me, dots);
    }
  }

  enemyCount() { if (!this.isHost) return this.left ?? 0; let n = this.queue.length; for (const m of this.monsters.values()) if (m.state !== 'dead') n++; return n; }

  /** 게임 오버 결과 (최고 기록은 이 브라우저에 저장) */
  result() {
    if (!this.saved) {
      let all = {}; try { all = JSON.parse(localStorage.getItem('cfps-best') || '{}'); } catch {}
      const prev = all[this.diffKey] ?? { score: 0, round: 0 }, isNew = this.me.score > prev.score;
      const best = isNew ? { score: this.me.score, round: this.round } : prev;
      if (isNew) { all[this.diffKey] = best; try { localStorage.setItem('cfps-best', JSON.stringify(all)); } catch {} }
      this.saved = { best, isNew };
    }
    return { round: this.round, kills: this.me.kills, score: this.me.score, time: this.survive, diff: this.diff.name, host: this.isHost, ...this.saved };
  }

  // ───────────── 사격 ─────────────
  fire(moving, sprint) {
    const A = this.arsenal, d = A.def, maxD = Math.min(400, d.range * 3), muzzle = A.muzzleWorld(), hits = new Map();
    let firstEnd = null;
    for (const { origin, dir } of A.rays(moving, sprint)) {
      let best = maxD, hit = null, point = null, normal = new THREE.Vector3(0, 1, 0);
      this.ray.set(origin, dir); this.ray.far = maxD;
      const w = this.ray.intersectObjects(this.ctx.worldMeshes, false)[0];
      if (w) { best = w.distance; point = w.point; if (w.face) normal = w.face.normal.clone().transformDirection(w.object.matrixWorld); }
      // 지형: 광선을 따라 내려가며 땅 높이와 비교
      for (let t = 0.5; t < best; t += t < 30 ? 0.5 : 1.5) {
        const x = origin.x + dir.x * t, y = -(origin.z + dir.z * t), h = origin.y + dir.y * t;
        if (h < this.ctx.groundAt(x, y)) { best = t; point = origin.clone().addScaledVector(dir, t); normal.set(0, 1, 0); break; }
      }
      const targets = [];
      for (const m of this.monsters.values()) if (m.state !== 'dead') targets.push(['m' + m.id, m, m.def.hits, m.kind]);
      if (this.mode === 'pvp') for (const p of this.players.values()) if (p.id !== this.myId && p.alive) targets.push(['p' + p.id, p, PVP_HITS, 'player']);
      for (const [key, t, spheres, kind] of targets) {
        for (const [h, r, head] of spheres) {
          const c = new THREE.Vector3(t.x, t.z + h, -t.y), dist = sphere(origin, dir, c, r);
          if (dist !== null && dist < best) { best = dist; hit = { key, head: !!head, kind }; point = origin.clone().addScaledVector(dir, dist); normal = dir.clone().negate(); }
        }
      }
      const end = point ?? origin.clone().addScaledVector(dir, maxD);
      firstEnd ??= end;
      if (d.pellets || Math.random() < 0.6) A.fx.tracer(muzzle, end);
      if (hit) {
        const f = best <= d.range ? 1 : Math.max(d.falloff, 1 - (1 - d.falloff) * (best - d.range) / d.range);
        const dmg = d.dmg * f * (hit.head ? d.head : 1), h = hits.get(hit.key) ?? { dmg: 0, head: false };
        h.dmg += dmg; h.head ||= hit.head; hits.set(hit.key, h);
        A.fx.burst(point, hit.kind === 'player' ? new THREE.Color(this.me.color).getHex() : BLOOD[hit.kind], hit.head ? 12 : 6);
      } else if (point) {
        if (this.mode === 'pvp') A.fx.decal(point, normal, new THREE.Color(this.me.color).getHex(), 0.18);
        else A.fx.decal(point, normal);
        A.fx.burst(point, 0x9a958a, 4, 1.5);
      }
    }
    this.net?.send({ t: 'shot', a: muzzle.toArray().map(v => +v.toFixed(2)), b: firstEnd.toArray().map(v => +v.toFixed(2)), w: d.id });
    for (const [key, h] of hits) {
      this.hud.hitMarker(false, h.head); sfx(h.head ? 'head' : 'hit');
      if (this.isHost) this.damage(key, h.dmg, this.myId, h.head); else this.net.send({ t: 'hit', target: key, dmg: Math.round(h.dmg), head: h.head });
    }
  }

  // ───────────── 방장: 규칙 처리 ─────────────
  /** key: 'm<id>'(몬스터) | 'p<id>'(플레이어), from: 공격한 몬스터(피격 방향 표시용) */
  damage(key, dmg, by, head = false, from = null) {
    const shooter = by ? this.players.get(by) : null;
    if (key[0] === 'm') {
      const m = this.monsters.get(+key.slice(1));
      if (!m || m.state === 'dead') return; // 이미 죽었으면 무시 → 킬·점수는 한 번만
      m.hp -= dmg; onHit(m, head);
      if (m.hp > 0) return;
      m.state = 'dead'; m.st = 0; m.vz = 0; m.hp = 0;
      if (shooter) {
        const pts = Math.round(m.def.score * this.diff.score * (head ? 1.5 : 1));
        shooter.kills++; shooter.score += pts;
        this.toast(by, 'kill', { pts, head });
      }
      if (m.kind === 'giant') { this.feed(`${shooter?.name ?? '누군가'} — 거인 처치!`); for (let i = 0; i < 3; i++) this.spawnPickup(PICK_KINDS[i % 2], m.x + (Math.random() - 0.5) * 4, m.y + (Math.random() - 0.5) * 4); }
      else if (Math.random() < this.diff.drop * m.def.drop) this.spawnPickup(Math.random() < 0.6 ? 'ammo' : 'health', m.x, m.y);
      return;
    }
    const p = this.players.get(key.slice(1));
    if (!p || !p.alive || this.over) return;
    p.hp -= dmg; p.hurtT = 0;
    const src = from ?? shooter;
    this.toast(p.id, 'hurt', src ? { x: +src.x.toFixed(1), y: +src.y.toFixed(1) } : {});
    if (p.hp <= 0) {
      p.alive = false; p.hp = 0; p.deaths++; p.respawnAt = this.now + PLAYER.respawn;
      if (shooter && shooter !== p) { shooter.kills++; shooter.score += 100; this.toast(by, 'kill', { head }); }
      this.feed(`${shooter ? shooter.name : from ? MONSTERS[from.kind].name : '?'} → ${p.name}`);
    }
  }

  /** 소리·표시 신호: 나에게 온 것이면 바로, 아니면 그 사람에게 보낸다 */
  toast(id, kind, extra = {}) {
    if (id === this.myId) this.localFx(kind, extra);
    else this.net?.send({ t: 'fx', kind, ...extra }, id);
  }
  localFx(kind, e) {
    if (kind === 'kill') { this.hud.hitMarker(true, e.head); sfx('kill'); if (e.pts) this.hud.note(`+${e.pts}${e.head ? '  헤드샷' : ''}`, 900); }
    else if (kind === 'hurt') {
      sfx('hurt');
      let a = null;
      if (e.x !== undefined) { const me = this.me, dx = e.x - me.x, dy = e.y - me.y, s = Math.sin(me.yaw), c = Math.cos(me.yaw); a = Math.atan2(dx * c + dy * s, -dx * s + dy * c); }
      this.hud.hurt(a);
    } else if (kind === 'ammo') { this.arsenal.addAmmo(PICKUPS.ammo.mags, PICKUPS.ammo.others); sfx('pickup'); this.hud.note('탄약 보충', 1000); }
    else if (kind === 'health') { sfx('pickup'); this.hud.note(`체력 +${PICKUPS.health.heal}`, 1000); }
  }
  feed(text) { this.hud.feed(text); this.net?.send({ t: 'feed', text }); }
  /** 위치 있는 소리 (거리에 따라 작게). 방장은 다른 사람에게도 보낸다 */
  sound(kind, x, y, relay = true) {
    sfx(kind, 1 / (1 + Math.hypot(x - this.me.x, y - this.me.y) / 10));
    if (relay && this.isHost) this.net?.send({ t: 'snd', k: kind, x: +x.toFixed(1), y: +y.toFixed(1) });
  }
  banner(text, t = 2.5) { this.msg = text; this.msgT = t; }

  respawn(p) {
    const others = [...this.players.values()].filter(o => o !== p && o.alive);
    const c = this.zombieMode ? SURVIVE_AT : null;
    const spot = this.nav.randomSpot((x, y) => (c ? Math.hypot(x - c[0], y - c[1]) < 25 : Math.abs(x) < 130 && y > -170 && y < 150)
      && others.every(o => Math.hypot(o.x - x, o.y - y) > (c ? 3 : 25))) ?? [0, -60];
    p.hp = PLAYER.hp; p.alive = true; p.x = p.tx = spot[0]; p.y = p.ty = spot[1]; p.z = p.tz = this.ctx.groundAt(...spot);
    if (p.id === this.myId) { this.ctx.teleport(spot[0], spot[1]); this.refillOnRespawn(); }
    else this.net?.send({ t: 'tp', x: spot[0], y: spot[1] }, p.id);
  }
  refillOnRespawn() { const A = this.arsenal; for (const [id, g] of A.guns) { const d = WEAPON[id]; g.ammo = d.mag; g.reserve = Math.max(g.reserve, d.reserve); } }

  hostUpdate(dt, restart) {
    this.now += dt;
    const players = [...this.players.values()];
    if ((this.msgT -= dt) <= 0 && this.msgT > -dt) this.msg = '';
    if (this.mode === 'pvp') {
      for (const p of players) { p.hurtT += dt; if (p.alive && p.hurtT > 4) p.hp = Math.min(PLAYER.hp, p.hp + 8 * dt); }
      for (const p of players) if (!p.alive && this.now > p.respawnAt && !this.over) this.respawn(p);
      const win = players.find(p => p.kills >= PLAYER.pvpGoal);
      if (win && !this.over) { this.over = true; this.overAt = this.now; this.msg = `${win.name} 승리!\n잠시 후 새 판이 시작돼요`; this.msgT = 99; }
      if (this.over && this.now - this.overAt > 8) { this.over = false; this.msg = ''; for (const p of players) { p.kills = p.deaths = p.score = 0; this.respawn(p); } }
    } else this.survival(dt, players, restart);

    // 보급 상자 줍기
    for (const [id, k] of this.pickups) {
      if ((k.life -= dt) <= 0) { this.removePickup(id); continue; }
      const p = players.find(p => p.alive && Math.hypot(p.x - k.x, p.y - k.y) < 1.5 && Math.abs(p.z - this.ctx.groundAt(k.x, k.y)) < 2);
      if (!p) continue;
      if (k.kind === 'health') { if (p.hp >= PLAYER.hp) continue; p.hp = Math.min(PLAYER.hp, p.hp + PICKUPS.health.heal); }
      this.toast(p.id, k.kind); this.removePickup(id);
    }

    // 네트워크로 상태 보내기
    this.sendT += dt;
    if (this.net && this.sendT > TICK) {
      this.sendT = 0;
      this.net.send({ t: 'snap', mode: this.mode, diff: this.diffKey, round: this.round, cleared: this.cleared, phase: this.phase, phaseT: +this.phaseT.toFixed(1),
        left: this.enemyCount(), msg: this.msg, over: this.over, survive: Math.round(this.survive),
        players: players.map(p => [p.id, p.name, p.color, +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +p.yaw.toFixed(2), +p.pitch.toFixed(2), Math.round(p.hp), p.alive, p.kills, p.deaths, p.speed, p.score]),
        mons: [...this.monsters.values()].map(m => [m.id, KINDS.indexOf(m.kind), +m.x.toFixed(2), +m.y.toFixed(2), +m.z.toFixed(2), +m.yaw.toFixed(2), STATES.indexOf(m.state), +m.st.toFixed(2), +m.wp.toFixed(2), +m.mv.toFixed(1), +(m.hp / m.maxHp).toFixed(3)]),
        picks: [...this.pickups.values()].map(k => [k.id, PICK_KINDS.indexOf(k.kind), +k.x.toFixed(1), +k.y.toFixed(1)]) });
    }
  }

  // ───────────── 무한 생존 ─────────────
  survival(dt, players, restart) {
    const alive = players.filter(p => p.alive);
    if (this.over) { if (restart) this.restart(); return; }
    if (!alive.length) { this.over = true; this.msg = ''; this.msgT = 0; return; }
    this.survive += dt;
    if (this.phase === 'round') {
      this.spawnCd -= dt;
      let n = 0; for (const m of this.monsters.values()) if (m.state !== 'dead') n++;
      if (this.queue.length && this.spawnCd <= 0 && n < ROUND.maxAlive) {
        const kind = this.queue[0], far = kind === 'giant' ? 35 : 30;
        const spot = this.nav.randomSpot((x, y) => alive.every(p => Math.hypot(p.x - x, p.y - y) > far) && alive.some(p => Math.hypot(p.x - x, p.y - y) < 80));
        if (spot) { this.queue.shift(); this.spawnMonster(kind, spot); }
        this.spawnCd = Math.max(0.3, 1.5 - this.round * 0.08) / (players.length > 1 ? 1.3 : 1);
      }
      if (!this.queue.length && n === 0) this.endRound(players);
    } else if ((this.phaseT -= dt) <= 0) this.startRound(players);
    else if (this.phase === 'prep' && this.msgT <= 0) this.msg = `준비하세요\n${Math.ceil(this.phaseT)}`;

    this.navT -= dt;
    if (this.navT <= 0) { this.nav.update(alive.map(p => [p.x, p.y])); this.navT = 0.5; }
    const W = { players: alive, monsters: [...this.monsters.values()], nav: this.nav, physics: this.ctx.physics, groundAt: this.ctx.groundAt,
      hurt: (p, dmg, m) => this.damage('p' + p.id, dmg, null, false, m), sound: (k, x, y) => this.sound(k, x, y),
      relocate: m => { const s = this.nav.randomSpot((x, y) => alive.every(p => Math.hypot(p.x - x, p.y - y) > 35) && alive.some(p => Math.hypot(p.x - x, p.y - y) < 80)); if (s) { m.x = s[0]; m.y = s[1]; } } };
    for (const m of W.monsters) {
      think(m, dt, W);
      if (m.state === 'dead' && m.st > 2.6) { this.ctx.scene.remove(m.model.root); this.monsters.delete(m.id); }
    }
  }

  startRound(players) {
    this.round++; this.phase = 'round';
    this.queue = roundPlan(this.round, this.diff, players.length);
    const boss = this.queue.includes('giant'), first = this.round === 3;
    this.banner(`라운드 ${this.round}${boss ? '\n보스 등장: 거인' : first ? '\n거대 거미·거대 박쥐 출현' : ''}`, 3);
    sfx('round');
    for (const p of players) if (!p.alive) this.respawn(p); // 쓰러진 사람은 새 라운드에 복귀
  }

  endRound(players) {
    this.cleared++; this.phase = 'rest'; this.phaseT = ROUND.rest;
    const bonus = Math.round(ROUND.clearBonus(this.round) * this.diff.score);
    for (const p of players) p.score += bonus;
    this.banner(`라운드 ${this.round} 클리어!\n보너스 +${bonus}`, 3.5);
    sfx('clear');
    this.syncUnlocks();
    // 정비 보급: 살아 있는 사람 근처에 탄약·구급 상자
    const n = Math.max(1, Math.round((players.length + PICKUPS.perRest) * this.diff.supply)), alive = players.filter(p => p.alive);
    for (let i = 0; i < n * 2; i++) {
      const p = alive[i % alive.length]; if (!p) break;
      const spot = this.nav.randomSpot((x, y) => Math.hypot(x - p.x, y - p.y) < 16 && Math.hypot(x - p.x, y - p.y) > 3);
      if (spot) this.spawnPickup(i < n ? 'ammo' : 'health', ...spot);
    }
  }

  spawnMonster(kind, [x, y]) {
    const s = ROUND.scale(this.round), D = this.diff;
    const m = createMonster(kind, this.nextId++, x, y, this.ctx.groundAt(x, y) + (kind === 'bat' ? MONSTERS.bat.alt : 0),
      { hp: s.hp * D.hp, dmg: s.dmg * D.dmg, speed: s.speed, cd: s.cd, windup: s.windup });
    m.model = makeModel(kind); this.ctx.scene.add(m.model.root);
    this.monsters.set(m.id, m);
    if (kind === 'giant') this.sound('roar', x, y);
  }

  spawnPickup(kind, x, y, id = this.nextId++) {
    const k = { id, kind, x, y, life: PICKUPS.life, mesh: pickupMesh(kind) };
    this.ctx.scene.add(k.mesh); this.pickups.set(id, k);
  }
  removePickup(id) { const k = this.pickups.get(id); if (k) { this.ctx.scene.remove(k.mesh); this.pickups.delete(id); } }

  /** 깬 라운드 수만큼 새 총을 준다 (방장·참가자 모두 같은 규칙) */
  syncUnlocks() {
    if (!this.zombieMode) return;
    for (const id of ROUND.unlock.slice(0, this.cleared)) if (this.arsenal.give(id)) {
      const w = WEAPON[id]; this.hud.note(`새 무기: ${w.name}  [${KEY_LABELS[w.slot]}]`, 3000); this.hud.feed(`새 무기 ${w.name} (${KEY_LABELS[w.slot]})`);
    }
  }

  // ───────────── 참가자 ─────────────
  clientUpdate(dt) {
    this.sendT += dt;
    if (this.sendT > TICK) {
      this.sendT = 0;
      const m = this.me;
      this.net.send({ t: 'me', name: m.name, x: +m.x.toFixed(2), y: +m.y.toFixed(2), z: +m.z.toFixed(2), yaw: +m.yaw.toFixed(2), pitch: +m.pitch.toFixed(2), speed: m.speed });
    }
  }

  // ───────────── 메시지 ─────────────
  onMessage(from, m) {
    switch (m.t) {
      case 'me': { // 방장이 받음: 참가자 위치
        const p = this.players.get(from) ?? this.addPlayer(from, m.name || '플레이어', COLORS[this.players.size % COLORS.length]);
        if (!p.joined) { p.joined = true; this.respawn(p); this.feed(`${p.name} 참가`); }
        Object.assign(p, { tx: m.x, ty: m.y, tz: m.z, yaw: m.yaw, pitch: m.pitch, speed: m.speed, name: m.name || p.name });
        break;
      }
      case 'hit': this.damage(m.target, Math.min(+m.dmg || 0, 300), from, !!m.head); break;
      case 'shot': {
        if (this.isHost) { m.from = from; this.net.send(m); } // 다른 사람에게도 전달 (쏜 사람은 이미 그렸다)
        if (m.from === this.myId) break;
        const a = new THREE.Vector3(...m.a), b = new THREE.Vector3(...m.b);
        this.arsenal.fx.tracer(a, b);
        const w = WEAPON[m.w]; if (w) gunSound(w.snd, 1 / (1 + a.distanceTo(this.ctx.camera.position) / 12));
        break;
      }
      case 'snap': this.applySnap(m); break;
      case 'tp': this.ctx.teleport(m.x, m.y); this.refillOnRespawn(); break;
      case 'fx': this.localFx(m.kind, m); break;
      case 'feed': this.hud.feed(m.text); break;
      case 'snd': this.sound(m.k, m.x, m.y, false); break;
    }
  }

  applySnap(m) {
    const wasOver = this.over;
    if (m.mode !== this.mode) { this.mode = m.mode; this.arsenal.reset(m.mode === 'pvp' ? ALL_GUNS : ROUND.startGuns); }
    if (m.diff !== this.diffKey) { this.diffKey = m.diff; this.diff = DIFFICULTY[m.diff]; }
    if (wasOver && !m.over && this.zombieMode) { this.arsenal.reset(ROUND.startGuns); this.saved = null; this.cleared = 0; } // 방장이 다시 시작
    if (m.round !== this.round && m.phase === 'round') sfx('round');
    Object.assign(this, { round: m.round, phase: m.phase, phaseT: m.phaseT, left: m.left, msg: m.msg, over: m.over, survive: m.survive });
    if (m.cleared !== this.cleared) { if (m.cleared > this.cleared) sfx('clear'); this.cleared = m.cleared; this.syncUnlocks(); }
    const seen = new Set();
    for (const [id, name, color, x, y, z, yaw, pitch, hp, alive, kills, deaths, speed, score] of m.players) {
      seen.add(id);
      const p = this.players.get(id) ?? this.addPlayer(id, name, color);
      Object.assign(p, { name, hp, alive, kills, deaths, score });
      if (id === this.myId) { p.color = color; continue; }
      Object.assign(p, { tx: x, ty: y, tz: z, yaw, pitch, speed });
    }
    for (const id of [...this.players.keys()]) if (!seen.has(id) && id !== this.myId) this.removePlayer(id); // 나는 방장이 아직 모를 때도 지우지 않는다
    const ms = new Set();
    for (const [id, ki, x, y, z, yaw, si, st, wp, mv, hpFrac] of m.mons) {
      ms.add(id);
      let o = this.monsters.get(id);
      const kind = KINDS[ki];
      if (!o) { o = { id, kind, def: MONSTERS[kind], x, y, z, model: makeModel(kind) }; this.ctx.scene.add(o.model.root); this.monsters.set(id, o); }
      const state = STATES[si];
      Object.assign(o, { tx: x, ty: y, tz: z, yaw, state, wp, mv, hpFrac });
      if (Math.abs((o.st ?? 0) - st) > 0.3) o.st = st;
    }
    for (const [id, o] of this.monsters) if (!ms.has(id)) { this.ctx.scene.remove(o.model.root); this.monsters.delete(id); }
    const ks = new Set();
    for (const [id, ki, x, y] of m.picks) { ks.add(id); if (!this.pickups.has(id)) this.spawnPickup(PICK_KINDS[ki], x, y, id); }
    for (const id of [...this.pickups.keys()]) if (!ks.has(id)) this.removePickup(id);
  }
}

/** 보급 상자 모양: 탄약(국방색 상자, 노란 띠) / 구급(흰 상자, 빨간 십자) */
const pickGeo = { box: new THREE.BoxGeometry(0.55, 0.32, 0.38), band: new THREE.BoxGeometry(0.56, 0.06, 0.39), crossA: new THREE.BoxGeometry(0.3, 0.09, 0.4), crossB: new THREE.BoxGeometry(0.09, 0.3, 0.4) };
const pickMat = { ammo: new THREE.MeshLambertMaterial({ color: 0x4b5a32 }), band: new THREE.MeshBasicMaterial({ color: 0xfacc15 }), health: new THREE.MeshLambertMaterial({ color: 0xf2f2f0 }), red: new THREE.MeshBasicMaterial({ color: 0xdc2626 }) };
function pickupMesh(kind) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(pickGeo.box, pickMat[kind]));
  if (kind === 'ammo') g.add(new THREE.Mesh(pickGeo.band, pickMat.band));
  else { const a = new THREE.Mesh(pickGeo.crossA, pickMat.red), b = new THREE.Mesh(pickGeo.crossB, pickMat.red); a.scale.z = b.scale.z = 1.02; g.add(a, b); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** 광선-구 교차 거리 (없으면 null) */
function sphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r, h = b * b - cc;
  if (h < 0) return null;
  const t = -b - Math.sqrt(h);
  return t > 0 ? t : null;
}
