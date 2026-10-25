import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { tiled } from './textures.js';

// Blender(tools/blender/build.py)로 만든 건물 모델을 불러온다.
// 오브젝트 이름 = 건물 id, 재질 이름 = "건물id:역할". 역할에 맞춰 실사 텍스처 재질로 바꿔 끼운다.

const ROLE = {
  wall: c => ({ color: c, map: tiled('plaster', 3), roughness: 0.9 }),
  concrete: c => ({ color: c, map: tiled('concrete', 3), roughness: 0.9 }),
  wood: c => ({ color: c, map: tiled('woodpanel', 2.5), roughness: 0.8 }),
  roof: c => ({ color: c, map: tiled('metalroof', 4), roughness: 0.75, metalness: 0.15 }),
  flatroof: c => ({ color: c, map: tiled('concrete', 6), roughness: 0.95 }),
  glass: c => ({ color: c, roughness: 0.08, metalness: 0.2, envMapIntensity: 0.8, transparent: true, opacity: 0.32, depthWrite: false }), // 비쳐 보이는 유리: 안에서 밖이 보인다
  frame: c => ({ color: c, roughness: 0.4, metalness: 0.5 }),
  trim: c => ({ color: c, map: tiled('concrete', 3), roughness: 0.8 }),
  accent: c => ({ color: c, roughness: 0.7 }),
  metal: c => ({ color: c, map: tiled('metalroof', 2), roughness: 0.45, metalness: 0.55 }), // 골강판 외벽
  paint1: c => ({ color: c, roughness: 0.5 }), paint2: c => ({ color: c, roughness: 0.5 }),
  paint3: c => ({ color: c, roughness: 0.5 }), paint4: c => ({ color: c, roughness: 0.5 }),
};

export async function loadModels(url = 'assets/models/buildings.glb?v=d2013c42') {
  const head = await fetch(url, { method: 'HEAD' }).catch(() => null);
  if (!head?.ok) return null;
  const draco = new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
  const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync(url);
  const cache = new Map(), models = new Map();
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    const mats = (Array.isArray(o.material) ? o.material : [o.material]).map(m => {
      const role = (m.name.split(':')[1] || 'wall').replace(/\.\d+$/, '');
      const key = role + m.color.getHexString();
      if (!cache.has(key)) cache.set(key, new THREE.MeshStandardMaterial({ ...(ROLE[role] ?? ROLE.wall)(m.color.clone()), side: THREE.DoubleSide }));
      return cache.get(key);
    });
    o.material = mats.length === 1 ? mats[0] : mats;
  });
  for (const o of [...gltf.scene.children]) models.set(o.name, o);
  return models;
}
