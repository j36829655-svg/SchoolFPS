using UnityEngine;
#if !ENABLE_LEGACY_INPUT_MANAGER && ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
#endif

namespace SchoolFPS.Core
{
    /// <summary>
    /// 입력을 한곳에서 읽는다. 프로젝트 설정(Active Input Handling)이 예전 Input Manager든
    /// 새 Input System이든 똑같이 동작하도록 감싼 것. 키 배치를 바꾸려면 여기만 고치면 된다.
    /// </summary>
    public static class GameInput
    {
#if !ENABLE_LEGACY_INPUT_MANAGER && ENABLE_INPUT_SYSTEM
        private static Keyboard Kb => Keyboard.current;
        private static Mouse M => Mouse.current;

        public static bool Forward => Kb != null && Kb.wKey.isPressed;
        public static bool Back => Kb != null && Kb.sKey.isPressed;
        public static bool Left => Kb != null && Kb.aKey.isPressed;
        public static bool Right => Kb != null && Kb.dKey.isPressed;
        public static bool Sprint => Kb != null && Kb.leftShiftKey.isPressed;
        public static bool Crouch => Kb != null && (Kb.leftCtrlKey.isPressed || Kb.cKey.isPressed);
        public static bool JumpPressed => Kb != null && Kb.spaceKey.wasPressedThisFrame;
        public static bool InteractPressed => Kb != null && Kb.eKey.wasPressedThisFrame;
        public static bool ReloadPressed => Kb != null && Kb.rKey.wasPressedThisFrame;
        public static bool PausePressed => Kb != null && (Kb.escapeKey.wasPressedThisFrame || Kb.pKey.wasPressedThisFrame);
        public static bool RestartPressed => Kb != null && Kb.rKey.wasPressedThisFrame;

        public static bool FireHeld => M != null && M.leftButton.isPressed;
        public static bool FirePressed => M != null && M.leftButton.wasPressedThisFrame;
        // 새 Input System의 delta는 픽셀 단위라 예전 방식과 비슷하도록 줄인다
        public static Vector2 LookDelta => M != null ? M.delta.ReadValue() * 0.1f : Vector2.zero;
#else
        public static bool Forward => Input.GetKey(KeyCode.W);
        public static bool Back => Input.GetKey(KeyCode.S);
        public static bool Left => Input.GetKey(KeyCode.A);
        public static bool Right => Input.GetKey(KeyCode.D);
        public static bool Sprint => Input.GetKey(KeyCode.LeftShift);
        public static bool Crouch => Input.GetKey(KeyCode.LeftControl) || Input.GetKey(KeyCode.C);
        public static bool JumpPressed => Input.GetKeyDown(KeyCode.Space);
        public static bool InteractPressed => Input.GetKeyDown(KeyCode.E);
        public static bool ReloadPressed => Input.GetKeyDown(KeyCode.R);
        public static bool PausePressed => Input.GetKeyDown(KeyCode.Escape) || Input.GetKeyDown(KeyCode.P);
        public static bool RestartPressed => Input.GetKeyDown(KeyCode.R);

        public static bool FireHeld => Input.GetMouseButton(0);
        public static bool FirePressed => Input.GetMouseButtonDown(0);
        public static Vector2 LookDelta => new Vector2(Input.GetAxisRaw("Mouse X"), Input.GetAxisRaw("Mouse Y"));
#endif

        public static Vector2 Move
        {
            get
            {
                var v = Vector2.zero;
                if (Forward) v.y += 1;
                if (Back) v.y -= 1;
                if (Right) v.x += 1;
                if (Left) v.x -= 1;
                return Vector2.ClampMagnitude(v, 1f);
            }
        }
    }
}
