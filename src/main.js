import * as THREE from 'three';
import { CAMPUS } from './data/campus.js';
import { TERRAIN } from './data/terrain.js';
import { Physics, Body } from './physics.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { buildWorld, BUILDING_SPECS } from './world.js';
import { loadModels } from './models.js';
import { loadTextures, tiled } from './textures.js';
import { applyAlignment } from './align.js';
import { loadOrtho, applyOrtho } from './ortho.js';

const EYE = 1.65, WALK = 4.5, RUN = 7.5, FLY = 25;
const SPAWN = { x: -76, y: -180, yaw: -0.4 }; // 정문 진입로, 북북동(학교 안쪽)을 바라봄
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

const startEl = document.getElementById('start');
const startHtml = startEl.innerHTML;
await loadTextures();
applyAlignment(); // 측정 좌표 → 브이월드 실제 좌표
const physics = new Physics(CAMPUS.bounds);

// 항공사진을 먼저 받는다: 지형 색과 나무 위치를 실제 사진에서 뽑기 위해 (최대 15초, 실패하면 기본 잔디·기존 나무)
const T = TERRAIN, terrainBox = [T.x0, T.y0, T.x0 + (T.nx - 1) * T.step, T.y0 + (T.ny - 1) * T.step];
startEl.innerHTML = '항공사진 불러오는 중…';
const ortho = await Promise.race([
  loadOrtho(terrainBox, (d, n) => { startEl.innerHTML = `항공사진 불러오는 중… ${d}/${n}`; }),
  new Promise(res => setTimeout(() => res(null), 15000)),
]);
startEl.innerHTML = startHtml;
const orthoMsg = ortho ? '항공사진·건물: 브이월드(국토교통부) · 도로: OpenStreetMap' : '항공사진을 불러오지 못했어요 (기본 잔디 사용)';
const models = await loadModels().catch(e => { console.warn('Blender 모델 없음', e); return null; });
const terrain = buildWorld(scene, physics, ortho && { ...ortho, apply: mesh => applyOrtho(mesh, ortho, tiled('grass', 2.5)) }, models);
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
let yaw = SPAWN.yaw, pitch = 0, flying = false, flyZ = 60;
// 디버그/테스트용 (브라우저 콘솔에서 game.body 등으로 접근). view.flyHeight = 비행 높이(절대)
window.game = { body, physics, camera, scene, terrain,
  // 개발용: 건물 사양을 tools/blender/spec.json 으로 저장 (로컬 서버에서만 동작)
  exportSpecs: () => fetch('/__save?file=spec.json', { method: 'POST', body: JSON.stringify(BUILDING_SPECS) }),
  set view(v) { ({ yaw, pitch, flying } = { yaw, pitch, flying, ...v }); if (v.flyHeight !== undefined) flyZ = v.flyHeight; } };

// ── 입력 ──
const keys = new Set();
addEventListener('keydown', e => {
  keys.add(e.code);
  if (e.code === 'KeyF') {
    flying = !flying;
    if (flying) flyZ = body.z + EYE;
    else { body.z = Math.max(flyZ - EYE, groundAt(body.pos.x, body.pos.y)); body.vz = 0; body.onGround = false; } // 내리면 그 자리에서 떨어진다
  }
});
addEventListener('keyup', e => keys.delete(e.code));
// 마우스 잠금이 안 되는 환경(일부 브라우저, 앱 내장 브라우저)에서도 움직일 수 있게
// '플레이 중' 여부는 직접 관리하고, 잠금이 없으면 마우스 버튼을 누른 채 끌어서 시점을 돌린다.
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
    // 개발용 자유 비행: W/S는 바라보는 방향(위아래 포함)으로, Space·E 위로, C·Q·Ctrl 아래로. 벽을 통과한다
    const sp = FLY * (keys.has('ShiftLeft') ? 3 : 1), cp = Math.cos(pitch);
    let up = 0;
    if (active && (keys.has('Space') || keys.has('KeyE'))) up += 1;
    if (active && (keys.has('KeyC') || keys.has('KeyQ') || keys.has('ControlLeft'))) up -= 1;
    body.pos.x += (-sin * cp * f + cos * s) * sp * dt;
    body.pos.y += (cos * cp * f + sin * s) * sp * dt;
    flyZ = Math.max(groundAt(body.pos.x, body.pos.y) + 1, flyZ + (Math.sin(pitch) * f + up) * sp * dt);
    camera.position.set(body.pos.x, flyZ, -body.pos.y);
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
