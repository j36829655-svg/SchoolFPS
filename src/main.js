import * as THREE from 'three';
import { CAMPUS } from './data/campus.js';
import { Physics, Body } from './physics.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { buildWorld } from './world.js';
import { loadTextures, tiled } from './textures.js';
import { applyAlignment } from './align.js';
import { loadOrtho, applyOrtho } from './ortho.js';

const EYE = 1.65, WALK = 4.5, RUN = 7.5, FLY = 25;
const SPAWN = { x: -40, y: -150, yaw: 0.6 }; // 주차장 근처, 북동쪽(학교 중심)을 바라봄
const SUN_DIR = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(48), THREE.MathUtils.degToRad(200)); // 고도 42°, 남남서

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xc9dbe8, 150, 650);

// 하늘: 물리 기반 대기 산란 → 배경 + 유리·금속에 비치는 환경맵
const sky = new Sky();
sky.scale.setScalar(2500);
sky.material.uniforms.turbidity.value = 6;
sky.material.uniforms.rayleigh.value = 1.6;
sky.material.uniforms.sunPosition.value.copy(SUN_DIR);
const pmrem = new THREE.PMREMGenerator(renderer);
const skyScene = new THREE.Scene(); skyScene.add(sky);
scene.environment = pmrem.fromScene(skyScene).texture;
scene.add(sky);

scene.add(new THREE.HemisphereLight(0xdfeeff, 0x6b7b55, 1.2));
const sun = new THREE.DirectionalLight(0xfff4e0, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 400 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 3000);
camera.rotation.order = 'YXZ';

await loadTextures();
applyAlignment(); // 측정 좌표 → 브이월드 실제 좌표
const physics = new Physics(CAMPUS.bounds);
const terrain = buildWorld(scene, physics);

// 항공사진은 게임을 막지 않고 뒤에서 받아 입힌다
let orthoMsg = '항공사진 불러오는 중';
loadOrtho([terrain.x0, terrain.y0, terrain.x0 + (terrain.nx - 1) * 2.5, terrain.y0 + (terrain.ny - 1) * 2.5], (d, n) => { orthoMsg = `항공사진 ${d}/${n}`; })
  .then(o => {
    if (!o) { orthoMsg = '항공사진을 불러오지 못했어요 (기본 잔디 사용)'; return; }
    applyOrtho(terrain.mesh, o, tiled('grass', 2.5));
    scene.traverse(m => { if (m.userData.orthoHide) m.visible = false; });
    orthoMsg = '항공사진·건물: 브이월드(국토교통부)';
  });
// 건물·나무·소품은 그림자를 드리우고, 땅과 바닥은 그림자를 받는다
scene.traverse(o => {
  if (!o.isMesh) return;
  o.receiveShadow = true;
  const flat = o.geometry.type === 'ShapeGeometry' || o.material.transparent;
  o.castShadow = !flat;
});
const groundAt = (x, y) => terrain.heightAt(x, y);

const body = new Body(physics, SPAWN.x, SPAWN.y, groundAt);
physics.resolve(body.pos, body.radius);
body.z = groundAt(body.pos.x, body.pos.y);
let yaw = SPAWN.yaw, pitch = 0, flying = false, flyHeight = 60;
// 디버그/테스트용 (브라우저 콘솔에서 game.body 등으로 접근)
window.game = { body, physics, camera, scene, terrain, set view(v) { ({ yaw, pitch, flying, flyHeight } = { yaw, pitch, flying, flyHeight, ...v }); } };

// ── 입력 ──
const keys = new Set();
addEventListener('keydown', e => {
  keys.add(e.code);
  if (e.code === 'KeyF') { flying = !flying; if (flying) flyHeight = body.z + 40; else body.z = Math.max(body.z, groundAt(body.pos.x, body.pos.y)); }
});
addEventListener('keyup', e => keys.delete(e.code));
// 마우스 잠금이 안 되는 환경(일부 브라우저, 앱 내장 브라우저)에서도 움직일 수 있게
// '플레이 중' 여부는 직접 관리하고, 잠금이 없으면 마우스 버튼을 누른 채 끌어서 시점을 돌린다.
const startEl = document.getElementById('start');
let playing = false, dragging = false;
function setPlaying(v) {
  playing = v;
  startEl.style.display = v ? 'none' : 'flex';
  if (!v) keys.clear();
}
startEl.addEventListener('click', () => {
  setPlaying(true);
  try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch {}
});
let hadLock = false;
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement) hadLock = true;
  else if (hadLock) { hadLock = false; setPlaying(false); } // Esc로 잠금이 풀리면 일시정지
});
addEventListener('keydown', e => { if (e.code === 'Escape' && playing && !document.pointerLockElement) setPlaying(false); });
renderer.domElement.addEventListener('mousedown', () => { dragging = true; });
addEventListener('mouseup', () => { dragging = false; });
addEventListener('mousemove', e => {
  if (!playing || (!document.pointerLockElement && !dragging)) return;
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
  const active = playing;

  // 이동 입력 → 월드 방향 (x 동, y 북). yaw 0 = 북쪽
  let f = 0, s = 0;
  if (active) {
    if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1; if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) s += 1; if (keys.has('KeyA') || keys.has('ArrowLeft')) s -= 1;
  }
  const len = Math.hypot(f, s) || 1;
  const sin = Math.sin(yaw), cos = Math.cos(yaw);
  const wish = { x: (-sin * f + cos * s) / len, y: (cos * f + sin * s) / len };

  if (flying) {
    const sp = FLY * (keys.has('ShiftLeft') ? 3 : 1);
    body.pos.x += wish.x * sp * dt; body.pos.y += wish.y * sp * dt;
    if (keys.has('Space')) flyHeight += sp * dt;
    if (keys.has('KeyC') || keys.has('ControlLeft')) flyHeight = Math.max(groundAt(body.pos.x, body.pos.y) + 2, flyHeight - sp * dt);
    camera.position.set(body.pos.x, flyHeight, -body.pos.y);
  } else {
    body.step(dt, wish, keys.has('ShiftLeft') ? RUN : WALK, active && keys.has('Space'));
    camera.position.set(body.pos.x, body.z + EYE, -body.pos.y);
  }
  camera.rotation.set(pitch, yaw, 0);

  // 그림자 영역이 플레이어를 따라다니게
  sun.target.position.copy(camera.position);
  sun.position.copy(camera.position).addScaledVector(SUN_DIR, 200);

  renderer.render(scene, camera);

  frames++; fpsT += dt;
  if (fpsT > 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
  hud.textContent = `${fps} FPS  ${flying ? '비행 모드' : '걷기 모드'}\nx ${body.pos.x.toFixed(1)}  y ${body.pos.y.toFixed(1)}\n${orthoMsg}`;
  requestAnimationFrame(tick);
}
tick();
