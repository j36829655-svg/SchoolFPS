import * as THREE from 'three';
import { CAMPUS } from './data/campus.js';
import { TREES } from './data/trees.js';

// 캠퍼스 데이터로 3D 장면과 충돌체를 만든다. (x, y북) → 3D (x, 높이, -y)

const GROUND_COLORS = { dirt: 0xc9a77a, futsal: 0x3f9a5a, court: 0x3aa58f, asphalt: 0x6f7378, water: 0x2e5f7a, farm: 0x8a6a48 };
const ROAD_COLORS = { asphalt: 0x63676c, concrete: 0xa9a9a4, dirt: 0xb69772 };

export function buildWorld(scene, physics) {
  const [x0, y0, x1, y1] = CAMPUS.bounds;

  // 바닥 (맵 밖 숲까지 넉넉히)
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshLambertMaterial({ color: 0x6f8f4e }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  CAMPUS.grounds.forEach((g, i) => {
    const m = flatShape(g.pts, GROUND_COLORS[g.type] ?? 0x888888, 0.02 + i * 0.002);
    scene.add(m);
    if (g.type === 'water') physics.addPolygon(g.pts);
  });

  for (const r of CAMPUS.roads) scene.add(road(r.pts, r.w, ROAD_COLORS[r.type] ?? 0x777777));

  for (const b of CAMPUS.buildings) {
    scene.add(building(b));
    physics.addPolygon(b.pts);
  }
  for (const g of CAMPUS.greenhouses) {
    scene.add(extrude(g.pts, 3.5, g.color, g.color));
    physics.addPolygon(g.pts);
  }

  // 맵 경계 표시용 낮은 울타리
  const fence = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(x1 - x0, 1.2, y1 - y0)),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
  fence.position.set((x0 + x1) / 2, 0.6, -(y0 + y1) / 2);
  scene.add(fence);

  addTrees(scene, physics);
}

function building(b) {
  return extrude(b.pts, b.h, b.wall, b.roof);
}

function extrude(pts, h, wallColor, roofColor) {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  // ExtrudeGeometry 그룹: 0 = 위/아래 면, 1 = 옆면
  const mesh = new THREE.Mesh(geo, [
    new THREE.MeshLambertMaterial({ color: roofColor }),
    new THREE.MeshLambertMaterial({ color: wallColor }),
  ]);
  return mesh;
}

function flatShape(pts, color, y) {
  const geo = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, py]) => new THREE.Vector2(x, py))));
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
  m.position.y = y;
  return m;
}

function road(pts, w, color) {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color });
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const len = Math.hypot(bx - ax, by - ay);
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(len, w), mat);
    seg.rotation.x = -Math.PI / 2;
    seg.rotation.z = Math.atan2(by - ay, bx - ax);
    seg.position.set((ax + bx) / 2, 0.05, -(ay + by) / 2);
    group.add(seg);
    const joint = new THREE.Mesh(new THREE.CircleGeometry(w / 2, 12), mat);
    joint.rotation.x = -Math.PI / 2;
    joint.position.set(bx, 0.05, -by);
    group.add(joint);
  }
  return group;
}

function addTrees(scene, physics) {
  const kinds = [
    { crown: new THREE.ConeGeometry(2.2, 7, 7), color: 0x2f5a35, crownY: 6.5, list: [] },
    { crown: new THREE.IcosahedronGeometry(3, 0), color: 0x4f7d3a, crownY: 5.5, list: [] },
  ];
  for (const t of TREES) kinds[t[2]].list.push(t);

  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.35, 4, 6);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x5b4330 }), TREES.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let ti = 0;

  for (const k of kinds) {
    const crowns = new THREE.InstancedMesh(k.crown, new THREE.MeshLambertMaterial({ color: k.color, flatShading: true }), k.list.length);
    k.list.forEach(([x, y, , sc], i) => {
      crowns.setMatrixAt(i, m.compose(p.set(x, k.crownY * sc, -y), q, s.set(sc, sc, sc)));
      trunks.setMatrixAt(ti++, m.compose(p.set(x, 2 * sc, -y), q, s.set(sc, sc, sc)));
      physics.addCircle(x, y, 0.35 * sc);
    });
    scene.add(crowns);
  }
  scene.add(trunks);
}
