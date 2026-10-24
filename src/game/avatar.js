import * as THREE from 'three';

// 사람·좀비 캐릭터: 상자로 만든 관절 인형. 원점 = 발바닥, 앞쪽 = -Z (three 기본 방향)
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, -h / 2, 0); // 위쪽 끝이 관절
const G = { leg: box(0.2, 0.85, 0.22), arm: box(0.15, 0.7, 0.15), torso: new THREE.BoxGeometry(0.52, 0.68, 0.3), head: new THREE.BoxGeometry(0.3, 0.32, 0.3) };
const matCache = new Map();
const mat = c => { if (!matCache.has(c)) matCache.set(c, new THREE.MeshLambertMaterial({ color: c })); return matCache.get(c); };

export class Avatar {
  /** zombie: 팔을 앞으로 뻗고 비틀거리며 걷는다 */
  constructor({ shirt = 0x3b6fd1, pants = 0x2a2d35, skin = 0xe2b892, zombie = false, name = '' } = {}) {
    this.zombie = zombie;
    this.root = new THREE.Group();
    const body = new THREE.Group(); // 몸 기울이기용
    this.root.add(body);
    const part = (geo, color, x, y, z) => { const m = new THREE.Mesh(geo, mat(color)); m.position.set(x, y, z); m.castShadow = true; body.add(m); return m; };
    this.legL = part(G.leg, pants, -0.13, 0.85, 0);
    this.legR = part(G.leg, pants, 0.13, 0.85, 0);
    this.torso = part(G.torso, shirt, 0, 1.19, 0);
    this.head = part(G.head, skin, 0, 1.71, 0);
    this.armL = part(G.arm, zombie ? skin : shirt, -0.34, 1.5, 0);
    this.armR = part(G.arm, zombie ? skin : shirt, 0.34, 1.5, 0);
    if (zombie) { // 눈: 붉게 빛나는 점
      const eye = new THREE.MeshBasicMaterial({ color: 0xff3b2f });
      for (const x of [-0.07, 0.07]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.02), eye); e.position.set(x, 1.74, -0.16); body.add(e); }
    }
    this.body = body;
    this.phase = Math.random() * 6;
    if (name) this.setName(name);
  }

  setName(name) {
    if (this.tag) this.root.remove(this.tag);
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g = c.getContext('2d');
    g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(0, 8, 256, 48);
    g.fillStyle = '#fff'; g.fillText(name.slice(0, 12), 128, 44);
    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
    this.tag.scale.set(1.4, 0.35, 1); this.tag.position.y = 2.25;
    this.root.add(this.tag);
  }

  /** speed: 수평 속도(m/s), attack: 0~1 공격 동작, dead: 쓰러짐 진행 0~1 */
  animate(dt, speed, attack = 0, dead = 0) {
    this.phase += dt * (2 + speed * 1.6);
    const sw = Math.min(1, speed / 4) * 0.7, s = Math.sin(this.phase);
    this.legL.rotation.x = s * sw;
    this.legR.rotation.x = -s * sw;
    if (this.zombie) {
      const reach = -1.35 + Math.sin(this.phase * 0.5) * 0.12 - attack * 0.6;
      this.armL.rotation.x = reach; this.armR.rotation.x = reach + Math.sin(this.phase) * 0.1;
      this.body.rotation.z = Math.sin(this.phase * 0.5) * 0.08;
    } else {
      this.armL.rotation.x = -s * sw * 0.8;
      this.armR.rotation.x = -1.2; // 총을 든 팔
    }
    this.body.rotation.x = dead * -1.5;   // 뒤로 쓰러짐
    this.body.position.y = dead * -0.4;
  }
}
