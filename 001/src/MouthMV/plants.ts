import * as THREE from 'three';

type V3 = [number, number, number];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp3 = (a: V3, b: V3, t: number): V3 => add(mul(a, 1 - t), mul(b, t));
const rotAxis = (v: V3, k: V3, ang: number): V3 => {
  const c = Math.cos(ang), s = Math.sin(ang);
  return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)));
};
const perp = (d: V3): V3 => norm(Math.abs(d[1]) < 0.95 ? cross(d, [0, 1, 0]) : cross(d, [1, 0, 0]));
const UP: V3 = [0, 1, 0];
const GOLD = 2.399963229728653;

export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 細かさ(LOD)ごとの設定: 0=近景(最も精細) 1=中景 2=遠景 */
const QS = {
  sides: [8, 5, 3],
  seg: [1, 0.6, 0.4],
  leafRows: [6, 3, 1],
  leafDen: [1, 0.45, 0.14],
  leafSize: [1, 1.45, 2.6],
  petalRows: [4, 3, 2],
  petalMul: [1, 0.6, 0.3],
  strands: [1, 0.6, 0.28],
};

type LeafShape = 'ovate' | 'lance' | 'cordate' | 'blade';

class Builder {
  pos: number[] = []; nor: number[] = []; start: number[] = []; meta: number[] = []; uv: number[] = []; idx: number[] = [];
  vert(p: V3, n: V3, s: V3, t0: number, t1: number, hue: number, kind: number, u: number, v: number) {
    this.pos.push(...p); this.nor.push(...n); this.start.push(...s);
    this.meta.push(t0, t1, hue, kind); this.uv.push(u, v);
    return this.pos.length / 3 - 1;
  }

  /** 点列に沿ってなめらかに伸びるテーパー付きの枝・幹(根元から順に伸びる) */
  path(pts: V3[], rad: number[], t0: number, t1: number, hue: number, sides: number, kind = 0, ridge = 0) {
    const n = pts.length;
    let U = perp(norm(sub(pts[1], pts[0])));
    const base = this.pos.length / 3;
    for (let i = 0; i < n; i++) {
      const T = i < n - 1 ? norm(sub(pts[i + 1], pts[i])) : norm(sub(pts[i], pts[i - 1]));
      U = norm(sub(U, mul(T, dot(U, T))));
      const W = cross(T, U);
      const ta = t0 + (t1 - t0) * Math.max(0, i - 1) / (n - 1), tb = t0 + (t1 - t0) * i / (n - 1);
      const st = pts[Math.max(0, i - 1)];
      for (let j = 0; j <= sides; j++) {
        const ang = (j / sides) * Math.PI * 2;
        const nn: V3 = add(mul(U, Math.cos(ang)), mul(W, Math.sin(ang)));
        const r = rad[i] * (1 + ridge * Math.sin(j * 2.0 + i * 1.3));
        this.vert(add(pts[i], mul(nn, r)), nn, st, ta, tb, hue + (i / (n - 1)) * 0.1, kind, j / sides, i / (n - 1));
      }
    }
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < sides; j++) {
      const a0 = base + i * (sides + 1) + j, a1 = a0 + 1, b0 = a0 + sides + 1, b1 = b0 + 1;
      this.idx.push(a0, b0, a1, a1, b0, b1);
    }
  }

  /** 葉・花弁: 中央の葉脈で折れたV字断面。幅プロファイルで葉形を変える */
  leaf(base: V3, dir: V3, up: V3, len: number, wid: number, curl: number, t0: number, t1: number, hue: number, kind: number, rows: number, shape: LeafShape = 'ovate', fold = 0.28, hueSpan = 0.18) {
    let side = cross(dir, up);
    if (Math.hypot(...side) < 1e-4) side = perp(dir);
    side = norm(side);
    let nrm = norm(cross(side, dir));
    let d = dir; let p = base;
    const b0 = this.pos.length / 3;
    for (let r = 0; r <= rows; r++) {
      const f = r / rows;
      let prof: number;
      switch (shape) {
        case 'lance': prof = Math.pow(Math.sin(Math.PI * Math.min(1, 0.04 + f * 0.96)), 0.75) * (1 - 0.3 * f); break;
        case 'cordate': prof = (0.25 + 0.75 * Math.sqrt(Math.sin(Math.PI * Math.min(1, f * 0.98 + 0.02)))) * Math.pow(1 - f, 0.35); break;
        case 'blade': prof = Math.pow(1 - f, 0.55) * (0.55 + 0.45 * Math.min(1, f * 5)); break;
        default: prof = Math.pow(Math.sin(Math.PI * Math.min(1, 0.07 + f * 0.93)), 0.85);
      }
      const w = wid * prof * (1 + 0.04 * Math.sin(f * 40 + len));
      const lift = nrm;
      const hv = hue + f * hueSpan;
      const L = add(add(p, mul(side, -w)), mul(lift, fold * w));
      const R = add(add(p, mul(side, w)), mul(lift, fold * w));
      this.vert(L, norm(add(nrm, mul(side, 0.55))), base, t0, t1, hv, kind, 0, f);
      this.vert(p, nrm, base, t0, t1, hv, kind, 0.5, f);
      this.vert(R, norm(add(nrm, mul(side, -0.55))), base, t0, t1, hv, kind, 1, f);
      if (r < rows) {
        d = norm(add(d, mul(nrm, -curl / rows)));
        p = add(p, mul(d, len / rows));
        nrm = norm(cross(side, d));
      }
    }
    for (let r = 0; r < rows; r++) {
      const i = b0 + r * 3;
      this.idx.push(i, i + 1, i + 3, i + 1, i + 4, i + 3, i + 1, i + 2, i + 4, i + 2, i + 5, i + 4);
    }
  }

  /** フィボナッチ螺旋の花(内側ほど立ち上がり、外側ほど開く) */
  flower(c: V3, axis: V3, n: number, len: number, t0: number, t1: number, hue: number, open: number, q: number) {
    const u = perp(axis); const w = cross(axis, u);
    n = Math.max(5, Math.round(n * QS.petalMul[q]));
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n; const ang = i * GOLD;
      const rad = add(mul(u, Math.cos(ang)), mul(w, Math.sin(ang)));
      const el = 0.18 + 1.2 * (1 - Math.pow(f, 0.7)) * (1.1 - open * 0.55);
      const fwd = norm(add(mul(rad, Math.cos(el)), mul(axis, Math.sin(el))));
      const L = len * (0.3 + 0.7 * Math.pow(f, 0.55));
      this.leaf(add(c, mul(rad, len * 0.04 * Math.sqrt(f))), fwd, axis, L, L * 0.36, 0.8 + (1 - f) * 0.9, t0, t1, hue + f * 0.4, 2, QS.petalRows[q], 'ovate', 0.45, 0.3);
    }
  }

  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aStart', new THREE.Float32BufferAttribute(this.start, 3));
    g.setAttribute('aMeta', new THREE.Float32BufferAttribute(this.meta, 4));
    g.setAttribute('aUV', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.pos.length / 3 > 65000 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    return g;
  }
}

/** ゆるやかに曲がる枝の点列(上向きの屈性とゆらぎ) */
const limb = (p0: V3, dir: V3, len: number, n: number, R: () => number, bend = 0.12, trop = 0.08) => {
  const pts: V3[] = [p0]; let d = dir; let p = p0;
  for (let i = 0; i < n; i++) {
    d = norm(add(add(d, mul(UP, trop)), [(R() - 0.5) * bend * 2, (R() - 0.5) * bend, (R() - 0.5) * bend * 2]));
    p = add(p, mul(d, len / n)); pts.push(p);
  }
  return {pts, dir: d};
};
const taper = (n: number, r0: number, r1: number) => Array.from({length: n + 1}, (_, i) => r0 + (r1 - r0) * (i / n));
const sides = (q: number, min = 3) => Math.max(min, QS.sides[q]);

/** 種0: 根張り・幹・曲がった枝が再帰分岐する大樹。枝先に葉叢と花 */
function greatTree(seed: number, q: number) {
  const R = mulberry(seed); const b = new Builder(); const hue0 = R();
  const D = q === 0 ? 5 : q === 1 ? 3 : 2;
  const leafAt = (pts: V3[], dir: V3, t: number, hue: number, cnt: number) => {
    const k = Math.max(1, Math.round(cnt * QS.leafDen[q]));
    const ax = perp(dir);
    for (let i = 0; i < k; i++) {
      const s = 0.3 + 0.7 * (i + R() * 0.5) / k;
      const base = lerp3(pts[0], pts[pts.length - 1], s);
      const out = rotAxis(ax, dir, i * GOLD);
      const ld = norm(add(add(mul(out, 0.85), mul(dir, 0.55)), [0, -0.22 + R() * 0.2, 0]));
      const sz = (0.9 + R() * 0.5) * QS.leafSize[q];
      b.leaf(base, ld, UP, 1.25 * sz, 0.5 * sz, 0.35 + R() * 0.4, t, t + 0.14, hue + R() * 0.12, 1, QS.leafRows[q], 'ovate', 0.3);
    }
  };
  // 幹と根張り
  const tN = Math.max(3, Math.round(6 * QS.seg[q]));
  const trunk = limb([0, -0.3, 0], UP, 4.3, tN, R, 0.08, 0.02);
  b.path(trunk.pts, trunk.pts.map((_, i) => 0.5 * (1 - 0.46 * i / tN) + 0.45 * Math.exp(-i * 3.2 / tN * 1.4)), 0, 0.1, hue0, sides(q, 4), 0, q === 0 ? 0.06 : 0);
  if (q < 2) for (let r = 0; r < 4; r++) {
    const a = r * 1.57 + R() * 0.6; const dir: V3 = norm([Math.cos(a), -0.28, Math.sin(a)]);
    const rp = limb([0, 0.55, 0], dir, 1.5, 3, R, 0.1, -0.05);
    b.path(rp.pts, taper(3, 0.2, 0.05), 0, 0.08, hue0, sides(q, 4), 0);
  }
  const w = 0.74 / D;
  const rec = (p: V3, dir: V3, len: number, rad: number, d: number) => {
    const n = Math.max(2, Math.round((d <= 1 ? 5 : d <= 2 ? 4 : 3) * QS.seg[q]));
    const t0 = 0.1 + (d - 1) * w, t1 = 0.1 + d * w;
    const L = limb(p, dir, len, n, R, 0.14, 0.09);
    b.path(L.pts, taper(n, rad, rad * 0.55), t0, t1, hue0 + d * 0.05, sides(q - 0 + (d > 2 ? 0 : 0), 3) - (d > 2 && q === 0 ? 2 : 0), 0, d <= 1 && q === 0 ? 0.05 : 0);
    const end = L.pts[n];
    if (d < D) {
      const kids = d < 2 ? 3 : 2; const ax = perp(L.dir); const tw = R() * 6.28;
      for (let k = 0; k < kids; k++) {
        const nd = rotAxis(L.dir, rotAxis(ax, L.dir, tw + k * (6.2832 / kids)), 0.42 + R() * 0.26);
        rec(end, nd, len * (0.7 + R() * 0.08), rad * 0.52, d + 1);
      }
      if (d >= 1 && R() < 0.6) {
        const mid = L.pts[Math.floor(n / 2)];
        rec(mid, rotAxis(L.dir, rotAxis(ax, L.dir, R() * 6.28), 1.0), len * 0.45, rad * 0.3, D);
      }
    } else {
      leafAt(L.pts, L.dir, 0.86, hue0 + 0.3, 7);
      if (R() < 0.4) b.flower(end, norm(add(L.dir, [0, 0.4, 0])), 11, 0.8, 0.86, 1, hue0 + 0.55, 0.8, q);
    }
  };
  rec(trunk.pts[tN], trunk.dir, 3.1, 0.3, 1);
  return b.geometry();
}

/** 種1: しだれ柳 — 弧を描く枝から細い枝垂れが何本も垂れ、葉が連なる */
function weepingWillow(seed: number, q: number) {
  const R = mulberry(seed); const b = new Builder(); const hue0 = R();
  const tN = Math.max(3, Math.round(5 * QS.seg[q]));
  const trunk = limb([0, -0.2, 0], norm([0.18, 1, 0.1]), 3.6, tN, R, 0.1, 0.03);
  b.path(trunk.pts, taper(tN, 0.46, 0.26), 0, 0.12, hue0, sides(q, 4), 0, q === 0 ? 0.07 : 0);
  const M = Math.max(3, Math.round(6 * QS.strands[q] + 2));
  for (let m = 0; m < M; m++) {
    const a = m / M * 6.283 + R() * 0.5;
    let d: V3 = norm([Math.cos(a) * 0.8, 0.85, Math.sin(a) * 0.8]); let p = trunk.pts[tN]; const pts: V3[] = [p];
    const n = Math.max(3, Math.round(5 * QS.seg[q]));
    for (let i = 0; i < n; i++) { d = norm(add(d, [0, -0.2, 0])); p = add(p, mul(d, 3.0 / n * 1.2)); pts.push(p); }
    b.path(pts, taper(n, 0.17, 0.07), 0.12, 0.3, hue0 + 0.05, sides(q, 3), 0);
    const S = Math.max(2, Math.round(7 * QS.strands[q]));
    for (let s = 0; s < S; s++) {
      const f = 0.3 + 0.7 * (s + R() * 0.6) / S;
      const i0 = Math.min(n - 1, Math.floor(f * n)); const base = lerp3(pts[i0], pts[i0 + 1], f * n - i0);
      const ns = Math.max(3, Math.round(4 * QS.seg[q] + 1));
      const len = 3.6 + R() * 2.2; const sp: V3[] = [base]; let sd: V3 = norm([Math.cos(a) * 0.3 + (R() - 0.5) * 0.2, -1, Math.sin(a) * 0.3 + (R() - 0.5) * 0.2]); let sq = base;
      for (let i = 0; i < ns; i++) { sd = norm(add(sd, [(R() - 0.5) * 0.14, -0.04, (R() - 0.5) * 0.14])); sq = add(sq, mul(sd, len / ns)); sp.push(sq); }
      const ts = 0.3 + 0.5 * f;
      b.path(sp, taper(ns, 0.03, 0.012), ts, ts + 0.2, hue0 + 0.12, 3, 0);
      const lk = Math.max(2, Math.round(ns * 2 * QS.leafDen[q] ** 0.5));
      for (let k = 0; k < lk; k++) {
        const ff = (k + 1) / (lk + 1); const idx = Math.min(ns - 1, Math.floor(ff * ns));
        const bp = lerp3(sp[idx], sp[idx + 1], ff * ns - idx);
        const side: V3 = [Math.cos(k * GOLD), 0, Math.sin(k * GOLD)];
        b.leaf(bp, norm(add(mul(side, 0.6), [0, -0.7, 0])), UP, 0.85 * QS.leafSize[q] ** 0.7, 0.13 * QS.leafSize[q] ** 0.7, 0.2, ts + 0.15, ts + 0.3, hue0 + 0.3 + R() * 0.1, 1, Math.max(1, QS.leafRows[q] - 3), 'lance', 0.2);
      }
    }
  }
  return b.geometry();
}

/** 種2: ヤシ — 節のある太い幹と、羽状の葉が放射状にしなる冠 */
function palm(seed: number, q: number) {
  const R = mulberry(seed); const b = new Builder(); const hue0 = R();
  const n = Math.max(6, Math.round(16 * QS.seg[q]));
  const trunk = limb([0, -0.2, 0], norm([0.14, 1, 0.08]), 6.4, n, R, 0.05, 0.02);
  b.path(trunk.pts, trunk.pts.map((_, i) => (0.36 * (1 - 0.28 * i / n) + 0.4 * Math.exp(-i * 3 / n * 2)) * (i % 2 ? 1 : 1.18)), 0, 0.3, hue0, sides(q, 4), 0, 0.04);
  const top = trunk.pts[n];
  const F = Math.max(5, Math.round(13 * QS.strands[q] + 3));
  for (let f = 0; f < F; f++) {
    const a = f * GOLD; const el = 0.35 + 0.9 * ((f % 5) / 5);
    let d: V3 = norm([Math.cos(a) * Math.cos(el), Math.sin(el) + 0.3, Math.sin(a) * Math.cos(el)]); let p = top; const pts: V3[] = [p];
    const rn = Math.max(3, Math.round(7 * QS.seg[q] + 1)); const len = 4.6 + R() * 1.2;
    for (let i = 0; i < rn; i++) { d = norm(add(d, [0, -0.13 - 0.03 * i, 0])); p = add(p, mul(d, len / rn)); pts.push(p); }
    const t0 = 0.3 + 0.05 * (f % 4), t1 = t0 + 0.3;
    b.path(pts, taper(rn, 0.1, 0.02), t0, t1, hue0 + 0.15, 3, 0);
    const lk = Math.max(2, Math.round(rn * 2.2 * QS.leafDen[q] ** 0.6));
    const sideV = norm(cross(UP, sub(pts[rn], pts[0])));
    for (let i = 1; i <= lk; i++) {
      const ff = i / (lk + 1); const idx = Math.min(rn - 1, Math.floor(ff * rn));
      const bp = lerp3(pts[idx], pts[idx + 1], ff * rn - idx);
      const ll = (1.9 - 1.1 * ff) * QS.leafSize[q] ** 0.6;
      for (const sd of [-1, 1]) {
        const ld = norm(add(add(mul(sideV, sd * 0.85), mul(norm(sub(pts[rn], pts[0])), 0.35)), [0, -0.5, 0]));
        b.leaf(bp, ld, UP, ll, 0.11 * QS.leafSize[q] ** 0.5, 0.35, t0 + 0.12, t1 + 0.12, hue0 + 0.3 + ff * 0.1, 1, Math.max(1, QS.leafRows[q] - 3), 'lance', 0.15);
      }
    }
  }
  if (q < 2) for (let c = 0; c < 5; c++) b.flower(add(top, [Math.cos(c * 1.3) * 0.3, -0.35, Math.sin(c * 1.3) * 0.3]), [0, -1, 0], 7, 0.45, 0.75, 1, hue0 + 0.6, 0.5, q);
  return b.geometry();
}

/** 種3: 大輪のダリア — らせん茎、大きな羽葉、側芽と蕾 */
function giantBloom(seed: number, q: number) {
  const R = mulberry(seed); const b = new Builder(); const hue = R();
  const stalk = (p0: V3, dir: V3, len: number, rad: number, depth: number, t0: number, h: number) => {
    const n = Math.max(4, Math.round(9 * QS.seg[q])); const pts: V3[] = [p0]; let p = p0; let d = dir;
    for (let i = 0; i < n; i++) { d = norm(rotAxis(add(d, mul(UP, 0.05)), UP, 0.26)); d = norm(rotAxis(d, perp(d), 0.04 * Math.sin(i + depth))); p = add(p, mul(d, len / n)); pts.push(p); }
    b.path(pts, taper(n, rad, rad * 0.55), t0, t0 + 0.4, h, sides(q, 4), 0);
    for (let i = 2; i < n; i += 2) {
      const a = i * GOLD; const out: V3 = [Math.cos(a), 0.12, Math.sin(a)];
      if (depth < 1 && i === n - 3 && q < 2) stalk(pts[i], norm(add(out, [0, 0.9, 0])), len * 0.42, rad * 0.5, depth + 1, t0 + 0.2, h + 0.25);
      else b.leaf(pts[i], norm(add(out, [0, 0.4, 0])), UP, (depth ? 1.2 : 2.7) * QS.leafSize[q] ** 0.5, (depth ? 0.6 : 1.3) * QS.leafSize[q] ** 0.5, 0.7, t0 + 0.25, t0 + 0.42, h + 0.3, 1, QS.leafRows[q], 'ovate', 0.35);
    }
    const top = pts[n];
    b.flower(top, norm(add(d, [0, 0.2, 0])), depth ? 21 : 55, depth ? len * 0.3 : 3.5, t0 + 0.4, 1, h + 0.5, depth ? 0.8 : 1, q);
    if (!depth && q < 2) b.flower(pts[n - 2], norm(add(d, [0.7, 0.2, 0.3])), 13, 0.9, t0 + 0.4, 1, h + 0.2, 0.1, q);   // 蕾
  };
  stalk([0, 0, 0], UP, 8.2, 0.24, 0, 0, hue);
  return b.geometry();
}

/** 種4: アガベ — 螺旋に並ぶ厚い葉のロゼットと、燭台状に咲く花茎 */
function agave(seed: number, q: number) {
  const R = mulberry(seed); const b = new Builder(); const hue = R();
  const K = Math.max(10, Math.round(40 * QS.petalMul[q] + 6));
  for (let i = 0; i < K; i++) {
    const f = i / K; const a = i * GOLD; const el = 1.25 - 1.0 * Math.pow(f, 0.8);
    const dir: V3 = norm([Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)]);
    b.leaf([0, 0.2, 0], dir, UP, (2.4 + 2.6 * f) * QS.leafSize[q] ** 0.4, (0.55 + 0.35 * f) * QS.leafSize[q] ** 0.4, 0.5 + 0.7 * f, 0.02 + 0.2 * f, 0.22 + 0.2 * f, hue + f * 0.25, 1, Math.max(2, QS.leafRows[q] - 1), 'blade', 0.7, 0.3);
  }
  const n = Math.max(4, Math.round(9 * QS.seg[q]));
  const st = limb([0, 0.3, 0], UP, 8.5, n, R, 0.05, 0.02);
  b.path(st.pts, taper(n, 0.2, 0.08), 0.35, 0.65, hue + 0.2, sides(q, 4), 0);
  const BR = Math.max(3, Math.round(8 * QS.strands[q] + 1));
  for (let i = 0; i < BR; i++) {
    const idx = Math.min(n, Math.floor(n * (0.5 + 0.5 * (i / BR)))); const base = st.pts[idx];
    const a = i * GOLD; const bd: V3 = norm([Math.cos(a), 0.7, Math.sin(a)]);
    const bl = limb(base, bd, 1.5, 3, R, 0.05, 0.1);
    b.path(bl.pts, taper(3, 0.05, 0.03), 0.6, 0.8, hue + 0.3, 3, 0);
    for (let k = 0; k < 3; k++) b.flower(lerp3(bl.pts[1], bl.pts[3], k / 2), norm(add(bl.dir, [0, 0.3, 0])), 6, 0.55, 0.8, 1, hue + 0.55, 0.9, q);
  }
  return b.geometry();
}

/** 種5: 竹林 — 節のある稈と、しなる笹の葉 */
function bamboo(seed: number, q: number) {
  const R = mulberry(seed); const b = new Builder(); const hue = R();
  const C = Math.max(2, Math.round(7 * QS.strands[q] + 1));
  for (let c = 0; c < C; c++) {
    const a = c * GOLD; const base: V3 = [Math.cos(a) * (0.3 + R() * 0.9), -0.2, Math.sin(a) * (0.3 + R() * 0.9)];
    const n = Math.max(4, Math.round(9 * QS.seg[q] + 1)); const H = 8 + R() * 3;
    const L = limb(base, norm([(R() - 0.5) * 0.2, 1, (R() - 0.5) * 0.2]), H, n, R, 0.05, 0.03);
    const t0 = 0.05 * c / C;
    b.path(L.pts, L.pts.map((_, i) => (i % 2 ? 0.14 : 0.2) * (1 - 0.3 * i / n)), t0, t0 + 0.5, hue + c * 0.03, sides(q, 5), 0, 0);
    for (let i = Math.floor(n * 0.5); i <= n; i++) {
      const sp = L.pts[i]; const ab = i * GOLD + c;
      const lk = Math.max(2, Math.round(5 * QS.leafDen[q] ** 0.5));
      for (let k = 0; k < lk; k++) {
        const ang = ab + k * 6.283 / lk; const dd: V3 = norm([Math.cos(ang) * 0.9, -0.25 + R() * 0.2, Math.sin(ang) * 0.9]);
        b.leaf(sp, dd, UP, 1.5 * QS.leafSize[q] ** 0.6, 0.12 * QS.leafSize[q] ** 0.6, 0.45, 0.5 + t0, 0.7 + t0, hue + 0.3, 1, Math.max(1, QS.leafRows[q] - 2), 'lance', 0.15);
      }
    }
  }
  return b.geometry();
}

/** 種6: 壁面を垂れる蔓 — ハート形の葉と、先端に小さなラッパ型の花 */
function hangingVine(seed: number, q: number) {
  const R = mulberry(seed); const b = new Builder(); const hue = R();
  const S = Math.max(2, Math.round(7 * QS.strands[q] + 1));
  for (let s = 0; s < S; s++) {
    const x0 = (s - S / 2) * 0.9 + (R() - 0.5) * 0.4; const base: V3 = [x0, 0, (R() - 0.5) * 0.3];
    const n = Math.max(4, Math.round(9 * QS.seg[q] + 1)); const len = 6 + R() * 5;
    const pts: V3[] = [base]; let p = base; let d: V3 = [0, -1, 0];
    for (let i = 0; i < n; i++) { d = norm(add(d, [Math.sin(i * 0.9 + s) * 0.18, 0, Math.cos(i * 0.7 + s * 2) * 0.12])); p = add(p, mul(d, len / n)); pts.push(p); }
    const t0 = 0.04 * s / S;
    b.path(pts, taper(n, 0.07, 0.025), t0, t0 + 0.5, hue + s * 0.03, 4, 0);
    for (let i = 1; i <= n; i++) {
      const sd: V3 = [Math.cos(i * GOLD + s), 0, Math.sin(i * GOLD + s)];
      const tt = t0 + 0.5 * i / n;
      const cnt = Math.max(1, Math.round(2 * QS.leafDen[q] ** 0.4));
      for (let k = 0; k < cnt; k++) {
        const dd = norm(add(mul(k ? [-sd[0], 0, -sd[2]] : sd, 0.9), [0, -0.5, 0]));
        b.leaf(pts[i], dd, UP, 1.0 * QS.leafSize[q] ** 0.6, 0.75 * QS.leafSize[q] ** 0.6, 0.5, tt, tt + 0.15, hue + 0.28, 1, Math.max(2, QS.leafRows[q] - 1), 'cordate', 0.3);
      }
      if (q < 2 && i % 3 === 0) b.flower(add(pts[i], mul(sd, 0.2)), norm(add(sd, [0, -0.3, 0])), 6, 0.5, 0.8, 1, hue + 0.55, 0.9, q);
    }
  }
  return b.geometry();
}

/** [関数, 本数の重み] 種の一覧。インデックス = 種ID */
export const SPECIES = [greatTree, weepingWillow, palm, giantBloom, agave, bamboo, hangingVine];
export const SPECIES_NAMES = ['greatTree', 'weepingWillow', 'palm', 'giantBloom', 'agave', 'bamboo', 'hangingVine'];
export const buildSpecies = (k: number, seed: number, q = 0) => SPECIES[k](seed, q);
