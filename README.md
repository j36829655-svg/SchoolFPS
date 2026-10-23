# Campus FPS

실제 캠퍼스 배치를 위성사진과 로드뷰로 측정해 만든 웹 3D FPS. 빌드 없이 브라우저에서 바로 실행된다.

- 플레이: https://j36829655-svg.github.io/SchoolFPS/
- 조작: WASD 이동 · Shift 달리기 · Space 점프 · F 비행 모드(맵 둘러보기) · Esc 일시정지

## 구조

| 파일 | 내용 |
|---|---|
| `index.html` | 진입점 (Three.js는 CDN에서 불러옴) |
| `src/main.js` | 렌더러, 카메라, 입력, 게임 루프 |
| `src/physics.js` | 충돌(공간 해시 + 다각형/원), 중력, 점프, 시야 판정 |
| `src/world.js` | 캠퍼스 데이터로 건물·지면·도로·나무 생성 |
| `src/data/campus.js` | 건물·도로·운동장 좌표 (m, x=동쪽, y=북쪽). 숫자를 고치면 맵이 바뀜 |
| `src/data/trees.js` | 위성사진에서 자동 추출한 나무 위치 |

## 수정하기

`main`에 푸시하면 1분 안에 GitHub Pages에 반영된다. 저장소 페이지에서 `.` 키를 누르면 브라우저 에디터가 열린다.

로컬 미리보기(Windows): `powershell -File tools/serve.ps1` → http://localhost:8770
