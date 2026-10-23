using UnityEngine;

namespace SchoolFPS.Weapons
{
    /// <summary>
    /// 무기 수치를 담는 에셋. Project 창에서 우클릭 → Create → SchoolFPS → Weapon Data.
    /// 같은 Weapon 스크립트에 다른 데이터를 넣어 권총/소총 등을 만든다.
    /// </summary>
    [CreateAssetMenu(menuName = "SchoolFPS/Weapon Data", fileName = "NewWeapon")]
    public class WeaponData : ScriptableObject
    {
        public string displayName = "Paintball Marker";

        [Header("Damage")]
        public float damage = 25f;
        public float range = 100f;

        [Header("Fire")]
        [Tooltip("초당 발사 수")]
        public float fireRate = 8f;
        public bool automatic = true;
        [Tooltip("탄 퍼짐 각도(도)")]
        public float spread = 1f;

        [Header("Ammo")]
        public int magazineSize = 30;
        public float reloadTime = 1.8f;

        [Header("Effects (optional)")]
        public AudioClip fireSound;
        public AudioClip reloadSound;
        public GameObject impactEffect;
    }
}
