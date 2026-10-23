using SchoolFPS.Core;
using UnityEngine;

namespace SchoolFPS.Player
{
    /// <summary>WASD 이동, Shift 달리기, Space 점프, Ctrl(또는 C) 앉기. CharacterController 기반.</summary>
    [RequireComponent(typeof(CharacterController))]
    public class PlayerMovement : MonoBehaviour
    {
        [Header("Speed")]
        [SerializeField] private float walkSpeed = 4f;
        [SerializeField] private float sprintSpeed = 7f;
        [SerializeField] private float crouchSpeed = 2f;

        [Header("Jump / Gravity")]
        [SerializeField] private float jumpHeight = 1.2f;
        [SerializeField] private float gravity = -20f;

        [Header("Crouch")]
        [SerializeField] private float standHeight = 1.8f;
        [SerializeField] private float crouchHeight = 1.0f;
        [SerializeField] private Transform cameraRoot;

        private CharacterController controller;
        private float verticalVelocity;
        private bool isCrouching;

        public bool IsSprinting { get; private set; }

        private void Awake()
        {
            controller = GetComponent<CharacterController>();
            controller.height = standHeight;
            controller.center = Vector3.up * (standHeight / 2f);
        }

        private void Update()
        {
            Vector2 input = GameInput.Move;

            HandleCrouch(GameInput.Crouch);
            IsSprinting = GameInput.Sprint && input.y > 0 && !isCrouching;

            float speed = isCrouching ? crouchSpeed : IsSprinting ? sprintSpeed : walkSpeed;
            Vector3 move = (transform.right * input.x + transform.forward * input.y) * speed;

            // 점프와 중력
            if (controller.isGrounded)
            {
                if (verticalVelocity < 0) verticalVelocity = -2f;
                if (GameInput.JumpPressed && !isCrouching)
                    verticalVelocity = Mathf.Sqrt(jumpHeight * -2f * gravity);
            }
            verticalVelocity += gravity * Time.deltaTime;
            move.y = verticalVelocity;

            controller.Move(move * Time.deltaTime);
        }

        private void HandleCrouch(bool wantsCrouch)
        {
            if (wantsCrouch == isCrouching) return;

            // 머리 위가 막혀 있으면 일어서지 않는다
            if (!wantsCrouch && Physics.Raycast(transform.position + Vector3.up * crouchHeight, Vector3.up, standHeight - crouchHeight))
                return;

            isCrouching = wantsCrouch;
            controller.height = isCrouching ? crouchHeight : standHeight;
            controller.center = Vector3.up * (controller.height / 2f);

            if (cameraRoot != null)
                cameraRoot.localPosition = Vector3.up * (controller.height - 0.1f);
        }
    }
}
