import raw from './analysis.json';

/** scripts/analyze_audio.py が出力した30fpsのフレーム単位データを、描画用の連続量に変換する */
export const FPS = raw.fps;
export const FRAMES = raw.frames;
export const LEN = 320; // 都市ループ長 (world units)

const N = FRAMES + 2;

/** onset列 -> 指数減衰パルス (アタック瞬時、tauフレームで減衰) */
const pulse = (onsets: number[], amps: number[] | null, tau: number, lead = 0) => {
  const out = new Float32Array(N);
  const k = Math.exp(-1 / tau);
  const hit = new Float32Array(N);
  onsets.forEach((f, i) => {
    const ff = Math.max(0, f - lead);
    hit[ff] = Math.max(hit[ff], amps ? Math.min(1, Math.max(0.55, amps[f])) : 1);
  });
  for (let f = 0; f < N; f++) out[f] = Math.max(hit[f], (f ? out[f - 1] : 0) * k);
  return out;
};

const smooth = (a: number[] | Float32Array, atk: number, rel: number) => {
  const o = new Float32Array(N);
  for (let f = 0; f < N; f++) {
    const v = a[Math.min(f, a.length - 1)];
    const p = f ? o[f - 1] : 0;
    o[f] = v > p ? p + (v - p) * atk : p + (v - p) * rel;
  }
  return o;
};

const box = (a: ArrayLike<number>, r: number) => {
  const o = new Float32Array(N);
  for (let f = 0; f < N; f++) {
    let s = 0, c = 0;
    for (let j = Math.max(0, f - r); j <= Math.min(N - 1, f + r); j++) { s += a[Math.min(j, a.length - 1)]; c++; }
    o[f] = s / c;
  }
  return o;
};

export const kick = pulse(raw.kicks, raw.bass_flux, 7, 1);
export const snare = pulse(raw.snares, raw.mid_flux, 6, 1);
export const hat = pulse(raw.hats, raw.high_flux, 3, 1);
export const bass = smooth(raw.bass, 0.7, 0.18);
export const mid = smooth(raw.mid, 0.6, 0.2);
export const high = smooth(raw.high, 0.7, 0.3);
export const loud = box(raw.loud, 20);
/** 0..1 の曲全体の盛り上がり (イントロ→サビ→ブレイク→ラスト) */
export const inten = new Float32Array(N).map((_, f) => Math.min(1, Math.max(0, (loud[f] - 0.18) / 0.55)));

const specSm: Float32Array[] = [];
for (let b = 0; b < 16; b++) specSm.push(smooth(raw.spec.map((r) => r[b]), 0.95, 0.3));
export const specAt = (f: number, out: number[]) => {
  const i = Math.min(Math.max(0, f), N - 1);
  for (let b = 0; b < 16; b++) out[b] = specSm[b][i];
  return out;
};

/** 拍グリッド */
export const beat0 = raw.beats[0];
export const beatPeriod = raw.beat_period;
export const beatPos = (f: number) => (f - beat0) / beatPeriod; // 拍数 (小数)

/** 都市を流れる距離: 盛り上がりとキックで加速 */
export const travel = (() => {
  const o = new Float32Array(N);
  let d = 0;
  for (let f = 0; f < N; f++) {
    const speed = 0.5 * (0.55 + 2.2 * inten[f] + 0.9 * bass[f] + 1.3 * kick[f]); // 進行速度は1/2
    d += speed;
    o[f] = d;
  }
  return o;
})();

/** 区間の最後のキックからのフレーム数 (リップル用) */
export const kickAge = (() => {
  const o = new Float32Array(N);
  const set = new Set(raw.kicks);
  let a = 99;
  for (let f = 0; f < N; f++) { a = set.has(f) ? 0 : a + 1; o[f] = a; }
  return o;
})();

/** スネア通し番号 (カメラロールの向きを交互にする) */
export const snareIdx = (() => {
  const o = new Int32Array(N);
  const set = new Set(raw.snares);
  let c = 0;
  for (let f = 0; f < N; f++) { if (set.has(f)) c++; o[f] = c; }
  return o;
})();
export const kickIdx = (() => {
  const o = new Int32Array(N);
  const set = new Set(raw.kicks);
  let c = 0;
  for (let f = 0; f < N; f++) { if (set.has(f)) c++; o[f] = c; }
  return o;
})();
