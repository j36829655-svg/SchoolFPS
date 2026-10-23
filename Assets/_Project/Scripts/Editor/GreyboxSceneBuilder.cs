using System.Collections.Generic;
using System.IO;
using SchoolFPS.AI;
using SchoolFPS.Core;
using SchoolFPS.Environment;
using SchoolFPS.Player;
using SchoolFPS.UI;
using SchoolFPS.Weapons;
using Unity.AI.Navigation;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.AI;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace SchoolFPS.EditorTools
{
    /// <summary>
    /// 학교 그레이박스(박스로만 만든 임시 맵) 씬을 코드로 만든다.
    /// Unity 없이 GitHub에서 이 파일만 고쳐도 다음 빌드에 맵이 바뀐다.
    ///   - 메뉴: SchoolFPS → Generate Greybox Scene
    ///   - CI 빌드: BuildScript가 빌드할 씬이 없으면 자동으로 호출
    ///
    /// 단위는 미터. 좌표계: +Z = 북쪽(본관 방향), +X = 동쪽, Y = 높이.
    /// </summary>
    public static class GreyboxSceneBuilder
    {
        public const string ScenePath = "Assets/_Project/Scenes/Greybox.unity";
        private const string GeneratedDir = "Assets/_Project/Generated";

        // ───────────── 학교 치수 (여기를 고치면 맵이 바뀐다) ─────────────
        private const float WallHeight = 3.3f;   // 층고
        private const float WallThick = 0.2f;
        private const float DoorWidth = 1.2f;
        private const float DoorHeight = 2.2f;

        private const float BuildingWest = -27f; // 본관 서쪽 끝 X
        private const float RoomWidth = 9f;      // 교실 가로
        private const int RoomCount = 6;         // 교실 수
        private const float CorridorSouth = 20f; // 복도 남쪽 벽 Z (운동장 쪽)
        private const float CorridorNorth = 23f; // 복도와 교실 사이 벽 Z
        private const float RoomDepth = 7.5f;    // 교실 세로

        private static float BuildingEast => BuildingWest + RoomWidth * RoomCount;
        private static float BuildingNorth => CorridorNorth + RoomDepth;
        private static float CorridorMidZ => (CorridorSouth + CorridorNorth) / 2f;

        private static readonly Vector3 PlayerSpawn = new Vector3(0f, 0f, -30f);

        // 적 배치: 각 줄이 적 한 명, 점들은 순찰 경로 (y는 무시하고 바닥에 맞춘다)
        private static readonly Vector3[][] EnemyRoutes =
        {
            new[] { new Vector3(-24f, 0, 21.5f), new Vector3(24f, 0, 21.5f) },  // 복도
            new[] { new Vector3(-20f, 0, 0f), new Vector3(20f, 0, 0f) },       // 운동장 가운데
            new[] { new Vector3(15f, 0, -15f), new Vector3(25f, 0, 5f) },      // 운동장 동쪽
            new[] { new Vector3(-4.5f, 0, 29.8f) },                            // 3번 교실 뒤쪽
            new[] { new Vector3(-20f, 0, 38f), new Vector3(20f, 0, 38f) },     // 본관 뒤
        };

        // 운동장 엄폐물: (중심, 크기)
        private static readonly (Vector3 center, Vector3 size)[] FieldCover =
        {
            (new Vector3(0f, 0.6f, 14f), new Vector3(8f, 1.2f, 3f)),     // 조회대
            (new Vector3(-12f, 0.6f, -8f), new Vector3(2f, 1.2f, 2f)),
            (new Vector3(12f, 0.6f, -8f), new Vector3(2f, 1.2f, 2f)),
            (new Vector3(-6f, 0.6f, -20f), new Vector3(3f, 1.2f, 1f)),
            (new Vector3(6f, 0.6f, -20f), new Vector3(3f, 1.2f, 1f)),
            (new Vector3(-25f, 1.25f, 5f), new Vector3(6f, 2.5f, 2.5f)), // 창고
            (new Vector3(25f, 1.25f, -25f), new Vector3(2.5f, 2.5f, 6f)),
        };

        // 운동장 크기 (본관 포함 전체 맵)
        private static readonly Vector3 GroundCenter = new Vector3(0f, -0.5f, -5f);
        private static readonly Vector3 GroundSize = new Vector3(100f, 1f, 100f);
        // ────────────────────────────────────────────────────────────

        private static Dictionary<string, Material> materials;
        private static Transform level;

        [MenuItem("SchoolFPS/Generate Greybox Scene")]
        public static void Build()
        {
            EnsureFolder(GeneratedDir);
            EnsureFolder(Path.GetDirectoryName(ScenePath).Replace('\\', '/'));
            CreateMaterials();

            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            SetupLighting();

            level = new GameObject("Level").transform;
            level.gameObject.AddComponent<NavMeshSurface>();
            level.gameObject.AddComponent<LevelNavMesh>();

            BuildGround();
            BuildSchool();
            BuildFieldCover();

            var playerHealth = BuildPlayer(out var weapon, out var interact);
            BuildEnemies();

            var gm = new GameObject("GameManager").AddComponent<GameManager>();
            SetRef(gm, "playerHealth", playerHealth);

            BuildHud(playerHealth, weapon, interact);

            EditorSceneManager.SaveScene(scene, ScenePath);
            AssetDatabase.SaveAssets();
            Debug.Log($"[SchoolFPS] Greybox scene generated at {ScenePath}");
        }

        // ───────────── 지형 / 건물 ─────────────

        private static void BuildGround()
        {
            Box("Ground", GroundCenter, GroundSize, "Field");

            // 맵 밖으로 못 나가게 둘레에 담장
            float hx = GroundSize.x / 2f, hz = GroundSize.z / 2f;
            var c = GroundCenter;
            Box("Fence_S", new Vector3(c.x, 1f, c.z - hz), new Vector3(GroundSize.x, 2f, 0.3f), "Fence");
            Box("Fence_N", new Vector3(c.x, 1f, c.z + hz), new Vector3(GroundSize.x, 2f, 0.3f), "Fence");
            Box("Fence_W", new Vector3(c.x - hx, 1f, c.z), new Vector3(0.3f, 2f, GroundSize.z), "Fence");
            Box("Fence_E", new Vector3(c.x + hx, 1f, c.z), new Vector3(0.3f, 2f, GroundSize.z), "Fence");
        }

        private static void BuildSchool()
        {
            var root = new GameObject("MainBuilding").transform;
            root.SetParent(level);

            float w = BuildingWest, e = BuildingEast, s = CorridorSouth, n = BuildingNorth;
            float cx = (w + e) / 2f, cz = (s + n) / 2f;

            // 바닥과 지붕
            Box("Floor", new Vector3(cx, 0f, cz), new Vector3(e - w, 0.1f, n - s), "Floor", root);
            Box("Roof", new Vector3(cx, WallHeight + 0.1f, cz), new Vector3(e - w + 0.4f, 0.2f, n - s + 0.4f), "Roof", root);

            // 바깥벽: 운동장 쪽에 현관 3곳, 양 끝에 복도 출입구
            WallX("Wall_South", s, w, e, new[] { (cx, 2.4f), (w + 4.5f, 1.6f), (e - 4.5f, 1.6f) }, root);
            WallX("Wall_North", n, w, e, null, root);
            WallZ("Wall_West", w, s, n, new[] { (CorridorMidZ, 1.6f) }, root);
            WallZ("Wall_East", e, s, n, new[] { (CorridorMidZ, 1.6f) }, root);

            // 복도-교실 벽: 교실마다 앞문/뒷문
            var gaps = new List<(float, float)>();
            for (int i = 0; i < RoomCount; i++)
            {
                float x0 = w + RoomWidth * i;
                gaps.Add((x0 + 1.5f, DoorWidth));
                gaps.Add((x0 + RoomWidth - 1.5f, DoorWidth));
            }
            WallX("Wall_Corridor", CorridorNorth, w, e, gaps.ToArray(), root);

            for (int i = 0; i < RoomCount; i++)
            {
                float x0 = w + RoomWidth * i;
                if (i > 0) WallZ($"Wall_Room{i}_West", x0, CorridorNorth, n, null, root);

                var room = new GameObject($"Classroom_{i + 1}").transform;
                room.SetParent(root);
                BuildClassroom(room, x0);

                SlidingDoor($"Door_{i + 1}_Front", new Vector3(x0 + 1.5f, 0f, CorridorNorth), root);
                SlidingDoor($"Door_{i + 1}_Back", new Vector3(x0 + RoomWidth - 1.5f, 0f, CorridorNorth), root);
            }
        }

        private static void BuildClassroom(Transform room, float x0)
        {
            float midZ = CorridorNorth + RoomDepth / 2f;

            // 칠판과 교탁 (교실 서쪽 벽이 앞쪽)
            Box("Blackboard", new Vector3(x0 + WallThick / 2f + 0.03f, 1.5f, midZ), new Vector3(0.05f, 1.2f, 4f), "Board", room);
            Box("TeacherDesk", new Vector3(x0 + 1.6f, 0.45f, midZ), new Vector3(0.7f, 0.9f, 1.6f), "Wood", room);

            // 학생 책상 4 x 4
            for (int col = 0; col < 4; col++)
            for (int row = 0; row < 4; row++)
            {
                var pos = new Vector3(x0 + 3.2f + col * 1.4f, 0.375f, CorridorNorth + 1.8f + row * 1.4f);
                Box($"Desk_{col}_{row}", pos, new Vector3(0.6f, 0.75f, 0.45f), "Wood", room);
            }
        }

        private static void BuildFieldCover()
        {
            var root = new GameObject("FieldCover").transform;
            root.SetParent(level);
            for (int i = 0; i < FieldCover.Length; i++)
                Box($"Cover_{i}", FieldCover[i].center, FieldCover[i].size, "Cover", root);
        }

        /// <summary>X축을 따라 가는 벽. gaps = (구멍 중심 X, 구멍 폭). 구멍 위에는 문틀(인방)을 얹는다.</summary>
        private static void WallX(string name, float z, float x0, float x1, (float center, float width)[] gaps, Transform parent)
        {
            var wall = new GameObject(name).transform;
            wall.SetParent(parent);
            foreach (var (a, b) in Segments(x0, x1, gaps))
                Box("Seg", new Vector3((a + b) / 2f, WallHeight / 2f, z), new Vector3(b - a, WallHeight, WallThick), "Wall", wall);
            if (gaps != null)
                foreach (var (c, gw) in gaps)
                    Box("Lintel", new Vector3(c, (DoorHeight + WallHeight) / 2f, z), new Vector3(gw, WallHeight - DoorHeight, WallThick), "Wall", wall);
        }

        /// <summary>Z축을 따라 가는 벽. gaps = (구멍 중심 Z, 구멍 폭).</summary>
        private static void WallZ(string name, float x, float z0, float z1, (float center, float width)[] gaps, Transform parent)
        {
            var wall = new GameObject(name).transform;
            wall.SetParent(parent);
            foreach (var (a, b) in Segments(z0, z1, gaps))
                Box("Seg", new Vector3(x, WallHeight / 2f, (a + b) / 2f), new Vector3(WallThick, WallHeight, b - a), "Wall", wall);
            if (gaps != null)
                foreach (var (c, gw) in gaps)
                    Box("Lintel", new Vector3(x, (DoorHeight + WallHeight) / 2f, c), new Vector3(WallThick, WallHeight - DoorHeight, gw), "Wall", wall);
        }

        private static IEnumerable<(float, float)> Segments(float from, float to, (float center, float width)[] gaps)
        {
            var sorted = new List<(float center, float width)>(gaps ?? new (float, float)[0]);
            sorted.Sort((p, q) => p.center.CompareTo(q.center));

            float cursor = from;
            foreach (var (c, gw) in sorted)
            {
                float gapStart = c - gw / 2f;
                if (gapStart > cursor + 0.01f) yield return (cursor, gapStart);
                cursor = c + gw / 2f;
            }
            if (to > cursor + 0.01f) yield return (cursor, to);
        }

        private static void SlidingDoor(string name, Vector3 bottomCenter, Transform parent)
        {
            var root = new GameObject(name).transform;
            root.SetParent(parent);
            root.position = bottomCenter;

            var panel = Box("Panel", bottomCenter + Vector3.up * (DoorHeight / 2f), new Vector3(DoorWidth, DoorHeight, 0.06f), "Door", root);

            panel.isStatic = false; // 움직이는 물체는 static이면 안 된다

            var door = root.gameObject.AddComponent<Door>();
            SetRef(door, "pivot", panel.transform);
            SetVector(door, "slideOffset", new Vector3(DoorWidth * 0.95f, 0f, 0f));
        }

        // ───────────── 플레이어 / 적 ─────────────

        private static Health BuildPlayer(out Weapon weapon, out PlayerInteract interact)
        {
            var player = new GameObject("Player") { tag = "Player" };
            player.transform.position = PlayerSpawn;

            var cc = player.AddComponent<CharacterController>();
            cc.height = 1.8f;
            cc.radius = 0.35f;
            cc.center = new Vector3(0f, 0.9f, 0f);

            var health = player.AddComponent<Health>();
            var movement = player.AddComponent<PlayerMovement>();
            var look = player.AddComponent<PlayerLook>();

            var cameraRoot = new GameObject("CameraRoot").transform;
            cameraRoot.SetParent(player.transform, false);
            cameraRoot.localPosition = new Vector3(0f, 1.7f, 0f);

            var camGo = new GameObject("Main Camera") { tag = "MainCamera" };
            camGo.transform.SetParent(cameraRoot, false);
            var cam = camGo.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.55f, 0.75f, 0.95f);
            cam.nearClipPlane = 0.05f;
            cam.fieldOfView = 75f;
            camGo.AddComponent<AudioListener>();

            interact = camGo.AddComponent<PlayerInteract>();
            SetRef(interact, "playerCamera", cam);

            // 총 모양 (충돌체가 있으면 내 총알이 막히므로 제거)
            var gun = new GameObject("Weapon");
            gun.transform.SetParent(camGo.transform, false);
            gun.transform.localPosition = new Vector3(0.25f, -0.22f, 0.45f);
            var gunMesh = Box("GunMesh", Vector3.zero, new Vector3(0.08f, 0.12f, 0.5f), "Gun", gun.transform, collider: false);
            gunMesh.transform.localPosition = Vector3.zero;

            weapon = gun.AddComponent<Weapon>();
            SetRef(weapon, "data", CreateWeaponData());
            SetRef(weapon, "playerCamera", cam);

            SetRef(movement, "cameraRoot", cameraRoot);
            SetRef(look, "cameraRoot", cameraRoot);

            // 플레이어는 운동장에서 본관을 바라보고 시작
            player.transform.rotation = Quaternion.LookRotation(Vector3.forward);
            return health;
        }

        private static void BuildEnemies()
        {
            var enemiesRoot = new GameObject("Enemies").transform;
            var pointsRoot = new GameObject("PatrolPoints").transform;

            for (int i = 0; i < EnemyRoutes.Length; i++)
            {
                var route = EnemyRoutes[i];
                var points = new Transform[route.Length];
                for (int p = 0; p < route.Length; p++)
                {
                    points[p] = new GameObject($"Enemy{i}_Point{p}").transform;
                    points[p].SetParent(pointsRoot);
                    points[p].position = new Vector3(route[p].x, 0f, route[p].z);
                }

                var enemy = GameObject.CreatePrimitive(PrimitiveType.Capsule);
                enemy.name = $"Enemy_{i}";
                enemy.transform.SetParent(enemiesRoot);
                enemy.transform.position = new Vector3(route[0].x, 1f, route[0].z);
                enemy.GetComponent<Renderer>().sharedMaterial = materials["Enemy"];

                var eyes = new GameObject("Eyes").transform;
                eyes.SetParent(enemy.transform, false);
                eyes.localPosition = new Vector3(0f, 0.6f, 0f);
                var visor = Box("Visor", Vector3.zero, new Vector3(0.6f, 0.15f, 0.3f), "Gun", eyes, collider: false);
                visor.transform.localPosition = new Vector3(0f, 0f, 0.35f);

                var agent = enemy.AddComponent<NavMeshAgent>();
                agent.baseOffset = 1f;
                agent.speed = 3f;
                agent.angularSpeed = 360f;

                var health = enemy.AddComponent<Health>();
                SetFloat(health, "maxHealth", 75f);

                var ai = enemy.AddComponent<EnemyAI>();
                SetRef(ai, "eyes", eyes);
                SetFloat(ai, "attackDamage", 8f);
                SetFloat(ai, "attackInterval", 1.2f);
                var so = new SerializedObject(ai);
                var arr = so.FindProperty("patrolPoints");
                arr.arraySize = points.Length;
                for (int p = 0; p < points.Length; p++)
                    arr.GetArrayElementAtIndex(p).objectReferenceValue = points[p];
                so.ApplyModifiedPropertiesWithoutUndo();
            }
        }

        private static WeaponData CreateWeaponData()
        {
            string path = $"{GeneratedDir}/PaintballMarker.asset";
            var data = AssetDatabase.LoadAssetAtPath<WeaponData>(path);
            if (data == null)
            {
                data = ScriptableObject.CreateInstance<WeaponData>();
                AssetDatabase.CreateAsset(data, path);
            }
            return data;
        }

        // ───────────── 조명 / HUD ─────────────

        private static void SetupLighting()
        {
            var sun = new GameObject("Sun").AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.shadows = LightShadows.Soft;
            sun.intensity = 1.1f;
            sun.transform.rotation = Quaternion.Euler(50f, -30f, 0f);

            RenderSettings.ambientMode = AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.55f, 0.55f, 0.6f);
            RenderSettings.skybox = null;
        }

        private static void BuildHud(Health playerHealth, Weapon weapon, PlayerInteract interact)
        {
            var canvasGo = new GameObject("HUD");
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1920f, 1080f);
            scaler.matchWidthOrHeight = 0.5f;

            var t = canvasGo.transform;

            // 체력바
            var bg = UiImage("HealthBg", t, new Vector2(0, 0), new Vector2(0, 0), new Vector2(40, 40), new Vector2(400, 26), new Color(0, 0, 0, 0.6f));
            var fill = UiImage("HealthFill", bg.transform, Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, new Color(0.3f, 0.85f, 0.4f));
            fill.rectTransform.pivot = new Vector2(0f, 0.5f);
            fill.rectTransform.offsetMin = new Vector2(3, 3);
            fill.rectTransform.offsetMax = new Vector2(-3, -3);

            var ammo = UiText("Ammo", t, new Vector2(1, 0), new Vector2(1, 0), new Vector2(-40, 40), new Vector2(400, 60), 44, TextAnchor.LowerRight);
            var enemies = UiText("Enemies", t, new Vector2(1, 1), new Vector2(1, 1), new Vector2(-40, -30), new Vector2(400, 50), 30, TextAnchor.UpperRight);
            var prompt = UiText("Prompt", t, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, -80), new Vector2(600, 50), 28, TextAnchor.MiddleCenter);
            var center = UiText("CenterMessage", t, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0, 120), new Vector2(1200, 200), 56, TextAnchor.MiddleCenter);
            UiText("Crosshair", t, new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(60, 60), 36, TextAnchor.MiddleCenter).text = "+";
            UiText("Controls", t, new Vector2(0, 1), new Vector2(0, 1), new Vector2(30, -25), new Vector2(900, 40), 20, TextAnchor.UpperLeft).text =
                "WASD move   Shift sprint   Space jump   C crouch   LMB shoot   R reload   E door   P pause";

            var hud = canvasGo.AddComponent<HUD>();
            SetRef(hud, "playerHealth", playerHealth);
            SetRef(hud, "weapon", weapon);
            SetRef(hud, "interact", interact);
            SetRef(hud, "healthFill", fill.rectTransform);
            SetRef(hud, "ammoText", ammo);
            SetRef(hud, "enemiesText", enemies);
            SetRef(hud, "promptText", prompt);
            SetRef(hud, "centerText", center);
        }

        private static Image UiImage(string name, Transform parent, Vector2 anchorMin, Vector2 anchorMax, Vector2 pos, Vector2 size, Color color)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rt = (RectTransform)go.transform;
            rt.anchorMin = anchorMin;
            rt.anchorMax = anchorMax;
            rt.pivot = anchorMin;
            rt.anchoredPosition = pos;
            rt.sizeDelta = size;
            var img = go.AddComponent<Image>();
            img.color = color;
            img.raycastTarget = false;
            return img;
        }

        private static Text UiText(string name, Transform parent, Vector2 anchor, Vector2 pivot, Vector2 pos, Vector2 size, int fontSize, TextAnchor align)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rt = (RectTransform)go.transform;
            rt.anchorMin = rt.anchorMax = anchor;
            rt.pivot = pivot;
            rt.anchoredPosition = pos;
            rt.sizeDelta = size;

            var text = go.AddComponent<Text>();
            text.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            text.fontSize = fontSize;
            text.alignment = align;
            text.color = Color.white;
            text.raycastTarget = false;
            text.horizontalOverflow = HorizontalWrapMode.Overflow;
            text.verticalOverflow = VerticalWrapMode.Overflow;
            go.AddComponent<Shadow>().effectDistance = new Vector2(2, -2);
            return text;
        }

        // ───────────── 공용 도우미 ─────────────

        private static GameObject Box(string name, Vector3 center, Vector3 size, string material, Transform parent = null, bool collider = true)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = name;
            go.transform.SetParent(parent != null ? parent : level, false);
            go.transform.position = center;
            go.transform.localScale = size;
            go.GetComponent<Renderer>().sharedMaterial = materials[material];
            if (!collider) Object.DestroyImmediate(go.GetComponent<Collider>());
            go.isStatic = collider;
            return go;
        }

        private static void CreateMaterials()
        {
            var colors = new Dictionary<string, Color>
            {
                { "Field", new Color(0.62f, 0.52f, 0.38f) },  // 흙 운동장
                { "Fence", new Color(0.3f, 0.45f, 0.3f) },
                { "Floor", new Color(0.55f, 0.5f, 0.45f) },
                { "Roof", new Color(0.35f, 0.35f, 0.38f) },
                { "Wall", new Color(0.92f, 0.88f, 0.78f) },
                { "Door", new Color(0.55f, 0.38f, 0.25f) },
                { "Wood", new Color(0.7f, 0.55f, 0.35f) },
                { "Board", new Color(0.12f, 0.3f, 0.2f) },
                { "Cover", new Color(0.35f, 0.5f, 0.75f) },
                { "Enemy", new Color(0.85f, 0.25f, 0.2f) },
                { "Gun", new Color(0.15f, 0.15f, 0.17f) },
            };

            materials = new Dictionary<string, Material>();
            var shader = Shader.Find("Standard");
            foreach (var kv in colors)
            {
                string path = $"{GeneratedDir}/M_{kv.Key}.mat";
                var mat = AssetDatabase.LoadAssetAtPath<Material>(path);
                if (mat == null)
                {
                    mat = new Material(shader);
                    AssetDatabase.CreateAsset(mat, path);
                }
                mat.color = kv.Value;
                mat.SetFloat("_Glossiness", 0.1f);
                EditorUtility.SetDirty(mat);
                materials[kv.Key] = mat;
            }
        }

        private static void EnsureFolder(string assetPath)
        {
            if (AssetDatabase.IsValidFolder(assetPath)) return;
            Directory.CreateDirectory(assetPath);
            AssetDatabase.Refresh();
        }

        private static void SetRef(Object target, string field, Object value)
        {
            var so = new SerializedObject(target);
            so.FindProperty(field).objectReferenceValue = value;
            so.ApplyModifiedPropertiesWithoutUndo();
        }

        private static void SetFloat(Object target, string field, float value)
        {
            var so = new SerializedObject(target);
            so.FindProperty(field).floatValue = value;
            so.ApplyModifiedPropertiesWithoutUndo();
        }

        private static void SetVector(Object target, string field, Vector3 value)
        {
            var so = new SerializedObject(target);
            so.FindProperty(field).vector3Value = value;
            so.ApplyModifiedPropertiesWithoutUndo();
        }
    }
}
