// 휴대폰 조작: 왼쪽 아래 조이스틱(이동, 끝까지 밀면 달리기), 화면 오른쪽을 끌어 시점,
// 오른쪽 버튼(쏘기 — 누른 채 끌면 시점도 돈다, 조준, 점프, 재장전, 무기 바꾸기), 왼쪽 위 일시 정지.
export const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

const css = `
#tc{position:fixed;inset:0;display:none;touch-action:none;user-select:none;-webkit-user-select:none;z-index:5}
#tc .stick{position:absolute;left:28px;bottom:28px;width:130px;height:130px;border-radius:50%;background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.35)}
#tc .knob{position:absolute;left:40px;top:40px;width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,.55)}
#tc button{position:absolute;border-radius:50%;border:2px solid rgba(255,255,255,.5);background:rgba(20,24,32,.45);color:#fff;font:700 13px system-ui;touch-action:none}
#tc button.on{background:rgba(225,29,72,.7)}
#tc .fire{right:26px;bottom:60px;width:84px;height:84px;font-size:15px}
#tc .aim{right:122px;bottom:30px;width:58px;height:58px}
#tc .jump{right:122px;bottom:100px;width:58px;height:58px}
#tc .reload{right:40px;bottom:160px;width:52px;height:52px}
#tc .swap{right:104px;bottom:170px;width:52px;height:52px}
#tc .pause{left:12px;top:12px;width:44px;height:44px;border-radius:10px}
`;

export function createTouch(onPause) {
  const S = { mx: 0, my: 0, lookX: 0, lookY: 0, fire: false, aim: false, sprint: false, jump: false, reload: false, cycle: 0, show() {} };
  if (!isTouch) return S;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const el = document.createElement('div'); el.id = 'tc';
  el.innerHTML = `<div class="stick"><div class="knob"></div></div><button class="fire">쏘기</button><button class="aim">조준</button>
    <button class="jump">점프</button><button class="reload">R</button><button class="swap">무기</button><button class="pause">II</button>`;
  document.body.appendChild(el);
  const q = s => el.querySelector(s), knob = q('.knob'), stick = q('.stick');
  let stickId = null, lookId = null, fireId = null, last = {};
  const R = 50;
  const setStick = (dx, dy) => {
    const l = Math.hypot(dx, dy), k = l > R ? R / l : 1;
    knob.style.transform = `translate(${dx * k}px,${dy * k}px)`;
    S.mx = dx * k / R; S.my = -dy * k / R; S.sprint = l > R * 1.15; // 원 밖까지 밀면 달리기
  };
  let origin = null;
  stick.addEventListener('touchstart', e => { e.preventDefault(); const t = e.changedTouches[0]; stickId = t.identifier; const r = stick.getBoundingClientRect(); origin = [r.left + r.width / 2, r.top + r.height / 2]; setStick(t.clientX - origin[0], t.clientY - origin[1]); }, { passive: false });
  // 화면 아무 곳(버튼·조이스틱 밖)을 끌면 시점
  el.addEventListener('touchstart', e => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.target === el && lookId === null) { lookId = t.identifier; last[t.identifier] = [t.clientX, t.clientY]; }
  }, { passive: false });
  const tap = (sel, down, up) => { const b = q(sel); b.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); down(e.changedTouches[0], b); }, { passive: false }); if (up) b.addEventListener('touchend', e => { e.preventDefault(); up(b); }, { passive: false }); };
  tap('.fire', (t, b) => { S.fire = true; fireId = t.identifier; last[t.identifier] = [t.clientX, t.clientY]; b.classList.add('on'); }, b => { S.fire = false; fireId = null; b.classList.remove('on'); });
  tap('.aim', (t, b) => { S.aim = !S.aim; b.classList.toggle('on', S.aim); });
  tap('.jump', () => { S.jump = true; });
  tap('.reload', () => { S.reload = true; });
  tap('.swap', () => { S.cycle = 1; });
  tap('.pause', () => onPause());
  addEventListener('touchmove', e => {
    for (const t of e.changedTouches) {
      if (t.identifier === stickId) setStick(t.clientX - origin[0], t.clientY - origin[1]);
      else if (t.identifier === lookId || t.identifier === fireId) { const p = last[t.identifier]; S.lookX += t.clientX - p[0]; S.lookY += t.clientY - p[1]; last[t.identifier] = [t.clientX, t.clientY]; }
    }
  }, { passive: true });
  const end = e => { for (const t of e.changedTouches) { if (t.identifier === stickId) { stickId = null; setStick(0, 0); } if (t.identifier === lookId) lookId = null; if (t.identifier === fireId) { fireId = null; S.fire = false; q('.fire').classList.remove('on'); } } };
  addEventListener('touchend', end); addEventListener('touchcancel', end);
  S.show = v => { el.style.display = v ? 'block' : 'none'; if (!v) { S.fire = false; S.mx = S.my = 0; knob.style.transform = ''; } };
  return S;
}
