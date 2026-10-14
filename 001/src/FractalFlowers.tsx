import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import {Bubbles, Glow, Rain, Rays, Vignette} from './Overlays';

export const DURATION = 450; // 15秒 @30fps
const FADE = 20;

const ease = Easing.inOut(Easing.cubic);

/** シーン共通: 前後のクロスフェード */
const Scene: React.FC<{from: number; dur: number; children: React.ReactNode}> = ({from, dur, children}) => (
  <Sequence from={from} durationInFrames={dur} layout="none">
    <SceneInner dur={dur}>{children}</SceneInner>
  </Sequence>
);

const SceneInner: React.FC<{dur: number; children: React.ReactNode}> = ({dur, children}) => {
  const f = useCurrentFrame();
  const opacity = interpolate(f, [0, FADE, dur - FADE, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <AbsoluteFill style={{opacity}}>{children}</AbsoluteFill>;
};

const useT = (dur: number) => {
  const f = useCurrentFrame();
  return interpolate(f, [0, dur], [0, 1], {extrapolateRight: 'clamp', easing: ease});
};

/** 1) フラクタルの太陽へ飛び込む */
const SceneSun: React.FC<{dur: number}> = ({dur}) => {
  const f = useCurrentFrame();
  const t = useT(dur);
  const scale = interpolate(t, [0, 1], [1.35, 2.6]);
  return (
    <AbsoluteFill style={{background: '#02030f'}}>
      <AbsoluteFill
        style={{
          transform: `scale(${scale}) rotate(${Math.sin(f / 40) * 1.5}deg)`,
          transformOrigin: '50% 77%',
          filter: `hue-rotate(${f * 0.8}deg) saturate(1.2)`,
        }}
      >
        <Img src={staticFile('ref2_fractal_sun.webp')} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
      </AbsoluteFill>
      <Rays opacity={0.2} cx="50%" cy="60%" speed={0.6} />
      <Glow hue={20} />
    </AbsoluteFill>
  );
};

/** 2) 虹と花畑: 縦長画像を上から下へゆっくりパン */
const SceneFlowers: React.FC<{dur: number}> = ({dur}) => {
  const f = useCurrentFrame();
  const t = useT(dur);
  const scale = interpolate(t, [0, 1], [1.25, 1.7]);
  const ty = interpolate(t, [0, 1], [8, -10]); // %
  return (
    <AbsoluteFill style={{background: '#10002a'}}>
      <AbsoluteFill
        style={{
          transform: `translateY(${ty}%) scale(${scale}) rotate(${Math.sin(f / 25) * 1.2}deg)`,
          transformOrigin: '50% 30%',
          filter: `hue-rotate(${Math.sin(f / 50) * 40}deg) saturate(1.15)`,
        }}
      >
        <Img src={staticFile('ref1_flowers_rainbow.jpg')} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
      </AbsoluteFill>
      <Rain />
      <Bubbles />
      <Rays opacity={0.12} cx="50%" cy="85%" speed={-0.4} />
    </AbsoluteFill>
  );
};

/** 3) フラクタルの樹: ズーム + 色相回転 */
const SceneTree: React.FC<{dur: number}> = ({dur}) => {
  const f = useCurrentFrame();
  const t = useT(dur);
  const scale = interpolate(t, [0, 1], [1.3, 2.3]);
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <AbsoluteFill
        style={{
          transform: `scale(${scale}) rotate(${interpolate(t, [0, 1], [-3, 4])}deg)`,
          transformOrigin: '43% 31%',
          filter: `hue-rotate(${f * 1.2}deg) saturate(1.1)`,
        }}
      >
        <Img src={staticFile('ref3_fractal_tree.webp')} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
      </AbsoluteFill>
      <Rays opacity={0.15} cx="43%" cy="31%" speed={0.8} />
      <Bubbles count={18} />
    </AbsoluteFill>
  );
};

/** 4) マンダラのカレイドスコープ */
const SceneMandala: React.FC<{dur: number}> = ({dur}) => {
  const f = useCurrentFrame();
  const t = useT(dur);
  const scale = interpolate(t, [0, 1], [1.0, 1.8]);
  const layer = (rot: number, s: number, opacity: number, hue: number, blend: 'normal' | 'screen') => (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        mixBlendMode: blend,
        opacity,
        transform: `scale(${s}) rotate(${rot}deg)`,
        filter: `hue-rotate(${hue}deg)`,
      }}
    >
      <Img
        src={staticFile('ref4_mandala.jpg')}
        style={{width: 1280, height: 853, objectFit: 'cover', borderRadius: '50%'}}
      />
    </AbsoluteFill>
  );
  return (
    <AbsoluteFill style={{background: '#0a0020'}}>
      {layer(f * 0.5, scale * 1.9, 1, 0, 'normal')}
      {layer(-f * 0.8, scale * 1.15, 0.35, 90 + f, 'screen')}
      {layer(f * 1.2, scale * 0.6, 0.3, 200 + f * 2, 'screen')}
      <Rays opacity={0.18} speed={1.2} />
      <Bubbles count={34} />
      <Glow hue={320} />
    </AbsoluteFill>
  );
};

export const FractalFlowers: React.FC = () => {
  const SC = 135; // 各シーン長
  const step = (DURATION - SC) / 3; // 105フレームごとに次シーン (20f重なる)
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <Audio src={staticFile('storyboard.mp4')} volume={0.9} />
      <Scene from={0} dur={SC}>
        <SceneSun dur={SC} />
      </Scene>
      <Scene from={Math.round(step)} dur={SC}>
        <SceneFlowers dur={SC} />
      </Scene>
      <Scene from={Math.round(step * 2)} dur={SC}>
        <SceneTree dur={SC} />
      </Scene>
      <Scene from={Math.round(step * 3)} dur={SC}>
        <SceneMandala dur={SC} />
      </Scene>
      <Rain count={30} opacity={0.3} />
      <Vignette />
    </AbsoluteFill>
  );
};
