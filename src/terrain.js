import { TERRAIN } from './data/terrain.js';

// 고도 격자(5m)를 2.5m로 촘촘하게 만든 뒤, 건물 터·운동장·연못 자리를 평평하게 깎는다.
// heightAt(x, y) 로 어디서든 땅 높이를 얻는다. (x 동, y 북, m)

const RES = 2.5;

export class Terrain {
  constructor() {
    const T = TERRAIN;
    this.x0 = T.x0; this.y0 = T.y0;
    this.nx = Math.round((T.nx - 1) * T.step / RES) + 1;
    this.ny = Math.round((T.ny - 1) * T.step / RES) + 1;
    this.h = new Float32Array(this.nx * this.ny);
    const src = (i, j) => T.data[Math.min(j, T.ny - 1) * T.nx + Math.min(i, T.nx - 1)];
    for (let j = 0; j < this.ny; j++) for (let i = 0; i < this.nx; i++) {
      const fx = i * RES / T.step, fy = j * RES / T.step, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      this.h[j * this.nx + i] = (src(ix, iy) * (1 - tx) + src(ix + 1, iy) * tx) * (1 - ty) + (src(ix, iy + 1) * (1 - tx) + src(ix + 1, iy + 1) * tx) * ty;
    }
  }

  heightAt(x, y) {
    const fx = Math.max(0, Math.min(this.nx - 1.001, (x - this.x0) / RES));
    const fy = Math.max(0, Math.min(this.ny - 1.001, (y - this.y0) / RES));
    const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, n = this.nx, h = this.h;
    const a = h[iy * n + ix], b = h[iy * n + ix + 1], c = h[(iy + 1) * n + ix], d = h[(iy + 1) * n + ix + 1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  }

  /** 다각형 안쪽(+margin)을 target 높이로 만들고 바깥 blend m 동안 자연 지형과 부드럽게 잇는다. target 생략 시 평균 높이 */
  flatten(pts, { margin = 1.5, blend = 6, offset = 0, target } = {}) {
    if (target === undefined) target = this.averageIn(pts) + offset;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    const pad = margin + blend;
    const i0 = Math.max(0, Math.floor((minX - pad - this.x0) / RES)), i1 = Math.min(this.nx - 1, Math.ceil((maxX + pad - this.x0) / RES));
    const j0 = Math.max(0, Math.floor((minY - pad - this.y0) / RES)), j1 = Math.min(this.ny - 1, Math.ceil((maxY + pad - this.y0) / RES));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = this.x0 + i * RES, y = this.y0 + j * RES;
      const d = signedDist(x, y, pts) - margin;
      if (d > blend) continue;
      const w = d <= 0 ? 1 : 1 - smooth(d / blend);
      const k = j * this.nx + i;
      this.h[k] += (target - this.h[k]) * w;
    }
    return target;
  }

  averageIn(pts) {
    let s = 0, n = 0;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    for (let y = minY; y <= maxY; y += RES) for (let x = minX; x <= maxX; x += RES)
      if (signedDist(x, y, pts) <= 0) { s += this.heightAt(x, y); n++; }
    if (!n) for (const [x, y] of pts) { s += this.heightAt(x, y); n++; }
    return s / n;
  }
}

function smooth(t) { return t * t * (3 - 2 * t); }

/** 다각형까지의 거리 (안쪽이면 음수) */
export function signedDist(x, y, pts) {
  let inside = false, best = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, ay] = pts[j], [bx, by] = pts[i];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return inside ? -best : best;
}
