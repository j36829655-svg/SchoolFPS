# Campus FPS

실제 캠퍼스 배치를 위성사진과 로드뷰로 측정해 만든 웹 3D FPS. 빌드 없이 브라우저에서 바로 실행된다.

- 플레이: https://j36829655-svg.github.io/SchoolFPS/
- 조작: WASD 이동 · Shift 달리기 · Space 점프 · 마우스 왼쪽 쏘기 · R 재장전 · Tab 점수판 · Esc 메뉴
- 자유 탐색에서 F: 비행 (바라보는 방향으로 날기 · Space/E 위 · C/Q 아래 · Shift 빠르게)

## 게임 모드

- **좀비 모드**: 웨이브마다 좀비가 늘어난다. 혼자 하거나 방을 만들어 친구와 협동할 수 있다. 모두 쓰러지면 R로 다시 시작
- **페인트볼 대전**: 방에 모인 사람끼리 개인전. 먼저 15킬 하면 승리
- **멀티플레이**: 방장이 방을 만들면 4자리 코드가 나온다. 친구는 같은 페이지에서 코드를 넣고 참가. 브라우저끼리 직접 연결(WebRTC)하므로 서버가 필요 없다. 학교·회사 네트워크에 따라 연결이 막힐 수 있다

## 구조

| 파일 | 내용 |
|---|---|
| `index.html` | 진입점 (Three.js는 CDN에서 불러옴) |
| `src/main.js` | 렌더러, 카메라, 입력, 게임 루프 |
| `src/physics.js` | 충돌(공간 해시 + 다각형/원), 중력, 점프, 시야 판정 |
| `src/world.js` | 캠퍼스 데이터로 건물·지면·도로·나무 생성 |
| `src/data/campus.js` | 건물·도로·운동장 좌표 (m, x=동쪽, y=북쪽). 숫자를 고치면 맵이 바뀜 |
| `src/data/trees.js` | 위성사진에서 자동 추출한 나무 위치 |
| `src/game/game.js` | 모드 규칙, 좀비 웨이브, 사격 판정, 멀티 동기화 (방장이 판정) |
| `src/game/net.js` | PeerJS 연결, 방 코드 |
| `src/game/nav.js` | 좀비 길찾기 (2 m 격자 거리장) |
| `src/game/weapon.js` · `avatar.js` · `hud.js` | 총, 캐릭터 모델, 화면 표시 |

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
