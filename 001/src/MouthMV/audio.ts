import raw from './analysis.json';

/** scripts/analyze_audio.py が出力した30fpsのフレーム単位データを、描画用の連続量に変換する */
export const FPS = raw.fps;
export const FRAMES = raw.frames;
export const LEN = 320; // 都市ループ長 (world units)

const N = FRAMES + 2;
const rawAny = raw as any;
/** 曲ごとの構成 ('mouth1' = v1の流れ: 時刻キーフレームのカメラと8拍カット) */
export const SONG: string = rawAny.song ?? 'mouth2';

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

/** 女性スキャット(声域の旋律線): 存在感・音の出だし・ピッチ (scripts/analyze_voice.py) */
export const vox = smooth(rawAny.vox ?? [], 0.7, 0.12);
export const voxOn = pulse(rawAny.voxOn ?? [], null, 9, 1);
export const pitch = smooth(rawAny.pitch ?? [], 0.5, 0.5);

/** 山場(静→動)の頭: ラウドネスが急に立ち上がったフレーム。曲ごとに自動検出 */
export const dropFlash = (() => {
  const o = new Float32Array(N);
  let last = -999;
  for (let f = 60; f < N; f++) {
    if (loud[f] - loud[f - 60] > 0.16 && loud[f] > 0.45 && f - last > 300) {
      last = f;
      for (let k = 0; k < 12 && f + k < N; k++) o[f + k] = 1 - k / 12;
    }
  }
  return o;
})();

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

/** 道に沿って流れる旋律線用: 走行距離(1単位=1サンプル)ごとのピッチと声の強さ */
export const MELODY_W = Math.ceil(travel[N - 1] / 2) + 1024; // 2単位=1サンプル (テクスチャ幅の上限8192以内)
export const melodyTex = (() => {
  const d = new Float32Array(MELODY_W * 2);
  let f = 0;
  for (let i = 0; i < MELODY_W; i++) {
    const dist = i * 2;
    while (f < N - 2 && travel[f + 1] < dist) f++;
    d[i * 2] = pitch[Math.min(f, N - 1)];
    d[i * 2 + 1] = vox[Math.min(f, N - 1)];
  }
  return d;
})();
