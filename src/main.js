import * as THREE from 'three';
import { CAMPUS } from './data/campus.js';
import { Physics, Body } from './physics.js';
import { buildWorld } from './world.js';

const EYE = 1.65, WALK = 4.5, RUN = 7.5, FLY = 25;
const SPAWN = { x: -40, y: -150, yaw: 0.6 }; // 주차장 근처, 북동쪽(학교 중심)을 바라봄

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9cc4e4);
scene.fog = new THREE.Fog(0x9cc4e4, 120, 520);
scene.add(new THREE.HemisphereLight(0xdfefff, 0x5b6b45, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(-120, 200, 80);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1500);
camera.rotation.order = 'YXZ';

const physics = new Physics(CAMPUS.bounds);
buildWorld(scene, physics);

const body = new Body(physics, SPAWN.x, SPAWN.y);
physics.resolve(body.pos, body.radius);
let yaw = SPAWN.yaw, pitch = 0, flying = false, flyHeight = 60;
// 디버그/테스트용 (브라우저 콘솔에서 game.body 등으로 접근)
window.game = { body, physics, camera, scene, set view(v) { ({ yaw, pitch, flying, flyHeight } = { yaw, pitch, flying, flyHeight, ...v }); } };

// ── 입력 ──
const keys = new Set();
addEventListener('keydown', e => {
  keys.add(e.code);
  if (e.code === 'KeyF') { flying = !flying; if (flying) flyHeight = Math.max(body.z + EYE, 40); }
});
addEventListener('keyup', e => keys.delete(e.code));
const startEl = document.getElementById('start');
startEl.addEventListener('click', () => renderer.domElement.requestPointerLock());
document.addEventListener('pointerlockchange', () => {
  startEl.style.display = document.pointerLockElement ? 'none' : 'flex';
});
addEventListener('mousemove', e => {
  if (!document.pointerLockElement) return;
  yaw -= e.movementX * 0.0022;
  pitch = Math.max(-1.5, Math.min(1.5, pitch - e.movementY * 0.0022));
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ── 루프 ──
const hud = document.getElementById('hud');
const clock = new THREE.Clock();
let fpsT = 0, frames = 0, fps = 0;

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const active = !!document.pointerLockElement;

  // 이동 입력 → 월드 방향 (x 동, y 북). yaw 0 = 북쪽
  let f = 0, s = 0;
  if (active) {
    if (keys.has('KeyW')) f += 1; if (keys.has('KeyS')) f -= 1;
    if (keys.has('KeyD')) s += 1; if (keys.has('KeyA')) s -= 1;
  }
  const len = Math.hypot(f, s) || 1;
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  const wish = { x: (-sin * f + cos * s) / len, y: (cos * f + sin * s) / len };

  if (flying) {
    const sp = FLY * (keys.has('ShiftLeft') ? 3 : 1);
    body.pos.x += wish.x * sp * dt; body.pos.y += wish.y * sp * dt;
    if (keys.has('Space')) flyHeight += sp * dt;
    if (keys.has('KeyC') || keys.has('ControlLeft')) flyHeight = Math.max(2, flyHeight - sp * dt);
    camera.position.set(body.pos.x, flyHeight, -body.pos.y);
  } else {
    body.step(dt, wish, keys.has('ShiftLeft') ? RUN : WALK, active && keys.has('Space'));
    camera.position.set(body.pos.x, body.z + EYE, -body.pos.y);
  }
  camera.rotation.set(pitch, yaw, 0);

  renderer.render(scene, camera);

  frames++; fpsT += dt;
  if (fpsT > 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
  hud.textContent = `${fps} FPS  ${flying ? '비행 모드' : '걷기 모드'}\nx ${body.pos.x.toFixed(1)}  y ${body.pos.y.toFixed(1)}`;
  requestAnimationFrame(tick);
}
tick();
