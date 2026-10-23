using UnityEngine;
using UnityEngine.SceneManagement;

namespace SchoolFPS.Core
{
    public enum GameState { Playing, Paused, GameOver, Victory }

    /// <summary>게임 상태(진행/일시정지/게임오버/승리)와 마우스 커서를 관리한다. 씬마다 하나만 둔다.</summary>
    public class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        [SerializeField] private Health playerHealth;

        public GameState State { get; private set; } = GameState.Playing;
        public int EnemiesRemaining { get; private set; }

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        private void Start()
        {
            if (playerHealth != null)
                playerHealth.OnDied.AddListener(GameOver);

            SetState(GameState.Playing);
        }

        private void Update()
        {
            switch (State)
            {
                case GameState.Playing:
                    if (GameInput.PausePressed) SetState(GameState.Paused);
                    // 웹 브라우저는 클릭해야 마우스를 잠글 수 있고, Esc를 누르면 브라우저가 잠금을 푼다
                    else if (Cursor.lockState != CursorLockMode.Locked && GameInput.FirePressed) LockCursor(true);
                    break;

                case GameState.Paused:
                    if (GameInput.PausePressed || GameInput.FirePressed) SetState(GameState.Playing);
                    break;

                case GameState.GameOver:
                case GameState.Victory:
                    if (GameInput.RestartPressed) Restart();
                    break;
            }
        }

        public void RegisterEnemy() => EnemiesRemaining++;

        public void OnEnemyKilled()
        {
            EnemiesRemaining = Mathf.Max(EnemiesRemaining - 1, 0);
            if (EnemiesRemaining == 0 && State == GameState.Playing)
                SetState(GameState.Victory);
        }

        public void GameOver() => SetState(GameState.GameOver);

        public void Restart()
        {
            Time.timeScale = 1f;
            SceneManager.LoadScene(SceneManager.GetActiveScene().buildIndex);
        }

        private void SetState(GameState newState)
        {
            State = newState;

            bool playing = newState == GameState.Playing;
            Time.timeScale = playing ? 1f : 0f;
            LockCursor(playing);
        }

        private static void LockCursor(bool locked)
        {
            Cursor.lockState = locked ? CursorLockMode.Locked : CursorLockMode.None;
            Cursor.visible = !locked;
        }
    }
}
