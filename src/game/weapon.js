import * as THREE from 'three';

// 페인트볼 마커: 1인칭 총 모델, 연사·탄창·재장전·반동, 물감 자국, 효과음
export const GUN = { rate: 9, mag: 30, reload: 1.8, damage: 34, head: 2, range: 220 };

let audio = null;
function sfx(kind) {
  try {
    audio ??= new AudioContext();
    const t = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
    const p = { shot: [220, 90, 0.08, 0.25, 'square'], hit: [1200, 900, 0.05, 0.15, 'sine'], kill: [600, 1500, 0.15, 0.2, 'triangle'], reload: [300, 500, 0.12, 0.12, 'sawtooth'], hurt: [140, 60, 0.18, 0.3, 'sawtooth'] }[kind];
    o.type = p[4]; o.frequency.setValueAtTime(p[0], t); o.frequency.exponentialRampToValueAtTime(p[1], t + p[2]);
    g.gain.setValueAtTime(p[3], t); g.gain.exponentialRampToValueAtTime(0.001, t + p[2]);
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + p[2]);
  } catch {}
}
export { sfx };

export class Weapon {
  constructor(camera, scene, color = 0xff4fa3) {
    this.camera = camera; this.scene = scene; this.color = color;
    this.ammo = GUN.mag; this.reloading = 0; this.cool = 0; this.kick = 0; this.spread = 0;
    // 1인칭 총 모델 (카메라에 붙인다)
    const g = new THREE.Group(), dark = new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.5, metalness: 0.4 });
    const add = (geo, m, x, y, z, rx = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.x = rx; g.add(o); return o; };
    add(new THREE.BoxGeometry(0.07, 0.11, 0.34), dark, 0, 0, 0);
    add(new THREE.CylinderGeometry(0.018, 0.018, 0.36, 10), dark, 0, 0.025, -0.33, Math.PI / 2);
    add(new THREE.BoxGeometry(0.05, 0.13, 0.06), dark, 0, -0.1, 0.08, 0.25);
    this.hopper = add(new THREE.SphereGeometry(0.065, 14, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.3, transparent: true, opacity: 0.85 }), 0, 0.11, -0.02);
    this.flash = add(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }), 0, 0.025, -0.53);
    g.position.set(0.17, -0.17, -0.38);
    g.traverse(o => { if (o.isMesh) { o.renderOrder = 10; o.material.depthTest = true; } });
    this.view = g; camera.add(g);
    this.splats = [];
    this.splatGeo = new THREE.CircleGeometry(0.22, 10);
  }

  setColor(c) { this.color = c; this.hopper.material.color.set(c); }

  /** 매 프레임. trigger: 쏘는 중, moving: 이동 중. 쏘면 true */
  update(dt, trigger, moving) {
    this.cool -= dt; this.kick = Math.max(0, this.kick - dt * 6);
    this.spread = Math.max(moving ? 0.012 : 0.003, this.spread - dt * 0.05);
    this.flash.material.opacity = Math.max(0, this.flash.material.opacity - dt * 20);
    if (this.reloading > 0) {
      this.reloading -= dt;
      this.view.rotation.x = -0.5 * Math.sin(Math.min(1, 1 - this.reloading / GUN.reload) * Math.PI);
      if (this.reloading <= 0) { this.ammo = GUN.mag; this.view.rotation.x = 0; }
      return false;
    }
    this.view.position.z = -0.38 + this.kick * 0.05;
    this.view.rotation.x = this.kick * 0.08;
    if (!trigger || this.cool > 0) return false;
    if (this.ammo <= 0) { this.startReload(); return false; }
    this.ammo--; this.cool = 1 / GUN.rate; this.kick = 1; this.spread = Math.min(0.03, this.spread + 0.004);
    this.flash.material.opacity = 1;
    sfx('shot');
    return true;
  }

  startReload() { if (this.reloading <= 0 && this.ammo < GUN.mag) { this.reloading = GUN.reload; sfx('reload'); } }

  /** 조준 방향 (퍼짐 포함) */
  aimRay() {
    const o = new THREE.Vector3(), d = new THREE.Vector3();
    this.camera.getWorldPosition(o); this.camera.getWorldDirection(d);
    d.x += (Math.random() - 0.5) * this.spread; d.y += (Math.random() - 0.5) * this.spread; d.z += (Math.random() - 0.5) * this.spread;
    return { origin: o, dir: d.normalize() };
  }

  /** 물감 자국 (최근 150개만 유지) */
  splat(point, normal, color = this.color) {
    const m = new THREE.Mesh(this.splatGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false }));
    m.position.copy(point).addScaledVector(normal, 0.02);
    m.lookAt(point.clone().add(normal));
    m.scale.setScalar(0.7 + Math.random() * 0.8);
    this.scene.add(m); this.splats.push(m);
    if (this.splats.length > 150) { const old = this.splats.shift(); this.scene.remove(old); old.material.dispose(); }
  }

  /** 페인트볼 궤적 (잠깐 보이는 선) */
  tracer(from, to, color = this.color) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 }));
    this.scene.add(line);
    setTimeout(() => { this.scene.remove(line); geo.dispose(); line.material.dispose(); }, 80);
  }
}
