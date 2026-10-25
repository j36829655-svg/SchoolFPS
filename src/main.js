import * as THREE from 'three';
import { CAMPUS } from './data/campus.js';
import { TERRAIN } from './data/terrain.js';
import { PARTS } from './data/details.js';
import { Physics, Body } from './physics.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { buildWorld, BUILDING_SPECS } from './world.js';
import { loadModels } from './models.js';
import { loadTextures, tiled } from './textures.js';
import { applyAlignment } from './align.js';
import { loadOrtho, applyOrtho } from './ortho.js';
import { signedDist } from './terrain.js';
import { Game } from './game/game.js';
import { Hud } from './game/hud.js';
import { Net } from './game/net.js';
import { SLOT_KEYS, DIFFICULTY } from './game/config.js';

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

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 3000);
camera.rotation.order = 'YXZ';
scene.add(camera); // 1인칭 총 모델이 카메라에 붙어 있어 장면에 넣어야 보인다

const $ = id => document.getElementById(id);
await loadTextures();
applyAlignment(); // 측정 좌표 → 브이월드 실제 좌표
const physics = new Physics(CAMPUS.bounds);

// 항공사진을 먼저 받는다: 지형 색과 나무 위치를 실제 사진에서 뽑기 위해 (최대 15초, 실패하면 기본 잔디·기존 나무)
const T = TERRAIN, terrainBox = [T.x0, T.y0, T.x0 + (T.nx - 1) * T.step, T.y0 + (T.ny - 1) * T.step];
const ortho = await Promise.race([
  loadOrtho(terrainBox, (d, n) => { $('loading').textContent = `항공사진 불러오는 중… ${d}/${n}`; }),
  new Promise(res => setTimeout(() => res(null), 15000)),
]);
const orthoMsg = ortho ? '항공사진·건물: 브이월드(국토교통부) · 도로: OpenStreetMap' : '항공사진을 불러오지 못했어요 (기본 잔디 사용)';
$('loading').textContent = '건물 모델 불러오는 중…';
const models = await loadModels().catch(e => { console.warn('Blender 모델 없음', e); return null; });
const terrain = buildWorld(scene, physics, ortho && { ...ortho, apply: mesh => applyOrtho(mesh, ortho, tiled('grass', 2.5)) }, models);
// 건물·나무·소품은 그림자를 드리우고, 땅과 바닥은 그림자를 받는다
const worldMeshes = [];
scene.traverse(o => {
  if (!o.isMesh) return;
  o.receiveShadow = true;
  const flat = o.geometry.type === 'ShapeGeometry' || o.material.transparent;
  o.castShadow = !flat;
  if (o.userData.solid) worldMeshes.push(o);
});
const groundAt = (x, y) => terrain.heightAt(x, y);

const body = new Body(physics, SPAWN.x, SPAWN.y, groundAt);
physics.resolve(body.pos, body.radius);
body.z = groundAt(body.pos.x, body.pos.y);
let yaw = SPAWN.yaw, pitch = 0, flying = false, flyZ = 60;

// ── 게임 ──
const hud = new Hud();
const solids = [...CAMPUS.buildings, ...PARTS, ...CAMPUS.greenhouses].map(b => b.pts).concat(CAMPUS.grounds.filter(g => g.type === 'water').map(g => g.pts));
const game = new Game({
  scene, camera, physics, groundAt, solids, signedDist, worldMeshes, bounds: CAMPUS.bounds, ortho, campus: CAMPUS,
  bodyPos: () => ({ x: body.pos.x, y: body.pos.y, z: body.z }),
  yaw: () => yaw, pitch: () => pitch,
  recoil: (dp, dy) => { pitch = Math.min(1.5, pitch + dp); yaw += dy; },
  teleport: (x, y) => { body.pos.x = x; body.pos.y = y; physics.resolve(body.pos, body.radius); body.z = groundAt(body.pos.x, body.pos.y); body.vx = body.vy = body.vz = 0; },
}, hud);

// 디버그/테스트용 (브라우저 콘솔에서 game.body 등으로 접근). view.flyHeight = 비행 높이(절대)
window.game = { body, physics, camera, scene, terrain, play: game, fit: () => fitView(),
  // 개발용: 건물 사양을 tools/blender/spec.json 으로 저장 (로컬 서버에서만 동작)
  exportSpecs: () => fetch('/__save?file=spec.json', { method: 'POST', body: JSON.stringify(BUILDING_SPECS) }),
  set view(v) { ({ yaw, pitch, flying } = { yaw, pitch, flying, ...v }); if (v.flyHeight !== undefined) flyZ = v.flyHeight; } };

// ── 메뉴 ──
const startEl = $('start');
$('loading').classList.add('hidden'); $('main').classList.remove('hidden');
$('name').value = localStorage.getItem('cfps-name') || '';
const playerName = () => { const n = $('name').value.trim() || '플레이어'; try { localStorage.setItem('cfps-name', n); } catch {} return n; };
const status = t => { $('status').textContent = t; };
let mode = null; // null(메뉴) | 'explore' | 'zombie' | 'pvp' | 'client'
// 난이도 선택 + 최고 기록 표시
let diff = localStorage.getItem('cfps-diff') || 'normal';
function showDiff() {
  document.querySelectorAll('#diff button').forEach(b => b.classList.toggle('sel', b.dataset.d === diff));
  let best = {}; try { best = JSON.parse(localStorage.getItem('cfps-best') || '{}'); } catch {}
  const b = best[diff]; $('best').textContent = b ? `최고 기록 (${DIFFICULTY[diff].name}): ${b.score.toLocaleString()}점 · 라운드 ${b.round}` : '';
}
document.querySelectorAll('#diff button').forEach(b => b.onclick = () => { diff = b.dataset.d; try { localStorage.setItem('cfps-diff', diff); } catch {} showDiff(); });
showDiff();

function begin(m) {
  mode = m; flying = false;
  $('resume').classList.toggle('hidden', false); $('leave').classList.toggle('hidden', false);
  $('restart').classList.toggle('hidden', !(m === 'zombie' || m === 'pvp'));
  setPlaying(true);
}
$('solo').onclick = () => { game.start({ mode: 'zombie', name: playerName(), diff }); begin('zombie'); };
$('explore').onclick = () => { game.stop(); begin('explore'); };
$('resume').onclick = () => setPlaying(true);
$('restart').onclick = () => { game.restart(); setPlaying(true); };
$('leave').onclick = () => { game.stop(); mode = null; ['resume', 'leave', 'restart'].forEach(id => $(id).classList.add('hidden')); status(''); showDiff(); };
async function hostRoom(m) {
  try {
    status('방 만드는 중…');
    const net = new Net(), code = await net.host();
    game.start({ mode: m, net, name: playerName(), diff });
    status(`방 코드: ${code}\n친구에게 알려 주세요`);
    begin(m);
    hud.feed(`방 코드 ${code}`);
  } catch (e) { status('방을 만들지 못했어요: ' + (e.message || e)); }
}
$('hostZombie').onclick = () => hostRoom('zombie');
$('hostPvp').onclick = () => hostRoom('pvp');
$('join').onclick = async () => {
  const code = $('code').value.trim();
  if (code.length !== 4) return status('4자리 방 코드를 입력하세요');
  try {
    status('연결 중…');
    const net = new Net(); await net.join(code);
    game.start({ mode: 'zombie', net, name: playerName() }); // 실제 모드는 방장이 보내는 상태로 바뀐다
    status(`방 ${code.toUpperCase()}에 참가했어요`);
    begin('client');
  } catch (e) { status('참가하지 못했어요: ' + (e.message || e)); }
};

// ── 입력 ──
const keys = new Set();
let fireHeld = false, aimHeld = false, reloadPressed = false, restartPressed = false, slotPressed = null, cycleDir = 0;
addEventListener('keydown', e => {
  if (document.activeElement?.tagName === 'INPUT') return;
  keys.add(e.code);
  if (e.code === 'Tab') e.preventDefault();
  if (e.code === 'KeyR') { reloadPressed = true; restartPressed = true; }
  const slot = SLOT_KEYS.indexOf(e.code); if (slot >= 0) slotPressed = slot;
  if (e.code === 'KeyQ' && mode !== 'explore') cycleDir = 1;
  if (e.code === 'KeyF' && mode === 'explore') {
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
  $('cross').style.display = game.active ? 'none' : ''; // 게임 중에는 HUD 조준점을 쓴다
  $('pauseNote').textContent = !v && game.active ? (game.net ? '멀티플레이 중에는 게임이 멈추지 않아요' : '일시 정지') : '';
  if (!v) { keys.clear(); fireHeld = aimHeld = false; }
  else try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch {}
}
let hadLock = false;
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement) hadLock = true;
  else if (hadLock) { hadLock = false; setPlaying(false); } // Esc로 잠금이 풀리면 메뉴
});
addEventListener('keydown', e => { if (e.code === 'Escape' && playing && !document.pointerLockElement) setPlaying(false); });
renderer.domElement.addEventListener('mousedown', e => { dragging = true; if (e.button === 0 && playing) fireHeld = true; if (e.button === 2 && playing) aimHeld = true; });
addEventListener('mouseup', e => { dragging = false; if (e.button === 0) fireHeld = false; if (e.button === 2) aimHeld = false; });
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('wheel', e => { if (playing && game.active) cycleDir = Math.sign(e.deltaY); }, { passive: true });
addEventListener('mousemove', e => {
  if (!playing || (!document.pointerLockElement && !dragging)) return;
  const sens = 0.0022 * camera.fov / 75; // 조준(확대) 중에는 감도도 낮춘다
  yaw -= e.movementX * sens;
  pitch = Math.max(-1.5, Math.min(1.5, pitch - e.movementY * sens));
});
// 창 크기에 맞춘다. 앱 내장 브라우저처럼 resize 이벤트 없이 크기가 바뀌는 곳도 있어 매 프레임 확인한다
function fitView() {
  const w = innerWidth, h = innerHeight, c = renderer.domElement;
  if (c.clientWidth === w && c.clientHeight === h && renderer.getPixelRatio() === Math.min(devicePixelRatio, 2)) return;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', fitView);

// ── 루프 ──
const devHud = $('hud');
const clock = new THREE.Clock();
let fpsT = 0, frames = 0, fps = 0;

function tick() {
  fitView();
  const dt = Math.min(clock.getDelta(), 0.05);
  const inGame = game.active;
  const active = playing && (!inGame || game.canMove());

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
    body.step(dt, wish, (keys.has('ShiftLeft') ? RUN : WALK) * (inGame ? game.moveMul() : 1), active && keys.has('Space'));
    const down = inGame && !game.canMove() && !game.over ? 1.2 : 0; // 쓰러지면 시선이 낮아진다
    camera.position.set(body.pos.x, body.z + EYE - down, -body.pos.y);
  }
  camera.rotation.set(pitch, yaw, 0);

  // 혼자 할 때는 메뉴를 열면 게임이 멈춘다 (멀티는 계속 진행)
  if (playing || game.net) game.update(dt, { trigger: playing && fireHeld, aim: playing && aimHeld, moving: !!(f || s), sprint: keys.has('ShiftLeft') && f > 0,
    reload: reloadPressed, restart: restartPressed && playing, board: keys.has('Tab'), slot: slotPressed, cycle: cycleDir });
  reloadPressed = restartPressed = false; slotPressed = null; cycleDir = 0;

  // 그림자 영역이 플레이어를 따라다니게
  sun.target.position.copy(camera.position);
  sun.position.copy(camera.position).addScaledVector(SUN_DIR, 200);

  renderer.render(scene, camera);

  frames++; fpsT += dt;
  if (fpsT > 0.5) { fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
  devHud.textContent = inGame ? `${fps} FPS` : `${fps} FPS  ${flying ? '비행 모드' : '걷기 모드'}\nx ${body.pos.x.toFixed(1)}  y ${body.pos.y.toFixed(1)}\n${orthoMsg}`;
  requestAnimationFrame(tick);
}
tick();
