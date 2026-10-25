// 2D(바닥 평면) 충돌 + 수직 중력으로 된 가벼운 물리 엔진.
// 좌표: x = 동쪽, y = 북쪽 (3D에서는 z = -y). 단위 m.

const CELL = 8; // 공간 해시 칸 크기

export class Physics {
  constructor(bounds) {
    this.bounds = bounds; // [xmin, ymin, xmax, ymax]
    this.colliders = [];
    this.grid = new Map();
  }

  addPolygon(pts) { this._add({ type: 'poly', pts, ...bbox(pts) }); }
  addCircle(x, y, r) { this._add({ type: 'circle', x, y, r, minX: x - r, minY: y - r, maxX: x + r, maxY: y + r }); }

  _add(c) {
    const i = this.colliders.push(c) - 1;
    for (let gx = cell(c.minX); gx <= cell(c.maxX); gx++)
      for (let gy = cell(c.minY); gy <= cell(c.maxY); gy++) {
        const k = gx + ',' + gy;
        if (!this.grid.has(k)) this.grid.set(k, []);
        this.grid.get(k).push(i);
      }
  }

  _nearby(x, y, r) {
    const out = new Set();
    for (let gx = cell(x - r); gx <= cell(x + r); gx++)
      for (let gy = cell(y - r); gy <= cell(y + r); gy++) {
        const list = this.grid.get(gx + ',' + gy);
        if (list) for (const i of list) out.add(i);
      }
    return out;
  }

  /** 원(플레이어/적)을 장애물 밖으로 밀어낸다. pos = {x, y} 를 직접 수정 */
  resolve(pos, r) {
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const i of this._nearby(pos.x, pos.y, r)) {
        const c = this.colliders[i];
        if (c.type === 'circle') {
          const dx = pos.x - c.x, dy = pos.y - c.y, d = Math.hypot(dx, dy), min = r + c.r;
          if (d < min && d > 1e-6) { pos.x = c.x + dx / d * min; pos.y = c.y + dy / d * min; moved = true; }
        } else if (pushOutOfPolygon(pos, r, c.pts)) moved = true;
      }
      if (!moved) break;
    }
    const [x0, y0, x1, y1] = this.bounds;
    pos.x = Math.min(Math.max(pos.x, x0 + r), x1 - r);
    pos.y = Math.min(Math.max(pos.y, y0 + r), y1 - r);
  }

  /** 두 점 사이 시야가 막혔는지 (건물만 검사) — 적 AI, 총알에 사용 */
  blocked(ax, ay, bx, by) {
    const minX = Math.min(ax, bx), maxX = Math.max(ax, bx), minY = Math.min(ay, by), maxY = Math.max(ay, by);
    for (const c of this.colliders) {
      if (c.type !== 'poly' || c.maxX < minX || c.minX > maxX || c.maxY < minY || c.minY > maxY) continue;
      const p = c.pts;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++)
        if (segIntersect(ax, ay, bx, by, p[j][0], p[j][1], p[i][0], p[i][1])) return true;
    }
    return false;
  }
}

/** 1인칭 캐릭터: 가속, 마찰, 중력, 점프, 충돌 */
export class Body {
  constructor(physics, x, y, ground = () => 0) {
    this.physics = physics;
    this.ground = ground; // (x, y) → 땅 높이
    this.pos = { x, y };
    this.z = ground(x, y); // 발 높이 (절대값)
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.radius = 0.4;
    this.onGround = true;
  }

  /** wish = 원하는 이동 방향(월드, 길이 0~1), speed m/s */
  step(dt, wish, speed, jump) {
    const accel = this.onGround ? 60 : 15;
    const tx = wish.x * speed, ty = wish.y * speed;
    this.vx += clampDelta(tx - this.vx, accel * dt);
    this.vy += clampDelta(ty - this.vy, accel * dt);

    // jump = 이번 프레임에 Space를 눌렀는지. 땅에서 한 번, 공중에서 한 번 더 (2단 점프)
    if (this.onGround) this.jumps = 0;
    if (jump && (this.onGround || this.jumps < 2)) { this.vz = this.onGround ? 6.2 : 5.6; this.jumps = (this.onGround ? 0 : Math.max(1, this.jumps)) + 1; this.onGround = false; }
    this.vz -= 20 * dt;

    const wasGround = this.onGround;
    this.pos.x += this.vx * dt;
    this.pos.y += this.vy * dt;
    this.z += this.vz * dt;

    const bx = this.pos.x, by = this.pos.y;
    this.physics.resolve(this.pos, this.radius);
    // 벽에 막힌 방향의 속도는 없앤다 (벽에 붙어 미끄러지기)
    if (dt > 0) { this.vx = (this.pos.x - bx) / dt + this.vx; this.vy = (this.pos.y - by) / dt + this.vy; }

    // 땅에 닿기. 내리막에서는 0.6m 이내면 땅에 붙여 통통 튀지 않게 한다
    const gz = this.ground(this.pos.x, this.pos.y, this.z);
    // 건물 안: 위층 바닥에 머리가 닿으면 더 못 올라간다
    const cz = this.ceil ? this.ceil(this.pos.x, this.pos.y, this.z) : Infinity;
    if (this.vz > 0 && this.z + 1.8 > cz) { this.vz = 0; this.z = Math.max(gz, cz - 1.8); }
    if (this.z <= gz || (wasGround && this.vz <= 0 && this.z - gz < 0.6)) { this.z = gz; this.vz = 0; this.onGround = true; }
    else this.onGround = false;
  }
}

function cell(v) { return Math.floor(v / CELL); }
function clampDelta(d, max) { return Math.max(-max, Math.min(max, d)); }
function bbox(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  return { minX, minY, maxX, maxY };
}

function pushOutOfPolygon(pos, r, pts) {
  let inside = false, best = Infinity, nx = 0, ny = 0, cx = 0, cy = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [ax, ay] = pts[j], [bx, by] = pts[i];
    if ((ay > pos.y) !== (by > pos.y) && pos.x < (bx - ax) * (pos.y - ay) / (by - ay) + ax) inside = !inside;
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((pos.x - ax) * dx + (pos.y - ay) * dy) / l2)) : 0;
    const px = ax + t * dx, py = ay + t * dy, d = Math.hypot(pos.x - px, pos.y - py);
    if (d < best) { best = d; cx = px; cy = py; }
  }
  if (!inside && best >= r) return false;
  nx = pos.x - cx; ny = pos.y - cy;
  const len = Math.hypot(nx, ny) || 1;
  const s = inside ? -1 : 1; // 안쪽이면 가장 가까운 변 바깥으로
  pos.x = cx + s * nx / len * r;
  pos.y = cy + s * ny / len * r;
  return true;
}

function segIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (d === 0) return false;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d;
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
  return t > 0 && t < 1 && u > 0 && u < 1;
}
