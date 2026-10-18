import React from 'react';
import {AbsoluteFill, Audio, Easing, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {Bubbles, Glow, Vignette} from './Overlays';
import {QuantumOverlay} from './QuantumOverlay';

/**
 * 量子力学的配色 + 連続モーフ(30秒)
 * 画像を追加するときは IMAGES に1行足すだけ(public/ に置く)。pos は縦長にトリミングする位置。
 */
const IMAGES: {src: string; pos?: string}[] = [
  {src: 'ref2_fractal_sun.webp'},
  {src: 'gen_kaleido.jpg'},
  {src: 'ref1_flowers_rainbow.jpg'},
  {src: 'ref3_fractal_tree.webp'},
  {src: 'gen_tree.jpg'},
  {src: 'ref4_mandala.jpg', pos: '50% 50%'},
  {src: 'gen_mandala.jpg'},
  {src: 'gen_field.jpg'},
];
const N = IMAGES.length;
export const QUANTUM_DURATION = 900; // 30秒 @30fps
const S = QUANTUM_DURATION / N; // 1枚あたりの長さ
const D = 66; // モーフにかける長さ(2.2秒)
const BASE = 1.25; // 常にオーバースキャン(右下の透かしを隠す)
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// 水素バルマー系列にもとづくグラデーション(明るさ→色): 黒紫→紫(410)→青(434)→シアン(486)→マゼンタ→赤(656)→白熱
const STOPS = [
  [2, 0, 10],
  [20, 6, 80],
  [60, 24, 190],
  [20, 90, 255],
  [0, 200, 255],
  [255, 40, 160],
  [255, 60, 40],
  [255, 235, 210],
];
const table = (ch: number) => STOPS.map((s) => (s[ch] / 255).toFixed(3)).join(' ');

const ImageLayer: React.FC<{index: number; filter?: string}> = ({index, filter}) => {
  const f = useCurrentFrame();
  const {src, pos = '50% 50%'} = IMAGES[index];
  const z = interpolate(f, [index * S - D, (index + 1) * S], [1.0, 1.14], clamp);
  const dx = Math.sin(f / 70 + index) * 14;
  const dy = Math.cos(f / 85 + index * 2) * 14;
  return (
    <AbsoluteFill
      style={{
        transform: `translate(${dx}px, ${dy}px) scale(${z * BASE})`,
        transformOrigin: '45% 40%',
        filter,
      }}
    >
      <Img src={staticFile(src)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: pos}} />
    </AbsoluteFill>
  );
};

export const QuantumMorph: React.FC = () => {
  const f = useCurrentFrame();
  const b = Math.min(N - 1, Math.floor(f / S));
  const inTransition = b < N - 1 && f >= (b + 1) * S - D;
  const p = inTransition
    ? Easing.inOut(Easing.sin)(interpolate(f, [(b + 1) * S - D, (b + 1) * S], [0, 1], clamp))
    : 0;
  const T = 1.0 - 1.1 * p; // ノイズのしきい値: 1→-0.1 で次の絵が溶けるように現れる

  return (
    <AbsoluteFill style={{background: '#02000a'}}>
      <Audio src={staticFile('storyboard.mp4')} volume={0.85} loop />
      <svg width={0} height={0} style={{position: 'absolute'}}>
        {/* 量子配色: 明るさをバルマー系列のグラデーションに置き換えて元の色と混ぜる */}
        <filter id="quantum" colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
          <feColorMatrix
            in="SourceGraphic"
            type="matrix"
            values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0"
            result="lum"
          />
          <feComponentTransfer in="lum" result="mapped">
            <feFuncR type="table" tableValues={table(0)} />
            <feFuncG type="table" tableValues={table(1)} />
            <feFuncB type="table" tableValues={table(2)} />
          </feComponentTransfer>
          <feComposite in="SourceGraphic" in2="mapped" operator="arithmetic" k1="0" k2="0.28" k3="0.82" k4="0" />
        </filter>
        {/* 出ていく絵: 波打つように崩れる */}
        <filter id="warpOut" colorInterpolationFilters="sRGB" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.011" numOctaves={2} seed={4} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={p * 90} xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* 入ってくる絵: ノイズの濃淡に沿って溶けるように現れ、ゆがみが解けていく */}
        <filter id="revealIn" colorInterpolationFilters="sRGB" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.0045 0.0075" numOctaves={3} seed={9} result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="alphaNoise" />
          <feComponentTransfer in="alphaNoise" result="mask">
            <feFuncA type="linear" slope="6" intercept={-6 * T} />
          </feComponentTransfer>
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.011" numOctaves={2} seed={4} result="n2" />
          <feDisplacementMap in="SourceGraphic" in2="n2" scale={(1 - p) * 70} xChannelSelector="R" yChannelSelector="G" result="disp" />
          <feComposite in="disp" in2="mask" operator="in" />
        </filter>
      </svg>

      <AbsoluteFill style={{filter: 'url(#quantum)'}}>
        <ImageLayer index={b} filter={inTransition ? 'url(#warpOut)' : undefined} />
        {inTransition ? <ImageLayer index={b + 1} filter="url(#revealIn)" /> : null}
      </AbsoluteFill>

      <Glow hue={250} />
      <QuantumOverlay />
      <Bubbles count={14} opacity={0.5} />
      <Vignette />
    </AbsoluteFill>
  );
};
