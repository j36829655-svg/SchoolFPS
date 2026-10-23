using UnityEngine;

namespace SchoolFPS.Core
{
    /// <summary>피해를 받을 수 있는 모든 대상(플레이어, 적, 부서지는 물체)이 구현한다.</summary>
    public interface IDamageable
    {
        void TakeDamage(float amount, Vector3 hitPoint, Vector3 hitNormal);
    }
}
