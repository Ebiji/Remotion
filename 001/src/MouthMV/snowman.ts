import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** 雪だるま1体分のジオメトリ。aPart(0=雪 1=炭 2=人参 3=枝 4=帽子 5=マフラー)と aCtr(部品の中心・腕は肩)を持つ。正面は+z */
export const snowmanGeometry = () => {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, part: number, ctr: THREE.Vector3) => {
    g.deleteAttribute('uv');
    const ng = g.index ? g.toNonIndexed() : g;
    const n = ng.attributes.position.count;
    ng.setAttribute('aPart', new THREE.Float32BufferAttribute(new Float32Array(n).fill(part), 1));
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.set([ctr.x, ctr.y, ctr.z], i * 3);
    ng.setAttribute('aCtr', new THREE.Float32BufferAttribute(c, 3));
    parts.push(ng);
  };
  const ball = (r: number, y: number) => { const g = new THREE.SphereGeometry(r, 40, 28); g.scale(1, 0.94, 1); g.translate(0, y, 0); add(g, 0, new THREE.Vector3(0, y, 0)); };
  ball(1.0, 0.98); ball(0.72, 2.42); ball(0.52, 3.5);
  // 炭の目・口・ボタン
  for (const s of [-1, 1]) { const e = new THREE.SphereGeometry(0.065, 12, 8); e.translate(s * 0.18, 3.63, 0.47); add(e, 1, new THREE.Vector3(s * 0.18, 3.63, 0.47)); }
  for (let i = 0; i < 5; i++) {
    const u = (i - 2) / 2;
    const x = u * 0.2, y = 3.33 - 0.06 * (1 - u * u), z = Math.sqrt(Math.max(0, 0.52 * 0.52 - x * x - (y - 3.5) * (y - 3.5))) * 0.98;
    const m = new THREE.SphereGeometry(0.035, 8, 6); m.translate(x, y, z); add(m, 1, new THREE.Vector3(x, y, z));
  }
  for (const y of [2.15, 2.45, 2.75]) {
    const z = Math.sqrt(Math.max(0, 0.72 * 0.72 - (y - 2.42) * (y - 2.42))) * 0.97;
    const b = new THREE.SphereGeometry(0.07, 12, 8); b.translate(0, y, z); add(b, 1, new THREE.Vector3(0, y, z));
  }
  // 人参の鼻
  { const c = new THREE.ConeGeometry(0.085, 0.5, 14); c.rotateX(Math.PI / 2); c.translate(0, 3.5, 0.5 + 0.25); add(c, 2, new THREE.Vector3(0, 3.5, 0.6)); }
  // 枝の腕(二股の指)
  for (const s of [-1, 1]) {
    const sh = new THREE.Vector3(s * 0.62, 2.62, 0);
    const arm = new THREE.CylinderGeometry(0.035, 0.05, 1.35, 7); arm.translate(0, 0.675, 0); arm.rotateZ(-s * (Math.PI / 2 - 0.55)); arm.translate(sh.x, sh.y, sh.z);
    add(arm, 3, sh);
    const end = new THREE.Vector3(s * (0.62 + 1.35 * Math.cos(0.55)), 2.62 + 1.35 * Math.sin(0.55), 0);
    for (const da of [0.5, -0.45]) {
      const f = new THREE.CylinderGeometry(0.02, 0.03, 0.38, 6); f.translate(0, 0.19, 0); f.rotateZ(-s * (Math.PI / 2 - 0.55 - da)); f.translate(end.x, end.y, end.z);
      add(f, 3, sh);
    }
  }
  // 帽子(つば + 山)
  { const b = new THREE.CylinderGeometry(0.6, 0.6, 0.06, 28); b.translate(0, 3.93, 0); add(b, 4, new THREE.Vector3(0, 4.1, 0)); }
  { const c = new THREE.CylinderGeometry(0.36, 0.4, 0.55, 28); c.translate(0, 4.23, 0); add(c, 4, new THREE.Vector3(0, 4.1, 0)); }
  // マフラー(首の輪 + 垂れ)
  { const t = new THREE.TorusGeometry(0.52, 0.12, 12, 32); t.rotateX(Math.PI / 2); t.translate(0, 3.02, 0); add(t, 5, new THREE.Vector3(0, 3.02, 0)); }
  { const tail = new THREE.BoxGeometry(0.22, 0.75, 0.08, 1, 4, 1); tail.rotateZ(0.12); tail.translate(0.28, 2.68, 0.6); add(tail, 5, new THREE.Vector3(0, 3.02, 0)); }
  return mergeGeometries(parts)!;
};
