using SchoolFPS.Core;
using UnityEngine;

namespace SchoolFPS.Player
{
    /// <summary>화면 중앙의 상호작용 대상을 찾고 E 키로 실행한다.</summary>
    public class PlayerInteract : MonoBehaviour
    {
        [SerializeField] private Camera playerCamera;
        [SerializeField] private float range = 2.5f;
        [SerializeField] private LayerMask interactMask = ~0;

        /// <summary>HUD가 표시할 안내 문구. 대상이 없으면 null.</summary>
        public string CurrentPrompt { get; private set; }

        private IInteractable current;

        private void Update()
        {
            current = null;
            CurrentPrompt = null;
            if (Time.timeScale == 0f) return;

            var ray = new Ray(playerCamera.transform.position, playerCamera.transform.forward);
            if (Physics.Raycast(ray, out RaycastHit hit, range, interactMask, QueryTriggerInteraction.Ignore))
            {
                current = hit.collider.GetComponentInParent<IInteractable>();
                CurrentPrompt = current?.Prompt;
            }

            if (current != null && GameInput.InteractPressed)
                current.Interact(gameObject);
        }
    }
}
