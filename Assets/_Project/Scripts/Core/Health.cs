using UnityEngine;
using UnityEngine.Events;

namespace SchoolFPS.Core
{
    /// <summary>플레이어와 적이 함께 쓰는 체력 컴포넌트.</summary>
    public class Health : MonoBehaviour, IDamageable
    {
        [SerializeField] private float maxHealth = 100f;

        public float Current { get; private set; }
        public float Max => maxHealth;
        public bool IsDead { get; private set; }

        public UnityEvent<float, float> OnHealthChanged = new UnityEvent<float, float>(); // (현재, 최대)
        public UnityEvent OnDied = new UnityEvent();

        private void Awake()
        {
            Current = maxHealth;
        }

        public void TakeDamage(float amount, Vector3 hitPoint, Vector3 hitNormal)
        {
            if (IsDead) return;

            Current = Mathf.Max(Current - amount, 0f);
            OnHealthChanged?.Invoke(Current, maxHealth);

            if (Current <= 0f)
            {
                IsDead = true;
                OnDied?.Invoke();
            }
        }

        public void Heal(float amount)
        {
            if (IsDead) return;

            Current = Mathf.Min(Current + amount, maxHealth);
            OnHealthChanged?.Invoke(Current, maxHealth);
        }
    }
}
