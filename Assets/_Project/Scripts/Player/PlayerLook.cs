using SchoolFPS.Core;
using UnityEngine;

namespace SchoolFPS.Player
{
    /// <summary>마우스 시점 회전. 몸통(이 오브젝트)은 좌우, 카메라 루트는 상하로 돈다.</summary>
    public class PlayerLook : MonoBehaviour
    {
        [SerializeField] private Transform cameraRoot;
        [SerializeField] private float sensitivity = 2f;
        [SerializeField] private float maxPitch = 85f;

        private float pitch;

        private void Update()
        {
            if (Cursor.lockState != CursorLockMode.Locked || Time.timeScale == 0f) return;

            Vector2 delta = GameInput.LookDelta * sensitivity;

            transform.Rotate(Vector3.up, delta.x);

            pitch = Mathf.Clamp(pitch - delta.y, -maxPitch, maxPitch);
            cameraRoot.localRotation = Quaternion.Euler(pitch, 0f, 0f);
        }
    }
}
