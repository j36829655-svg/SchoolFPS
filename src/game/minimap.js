// 미니맵: 북쪽이 위. 항공사진이 있으면 그것을, 없으면 건물·도로 도면을 배경으로 쓴다.
// 실제 맵 좌표(x 동, y 북, m)와 같은 좌표로 그리므로 보이는 위치가 곧 게임 속 위치다.
const SIZE = 180, RANGE = 75; // 반지름 75 m

export class Minimap {
  constructor(parent, ortho, campus) {
    this.c = document.createElement('canvas'); this.c.width = this.c.height = SIZE;
    this.c.style.width = this.c.style.height = '100%';
    parent.appendChild(this.c); this.g = this.c.getContext('2d');
    if (ortho?.tex?.image) {
      const img = ortho.tex.image, W = img.width, H = img.height;
      this.src = img;
      this.toPx = (x, y) => { const [u, v] = ortho.uvAt(x, y); return [u * W, (1 - v) * H]; };
    } else {
      // 도면: 1 m = 2 px
      const [x0, y0, x1, y1] = campus.bounds, S = 2, cv = document.createElement('canvas');
      cv.width = (x1 - x0) * S; cv.height = (y1 - y0) * S;
      const g = cv.getContext('2d'), P = (x, y) => [(x - x0) * S, (y1 - y) * S];
      g.fillStyle = '#5d7a45'; g.fillRect(0, 0, cv.width, cv.height);
      const poly = (pts, fill) => { g.fillStyle = fill; g.beginPath(); pts.forEach(p => g.lineTo(...P(...p))); g.fill(); };
      for (const gr of campus.grounds) poly(gr.pts, gr.type === 'water' ? '#4a7fa8' : '#a8957a');
      g.lineCap = 'round';
      for (const r of campus.roads) { g.strokeStyle = r.type === 'dirt' ? '#b9a47f' : '#8c8c8c'; g.lineWidth = r.w * S; g.beginPath(); r.pts.forEach(p => g.lineTo(...P(...p))); g.stroke(); }
      for (const b of campus.buildings) poly(b.pts, '#e8e4da');
      this.src = cv; this.toPx = P;
    }
    const [a] = this.toPx(0, 0), [b] = this.toPx(10, 0); this.pxPerM = (b - a) / 10;
  }

  /** me: {x, y, yaw}, dots: [{x, y, color, r}] */
  draw(me, dots) {
    const g = this.g, k = SIZE / 2 / RANGE, [cx, cy] = this.toPx(me.x, me.y), half = RANGE * this.pxPerM;
    g.fillStyle = '#223'; g.fillRect(0, 0, SIZE, SIZE);
    g.drawImage(this.src, cx - half, cy - half, half * 2, half * 2, 0, 0, SIZE, SIZE);
    g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(0, 0, SIZE, SIZE);
    for (const d of dots) {
      const sx = SIZE / 2 + (d.x - me.x) * k, sy = SIZE / 2 - (d.y - me.y) * k;
      if (Math.hypot(sx - SIZE / 2, sy - SIZE / 2) > SIZE / 2 - 3) continue;
      g.fillStyle = d.color; g.beginPath(); g.arc(sx, sy, d.r ?? 3, 0, Math.PI * 2); g.fill();
    }
    // 나: 바라보는 쪽을 가리키는 화살표 (yaw 0 = 북쪽, 왼쪽으로 돌면 +)
    g.save(); g.translate(SIZE / 2, SIZE / 2); g.rotate(-me.yaw);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 40, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); g.fill();
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 6); g.lineTo(0, 3); g.lineTo(-6, 6); g.closePath(); g.fill(); g.stroke();
    g.restore();
    g.fillStyle = '#fff'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.fillText('N', SIZE / 2, 13);
  }
}
