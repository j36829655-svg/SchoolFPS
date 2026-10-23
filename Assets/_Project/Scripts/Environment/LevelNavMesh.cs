using Unity.AI.Navigation;
using UnityEngine;

namespace SchoolFPS.Environment
{
    /// <summary>
    /// 게임이 시작될 때 맵의 NavMesh(적이 걸어 다닐 수 있는 영역)를 굽는다.
    /// 에디터에서 미리 굽지 않아도 되므로, 맵을 코드로 고쳐도 적 이동이 자동으로 맞춰진다.
    /// 맵 오브젝트들은 이 컴포넌트가 붙은 오브젝트의 자식으로 둔다.
    /// </summary>
    [DefaultExecutionOrder(-100)]
    [RequireComponent(typeof(NavMeshSurface))]
    public class LevelNavMesh : MonoBehaviour
    {
        private void Awake()
        {
            var surface = GetComponent<NavMeshSurface>();
            surface.collectObjects = CollectObjects.Children;
            surface.useGeometry = UnityEngine.AI.NavMeshCollectGeometry.PhysicsColliders;
            surface.BuildNavMesh();
        }
    }
}
