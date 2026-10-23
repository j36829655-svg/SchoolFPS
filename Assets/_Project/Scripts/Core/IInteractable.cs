namespace SchoolFPS.Core
{
    /// <summary>E 키로 상호작용할 수 있는 대상(문, 사물함, 스위치 등)이 구현한다.</summary>
    public interface IInteractable
    {
        string Prompt { get; }
        void Interact(UnityEngine.GameObject interactor);
    }
}
