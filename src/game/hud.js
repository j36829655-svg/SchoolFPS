// 게임 화면 표시: 체력, 탄약, 웨이브/점수, 킬 로그, 가운데 알림, 피격 효과, 점수판(Tab)
const css = `
#ghud{position:fixed;inset:0;pointer-events:none;font-family:system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px #000;display:none}
#ghud .hp{position:absolute;left:24px;bottom:22px;width:260px}
#ghud .bar{height:14px;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.4);border-radius:3px;overflow:hidden}
#ghud .fill{height:100%;background:linear-gradient(90deg,#4ade80,#22c55e);transition:width .15s}
#ghud .ammo{position:absolute;right:28px;bottom:20px;font-size:34px;font-weight:700;text-align:right}
#ghud .ammo small{font-size:15px;opacity:.75;display:block}
#ghud .top{position:absolute;top:14px;left:50%;transform:translateX(-50%);font-size:20px;font-weight:700;text-align:center}
#ghud .feed{position:absolute;top:14px;right:18px;font-size:14px;text-align:right;line-height:1.6}
#ghud .center{position:absolute;top:34%;left:50%;transform:translate(-50%,-50%);font-size:34px;font-weight:800;text-align:center;white-space:pre-line}
#ghud .hit{position:absolute;left:50%;top:50%;width:22px;height:22px;margin:-11px;opacity:0;transition:opacity .12s}
#ghud .hit:before,#ghud .hit:after{content:'';position:absolute;left:10px;top:0;width:2px;height:22px;background:#fff;transform:rotate(45deg)}
#ghud .hit:after{transform:rotate(-45deg)}
#ghud .hurt{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 45%,rgba(200,0,0,.55));opacity:0;transition:opacity .25s}
#ghud .board{position:absolute;top:18%;left:50%;transform:translateX(-50%);min-width:360px;background:rgba(0,0,0,.7);padding:14px 18px;border-radius:8px;display:none;font-size:15px}
#ghud .board td{padding:3px 12px}
`;

export class Hud {
  constructor() {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    this.el = document.createElement('div'); this.el.id = 'ghud';
    this.el.innerHTML = `<div class="hurt"></div><div class="hit"></div><div class="top"></div><div class="feed"></div><div class="center"></div>
      <div class="hp"><div style="font-size:13px;margin-bottom:4px">체력 <b class="hpv">100</b></div><div class="bar"><div class="fill"></div></div></div>
      <div class="ammo"><span class="av">30</span><small>R 재장전</small></div><table class="board"></table>`;
    document.body.appendChild(this.el);
    this.q = s => this.el.querySelector(s);
    this.feedItems = [];
  }
  show(v) { this.el.style.display = v ? 'block' : 'none'; }
  health(hp) { this.q('.fill').style.width = Math.max(0, hp) + '%'; this.q('.hpv').textContent = Math.max(0, Math.round(hp)); }
  ammo(n, reloading) { this.q('.av').textContent = reloading ? '재장전…' : n; }
  top(text) { this.q('.top').textContent = text; }
  center(text) { this.q('.center').textContent = text; }
  hitMarker(kill) { const h = this.q('.hit'); h.style.opacity = 1; h.style.filter = kill ? 'drop-shadow(0 0 2px red) sepia(1) saturate(9) hue-rotate(-50deg)' : ''; clearTimeout(this.ht); this.ht = setTimeout(() => (h.style.opacity = 0), 120); }
  hurt() { const h = this.q('.hurt'); h.style.opacity = 1; clearTimeout(this.hu); this.hu = setTimeout(() => (h.style.opacity = 0), 250); }
  feed(text) {
    this.feedItems.push({ text, t: performance.now() });
    this.feedItems = this.feedItems.filter(f => performance.now() - f.t < 6000).slice(-6);
    this.q('.feed').innerHTML = this.feedItems.map(f => `<div>${f.text}</div>`).join('');
  }
  board(rows, visible) {
    const b = this.q('.board'); b.style.display = visible ? 'table' : 'none';
    if (visible) b.innerHTML = '<tr><th>이름</th><th>킬</th><th>데스</th></tr>' + rows.map(r => `<tr><td style="color:${r.color}">${r.name}</td><td>${r.kills}</td><td>${r.deaths}</td></tr>`).join('');
  }
}
