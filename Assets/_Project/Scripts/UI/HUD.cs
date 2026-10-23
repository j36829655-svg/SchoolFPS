using SchoolFPS.Core;
using SchoolFPS.Player;
using SchoolFPS.Weapons;
using UnityEngine;
using UnityEngine.UI;

namespace SchoolFPS.UI
{
    /// <summary>
    /// 체력바, 탄약, 남은 적, 상호작용 안내, 일시정지/게임오버/승리 패널을 갱신한다.
    /// 웹 빌드에서 한글 글꼴이 없으므로 화면 문구는 영어로 둔다(한글을 쓰려면 한글 폰트를 프로젝트에 넣을 것).
    /// </summary>
    public class HUD : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private Health playerHealth;
        [SerializeField] private Weapon weapon;
        [SerializeField] private PlayerInteract interact;

        [Header("UI")]
        [Tooltip("왼쪽 끝이 pivot인 막대. 체력 비율만큼 가로로 줄어든다")]
        [SerializeField] private RectTransform healthFill;
        [SerializeField] private Text ammoText;
        [SerializeField] private Text enemiesText;
        [SerializeField] private Text promptText;
        [SerializeField] private Text centerText;

        private void Start()
        {
            if (playerHealth != null)
            {
                playerHealth.OnHealthChanged.AddListener(UpdateHealth);
                UpdateHealth(playerHealth.Current, playerHealth.Max);
            }
        }

        private void Update()
        {
            if (weapon != null && ammoText != null)
                ammoText.text = weapon.IsReloading ? "Reloading..." : $"{weapon.AmmoInMagazine} / {weapon.Data.magazineSize}";

            if (promptText != null)
            {
                string prompt = interact != null ? interact.CurrentPrompt : null;
                promptText.text = string.IsNullOrEmpty(prompt) ? "" : $"[E] {prompt}";
            }

            var gm = GameManager.Instance;
            if (gm == null) return;

            if (enemiesText != null)
                enemiesText.text = $"Enemies: {gm.EnemiesRemaining}";

            if (centerText != null)
            {
                centerText.text = gm.State switch
                {
                    GameState.Paused => "PAUSED\nClick or press P to resume",
                    GameState.GameOver => "GAME OVER\nPress R to restart",
                    GameState.Victory => "SCHOOL CLEARED!\nPress R to play again",
                    _ => Cursor.lockState != CursorLockMode.Locked ? "Click to play" : "",
                };
            }
        }

        private void UpdateHealth(float current, float max)
        {
            if (healthFill != null) healthFill.localScale = new Vector3(current / max, 1f, 1f);
        }
    }
}
