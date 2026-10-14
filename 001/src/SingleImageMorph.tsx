import React from 'react';
import {AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, Easing} from 'remotion';
import {Bubbles, Glow, Rays, Vignette} from './Overlays';

export const MORPH_DURATION = 300; // 10秒 @30fps

const SRC = 'ref3_fractal_tree.webp';
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** 1枚の画像だけで、ゆがみ→万華鏡→ズームと変形していく */
export const SingleImageMorph: React.FC = () => {
  const f = useCurrentFrame();

  // 0-3.5s ゆがみ(液体)  3-4s 万華鏡へ  4-8s 万華鏡回転  7-10s 中心へズーム
  const warp = interpolate(f, [0, 90, 120, 300], [10, 60, 20, 30], clamp);
  const kaleido = interpolate(f, [90, 130], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const hue = f * 2.2;
  const baseScale = interpolate(f, [0, 130], [1.3, 1.9], clamp);
  const deep = interpolate(f, [210, 300], [1, 3.2], {...clamp, easing: Easing.in(Easing.cubic)});
  const rot = interpolate(f, [90, 300], [0, 120], clamp);
  const fadeOut = interpolate(f, [270, 300], [1, 0], clamp);

  const tile = (flipX: number, flipY: number, left: number, top: number) => (
    <div
      key={`${left}-${top}`}
      style={{position: 'absolute', left, top, width: 360, height: 640, overflow: 'hidden'}}
    >
      <div style={{width: '100%', height: '100%', transform: `scale(${flipX}, ${flipY})`}}>
        <Img
          src={staticFile(SRC)}
          style={{
            width: 720,
            height: 1280,
            objectFit: 'cover',
            transform: `translate(-${180 + Math.sin(f / 30) * 40}px, -${300 + Math.cos(f / 37) * 40}px) scale(1)`,
          }}
        />
      </div>
    </div>
  );

  return (
    <AbsoluteFill style={{background: '#000', opacity: fadeOut}}>
      <svg width={0} height={0} style={{position: 'absolute'}}>
        <filter id="liquid" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency={`${0.006 + Math.sin(f / 50) * 0.002} ${0.01 + Math.cos(f / 60) * 0.003}`}
            numOctaves={2}
            seed={3}
            result="n"
          />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={warp * 2.2} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>

      <AbsoluteFill style={{transform: `scale(${deep})`, transformOrigin: '50% 50%'}}>
        {/* A: 1枚をうねうねゆがませる */}
        <AbsoluteFill style={{opacity: 1 - kaleido, filter: `url(#liquid) hue-rotate(${hue}deg) saturate(1.2)`}}>
          <AbsoluteFill style={{transform: `scale(${baseScale})`, transformOrigin: '43% 31%'}}>
            <Img src={staticFile(SRC)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
          </AbsoluteFill>
        </AbsoluteFill>

        {/* B: 4分割ミラー(万華鏡)を回転 */}
        <AbsoluteFill
          style={{
            opacity: kaleido,
            filter: `url(#liquid) hue-rotate(${hue + 120}deg) saturate(1.3)`,
            transform: `rotate(${rot}deg) scale(${1.45 + Math.sin(f / 25) * 0.08})`,
          }}
        >
          {tile(1, 1, 0, 0)}
          {tile(-1, 1, 360, 0)}
          {tile(1, -1, 0, 640)}
          {tile(-1, -1, 360, 640)}
        </AbsoluteFill>
      </AbsoluteFill>

      <Rays opacity={0.12 + kaleido * 0.1} speed={0.9} />
      <Bubbles count={20} />
      <Glow hue={hue} />
      <Vignette />
    </AbsoluteFill>
  );
};
