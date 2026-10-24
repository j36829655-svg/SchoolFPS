// 좀비 길찾기: 캠퍼스를 2m 격자로 나누고, 플레이어들로부터의 거리장(BFS)을 만들어 거리가 줄어드는 쪽으로 걷게 한다.
// 건물·비닐하우스·연못은 막힌 칸.
const CELL = 2;

export class NavGrid {
  constructor(bounds, solids, signedDist) {
    const [x0, y0, x1, y1] = bounds;
    this.x0 = x0; this.y0 = y0;
    this.nx = Math.ceil((x1 - x0) / CELL); this.ny = Math.ceil((y1 - y0) / CELL);
    this.blocked = new Uint8Array(this.nx * this.ny);
    this.dist = new Float32Array(this.nx * this.ny).fill(Infinity);
    const boxes = solids.map(p => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const [x, y] of p) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); } return { p, a, b, c, d }; });
    for (let j = 0; j < this.ny; j++) for (let i = 0; i < this.nx; i++) {
      const x = x0 + (i + 0.5) * CELL, y = y0 + (j + 0.5) * CELL;
      for (const s of boxes) if (x > s.a - 1 && x < s.c + 1 && y > s.b - 1 && y < s.d + 1 && signedDist(x, y, s.p) < 0.6) { this.blocked[j * this.nx + i] = 1; break; }
    }
  }

  idx(x, y) {
    const i = Math.floor((x - this.x0) / CELL), j = Math.floor((y - this.y0) / CELL);
    return i < 0 || j < 0 || i >= this.nx || j >= this.ny ? -1 : j * this.nx + i;
  }
  center(k) { return [this.x0 + (k % this.nx + 0.5) * CELL, this.y0 + (Math.floor(k / this.nx) + 0.5) * CELL]; }
  walkable(x, y) { const k = this.idx(x, y); return k >= 0 && !this.blocked[k]; }

  /** targets: [[x, y], ...] 에서 시작하는 BFS 거리장 (최대 maxSteps 칸) */
  update(targets, maxSteps = 220) {
    const { nx, ny, blocked, dist } = this;
    dist.fill(Infinity);
    let frontier = [];
    for (const [x, y] of targets) { const k = this.idx(x, y); if (k >= 0) { dist[k] = 0; frontier.push(k); } }
    for (let step = 1; step <= maxSteps && frontier.length; step++) {
      const next = [];
      for (const k of frontier) {
        const i = k % nx, j = (k - i) / nx;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const a = i + di, b = j + dj;
          if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
          const n = b * nx + a;
          if (blocked[n] || dist[n] <= step) continue;
          dist[n] = step; next.push(n);
        }
      }
      frontier = next;
    }
  }

  /** (x, y)에서 목표 쪽으로 가는 단위 방향 [dx, dy], 모르면 null */
  dirAt(x, y) {
    const k = this.idx(x, y);
    if (k < 0) return null;
    const i = k % this.nx, j = (k - i) / this.nx;
    let best = this.dist[k], bx = 0, by = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= this.nx || b >= this.ny) continue;
      const n = b * this.nx + a, d = this.dist[n] + (di && dj ? 0.4 : 0);
      if (d < best) { best = d; bx = di; by = dj; }
    }
    if (!bx && !by) return null;
    const l = Math.hypot(bx, by);
    return [bx / l, by / l];
  }

  /** 걸을 수 있는 무작위 지점 (필터 통과하는 것) */
  randomSpot(filter = () => true, tries = 400) {
    for (let t = 0; t < tries; t++) {
      const k = Math.floor(Math.random() * this.nx * this.ny);
      if (this.blocked[k]) continue;
      const [x, y] = this.center(k);
      if (filter(x, y)) return [x, y];
    }
    return null;
  }
}
