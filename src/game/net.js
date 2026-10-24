// 멀티플레이: PeerJS(WebRTC)로 브라우저끼리 직접 연결. 방장(host)이 방 코드를 만들고 다른 사람이 그 코드로 참가한다.
// 방장이 좀비·체력·점수를 결정하고, 각자는 자기 위치와 사격 결과를 보낸다.
const PREFIX = 'campusfps-v1-';
let PeerLib = null;
async function lib() {
  if (PeerLib) return PeerLib;
  await new Promise((ok, fail) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js'; s.onload = ok; s.onerror = fail; document.head.appendChild(s); });
  return (PeerLib = window.Peer);
}

export class Net {
  constructor() { this.conns = new Map(); this.onMessage = () => {}; this.onLeave = () => {}; this.onJoin = () => {}; }

  /** 방 만들기 → 4자리 코드 */
  async host() {
    const Peer = await lib();
    for (let tries = 0; tries < 5; tries++) {
      const code = Math.random().toString(36).slice(2, 6).toUpperCase();
      try {
        this.peer = await open(new Peer(PREFIX + code));
        this.id = 'host'; this.isHost = true; this.code = code;
        this.peer.on('connection', c => c.on('open', () => this.attach(c)));
        return code;
      } catch (e) { if (!String(e).includes('unavailable-id')) throw e; }
    }
    throw new Error('방 코드를 만들지 못했어요');
  }

  /** 코드로 참가 */
  async join(code) {
    const Peer = await lib();
    this.peer = await open(new Peer());
    this.id = this.peer.id; this.isHost = false;
    const c = this.peer.connect(PREFIX + code.trim().toUpperCase(), { reliable: true });
    await new Promise((ok, fail) => { c.on('open', ok); c.on('error', fail); setTimeout(() => fail(new Error('방을 찾지 못했어요')), 10000); });
    this.attach(c);
  }

  attach(c) {
    const id = this.isHost ? c.peer : 'host';
    this.conns.set(id, c);
    c.on('data', d => this.onMessage(id, d));
    c.on('close', () => { this.conns.delete(id); this.onLeave(id); });
    this.onJoin(id);
  }

  /** 모두에게 (방장) 또는 방장에게 (참가자) */
  send(msg, to = null) {
    for (const [id, c] of this.conns) if (!to || id === to) { try { c.send(msg); } catch {} }
  }
  close() { try { this.peer?.destroy(); } catch {} this.conns.clear(); }
}

function open(peer) {
  return new Promise((ok, fail) => { peer.on('open', () => ok(peer)); peer.on('error', fail); });
}
