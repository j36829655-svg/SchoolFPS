# SchoolFPS

우리 학교를 배경으로 한 1인칭 슈팅(페인트볼/서바이벌 콘셉트) Unity 프로젝트.

`main` 브랜치에 푸시하면 GitHub Actions가 **WebGL로 빌드해서 GitHub Pages에 올린다.** 링크만 열면 브라우저에서 바로 플레이할 수 있다.

## 1. 어디서든 수정하기

| 어디서 | 방법 |
|---|---|
| 아무 브라우저 | 저장소 페이지에서 `.` 키 → github.dev 에디터. 고치고 Commit하면 자동 빌드 |
| 폰 | GitHub 앱이나 웹에서 파일 열고 연필 아이콘으로 수정 |
| 내 PC (Unity 없이) | `git clone` → VS Code로 수정 → push |
| 내 PC (Unity 있음) | Unity Hub → Add → 이 폴더 열기. 씬을 직접 편집 가능 |

**맵은 코드로 만들어진다.** 학교 구조(교실 수, 크기, 문 위치, 적 배치, 엄폐물)는
[`GreyboxSceneBuilder.cs`](Assets/_Project/Scripts/Editor/GreyboxSceneBuilder.cs) 위쪽의 `학교 치수` 구역에 모여 있다.
숫자만 바꿔서 커밋하면 다음 빌드에 반영된다.

빌드에는 약 15~30분 걸린다. 진행 상황은 저장소의 **Actions** 탭에서 볼 수 있다.

## 2. GitHub 빌드 설정 (처음 한 번)

Unity는 무료(Personal)라도 라이선스 인증이 필요해서, 저장소에 시크릿 3개를 넣어야 한다.

1. PC에 **Unity Hub**를 설치하고 Unity 계정으로 로그인
2. Unity Hub → 설정(톱니바퀴) → Licenses → **Add** → *Get a free personal license*
3. 라이선스 파일이 생긴다: `C:\ProgramData\Unity\Unity_lic.ulf`
4. 저장소 → **Settings → Secrets and variables → Actions → New repository secret** 에서 추가

   | 이름 | 값 |
   |---|---|
   | `UNITY_LICENSE` | `Unity_lic.ulf` 파일을 메모장으로 열어 **전체 내용**을 붙여넣기 |
   | `UNITY_EMAIL` | Unity 계정 이메일 |
   | `UNITY_PASSWORD` | Unity 계정 비밀번호 |

5. **Actions** 탭 → *Build & Deploy (WebGL)* → **Run workflow**

시크릿은 암호화되어 저장되고, 공개 저장소여도 다른 사람에게 보이지 않는다.

## 3. 조작법

| 키 | 동작 |
|---|---|
| WASD | 이동 |
| Shift | 달리기 |
| Space | 점프 |
| C / 왼쪽 Ctrl | 앉기 |
| 마우스 왼쪽 | 발사 (웹에서는 처음에 한 번 클릭해야 마우스가 잠김) |
| R | 재장전 / 게임 끝난 뒤 재시작 |
| E | 문 열기·닫기 |
| P | 일시정지 (웹에서 Esc는 브라우저가 마우스 잠금 해제에 씀) |

목표: 학교 안팎의 적을 모두 쓰러뜨리기.

## 4. 폴더 구조

```
.github/workflows/build.yml   ← 자동 빌드 & 배포
Assets/_Project/              ← 우리가 만든 것만 여기에 (외부 에셋과 분리)
├── Art/                      Models(School·Props·Weapons), Materials, Textures, Animations
├── Audio/                    SFX, Music
├── Prefabs/                  Player, Weapons, Enemies, Environment, UI
├── Scenes/                   Greybox.unity는 빌드 때 자동 생성
├── ScriptableObjects/Weapons/
├── Settings/
└── Scripts/
    ├── Core/        GameManager, GameInput, Health, IDamageable, IInteractable
    ├── Player/      PlayerMovement, PlayerLook, PlayerInteract
    ├── Weapons/     Weapon, WeaponData
    ├── AI/          EnemyAI
    ├── UI/          HUD
    ├── Environment/ Door, LevelNavMesh
    └── Editor/      GreyboxSceneBuilder (맵 생성), BuildScript (CI 빌드)
Docs/Reference/               학교 사진, 배치도 등 참고 자료 (공개 저장소이니 주의)
Packages/manifest.json        사용하는 Unity 패키지
ProjectSettings/              Unity 버전(6000.0.85f1) 등
```

## 5. 스크립트 역할

| 스크립트 | 하는 일 |
|---|---|
| `GameInput` | 모든 키 입력을 한곳에서 읽음. 키 배치를 바꾸려면 여기만 수정 |
| `GameManager` | 진행/일시정지/게임오버/승리 상태, 마우스 잠금, 남은 적 수 |
| `Health` | 체력과 피격·사망 이벤트. 플레이어와 적이 같이 씀 |
| `PlayerMovement` / `PlayerLook` | 이동, 달리기, 점프, 앉기 / 마우스 시점 |
| `PlayerInteract` | 화면 중앙 대상과 E 키 상호작용 |
| `WeaponData` / `Weapon` | 무기 수치 에셋 / 발사(레이캐스트)와 재장전 |
| `EnemyAI` | 순찰 → 발견 시 추적 → 사거리 안이면 공격 |
| `HUD` | 체력바, 탄약, 남은 적, 안내 문구 |
| `Door` | 미닫이(교실문) 또는 여닫이 문 |
| `LevelNavMesh` | 게임 시작 때 적이 다닐 길(NavMesh)을 자동으로 계산 |
| `GreyboxSceneBuilder` | 학교 맵 씬을 코드로 생성 (Unity 메뉴: SchoolFPS → Generate Greybox Scene) |
| `BuildScript` | CI 빌드 진입점 (Unity 메뉴: SchoolFPS → Build WebGL) |

## 6. 알아둘 점

- 화면 글자는 영어로 되어 있다. 웹 빌드에는 한글 글꼴이 없어서, 한글을 쓰려면 한글 폰트(예: 나눔고딕 .ttf)를 프로젝트에 넣고 `GreyboxSceneBuilder`의 `UiText`에서 그 폰트를 쓰게 바꿔야 한다.
- Unity로 직접 씬을 만들어 **Build Settings에 등록하고 커밋**하면, 그때부터는 자동 생성 맵 대신 그 씬이 빌드된다.
- 저장소가 공개라 누구나 코드를 볼 수 있다. 학교 실명, 학생 얼굴이 나온 사진은 올리지 말 것.
- Unity로 열면 `Library/` 폴더가 몇 GB로 커진다. OneDrive 폴더 안에 두면 동기화가 느려지므로, Unity 작업은 OneDrive 밖(예: `C:\Projects\SchoolFPS`)에 clone해서 하는 걸 권장.

## 7. 개발 로드맵

1. **그레이박스** ✅ – 코드로 만든 박스 학교에서 돌아다니기
2. **게임플레이 다듬기** – 반동, 조준(우클릭), 피격 효과, 사운드
3. **모델링** – Blender로 실제 학교 건물을 만들어 `Art/Models/School`에 `.fbx`로 교체 (교실 ≈ 9m × 7.5m, 복도 폭 ≈ 2.5~3m, 층고 ≈ 3.3m)
4. **2층, 계단, 체육관** 등 맵 확장
5. **모드** – 팀전, 깃발 뺏기, 좀비 웨이브
