import React from 'react';
import {AbsoluteFill, Audio, Easing, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {Bubbles, Glow, Rain, Rays, Vignette} from './Overlays';

// 画面切り替え無し: 前の絵の中心に穴が開き、奥から次の絵が湧き出る「ズームスルー・モーフ」
const IMAGES = [
  'gen_kaleido.jpg',
  'ref2_fractal_sun.webp',
  'gen_tree.jpg',
  'ref3_fractal_tree.webp',
  'gen_field.jpg',
  'gen_mandala.jpg',
];
const STEP = 75; // 1枚あたり2.5秒
const D = 60; // モーフにかける長さ(2秒): 次のスロットの手前から重なる
export const CHAIN_DURATION = IMAGES.length * STEP;

const BASE = 1.25; // 常に少しオーバースキャン(右下の透かしを隠す＆縁を見せない)
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const ease = Easing.inOut(Easing.cubic);

const Layer: React.FC<{src: string; scale: number; rotate: number; hue: number; holeR?: number}> = ({
  src,
  scale,
  rotate,
  hue,
  holeR,
}) => {
  const mask =
    holeR === undefined
      ? undefined
      : `radial-gradient(circle at 50% 50%, transparent ${holeR}%, black ${holeR + 18}%)`;
  return (
    <AbsoluteFill
      style={{
        transform: `scale(${scale * BASE}) rotate(${rotate}deg)`,
        transformOrigin: '45% 40%',
        filter: `hue-rotate(${hue}deg) saturate(1.15)`,
        WebkitMaskImage: mask,
        maskImage: mask,
      }}
    >
      <Img src={staticFile(src)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
    </AbsoluteFill>
  );
};

export const MorphChain: React.FC = () => {
  const f = useCurrentFrame();
  let morph = 0; // 0..1: 今モーフ中の強さ(歪みフィルタ用)
  const layers: React.ReactNode[] = [];

  IMAGES.forEach((src, i) => {
    const t = f - i * STEP; // このスロット開始からの経過
    if (t < -D || t > STEP) return;
    const hue = Math.sin(f / 38 + i) * 55;
    const hold = interpolate(t, [0, STEP - D], [1, 1.12], clamp);
    let scale = hold;
    let rotate = 0;
    let holeR: number | undefined;
    if (t < 0) {
      // 入ってくる側: 下のレイヤーで少し大きくなりながら現れる
      const u = ease(interpolate(t, [-D, 0], [0, 1], clamp));
      scale = interpolate(u, [0, 1], [0.8, 1]);
      rotate = interpolate(u, [0, 1], [-20, 0]);
      morph = Math.max(morph, Math.sin(Math.PI * u));
    } else if (t > STEP - D && i < IMAGES.length - 1) {
      // 出ていく側: 上のレイヤーで拡大し、中心に穴が開く
      const u = interpolate(t, [STEP - D, STEP], [0, 1], {...clamp, easing: Easing.in(Easing.quad)});
      scale = interpolate(u, [0, 1], [1.12, 3.6]);
      rotate = interpolate(u, [0, 1], [0, 28]);
      holeR = interpolate(u, [0, 1], [0, 62]);
    }
    layers.push(
      <Layer key={src + i} src={src} scale={scale} rotate={rotate} hue={hue} holeR={holeR} />,
    );
  });

  // 入ってくる絵が先に描かれるよう、スロット番号の大きい方を下にする
  layers.reverse();

  return (
    <AbsoluteFill style={{background: '#000'}}>
      <Audio src={staticFile('storyboard.mp4')} volume={0.9} />
      <svg width={0} height={0} style={{position: 'absolute'}}>
        <filter id="flow" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency={`${0.006 + Math.sin(f / 40) * 0.002} ${0.01 + Math.cos(f / 55) * 0.003}`}
            numOctaves={2}
            seed={5}
          />
          <feDisplacementMap in="SourceGraphic" scale={morph * 90} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <AbsoluteFill style={{filter: morph > 0.01 ? 'url(#flow)' : undefined}}>{layers}</AbsoluteFill>
      <Rays opacity={0.1 + morph * 0.12} speed={0.8} />
      <Bubbles count={22} />
      <Rain count={30} opacity={0.25} />
      <Glow hue={300} />
      <Vignette />
    </AbsoluteFill>
  );
};
