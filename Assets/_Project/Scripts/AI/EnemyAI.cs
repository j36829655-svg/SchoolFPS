using SchoolFPS.Core;
using UnityEngine;
using UnityEngine.AI;

namespace SchoolFPS.AI
{
    /// <summary>
    /// 순찰 → 플레이어 발견 시 추적 → 사거리 안이면 공격하는 간단한 적.
    /// 맵에 NavMesh를 구워야 움직인다(Window → AI → Navigation, NavMeshSurface 컴포넌트).
    /// </summary>
    [RequireComponent(typeof(NavMeshAgent), typeof(Health))]
    public class EnemyAI : MonoBehaviour
    {
        private enum State { Patrol, Chase, Attack, Dead }

        [SerializeField] private Transform[] patrolPoints;
        [SerializeField] private Transform eyes;

        [Header("Detection")]
        [SerializeField] private float sightRange = 20f;
        [SerializeField] private float sightAngle = 70f;
        [SerializeField] private LayerMask sightMask = ~0;

        [Header("Attack")]
        [SerializeField] private float attackRange = 12f;
        [SerializeField] private float attackDamage = 10f;
        [SerializeField] private float attackInterval = 1f;

        private NavMeshAgent agent;
        private Health health;
        private Transform player;
        private IDamageable playerDamageable;
        private State state = State.Patrol;
        private int patrolIndex;
        private float nextAttackTime;
        private Vector3 lastKnownPosition;

        private void Awake()
        {
            agent = GetComponent<NavMeshAgent>();
            health = GetComponent<Health>();
            health.OnDied.AddListener(Die);
            if (eyes == null) eyes = transform;
        }

        private void Start()
        {
            var playerObj = GameObject.FindGameObjectWithTag("Player");
            if (playerObj != null)
            {
                player = playerObj.transform;
                playerDamageable = playerObj.GetComponent<IDamageable>();
            }

            // NavMesh를 게임 시작 때 굽기 때문에, 에이전트를 그 위에 다시 올려 준다
            if (!agent.isOnNavMesh) agent.Warp(transform.position);

            GameManager.Instance?.RegisterEnemy();
            GoToNextPatrolPoint();
        }

        private void Update()
        {
            if (state == State.Dead || player == null || !agent.isOnNavMesh) return;

            bool canSee = CanSeePlayer();
            float dist = Vector3.Distance(transform.position, player.position);

            if (canSee) lastKnownPosition = player.position;

            if (canSee && dist <= attackRange) state = State.Attack;
            else if (canSee || state == State.Attack) state = State.Chase; // 놓치면 마지막 위치로 이동
            else if (state == State.Chase && !agent.pathPending && agent.remainingDistance < 0.5f)
            {
                state = State.Patrol; // 마지막으로 본 위치에 도착했는데 안 보이면 순찰 복귀
                GoToNextPatrolPoint();
            }

            switch (state)
            {
                case State.Patrol:
                    if (!agent.pathPending && agent.remainingDistance < 0.5f) GoToNextPatrolPoint();
                    break;

                case State.Chase:
                    agent.isStopped = false;
                    agent.SetDestination(lastKnownPosition);
                    break;

                case State.Attack:
                    agent.isStopped = true;
                    FacePlayer();
                    if (Time.time >= nextAttackTime)
                    {
                        nextAttackTime = Time.time + attackInterval;
                        playerDamageable?.TakeDamage(attackDamage, player.position, -transform.forward);
                    }
                    break;
            }
        }

        private bool CanSeePlayer()
        {
            Vector3 target = player.position + Vector3.up * 1.5f;
            Vector3 toPlayer = target - eyes.position;

            if (toPlayer.magnitude > sightRange) return false;
            if (Vector3.Angle(eyes.forward, toPlayer) > sightAngle * 0.5f) return false;

            // 벽에 가려졌는지 확인
            if (Physics.Raycast(eyes.position, toPlayer.normalized, out RaycastHit hit, sightRange, sightMask, QueryTriggerInteraction.Ignore))
                return hit.transform == player || hit.transform.IsChildOf(player);

            return false;
        }

        private void FacePlayer()
        {
            Vector3 dir = player.position - transform.position;
            dir.y = 0f;
            if (dir.sqrMagnitude > 0.01f)
                transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(dir), 10f * Time.deltaTime);
        }

        private void GoToNextPatrolPoint()
        {
            if (!agent.isOnNavMesh) return;
            agent.isStopped = false;
            if (patrolPoints == null || patrolPoints.Length == 0) return;

            agent.SetDestination(patrolPoints[patrolIndex].position);
            patrolIndex = (patrolIndex + 1) % patrolPoints.Length;
        }

        private void Die()
        {
            state = State.Dead;
            if (agent.isOnNavMesh) agent.isStopped = true;
            agent.enabled = false;

            // 쓰러지는 연출 대신 옆으로 눕힌다
            foreach (var col in GetComponentsInChildren<Collider>()) col.enabled = false;
            transform.rotation = Quaternion.LookRotation(Vector3.down, transform.forward);
            transform.position += Vector3.up * 0.4f;

            GameManager.Instance?.OnEnemyKilled();
            Destroy(gameObject, 3f);
        }
    }
}
