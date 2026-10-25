// 게임 화면 표시: 체력, 무기·탄약, 킬·점수, 라운드·남은 적, 보스 체력, 미니맵, 킬 로그, 알림,
// 조준점(퍼짐에 따라 벌어짐), 저격 조준경, 피격 방향, 점수판(Tab), 결과 화면
const css = `
#ghud{position:fixed;inset:0;pointer-events:none;font-family:system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px #000;display:none}
#ghud .hp{position:absolute;left:24px;bottom:22px;width:260px}
#ghud .bar{height:14px;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.4);border-radius:3px;overflow:hidden}
#ghud .fill{height:100%;background:linear-gradient(90deg,#4ade80,#22c55e);transition:width .15s}
#ghud .fill.low{background:linear-gradient(90deg,#f87171,#ef4444)}
#ghud .wpn{position:absolute;right:26px;bottom:18px;text-align:right}
#ghud .wname{font-size:15px;font-weight:700;opacity:.9}
#ghud .ammo{font-size:36px;font-weight:800;line-height:1.1}
#ghud .ammo small{font-size:18px;opacity:.7;font-weight:600}
#ghud .wstat{font-size:13px;min-height:17px;color:#fde68a}
#ghud .slots{display:flex;gap:3px;justify-content:flex-end;margin-top:6px}
#ghud .slots span{width:22px;height:18px;font-size:11px;line-height:18px;text-align:center;border-radius:3px;background:rgba(0,0,0,.35);opacity:.3}
#ghud .slots span.own{opacity:.85}
#ghud .slots span.cur{background:#e11d48;opacity:1}
#ghud .stats{position:absolute;left:14px;top:30px;font-size:16px;font-weight:700;line-height:1.5}
#ghud .top{position:absolute;top:12px;left:50%;transform:translateX(-50%);font-size:20px;font-weight:700;text-align:center;white-space:nowrap}
#ghud .boss{position:absolute;top:44px;left:50%;transform:translateX(-50%);width:min(420px,60vw);display:none;text-align:center;font-size:13px;font-weight:700}
#ghud .boss .bar{height:10px;margin-top:3px}
#ghud .boss .fill{background:linear-gradient(90deg,#b91c1c,#ef4444)}
#ghud .map{position:absolute;top:12px;right:12px;width:180px;height:180px;border-radius:50%;overflow:hidden;border:2px solid rgba(255,255,255,.55);box-shadow:0 2px 10px rgba(0,0,0,.5);background:#223}
#ghud .feed{position:absolute;top:202px;right:16px;font-size:14px;text-align:right;line-height:1.6}
#ghud .center{position:absolute;top:30%;left:50%;transform:translate(-50%,-50%);font-size:34px;font-weight:800;text-align:center;white-space:pre-line}
#ghud .note{position:absolute;top:58%;left:50%;transform:translateX(-50%);font-size:17px;font-weight:700;text-align:center;color:#fde68a;transition:opacity .3s;white-space:pre-line}
#ghud .hit{position:absolute;left:50%;top:50%;width:22px;height:22px;margin:-11px;opacity:0;transition:opacity .12s}
#ghud .hit:before,#ghud .hit:after{content:'';position:absolute;left:10px;top:0;width:2px;height:22px;background:#fff;transform:rotate(45deg)}
#ghud .hit:after{transform:rotate(-45deg)}
#ghud .hit.head:before,#ghud .hit.head:after{background:#ff3b3b}
#ghud .hurt{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 45%,rgba(200,0,0,.55));opacity:0;transition:opacity .25s}
#ghud .dir{position:absolute;left:50%;top:50%;width:0;height:0;opacity:0;transition:opacity .6s}
#ghud .dir:after{content:'';position:absolute;left:-26px;top:-130px;border-left:26px solid transparent;border-right:26px solid transparent;border-bottom:22px solid rgba(255,40,40,.85)}
#ghud .cross{position:absolute;left:50%;top:50%}
#ghud .cross i{position:absolute;background:#fff;box-shadow:0 0 2px #000}
#ghud .scope{position:absolute;inset:0;display:none;background:radial-gradient(circle at center,transparent 0,transparent 33vmin,#000 33.5vmin)}
#ghud .scope:before,#ghud .scope:after{content:'';position:absolute;background:#000}
#ghud .scope:before{left:50%;top:0;bottom:0;width:1px}
#ghud .scope:after{top:50%;left:0;right:0;height:1px}
#ghud .dot{position:absolute;inset:0;display:none;background:radial-gradient(circle at center,rgba(120,160,190,.06) 0,rgba(120,160,190,.06) 21vmin,rgba(12,14,16,.75) 21.3vmin,rgba(12,14,16,.75) 23vmin,transparent 23.3vmin)}
#ghud .dot:after{content:'';position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px;border-radius:50%;background:#ff2a2a;box-shadow:0 0 6px 1px #ff2a2a}
#ghud .board{position:absolute;top:18%;left:50%;transform:translateX(-50%);min-width:380px;background:rgba(0,0,0,.7);padding:14px 18px;border-radius:8px;display:none;font-size:15px}
#ghud .board td,#ghud .board th{padding:3px 12px}
#ghud .results{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);min-width:340px;background:rgba(10,12,18,.88);border:1px solid rgba(255,255,255,.2);padding:22px 28px;border-radius:12px;display:none;text-align:center}
#ghud .results h2{margin:0 0 12px;font-size:30px;color:#f87171}
#ghud .results table{margin:0 auto;font-size:17px}
#ghud .results td{padding:4px 14px}
#ghud .results td:first-child{opacity:.7;text-align:left}
#ghud .results td:last-child{font-weight:800;text-align:right}
#ghud .results p{margin:14px 0 0;opacity:.8;font-size:14px}
#ghud .results .new{color:#fde047;font-weight:800}
`;

export const KEY_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];

export class Hud {
  constructor() {
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    this.el = document.createElement('div'); this.el.id = 'ghud';
    this.el.innerHTML = `<div class="scope"></div><div class="dot"></div><div class="hurt"></div><div class="cross"><i></i><i></i><i></i><i></i></div><div class="hit"></div>
      <div class="dir"></div><div class="dir"></div><div class="dir"></div><div class="dir"></div>
      <div class="stats"></div><div class="top"></div><div class="boss"><span class="bname"></span><div class="bar"><div class="fill"></div></div></div>
      <div class="map"></div><div class="feed"></div><div class="center"></div><div class="note"></div>
      <div class="hp"><div style="font-size:13px;margin-bottom:4px">체력 <b class="hpv">100</b></div><div class="bar"><div class="fill"></div></div></div>
      <div class="wpn"><div class="wname"></div><div class="ammo"></div><div class="wstat"></div><div class="slots">${KEY_LABELS.map(k => `<span>${k}</span>`).join('')}</div></div>
      <table class="board"></table><div class="results"></div>`;
    document.body.appendChild(this.el);
    this.q = s => this.el.querySelector(s);
    this.mapEl = this.q('.map');
    this.feedItems = []; this.dirs = [...this.el.querySelectorAll('.dir')]; this.dirN = 0;
    this.cache = {};
  }
  /** 같은 내용이면 DOM을 건드리지 않는다 */
  set(sel, html, prop = 'innerHTML') { if (this.cache[sel] !== html) { this.cache[sel] = html; this.q(sel)[prop] = html; } }

  show(v) { this.el.style.display = v ? 'block' : 'none'; }
  health(hp, max = 100) {
    const f = this.q('.hp .fill'); f.style.width = Math.max(0, hp / max * 100) + '%'; f.classList.toggle('low', hp < 30);
    this.set('.hpv', String(Math.max(0, Math.round(hp))), 'textContent');
  }
  /** w: { name, kind, ammo, reserve, mag, status, owned: [slot], cur: slot } */
  weapon(w) {
    this.set('.wname', `${w.name} <small style="opacity:.6">${w.kind}</small>`);
    this.set('.ammo', `${w.ammo} <small>/ ${w.reserve}</small>`);
    this.set('.wstat', w.status, 'textContent');
    const key = w.owned.join(',') + '|' + w.cur;
    if (this.cache.slots !== key) { this.cache.slots = key; this.el.querySelectorAll('.slots span').forEach((s, i) => { s.className = (w.owned.includes(i) ? 'own' : '') + (i === w.cur ? ' cur' : ''); }); }
  }
  stats(text) { this.set('.stats', text); }
  top(text) { this.set('.top', text, 'textContent'); }
  boss(name, frac) {
    const b = this.q('.boss'); b.style.display = name ? 'block' : 'none';
    if (name) { this.set('.bname', name, 'textContent'); b.querySelector('.fill').style.width = Math.max(0, frac * 100) + '%'; }
  }
  center(text) { this.set('.center', text, 'textContent'); }
  note(text, ms = 1800) { const n = this.q('.note'); n.textContent = text; n.style.opacity = 1; clearTimeout(this.nt); this.nt = setTimeout(() => (n.style.opacity = 0), ms); }
  hitMarker(kill, head) {
    const h = this.q('.hit'); h.style.opacity = 1; h.classList.toggle('head', !!head); h.style.transform = kill ? 'scale(1.5)' : '';
    clearTimeout(this.ht); this.ht = setTimeout(() => (h.style.opacity = 0), kill ? 260 : 120);
  }
  /** 피격: angle = 화면 위쪽(정면)부터 시계 방향 라디안, 없으면 방향 표시 안 함 */
  hurt(angle) {
    const h = this.q('.hurt'); h.style.opacity = 1; clearTimeout(this.hu); this.hu = setTimeout(() => (h.style.opacity = 0), 250);
    if (angle === undefined || angle === null) return;
    const d = this.dirs[this.dirN++ % this.dirs.length];
    d.style.transition = 'none'; d.style.opacity = 1; d.style.transform = `rotate(${angle}rad)`;
    requestAnimationFrame(() => { d.style.transition = 'opacity 1.2s'; d.style.opacity = 0; });
  }
  /** gap: 조준점 벌어짐(px), scoped: 저격 조준경, dot: 도트 조준경(조준 중) */
  cross(gap, visible, scoped, dot) {
    this.q(".dot").style.display = dot && visible ? "block" : "none";
    this.q('.scope').style.display = scoped ? 'block' : 'none';
    const c = this.q('.cross'); c.style.display = visible && !scoped && !dot ? 'block' : 'none';
    const g = Math.round(Math.min(80, 3 + gap)), key = 'g' + g;
    if (this.cache.cross === key) return; this.cache.cross = key;
    const [t, b, l, r] = c.children, L = 9;
    Object.assign(t.style, { left: '-1px', top: -(g + L) + 'px', width: '2px', height: L + 'px' });
    Object.assign(b.style, { left: '-1px', top: g + 'px', width: '2px', height: L + 'px' });
    Object.assign(l.style, { top: '-1px', left: -(g + L) + 'px', width: L + 'px', height: '2px' });
    Object.assign(r.style, { top: '-1px', left: g + 'px', width: L + 'px', height: '2px' });
  }
  feed(text) {
    this.feedItems.push({ text, t: performance.now() });
    this.feedItems = this.feedItems.filter(f => performance.now() - f.t < 6000).slice(-6);
    this.q('.feed').innerHTML = this.feedItems.map(f => `<div>${f.text}</div>`).join('');
  }
  board(rows, visible, score) {
    const b = this.q('.board'); b.style.display = visible ? 'table' : 'none';
    if (visible) b.innerHTML = `<tr><th>이름</th><th>킬</th><th>데스</th>${score ? '<th>점수</th>' : ''}</tr>` + rows.map(r => `<tr><td style="color:${r.color}">${r.name}</td><td>${r.kills}</td><td>${r.deaths}</td>${score ? `<td>${r.score}</td>` : ''}</tr>`).join('');
  }
  /** r: { round, kills, score, time, diff, best, isNew, host } 또는 null */
  results(r) {
    const el = this.q('.results'); el.style.display = r ? 'block' : 'none';
    if (!r) { this.cache.res = ''; return; }
    const key = JSON.stringify(r); if (this.cache.res === key) return; this.cache.res = key;
    const t = `${Math.floor(r.time / 60)}:${String(Math.floor(r.time % 60)).padStart(2, '0')}`;
    el.innerHTML = `<h2>게임 오버</h2><table>
      <tr><td>난이도</td><td>${r.diff}</td></tr><tr><td>최종 라운드</td><td>${r.round}</td></tr>
      <tr><td>킬</td><td>${r.kills}</td></tr><tr><td>점수</td><td>${r.score.toLocaleString()}</td></tr><tr><td>생존 시간</td><td>${t}</td></tr>
      <tr><td>최고 기록</td><td>${r.isNew ? '<span class="new">신기록!</span> ' : ''}${r.best.score.toLocaleString()}점 · 라운드 ${r.best.round}</td></tr></table>
      <p>${r.host ? 'R: 다시 시작 · Esc: 메뉴' : '방장이 다시 시작할 때까지 기다려요 · Esc: 메뉴'}</p>`;
  }
}
