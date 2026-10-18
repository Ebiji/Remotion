import * as THREE from 'three';

type V3 = [number, number, number];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp3 = (a: V3, b: V3, t: number): V3 => add(mul(a, 1 - t), mul(b, t));
/** 軸まわりに回転 (Rodrigues) */
const rotAxis = (v: V3, k: V3, ang: number): V3 => {
  const c = Math.cos(ang), s = Math.sin(ang);
  return add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)));
};
const perp = (d: V3): V3 => norm(Math.abs(d[1]) < 0.95 ? cross(d, [0, 1, 0]) : cross(d, [1, 0, 0]));

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

const GOLD = 2.399963229728653;

class Builder {
  pos: number[] = []; nor: number[] = []; start: number[] = []; meta: number[] = []; uv: number[] = []; idx: number[] = [];
  vert(p: V3, n: V3, s: V3, t0: number, t1: number, hue: number, kind: number, u: number, v: number) {
    this.pos.push(...p); this.nor.push(...n); this.start.push(...s);
    this.meta.push(t0, t1, hue, kind); this.uv.push(u, v);
    return this.pos.length / 3 - 1;
  }
  /** テーパー付きの茎/枝 */
  tube(a: V3, b: V3, r0: number, r1: number, t0: number, t1: number, hue: number, sides = 5, kind = 0) {
    const d = norm(sub(b, a)); const u = perp(d); const w = cross(d, u);
    const base = this.pos.length / 3;
    for (let ring = 0; ring < 2; ring++) {
      const c = ring ? b : a; const r = ring ? r1 : r0;
      for (let i = 0; i <= sides; i++) {
        const ang = (i / sides) * Math.PI * 2;
        const n: V3 = add(mul(u, Math.cos(ang)), mul(w, Math.sin(ang)));
        this.vert(add(c, mul(n, r)), n, a, t0, t1, hue + ring * 0.03, kind, i / sides, ring);
      }
    }
    for (let i = 0; i < sides; i++) {
      const a0 = base + i, a1 = base + i + 1, b0 = base + sides + 1 + i, b1 = b0 + 1;
      this.idx.push(a0, b0, a1, a1, b0, b1);
    }
  }
  /** 葉/花弁: 根元から先端へ曲がる幅プロファイル付きの帯 */
  blade(base: V3, fwd: V3, side: V3, len: number, wid: number, curl: number, t0: number, t1: number, hue: number, kind: number, segs = 5, prof = 0.8, hueSpan = 0.2) {
    const nrm0 = norm(cross(side, fwd));
    const b0 = this.pos.length / 3;
    let pnt = base; let dir = fwd;
    for (let s = 0; s <= segs; s++) {
      const f = s / segs;
      const w = wid * Math.pow(Math.sin(Math.PI * Math.min(1, 0.12 + f * 0.88)), prof) * (kind === 2 ? 1 : 1);
      const nrm = norm(cross(side, dir));
      for (const sd of [-1, 1]) {
        this.vert(add(pnt, mul(side, sd * w)), nrm, base, t0, t1, hue + f * hueSpan, kind, sd * 0.5 + 0.5, f);
      }
      if (s < segs) {
        dir = norm(add(dir, mul(nrm0, -curl / segs)));
        pnt = add(pnt, mul(dir, len / segs));
      }
    }
    for (let s = 0; s < segs; s++) {
      const i = b0 + s * 2;
      this.idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
    }
  }
  /** フィボナッチ螺旋の花 (ダリア/薔薇のように内側ほど立ち上がる) */
  flower(c: V3, axis: V3, n: number, len: number, t0: number, t1: number, hue: number, openness = 1) {
    const u = perp(axis); const w = cross(axis, u);
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n; const ang = i * GOLD;
      const rad = add(mul(u, Math.cos(ang)), mul(w, Math.sin(ang)));
      const el = (0.2 + 1.25 * (1 - Math.pow(f, 0.7)) * (1.15 - openness * 0.5)); // 外側ほど平ら
      const fwd = norm(add(mul(rad, Math.cos(el)), mul(axis, Math.sin(el))));
      const side = norm(cross(axis, rad));
      const L = len * (0.28 + 0.72 * Math.pow(f, 0.55));
      this.blade(add(c, mul(rad, len * 0.05 * Math.sqrt(f))), fwd, side, L, L * 0.34, 0.9 + (1 - f) * 0.8, t0, t1, hue + f * 0.45, 2, 3, 0.7, 0.35);
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

const UP: V3 = [0, 1, 0];

/** 種0: 黄金角でねじれながら再帰分岐する樹 (枝先に花、途中に葉) */
function fractalTree(seed: number) {
  const R = mulberry(seed); const b = new Builder(); const D = 5;
  const rec = (p: V3, dir: V3, len: number, rad: number, depth: number, hue: number, twist: number) => {
    const t0 = (depth + R() * 0.25) / (D + 2), t1 = (depth + 1) / (D + 2);
    const tilt = norm(add(dir, mul(UP, 0.22)));
    const e = add(p, mul(tilt, len));
    b.tube(p, e, rad, rad * 0.7, t0, t1, hue + depth * 0.07, depth < 2 ? 6 : 4);
    if (depth >= 2 && depth < D) {
      const lside = perp(tilt);
      b.blade(lerp3(p, e, 0.55), norm(add(lside, mul(UP, 0.3))), cross(lside, tilt), len * 0.9, len * 0.28, 0.6, t1, t1 + 0.12, hue + 0.25, 1, 4);
    }
    if (depth < D) {
      const n = depth < 1 ? 3 : 2; const ax = perp(tilt);
      for (let k = 0; k < n; k++) {
        const around = twist + k * (Math.PI * 2 / n) + (R() - 0.5) * 0.3;
        const ang = (0.42 + R() * 0.2) * (depth < 1 ? 1.1 : 1);
        const nd = rotAxis(tilt, rotAxis(ax, tilt, around), ang);
        rec(e, nd, len * (0.72 + R() * 0.06), rad * 0.66, depth + 1, hue, twist + GOLD);
      }
    } else {
      b.flower(e, tilt, 8, 0.85, (D + 1) / (D + 2), 1, hue + 0.4);
    }
  };
  rec([0, 0, 0], UP, 3.4, 0.28, 0, R(), 0);
  return b.geometry();
}

/** 種1: 再帰するシダ (羽状複葉の中にさらに羽状複葉) */
function fern(seed: number) {
  const R = mulberry(seed); const b = new Builder();
  const frond = (base: V3, fwd: V3, side: V3, len: number, depth: number, t0: number, hue: number) => {
    const segs = depth > 0 ? 9 : 4; let p = base; let dir = fwd;
    const tSpan = depth > 0 ? 0.2 : 0.45;
    const nrm = norm(cross(side, fwd));
    for (let s = 0; s < segs; s++) {
      const f = s / segs; const ta = t0 + tSpan * f, tb = t0 + tSpan * (f + 1 / segs);
      dir = norm(add(dir, mul(nrm, -0.16 * (depth > 1 ? 1 : 0.5))));
      const e = add(p, mul(dir, len / segs));
      b.tube(p, e, 0.07 * Math.pow(1 - f, 0.8) * (len > 3 ? 1.4 : 0.7) + 0.012, 0.06 * (1 - f) * (len > 3 ? 1.4 : 0.7) + 0.01, ta, tb, hue + f * 0.15, 3);
      if (s >= 1 && depth > 0) {
        const k = 1 - f * 0.75;
        for (const sd of [-1, 1]) {
          const sdv = mul(side, sd);
          const cdir = norm(add(mul(sdv, 0.9), mul(dir, 0.5)));
          frond(e, cdir, norm(cross(nrm, cdir)), len * 0.42 * k, depth - 1, tb, hue + 0.2);
        }
      } else if (depth === 0) {
        b.blade(e, norm(add(mul(side, 0.9), mul(dir, 0.4))), nrm, len * 0.5, len * 0.16, 0.3, ta, ta + 0.15, hue + 0.3, 1, 3);
        b.blade(e, norm(add(mul(side, -0.9), mul(dir, 0.4))), nrm, len * 0.5, len * 0.16, 0.3, ta, ta + 0.15, hue + 0.3, 1, 3);
      }
      p = e;
    }
  };
  const nf = 5; const h0 = R();
  for (let i = 0; i < nf; i++) {
    const a = (i / nf) * Math.PI * 2 + R() * 0.3;
    const out: V3 = [Math.cos(a), 0, Math.sin(a)];
    const fwd = norm(add(mul(out, 0.8), mul(UP, 1.1)));
    frond([0, 0, 0], fwd, perp(fwd), 7.5 + R() * 2, 1, 0.0, h0 + i * 0.1);
  }
  b.flower([0, 0.4, 0], UP, 21, 1.1, 0.6, 1, h0 + 0.5, 0.6);
  return b.geometry();
}

/** 種2: ロマネスコ — 自己相似な螺旋円錐を3段入れ子 */
function romanesco(seed: number) {
  const R = mulberry(seed); const b = new Builder();
  const cone = (base: V3, axis: V3, h: number, r: number, depth: number, hue: number, t0: number) => {
    const tip = add(base, mul(axis, h));
    const ta = t0, tb = t0 + 0.28;
    b.tube(base, tip, r, r * 0.08, ta, tb, hue + (3 - depth) * 0.12, depth > 1 ? 6 : 4, 2);
    if (depth === 0) return;
    const n = depth === 3 ? 9 : depth === 2 ? 6 : 5; const u = perp(axis); const w = cross(axis, u);
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n; const ang = i * GOLD;
      const rad = add(mul(u, Math.cos(ang)), mul(w, Math.sin(ang)));
      const p = add(base, mul(axis, h * (0.1 + 0.8 * f)));
      const nd = norm(add(mul(rad, 0.95), mul(axis, 0.75)));
      const k = 1 - f * 0.55;
      cone(add(p, mul(rad, r * (1 - f) * 0.7)), nd, h * 0.42 * k, r * 0.42 * k, depth - 1, hue + f * 0.18, tb - 0.1 + f * 0.12);
    }
  };
  // 茎 + 頂部のロマネスコ + 葉
  const hue = R();
  b.tube([0, 0, 0], [0, 3.0, 0], 0.42, 0.34, 0, 0.18, hue, 6);
  cone([0, 3.0, 0], UP, 5.6, 1.7, 3, hue + 0.1, 0.18);
  for (let i = 0; i < 5; i++) {
    const a = i * GOLD * 1.7; const out: V3 = [Math.cos(a), 0.3, Math.sin(a)];
    b.blade([0, 0.4 + i * 0.35, 0], norm(add(out, mul(UP, 0.8))), norm(cross(UP, out)), 4.2, 1.1, 0.9, 0.05, 0.22, hue + 0.4, 1, 5);
  }
  return b.geometry();
}

/** 種3: らせん茎に側芽(入れ子の花)を付けた大輪の花 */
function bloomStalk(seed: number) {
  const R = mulberry(seed); const b = new Builder(); const hue = R();
  const stalk = (p0: V3, dir: V3, len: number, rad: number, depth: number, t0: number, h: number) => {
    const segs = 9; let p = p0; let d = dir; const ax = perp(dir);
    for (let s = 0; s < segs; s++) {
      const f = s / segs; const ta = t0 + 0.4 * f * (depth ? 0.6 : 1), tb = t0 + 0.4 * (f + 1 / segs) * (depth ? 0.6 : 1);
      d = norm(rotAxis(d, ax, 0.05 + 0.03 * Math.sin(f * 6 + depth)));
      d = norm(rotAxis(d, UP, 0.28));
      const e = add(p, mul(d, len / segs));
      b.tube(p, e, rad * (1 - f * 0.4), rad * (1 - (f + 1 / segs) * 0.4), ta, tb, h + f * 0.2, 5);
      if (s >= 2 && s % 2 === 0) {
        const a = s * GOLD; const out: V3 = [Math.cos(a), 0.15, Math.sin(a)];
        if (depth < 1 && s > 3) stalk(e, norm(add(out, mul(UP, 0.9))), len * 0.42, rad * 0.5, depth + 1, tb, h + 0.3);
        else b.blade(e, norm(add(out, mul(UP, 0.35))), norm(cross(UP, out)), len * 0.4, len * 0.12, 0.7, tb, tb + 0.12, h + 0.45, 1, 4);
      }
      p = e;
    }
    const tt = t0 + 0.4 * (depth ? 0.6 : 1);
    b.flower(p, d, depth ? 21 : 55, depth ? len * 0.34 : 3.6, tt, 1, h + 0.5, depth ? 0.8 : 1);
  };
  stalk([0, 0, 0], UP, 8.5, 0.34, 0, 0.0, hue);
  return b.geometry();
}

export const SPECIES = [fractalTree, fern, romanesco, bloomStalk];
export const buildSpecies = (k: number, seed: number) => SPECIES[k](seed);
