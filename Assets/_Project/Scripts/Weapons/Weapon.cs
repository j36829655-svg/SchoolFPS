using System.Collections;
using SchoolFPS.Core;
using UnityEngine;

namespace SchoolFPS.Weapons
{
    /// <summary>히트스캔(레이캐스트) 방식 무기. 좌클릭 발사, R 재장전.</summary>
    public class Weapon : MonoBehaviour
    {
        [SerializeField] private WeaponData data;
        [SerializeField] private Camera playerCamera;
        [SerializeField] private LayerMask hitMask = ~0;
        [SerializeField] private AudioSource audioSource;
        [SerializeField] private ParticleSystem muzzleFlash;

        public int AmmoInMagazine { get; private set; }
        public bool IsReloading { get; private set; }
        public WeaponData Data => data;

        private float nextFireTime;

        private void Awake()
        {
            AmmoInMagazine = data.magazineSize;
        }

        private void OnDisable()
        {
            // 무기 교체 중 재장전이 끊기면 상태를 되돌린다
            IsReloading = false;
        }

        private void Update()
        {
            if (Time.timeScale == 0f || IsReloading || Cursor.lockState != CursorLockMode.Locked) return;

            bool fireInput = data.automatic ? GameInput.FireHeld : GameInput.FirePressed;

            if (fireInput && Time.time >= nextFireTime)
            {
                if (AmmoInMagazine > 0) Fire();
                else StartCoroutine(Reload());
            }

            if (GameInput.ReloadPressed && AmmoInMagazine < data.magazineSize)
                StartCoroutine(Reload());
        }

        private void Fire()
        {
            nextFireTime = Time.time + 1f / data.fireRate;
            AmmoInMagazine--;

            if (muzzleFlash != null) muzzleFlash.Play();
            if (audioSource != null && data.fireSound != null) audioSource.PlayOneShot(data.fireSound);

            Transform cam = playerCamera.transform;
            Vector3 dir = Quaternion.Euler(
                Random.Range(-data.spread, data.spread),
                Random.Range(-data.spread, data.spread),
                0f) * cam.forward;

            if (Physics.Raycast(cam.position, dir, out RaycastHit hit, data.range, hitMask, QueryTriggerInteraction.Ignore))
            {
                var target = hit.collider.GetComponentInParent<IDamageable>();
                target?.TakeDamage(data.damage, hit.point, hit.normal);

                if (data.impactEffect != null)
                {
                    var fx = Instantiate(data.impactEffect, hit.point, Quaternion.LookRotation(hit.normal));
                    Destroy(fx, 5f);
                }
            }
        }

        private IEnumerator Reload()
        {
            if (IsReloading) yield break;

            IsReloading = true;
            if (audioSource != null && data.reloadSound != null) audioSource.PlayOneShot(data.reloadSound);

            yield return new WaitForSeconds(data.reloadTime);

            AmmoInMagazine = data.magazineSize;
            IsReloading = false;
        }
    }
}
