# Campus FPS

실제 캠퍼스 배치를 위성사진과 로드뷰로 측정해 만든 웹 3D FPS. 빌드 없이 브라우저에서 바로 실행된다.

- 플레이: https://j36829655-svg.github.io/SchoolFPS/
- 조작: WASD 이동 · Shift 달리기 · Space 점프 · 왼쪽 클릭 쏘기 · 오른쪽 클릭 조준 · R 재장전 · 숫자 1~0, -, = 무기 선택 · 휠/Q 무기 바꾸기 · Tab 점수판 · Esc 일시 정지
- 자유 탐색에서 F: 비행 (바라보는 방향으로 날기 · Space/E 위 · C/Q 아래 · Shift 빠르게)

## 게임 모드

- **무한 생존**: 난이도(쉬움·보통·어려움)를 고르고 시작. 라운드마다 몬스터를 모두 처치하면 정비 시간에 보급 상자와 새 총이 나온다.
  1~2라운드 좀비, 3~4라운드 거대 거미·박쥐, 5라운드마다 거인 보스. 혼자 하거나 방을 만들어 협동. 최고 기록은 브라우저에 저장
- **대전**: 방에 모인 사람끼리 개인전. 총 12종 모두 사용, 먼저 15킬 하면 승리
- **멀티플레이**: 방장이 "방 만들기"를 누르면 4자리 코드와 대기실이 나온다. 친구가 코드로 참가하면 대기실에 이름이 뜨고, 모두 들어오면 방장이 모드(협동 생존·대전)와 난이도를 골라 시작한다. 시작 후 들어온 사람은 바로 합류. 브라우저끼리 직접 연결(WebRTC)하므로 서버가 필요 없다. 학교·회사 네트워크에 따라 연결이 막힐 수 있다

## 구조

| 파일 | 내용 |
|---|---|
| `index.html` | 진입점 (Three.js는 CDN에서 불러옴) |
| `src/main.js` | 렌더러, 카메라, 입력, 게임 루프 |
| `src/physics.js` | 충돌(공간 해시 + 다각형/원), 중력, 점프, 시야 판정 |
| `src/world.js` | 캠퍼스 데이터로 건물·지면·도로·나무 생성 |
| `src/data/campus.js` | 건물·도로·운동장 좌표 (m, x=동쪽, y=북쪽). 숫자를 고치면 맵이 바뀜 |
| `src/data/trees.js` | 위성사진에서 자동 추출한 나무 위치 |
| `src/game/config.js` | **밸런스 수치 전부**: 총 12종, 몬스터 4종, 난이도, 라운드 구성, 보급 |
| `src/game/game.js` | 모드 규칙, 라운드, 사격 판정, 점수, 멀티 동기화 (방장이 판정) |
| `src/game/weapon.js` · `gunmodel.js` | 공통 무기 시스템(사격 방식·재장전·조준·반동·효과음), 1인칭 총 모델 |
| `src/game/monsters.js` | 몬스터 모양과 AI (탐색 → 추격 → 예고 → 공격 → 회복) |
| `src/game/nav.js` | 몬스터 길찾기 (2 m 격자 거리장) |
| `src/game/net.js` | PeerJS 연결, 방 코드 |
| `src/game/hud.js` · `minimap.js` · `avatar.js` | 화면 표시, 미니맵, 사람 모양 |

## 수정하기

`main`에 푸시하면 1분 안에 GitHub Pages에 반영된다. 저장소 페이지에서 `.` 키를 누르면 브라우저 에디터가 열린다.

로컬 미리보기(Windows): `powershell -File tools/serve.ps1` → http://localhost:8770

## 데이터 출처

- 항공사진·건물 외곽선·층수: [브이월드](https://www.vworld.kr) (국토교통부, 공공데이터) — 항공사진은 실행 중 브이월드 API에서 받아온다
- 도로: © OpenStreetMap contributors (ODbL)
- 나무 위치: 브이월드 항공사진에서 실행 중 자동 추출
- 고도: AWS Terrain Tiles (SRTM)
- 텍스처: ambientCG (CC0)
- 멀티플레이 연결: [PeerJS](https://peerjs.com) (MIT) 공개 시그널링 서버

## 건물 모델 다시 만들기 (Blender)

건물은 Blender 스크립트가 만든 `assets/models/buildings.glb`를 쓴다. 맵 데이터를 고친 뒤 다시 만들려면:

1. 로컬 서버(`tools/serve.ps1`)로 게임을 열고 콘솔에서 `game.exportSpecs()` → `tools/blender/spec.json` 저장
2. `blender -b --factory-startup -P tools/blender/build.py -- tools/blender/spec.json assets/models/buildings.glb`
