import * as THREE from 'three';
import { Avatar } from './avatar.js';
import { Weapon, GUN, sfx } from './weapon.js';
import { NavGrid } from './nav.js';

// 게임 규칙: 좀비 모드(혼자·협동), 페인트볼 대전(멀티). 혼자 할 때도 "방장" 코드 경로를 그대로 쓴다.
const COLORS = ['#ff4fa3', '#3b82f6', '#f59e0b', '#10b981', '#a855f7', '#ef4444', '#06b6d4', '#84cc16'];
const PVP_GOAL = 15, RESPAWN = 3, TICK = 1 / 15, MAX_ZOMBIES = 45;
const HEAD = 1.72, EYE = 1.65;

export class Game {
  /** ctx: { scene, camera, physics, groundAt, teleport(x, y), bodyPos(), solids, signedDist, worldMeshes, bounds } */
  constructor(ctx, hud) {
    this.ctx = ctx; this.hud = hud;
    this.weapon = new Weapon(ctx.camera, ctx.scene);
    this.weapon.view.visible = false;
    this.nav = new NavGrid(ctx.bounds, ctx.solids, ctx.signedDist);
    this.ray = new THREE.Raycaster();
    this.active = false;
  }

  /** mode: 'zombie' | 'pvp', net: Net 또는 null(혼자) */
  start({ mode, net = null, name = '나' }) {
    this.stop();
    this.mode = mode; this.net = net;
    this.isHost = !net || net.isHost;
    this.myId = net ? net.id : 'host';
    this.players = new Map();
    this.zombies = new Map();
    this.nextZid = 1; this.wave = 0; this.waveLeft = 0; this.spawnCd = 0; this.intermission = 3;
    this.msg = ''; this.over = false; this.sendT = 0; this.navT = 0; this.now = 0;
    this.addPlayer(this.myId, name, COLORS[0]);
    this.me = this.players.get(this.myId);
    this.weapon.setColor(this.me.color); this.weapon.ammo = GUN.mag; this.weapon.view.visible = true;
    this.active = true;
    this.hud.show(true);
    if (net) {
      net.onMessage = (from, m) => this.onMessage(from, m);
      net.onLeave = id => { this.removePlayer(id); this.hud.feed('누군가 나갔어요'); };
      net.onJoin = id => { if (this.isHost) this.hud.feed('새 플레이어 참가'); };
    }
    if (this.isHost) this.respawn(this.me, true);
  }

  stop() {
    if (!this.active) return;
    for (const p of this.players.values()) if (p.avatar) this.ctx.scene.remove(p.avatar.root);
    for (const z of this.zombies.values()) this.ctx.scene.remove(z.avatar.root);
    this.net?.close(); this.net = null;
    this.active = false; this.weapon.view.visible = false; this.hud.show(false); this.hud.center('');
  }

  addPlayer(id, name, color) {
    if (this.players.has(id)) return this.players.get(id);
    const p = { id, name, color, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, hp: 100, alive: true, kills: 0, deaths: 0, speed: 0, hurtT: 0, respawnAt: 0, tx: 0, ty: 0, tz: 0 };
    if (id !== this.myId) { p.avatar = new Avatar({ shirt: new THREE.Color(color).getHex(), name }); this.ctx.scene.add(p.avatar.root); }
    this.players.set(id, p);
    return p;
  }
  removePlayer(id) { const p = this.players.get(id); if (p?.avatar) this.ctx.scene.remove(p.avatar.root); this.players.delete(id); }
  canMove() { return this.active && this.me.alive && !this.over; }

  // ───────────── 매 프레임 ─────────────
  update(dt, { trigger, moving, reload, board, restart }) {
    if (!this.active) return;
    const me = this.me, pos = this.ctx.bodyPos();
    me.x = pos.x; me.y = pos.y; me.z = pos.z; me.yaw = this.ctx.yaw(); me.pitch = this.ctx.pitch(); me.speed = moving ? 4.5 : 0;
    if (reload) this.weapon.startReload();
    if (this.weapon.update(dt, trigger && this.canMove(), moving)) this.fire();
    this.hud.ammo(this.weapon.ammo, this.weapon.reloading > 0);
    this.hud.health(me.hp);
    this.hud.board([...this.players.values()].sort((a, b) => b.kills - a.kills), board);

    if (this.isHost) this.hostUpdate(dt, restart); else this.clientUpdate(dt);

    // 다른 플레이어·좀비 모습 (보간)
    for (const p of this.players.values()) {
      if (!p.avatar) continue;
      const k = Math.min(1, dt * 12);
      p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; p.z += (p.tz - p.z) * k;
      p.avatar.root.position.set(p.x, p.z, -p.y); p.avatar.root.rotation.y = p.yaw;
      p.avatar.root.visible = p.alive || p.deadT < 2;
      p.deadT = p.alive ? 0 : (p.deadT ?? 0) + dt;
      p.avatar.animate(dt, p.speed, 0, p.alive ? 0 : Math.min(1, p.deadT * 3));
    }
    for (const z of this.zombies.values()) {
      if (!this.isHost) { const k = Math.min(1, dt * 10); z.x += (z.tx - z.x) * k; z.y += (z.ty - z.y) * k; z.z += (z.tz - z.z) * k; }
      z.avatar.root.position.set(z.x, z.z, -z.y); z.avatar.root.rotation.y = z.yaw;
      z.avatar.animate(dt, z.dead ? 0 : z.speed, z.atkT > 0 ? 1 : 0, z.dead ? Math.min(1, z.dead * 2.5) : 0);
      z.atkT = Math.max(0, (z.atkT ?? 0) - dt);
    }
    // 위쪽 정보
    if (this.mode === 'zombie') this.hud.top(`웨이브 ${this.wave}  ·  남은 좀비 ${this.zombieCount()}  ·  킬 ${me.kills}`);
    else this.hud.top(`페인트볼 대전  ·  ${PVP_GOAL}킬 먼저  ·  내 킬 ${me.kills}`);
    this.hud.center(!me.alive && !this.over ? `쓰러졌어요\n${this.mode === 'pvp' ? '잠시 후 다시 등장' : '다음 웨이브에 복귀'}` : this.msg);
  }

  zombieCount() { let n = 0; for (const z of this.zombies.values()) if (!z.dead) n++; return n + (this.isHost ? this.waveLeft : 0); }

  // ───────────── 사격 ─────────────
  fire() {
    const { origin, dir } = this.weapon.aimRay();
    let best = GUN.range, hit = null, point = null, normal = new THREE.Vector3(0, 1, 0);
    // 건물
    this.ray.set(origin, dir); this.ray.far = GUN.range;
    const w = this.ray.intersectObjects(this.ctx.worldMeshes, false)[0];
    if (w) { best = w.distance; point = w.point; if (w.face) normal = w.face.normal.clone().transformDirection(w.object.matrixWorld); }
    // 지형 (광선을 따라 0.5m씩 내려가며 땅 높이와 비교)
    for (let t = 0.5; t < best; t += 0.5) {
      const x = origin.x + dir.x * t, y = -(origin.z + dir.z * t), h = origin.y + dir.y * t;
      if (h < this.ctx.groundAt(x, y)) { best = t; point = origin.clone().addScaledVector(dir, t); normal.set(0, 1, 0); break; }
    }
    // 좀비 / 다른 플레이어 (머리·몸통 구)
    const targets = [];
    for (const z of this.zombies.values()) if (!z.dead) targets.push(['z' + z.id, z]);
    if (this.mode === 'pvp') for (const p of this.players.values()) if (p.id !== this.myId && p.alive) targets.push(['p' + p.id, p]);
    for (const [key, t] of targets) {
      for (const [h, r, head] of [[HEAD, 0.22, true], [1.18, 0.4, false], [0.55, 0.32, false]]) {
        const c = new THREE.Vector3(t.x, t.z + h, -t.y), d = sphere(origin, dir, c, r);
        if (d !== null && d < best) { best = d; hit = { key, head }; point = origin.clone().addScaledVector(dir, d); normal = dir.clone().negate(); }
      }
    }
    const end = point ?? origin.clone().addScaledVector(dir, GUN.range);
    const muzzle = new THREE.Vector3(); this.weapon.flash.getWorldPosition(muzzle);
    this.weapon.tracer(muzzle, end);
    if (point) this.weapon.splat(point, normal);
    this.net?.send({ t: 'shot', a: muzzle.toArray(), b: end.toArray(), c: this.me.color });
    if (hit) {
      const dmg = GUN.damage * (hit.head ? GUN.head : 1);
      this.hud.hitMarker(false); sfx('hit');
      if (this.isHost) this.damage(hit.key, dmg, this.myId); else this.net.send({ t: 'hit', target: hit.key, dmg });
    }
  }

  // ───────────── 방장: 규칙 처리 ─────────────
  damage(key, dmg, by) {
    const shooter = this.players.get(by);
    if (key[0] === 'z') {
      const z = this.zombies.get(+key.slice(1));
      if (!z || z.dead) return;
      z.hp -= dmg;
      if (z.hp <= 0) { z.dead = 0.001; if (shooter) shooter.kills++; this.toast(by, 'kill'); }
    } else {
      const p = this.players.get(key.slice(1));
      if (!p || !p.alive) return;
      p.hp -= dmg; p.hurtT = 0;
      this.toast(p.id, 'hurt');
      if (p.hp <= 0) {
        p.alive = false; p.hp = 0; p.deaths++; p.respawnAt = this.now + RESPAWN;
        if (shooter && shooter !== p) { shooter.kills++; this.toast(by, 'kill'); }
        this.feed(`${shooter ? shooter.name : '좀비'} → ${p.name}`);
      }
    }
  }

  /** 소리·표시 신호 (나에게 온 것이면 바로, 아니면 그 사람에게 보낸다) */
  toast(id, kind) {
    if (id === this.myId) { if (kind === 'kill') { this.hud.hitMarker(true); sfx('kill'); } else { this.hud.hurt(); sfx('hurt'); } }
    else this.net?.send({ t: 'fx', kind }, id);
  }
  feed(text) { this.hud.feed(text); this.net?.send({ t: 'feed', text }); }

  respawn(p, first = false) {
    const others = [...this.players.values()].filter(o => o !== p && o.alive);
    const center = this.mode === 'zombie' ? [20, -70] : null;
    const spot = this.nav.randomSpot((x, y) => (center ? Math.hypot(x - center[0], y - center[1]) < 25 : Math.abs(x) < 130 && y > -170 && y < 150)
      && others.every(o => Math.hypot(o.x - x, o.y - y) > (center ? 3 : 25))) ?? [0, -60];
    p.hp = 100; p.alive = true; p.x = p.tx = spot[0]; p.y = p.ty = spot[1]; p.z = p.tz = this.ctx.groundAt(...spot);
    if (p.id === this.myId) { this.ctx.teleport(spot[0], spot[1]); this.weapon.ammo = GUN.mag; }
    else this.net?.send({ t: 'tp', x: spot[0], y: spot[1] }, p.id);
  }

  hostUpdate(dt, restart) {
    this.now = (this.now ?? 0) + dt;
    const players = [...this.players.values()];
    // 체력 회복
    for (const p of players) { p.hurtT += dt; if (p.alive && p.hurtT > 4) p.hp = Math.min(100, p.hp + 8 * dt); }

    if (this.mode === 'pvp') {
      for (const p of players) if (!p.alive && this.now > p.respawnAt && !this.over) this.respawn(p);
      const win = players.find(p => p.kills >= PVP_GOAL);
      if (win && !this.over) { this.over = true; this.overAt = this.now; this.msg = `${win.name} 승리!\n잠시 후 새 판이 시작돼요`; }
      if (this.over && this.now - this.overAt > 8) { this.over = false; this.msg = ''; for (const p of players) { p.kills = p.deaths = 0; this.respawn(p); } }
    } else {
      this.zombieRules(dt, players, restart);
    }

    // 네트워크로 상태 보내기
    this.sendT += dt;
    if (this.net && this.sendT > TICK) {
      this.sendT = 0;
      this.net.send({ t: 'snap', mode: this.mode, wave: this.wave, left: this.waveLeft, msg: this.msg, over: this.over,
        players: players.map(p => [p.id, p.name, p.color, +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2), +p.yaw.toFixed(2), +p.pitch.toFixed(2), Math.round(p.hp), p.alive, p.kills, p.deaths, p.speed]),
        zombies: [...this.zombies.values()].map(z => [z.id, +z.x.toFixed(2), +z.y.toFixed(2), +z.z.toFixed(2), +z.yaw.toFixed(2), z.dead ? 1 : 0, z.atkT > 0 ? 1 : 0, +z.speed.toFixed(1)]) });
    }
  }

  zombieRules(dt, players, restart) {
    const alive = players.filter(p => p.alive);
    if (this.over) { if (restart) this.start({ mode: 'zombie', net: this.keepNet(), name: this.me.name }); return; }
    if (!alive.length) { this.over = true; this.msg = `모두 쓰러졌어요 — 웨이브 ${this.wave}까지 버텼어요\n${this.isHost ? 'R 키로 다시 시작' : '방장이 다시 시작할 때까지 기다려요'}`; return; }
    // 웨이브 진행
    if (this.waveLeft === 0 && this.zombieCount() === 0) {
      this.intermission -= dt;
      this.msg = this.wave === 0 ? `좀비가 몰려와요!\n${Math.ceil(this.intermission)}` : `웨이브 ${this.wave} 클리어!\n다음 웨이브 ${Math.ceil(this.intermission)}`;
      if (this.intermission <= 0) {
        this.wave++; this.intermission = 6; this.msg = '';
        this.waveLeft = Math.round((5 + this.wave * 3) * (1 + 0.5 * (players.length - 1)));
        for (const p of players) if (!p.alive) this.respawn(p); // 쓰러진 사람은 새 웨이브에 복귀
      }
    }
    this.spawnCd -= dt;
    if (this.waveLeft > 0 && this.spawnCd <= 0 && this.zombies.size < MAX_ZOMBIES) {
      const spot = this.nav.randomSpot((x, y) => alive.every(p => Math.hypot(p.x - x, p.y - y) > 45) && alive.some(p => Math.hypot(p.x - x, p.y - y) < 130));
      if (spot) { this.spawnZombie(spot); this.waveLeft--; }
      this.spawnCd = Math.max(0.35, 1.6 - this.wave * 0.1);
    }
    // 길찾기 갱신
    this.navT -= dt;
    if (this.navT <= 0) { this.nav.update(alive.map(p => [p.x, p.y])); this.navT = 0.5; }
    // 좀비 이동·공격
    for (const z of this.zombies.values()) {
      if (z.dead) { z.dead += dt; if (z.dead > 2.5) { this.ctx.scene.remove(z.avatar.root); this.zombies.delete(z.id); } continue; }
      let target = null, td = Infinity;
      for (const p of alive) { const d = Math.hypot(p.x - z.x, p.y - z.y); if (d < td) { td = d; target = p; } }
      if (!target) continue;
      let dx, dy;
      if (td < 8 && !this.ctx.physics.blocked(z.x, z.y, target.x, target.y)) { dx = (target.x - z.x) / td; dy = (target.y - z.y) / td; }
      else { const d = this.nav.dirAt(z.x, z.y); if (d) [dx, dy] = d; else { dx = (target.x - z.x) / td; dy = (target.y - z.y) / td; } }
      // 서로 겹치지 않게
      for (const o of this.zombies.values()) { if (o === z || o.dead) continue; const ox = z.x - o.x, oy = z.y - o.y, od = Math.hypot(ox, oy); if (od < 0.9 && od > 0) { dx += ox / od * 0.6; dy += oy / od * 0.6; } }
      const l = Math.hypot(dx, dy) || 1;
      const sp = td < 1.2 ? 0 : z.speed;
      const pos = { x: z.x + dx / l * sp * dt, y: z.y + dy / l * sp * dt };
      this.ctx.physics.resolve(pos, 0.35);
      z.x = pos.x; z.y = pos.y; z.z = this.ctx.groundAt(z.x, z.y);
      const want = Math.atan2(-(target.x - z.x), target.y - z.y); // yaw: 0 = 북쪽(-Z)
      z.yaw += Math.atan2(Math.sin(want - z.yaw), Math.cos(want - z.yaw)) * Math.min(1, dt * 8);
      z.cd -= dt;
      if (td < 1.5 && Math.abs(target.z - z.z) < 2 && z.cd <= 0) { z.cd = 1; z.atkT = 0.4; this.damage('p' + target.id, 12 + this.wave, null); }
    }
  }

  keepNet() { const n = this.net; this.net = null; return n; } // 다시 시작할 때 연결 유지

  spawnZombie([x, y]) {
    const shirts = [0x6b5b4b, 0x4b5b6b, 0x5b6b4b, 0x7b4b4b];
    const z = { id: this.nextZid++, x, y, z: this.ctx.groundAt(x, y), yaw: 0, hp: 60 + this.wave * 8, cd: 0, atkT: 0, dead: 0,
      speed: 2.2 + Math.min(this.wave * 0.15, 2) + Math.random() * 0.5, avatar: new Avatar({ zombie: true, skin: 0x8fae7a, shirt: shirts[this.nextZid % 4], pants: 0x3a3a3a }) };
    this.ctx.scene.add(z.avatar.root);
    this.zombies.set(z.id, z);
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
      case 'hit': this.damage(m.target, Math.min(m.dmg, GUN.damage * GUN.head), from); break;
      case 'shot':
        if (this.isHost) { m.from = from; this.net.send(m); } // 다른 사람에게도 전달 (보낸 사람은 자기 화면에 이미 그렸다)
        if (!m.from || m.from !== this.myId) this.weapon.tracer(new THREE.Vector3(...m.a), new THREE.Vector3(...m.b), m.c);
        break;
      case 'snap': { // 참가자가 받음
        this.mode = m.mode; this.wave = m.wave; this.msg = m.msg; this.over = m.over;
        const seen = new Set();
        for (const [id, name, color, x, y, z, yaw, pitch, hp, alive, kills, deaths, speed] of m.players) {
          const pid = id === 'host' ? 'host' : id;
          seen.add(pid);
          const p = this.players.get(pid) ?? this.addPlayer(pid, name, color);
          Object.assign(p, { name, hp, alive, kills, deaths });
          if (pid === this.myId) { if (p.color !== color) { p.color = color; this.weapon.setColor(color); } continue; }
          Object.assign(p, { tx: x, ty: y, tz: z, yaw, pitch, speed });
        }
        for (const id of [...this.players.keys()]) if (!seen.has(id)) this.removePlayer(id);
        const zs = new Set();
        for (const [id, x, y, z, yaw, dead, atk, speed] of m.zombies) {
          zs.add(id);
          let zz = this.zombies.get(id);
          if (!zz) { zz = { id, x, y, z, avatar: new Avatar({ zombie: true, skin: 0x8fae7a, shirt: 0x5b5b4b, pants: 0x3a3a3a }) }; this.ctx.scene.add(zz.avatar.root); this.zombies.set(id, zz); }
          Object.assign(zz, { tx: x, ty: y, tz: z, yaw, speed, dead: dead ? (zz.dead || 0.001) + TICK : 0, atkT: atk ? 0.3 : 0 });
        }
        for (const [id, z] of this.zombies) if (!zs.has(id)) { this.ctx.scene.remove(z.avatar.root); this.zombies.delete(id); }
        break;
      }
      case 'tp': this.ctx.teleport(m.x, m.y); this.weapon.ammo = GUN.mag; break;
      case 'fx': if (m.kind === 'kill') { this.hud.hitMarker(true); sfx('kill'); } else { this.hud.hurt(); sfx('hurt'); } break;
      case 'feed': this.hud.feed(m.text); break;
    }
  }
}

/** 광선-구 교차 거리 (없으면 null) */
function sphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r, h = b * b - cc;
  if (h < 0) return null;
  const t = -b - Math.sqrt(h);
  return t > 0 ? t : null;
}
