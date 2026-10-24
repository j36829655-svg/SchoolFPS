import * as THREE from 'three';
import { WEAPONS, WEAPON } from './config.js';
import { buildGun } from './gunmodel.js';

// 공통 무기 시스템: 모든 총이 같은 코드로 동작하고, 차이는 config.js 수치뿐이다.
// 사격 방식(단발·연사·점사·펌프), 탄창·예비 탄약, 재장전(산탄총은 한 발씩), 교체, 조준(우클릭), 반동, 퍼짐, 총구 화염, 효과음.

// ───────────── 효과음 (WebAudio로 합성) ─────────────
let ac = null, noiseBuf = null;
function audio() {
  ac ??= new AudioContext();
  if (ac.state === 'suspended') ac.resume();
  if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  return ac;
}
function noise(cut, dur, vol, type = 'lowpass', q = 0.8, t0 = 0) {
  const a = audio(), t = a.currentTime + t0, s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.value = cut; f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(a.destination); s.start(t, Math.random() * 0.5); s.stop(t + dur);
}
function tone(f0, f1, dur, vol, type = 'sine', t0 = 0) {
  const a = audio(), t = a.currentTime + t0, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur);
}
/** 총소리: [음색, 울림, 크기, 저음], v = 거리 감쇠 */
export function gunSound([f, dec, vol, low], v = 1) {
  try { noise(f, dec, vol * 0.5 * v); noise(f * 2.2, dec * 0.35, vol * 0.25 * v, 'highpass'); tone(low * 2, low * 0.6, dec * 0.8, vol * 0.5 * v, 'triangle'); } catch {}
}
const SFX = {
  hit: () => tone(1400, 1000, 0.05, 0.12),
  head: () => { tone(1900, 1500, 0.07, 0.15); tone(2600, 2200, 0.05, 0.08, 'sine', 0.02); },
  kill: () => tone(700, 1500, 0.14, 0.16, 'triangle'),
  hurt: () => { tone(160, 60, 0.2, 0.3, 'sawtooth'); noise(500, 0.15, 0.2); },
  dry: () => noise(4000, 0.03, 0.25, 'bandpass', 4),
  reload: () => { noise(2500, 0.05, 0.3, 'bandpass', 3); noise(1800, 0.06, 0.25, 'bandpass', 3, 0.15); },
  magin: () => { noise(2200, 0.06, 0.35, 'bandpass', 3); tone(300, 200, 0.05, 0.1, 'square', 0.03); },
  shell: () => noise(1600, 0.07, 0.3, 'bandpass', 2),
  pump: () => { noise(1200, 0.08, 0.4, 'bandpass', 2); noise(1500, 0.08, 0.4, 'bandpass', 2, 0.18); },
  switch: () => noise(3000, 0.05, 0.2, 'bandpass', 3),
  pickup: () => { tone(600, 900, 0.08, 0.15, 'triangle'); tone(900, 1300, 0.1, 0.15, 'triangle', 0.08); },
  round: () => { tone(220, 220, 0.5, 0.18, 'sawtooth'); tone(330, 330, 0.5, 0.12, 'sawtooth', 0.25); },
  clear: () => { tone(523, 523, 0.15, 0.15, 'triangle'); tone(659, 659, 0.15, 0.15, 'triangle', 0.15); tone(784, 784, 0.3, 0.15, 'triangle', 0.3); },
  groan: v => tone(110 + Math.random() * 40, 70, 0.6, 0.12 * v, 'sawtooth'),
  hiss: v => noise(5000, 0.5, 0.25 * v, 'highpass'),
  roar: v => { tone(70, 40, 1.2, 0.4 * v, 'sawtooth'); noise(300, 1.0, 0.3 * v); },
  screech: v => tone(2400, 3600, 0.35, 0.12 * v, 'square'),
  slam: v => { tone(60, 25, 0.6, 0.6 * v, 'sine'); noise(400, 0.5, 0.5 * v); },
};
export function sfx(kind, v = 1) { if (v > 0.02) try { SFX[kind]?.(v); } catch {} }

// ───────────── 총 ─────────────
const HIP = new THREE.Vector3(0.16, -0.165, -0.3), HIP_PISTOL = new THREE.Vector3(0.14, -0.13, -0.33);
const BASE_FOV = 75;

export class Arsenal {
  constructor(camera, scene) {
    this.camera = camera; this.scene = scene; this.fx = new Fx(scene);
    this.holder = new THREE.Group(); camera.add(this.holder);
    this.models = {}; this.guns = new Map(); this.id = null;
    this.cool = 0; this.reloading = 0; this.switchT = 0; this.kick = 0; this.aimT = 0; this.bloom = 0;
    this.burstLeft = 0; this.pumpT = 0; this.prevTrigger = false; this.bob = 0; this.recoil = 0; this.recoilYaw = 0;
    // 총구 화염: 별 모양 스프라이트 + 잠깐 켜지는 조명 (조명은 항상 있어야 셰이더가 다시 컴파일되지 않는다)
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const grd = x.createRadialGradient(32, 32, 0, 32, 32, 32); grd.addColorStop(0, '#fff8e0'); grd.addColorStop(0.25, '#ffc860'); grd.addColorStop(1, 'rgba(255,120,20,0)');
    x.fillStyle = grd; x.beginPath(); for (let i = 0; i < 16; i++) { const r = i % 2 ? 9 : 32, a = i / 16 * Math.PI * 2; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } x.fill();
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    this.light = new THREE.PointLight(0xffb060, 0, 9, 2); camera.add(this.light);
    this.visible = false;
  }

  get def() { return WEAPON[this.id]; }
  get cur() { return this.guns.get(this.id); }
  get owned() { return WEAPONS.filter(w => this.guns.has(w.id)).map(w => w.id); }
  set visible(v) { this.holder.visible = v; this._vis = v; }
  get visible() { return this._vis; }
  get scoped() { return this.def?.scope && this.aimT > 0.85; }

  /** 가진 총을 ids 로 바꾸고 탄약을 채운다 */
  reset(ids, select = ids[ids.length - 1]) { this.guns.clear(); for (const id of ids) this.give(id); this.id = null; this.select(select); }
  give(id) {
    if (this.guns.has(id)) return false;
    const d = WEAPON[id]; this.guns.set(id, { ammo: d.mag, reserve: d.reserve });
    return true;
  }
  refill() { for (const [id, g] of this.guns) { g.ammo = WEAPON[id].mag; g.reserve = WEAPON[id].reserve; } }
  /** 탄약 상자: 지금 총 +cur 탄창, 나머지 +other 탄창 (최대 예비 = 처음의 2배) */
  addAmmo(cur, other) { for (const [id, g] of this.guns) { const d = WEAPON[id]; g.reserve = Math.min(d.reserve * 2, g.reserve + d.mag * (id === this.id ? cur : other)); } }

  select(id) {
    if (!this.guns.has(id) || id === this.id) return;
    if (this.model) this.holder.remove(this.model.group);
    this.id = id;
    this.model = this.models[id] ??= buildGun(WEAPON[id]);
    this.holder.add(this.model.group);
    this.model.group.add(this.flash); this.flash.position.copy(this.model.muzzle).z -= 0.03;
    this.switchT = 0.45; this.reloading = 0; this.burstLeft = 0; this.pumpT = 0; this.cool = Math.max(this.cool, 0);
    sfx('switch');
  }
  selectSlot(i) { const w = WEAPONS[i]; if (w) this.select(w.id); }
  cycle(d) { const o = this.owned; if (o.length < 2) return; this.select(o[(o.indexOf(this.id) + d + o.length) % o.length]); }

  startReload() {
    const d = this.def, c = this.cur;
    if (!c || this.reloading > 0 || this.switchT > 0 || c.ammo >= d.mag || c.reserve <= 0) return;
    this.reloading = d.reload; this.reloadLen = d.reload; this.burstLeft = 0;
    sfx(d.shell ? 'shell' : 'reload');
  }

  /** 지금 퍼짐 (라디안) */
  spread(moving, sprint) {
    const d = this.def;
    const base = this.aimT > 0.5 ? (d.adsSpread ?? d.spread * 0.3) : d.spread;
    return base * (sprint ? 2.2 : moving ? (this.aimT > 0.5 ? 1.3 : 1.7) : 1) + this.bloom;
  }

  /** 매 프레임. 이번 프레임에 쏘면 true */
  update(dt, { trigger, aim, moving, sprint }) {
    const d = this.def, c = this.cur;
    this.fx.update(dt);
    if (!d || !this._vis) { this.setFov(BASE_FOV); return false; }
    this.cool -= dt; this.kick = Math.max(0, this.kick - dt * 7); this.bloom = Math.max(0, this.bloom - dt * 0.12);
    this.flash.material.opacity = Math.max(0, this.flash.material.opacity - dt * 30);
    this.light.intensity = Math.max(0, this.light.intensity - dt * 120);
    const pressed = trigger && !this.prevTrigger; this.prevTrigger = trigger;
    this.aimT += ((aim && this.reloading <= 0 && this.switchT <= 0 && !sprint ? 1 : 0) - this.aimT) * Math.min(1, dt * 9);
    this.setFov(BASE_FOV + (d.ads - BASE_FOV) * this.aimT);
    this.pose(dt, moving, sprint);
    if (this.switchT > 0) { this.switchT -= dt; return false; }
    if (this.pumpT > 0) { this.pumpT -= dt; if (this.pumpT <= 0.3 && this.pumpT + dt > 0.3) sfx('pump'); }

    if (this.reloading > 0) {
      if (d.shell && pressed && c.ammo > 0) this.reloading = 0; // 산탄총은 쏘면 재장전이 끊긴다
      else {
        this.reloading -= dt;
        if (this.reloading > 0) return false;
        if (d.shell) { c.ammo++; c.reserve--; if (c.ammo < d.mag && c.reserve > 0) { this.reloading = d.reload; sfx('shell'); } else { this.pumpT = 0.55; } }
        else { const n = Math.min(d.mag - c.ammo, c.reserve); c.ammo += n; c.reserve -= n; sfx('magin'); }
        return false;
      }
    }
    let want = d.mode === 'auto' ? trigger : pressed;
    if (d.mode === 'burst') { if (pressed && !this.burstLeft && this.cool <= 0) this.burstLeft = d.burst; want = this.burstLeft > 0; }
    if (d.mode === 'pump' && this.pumpT > 0) want = false;
    if (!want || this.cool > 0 || sprint) return false;
    if (c.ammo <= 0) { this.burstLeft = 0; if (pressed) { sfx('dry'); this.startReload(); } return false; }
    c.ammo--; this.cool = 60 / d.rpm;
    if (d.mode === 'burst' && --this.burstLeft === 0) this.cool = d.burstDelay;
    if (d.mode === 'pump') this.pumpT = 0.75;
    this.kick = 1; this.bloom = Math.min(d.spread * 1.5, this.bloom + d.recoil * 0.25);
    this.recoil += d.recoil * (this.aimT > 0.5 ? 0.7 : 1); this.recoilYaw += (Math.random() - 0.5) * d.recoil * 0.6;
    this.flash.material.opacity = 1; this.flash.material.rotation = Math.random() * 6; this.flash.scale.setScalar(d.flash * (0.8 + Math.random() * 0.4));
    this.light.intensity = 3; this.light.position.set(0.15, -0.1, -0.8);
    gunSound(d.snd);
    return true;
  }

  setFov(f) { if (Math.abs(this.camera.fov - f) > 0.05) { this.camera.fov = f; this.camera.updateProjectionMatrix(); } }

  /** 1인칭 총 위치: 허리 ↔ 조준, 걸음 흔들림, 반동, 재장전·교체 동작 */
  pose(dt, moving, sprint) {
    const mdl = this.model, d = this.def, g = mdl.group;
    const hip = mdl.pistol ? HIP_PISTOL : HIP, a = this.aimT;
    this.bob += dt * (moving ? (sprint ? 13 : 9) : 2);
    const bobA = (moving ? (sprint ? 0.022 : 0.012) : 0.002) * (1 - a * 0.85);
    let x = hip.x * (1 - a), y = hip.y + (-mdl.sightY - hip.y) * a + Math.abs(Math.sin(this.bob)) * bobA, z = hip.z + (-0.22 - hip.z) * a + this.kick * 0.045;
    let rx = this.kick * (mdl.pistol ? 0.18 : 0.06), ry = 0, rz = 0;
    if (sprint) { rx -= 0.35; ry += 0.6; x -= 0.04; }
    if (this.reloading > 0) { const p = d.shell ? 0.5 : Math.sin(Math.min(1, 1 - this.reloading / this.reloadLen) * Math.PI); rx -= 0.45 * p; rz += 0.5 * p; y -= 0.05 * p; }
    if (this.switchT > 0) y -= this.switchT * 0.5;
    g.position.set(x + Math.sin(this.bob * 0.5) * bobA, y, z); g.rotation.set(rx, ry, rz);
    if (mdl.slide) mdl.slide.position.z = this.kick * 0.035;
    if (mdl.pump) mdl.pump.position.z = this.pumpT > 0 ? Math.sin(Math.min(1, (0.75 - this.pumpT) / 0.5) * Math.PI) * 0.08 : 0;
    g.visible = !this.scoped;
  }

  /** 조준 광선들 (산탄총은 펠릿 수만큼) */
  rays(moving, sprint) {
    const o = new THREE.Vector3(), f = new THREE.Vector3(); this.camera.getWorldPosition(o); this.camera.getWorldDirection(f);
    const right = new THREE.Vector3().crossVectors(f, this.camera.up).normalize(), up = new THREE.Vector3().crossVectors(right, f);
    const s = this.spread(moving, sprint), n = this.def.pellets ?? 1, out = [];
    for (let i = 0; i < n; i++) {
      const r = s * Math.sqrt(Math.random()), a = Math.random() * Math.PI * 2;
      out.push({ origin: o, dir: f.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize() });
    }
    return out;
  }
  muzzleWorld() { const v = this.model.muzzle.clone(); return this.model.group.localToWorld(v); }
}

// ───────────── 효과: 탄흔, 궤적, 파편 ─────────────
const holeGeo = new THREE.CircleGeometry(1, 8);
export class Fx {
  constructor(scene) {
    this.scene = scene; this.decals = []; this.lines = [];
    const N = 400; this.N = N; this.n = 0;
    this.pos = new Float32Array(N * 3).fill(-999); this.col = new Float32Array(N * 3); this.vel = new Float32Array(N * 3); this.life = new Float32Array(N);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }));
    this.points.frustumCulled = false; scene.add(this.points);
  }
  /** 벽·땅 자국. paint 색이 있으면 페인트, 없으면 탄흔 */
  decal(point, normal, color = 0x1a1a1a, size = 0.05) {
    const m = new THREE.Mesh(holeGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false }));
    m.position.copy(point).addScaledVector(normal, 0.015); m.lookAt(point.clone().add(normal)); m.scale.setScalar(size * (0.8 + Math.random() * 0.5));
    this.scene.add(m); this.decals.push(m);
    if (this.decals.length > 120) { const o = this.decals.shift(); this.scene.remove(o); o.material.dispose(); }
  }
  /** 파편·피 튀김 */
  burst(point, color, n = 8, speed = 2.5) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      const k = this.n++ % this.N;
      this.pos.set([point.x, point.y, point.z], k * 3); this.col.set([c.r, c.g, c.b], k * 3);
      this.vel.set([(Math.random() - 0.5) * speed, Math.random() * speed, (Math.random() - 0.5) * speed], k * 3); this.life[k] = 0.35 + Math.random() * 0.3;
    }
  }
  tracer(from, to, color = 0xffe2a0) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 }));
    this.scene.add(line); this.lines.push([line, 0.06]);
  }
  update(dt) {
    for (let k = 0; k < this.N; k++) {
      if (this.life[k] <= 0) continue;
      this.life[k] -= dt;
      if (this.life[k] <= 0) { this.pos[k * 3 + 1] = -999; continue; }
      this.vel[k * 3 + 1] -= 9.8 * dt;
      for (let a = 0; a < 3; a++) this.pos[k * 3 + a] += this.vel[k * 3 + a] * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true; this.points.geometry.attributes.color.needsUpdate = true;
    for (const l of this.lines) l[1] -= dt;
    this.lines = this.lines.filter(([line, t]) => { if (t > 0) return true; this.scene.remove(line); line.geometry.dispose(); line.material.dispose(); return false; });
  }
}
