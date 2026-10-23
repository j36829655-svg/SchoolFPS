using SchoolFPS.Core;
using UnityEngine;

namespace SchoolFPS.Environment
{
    /// <summary>
    /// 교실 문. 경첩 위치에 빈 오브젝트(pivot)를 두고 문 메시를 그 자식으로 넣는다.
    /// slide를 켜면 미닫이문(교실 앞뒷문)처럼 옆으로 밀린다.
    /// </summary>
    public class Door : MonoBehaviour, IInteractable
    {
        [SerializeField] private Transform pivot;
        [SerializeField] private bool slide = true;
        [SerializeField] private float openAngle = 90f;
        [SerializeField] private Vector3 slideOffset = new Vector3(1f, 0f, 0f);
        [SerializeField] private float speed = 4f;
        [SerializeField] private bool locked;

        private bool isOpen;
        private Vector3 closedPos;
        private Quaternion closedRot;

        public string Prompt => locked ? "Locked" : isOpen ? "Close door" : "Open door";

        private void Awake()
        {
            if (pivot == null) pivot = transform;
            closedPos = pivot.localPosition;
            closedRot = pivot.localRotation;
        }

        public void Interact(GameObject interactor)
        {
            if (locked) return;
            isOpen = !isOpen;
        }

        public void SetLocked(bool value) => locked = value;

        private void Update()
        {
            float t = speed * Time.deltaTime;
            if (slide)
            {
                Vector3 target = isOpen ? closedPos + slideOffset : closedPos;
                pivot.localPosition = Vector3.Lerp(pivot.localPosition, target, t);
            }
            else
            {
                Quaternion target = isOpen ? closedRot * Quaternion.Euler(0f, openAngle, 0f) : closedRot;
                pivot.localRotation = Quaternion.Slerp(pivot.localRotation, target, t);
            }
        }
    }
}
