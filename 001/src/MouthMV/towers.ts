import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** 遠景の電波塔を鉄骨の格子として組み立てる。aH(高さの割合)とaKind(0=東京タワー風 1=スカイツリー風)を持つ */
const beam = (a: THREE.Vector3, b: THREE.Vector3, t: number) => {
  const len = a.distanceTo(b);
  const g = new THREE.BoxGeometry(t, t, len);
  g.translate(0, 0, len / 2);
  const o = new THREE.Object3D();
  if (Math.abs(b.y - a.y) > 0.98 * len) o.up.set(0, 0, 1);   // 真上を向く部材は上方向の基準を変える(向きの計算が崩れるため)
  o.position.copy(a); o.lookAt(b); o.updateMatrix();
  g.applyMatrix4(o.matrix);
  return g;
};
const ring = (c: THREE.Vector3, r: number, n: number, t: number, phase = 0) => {
  const out: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = phase + (i / n) * Math.PI * 2, a1 = phase + ((i + 1) / n) * Math.PI * 2;
    out.push(beam(new THREE.Vector3(c.x + Math.cos(a0) * r, c.y, c.z + Math.sin(a0) * r), new THREE.Vector3(c.x + Math.cos(a1) * r, c.y, c.z + Math.sin(a1) * r), t));
  }
  return out;
};
const finish = (parts: THREE.BufferGeometry[], H: number, kind: number) => {
  const g = mergeGeometries(parts.map((p) => { p.deleteAttribute('uv'); return p; }))!;
  const pos = g.attributes.position;
  const aH = new Float32Array(pos.count), aK = new Float32Array(pos.count).fill(kind);
  for (let i = 0; i < pos.count; i++) aH[i] = pos.getY(i) / H;
  g.setAttribute('aH', new THREE.BufferAttribute(aH, 1));
  g.setAttribute('aKind', new THREE.BufferAttribute(aK, 1));
  return g;
};

/** 東京タワー風: 四角錐の鉄骨、X字の筋交い、2つの展望台、アンテナ */
export const tokyoTower = (cx: number, cz: number, H = 333) => {
  const parts: THREE.BufferGeometry[] = [];
  const top = H * 0.75;
  const half = (y: number) => 40 * Math.pow(Math.max(0, 1 - y / (top * 1.06)), 1.7) + 2.4;
  const levels: number[] = [];
  for (let i = 0; i <= 26; i++) levels.push(top * Math.pow(i / 26, 1.15));
  const corner = (y: number, k: number) => { const w = half(y); const s = [[-1, -1], [1, -1], [1, 1], [-1, 1]][k]; return new THREE.Vector3(cx + s[0] * w, y, cz + s[1] * w); };
  for (let i = 0; i < levels.length - 1; i++) {
    const y0 = levels[i], y1 = levels[i + 1];
    const th = 2.2 - 1.4 * (y0 / top);
    for (let k = 0; k < 4; k++) {
      const a0 = corner(y0, k), a1 = corner(y1, k), b0 = corner(y0, (k + 1) % 4), b1 = corner(y1, (k + 1) % 4);
      parts.push(beam(a0, a1, th * 1.4));                 // 脚
      parts.push(beam(a1, b1, th * 0.8));                 // 水平材
      parts.push(beam(a0, b1, th * 0.55), beam(b0, a1, th * 0.55)); // X字の筋交い
    }
  }
  // 足元のアーチ(4面)
  for (let k = 0; k < 4; k++) {
    const a = corner(0, k), b = corner(0, (k + 1) % 4);
    for (let j = 0; j < 10; j++) {
      const u0 = j / 10, u1 = (j + 1) / 10;
      const p = (u: number) => new THREE.Vector3().lerpVectors(a, b, u).setY(28 * Math.sin(Math.PI * u) + 6);
      parts.push(beam(p(u0), p(u1), 1.6));
    }
  }
  // 展望台(大きな箱の帯) と特別展望台
  for (const [y, w, h] of [[top * 0.45, 1.55, 9], [top * 0.75, 1.35, 6]] as [number, number, number][]) {
    const ww = half(y) * w * 2;
    const box = new THREE.BoxGeometry(ww, h, ww); box.translate(cx, y, cz); parts.push(box);
  }
  parts.push(beam(new THREE.Vector3(cx, top, cz), new THREE.Vector3(cx, H, cz), 2.2));
  parts.push(beam(new THREE.Vector3(cx, top, cz), new THREE.Vector3(cx, top + 30, cz), 5));
  return finish(parts, H, 0);
};

/** スカイツリー風: 円筒の鉄骨格子(らせんの斜材)、2つの展望台のリング、細いアンテナ */
export const skyTree = (cx: number, cz: number, H = 520) => {
  const parts: THREE.BufferGeometry[] = [];
  const top = H * 0.86, N = 12;
  const rad = (y: number) => 30 * Math.pow(Math.max(0, 1 - y / (top * 1.12)), 0.9) + 4.5;
  const levels: number[] = [];
  for (let i = 0; i <= 24; i++) levels.push(top * (i / 24));
  const pt = (y: number, k: number) => { const a = (k / N) * Math.PI * 2; const r = rad(y); return new THREE.Vector3(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r); };
  for (let i = 0; i < levels.length - 1; i++) {
    const y0 = levels[i], y1 = levels[i + 1];
    const th = 1.9 - 1.0 * (y0 / top);
    for (let k = 0; k < N; k++) {
      parts.push(beam(pt(y0, k), pt(y1, k), th));
      parts.push(beam(pt(y0, k), pt(y1, (k + 1) % N), th * 0.55), beam(pt(y0, (k + 1) % N), pt(y1, k), th * 0.55));
    }
    parts.push(...ring(new THREE.Vector3(cx, y1, cz), rad(y1), N, th * 0.7));
  }
  for (const [y, extra, h] of [[top * 0.6, 9, 9], [top * 0.82, 6, 6]] as [number, number, number][]) {
    for (let j = 0; j < 3; j++) parts.push(...ring(new THREE.Vector3(cx, y - h / 2 + j * (h / 2), cz), rad(y) + extra, 24, 2.6));
    const cyl = new THREE.CylinderGeometry(rad(y) + extra - 1, rad(y) + extra - 1, h, 24, 1, true); cyl.translate(cx, y, cz); parts.push(cyl.toNonIndexed());
  }
  parts.push(beam(new THREE.Vector3(cx, top, cz), new THREE.Vector3(cx, H, cz), 3));
  return finish(parts.map((p) => (p.index ? p.toNonIndexed() : p)), H, 1);
};
