import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate} from 'remotion';

// deterministic pseudo random
const rnd = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const RAINBOW =
  'red, orange, yellow, lime, cyan, blue, magenta, red';

/** 画面中心から放射する虹色の光線 */
export const Rays: React.FC<{opacity?: number; cx?: string; cy?: string; speed?: number}> = ({
  opacity = 0.5,
  cx = '50%',
  cy = '50%',
  speed = 0.35,
}) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        mixBlendMode: 'screen',
        opacity: opacity * (0.75 + 0.25 * Math.sin(f / 9)),
        background: `repeating-conic-gradient(from ${f * speed}deg at ${cx} ${cy},
          rgba(255,0,80,0.9) 0deg, rgba(255,200,0,0.9) 3deg, rgba(0,255,150,0.9) 6deg,
          rgba(0,150,255,0.9) 9deg, rgba(180,0,255,0.9) 12deg, transparent 13deg, transparent 18deg)`,
        WebkitMaskImage: `radial-gradient(circle at ${cx} ${cy}, transparent 0%, black 18%, black 80%, transparent 100%)`,
        maskImage: `radial-gradient(circle at ${cx} ${cy}, transparent 0%, black 18%, black 80%, transparent 100%)`,
      }}
    />
  );
};

/** 雨 */
export const Rain: React.FC<{count?: number; opacity?: number}> = ({count = 70, opacity = 0.55}) => {
  const f = useCurrentFrame();
  const {width, height} = useVideoConfig();
  return (
    <AbsoluteFill style={{opacity, mixBlendMode: 'screen'}}>
      {Array.from({length: count}).map((_, i) => {
        const x = rnd(i + 1) * width;
        const len = 60 + rnd(i + 50) * 140;
        const sp = 28 + rnd(i + 99) * 30;
        const y = ((f * sp + rnd(i + 7) * height * 2) % (height + len * 2)) - len;
        const hue = Math.floor(rnd(i + 3) * 360);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: 2,
              height: len,
              transform: 'rotate(4deg)',
              background: `linear-gradient(to bottom, transparent, hsla(${hue},100%,75%,0.9))`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** ふわふわ昇る水玉・シャボン玉 */
export const Bubbles: React.FC<{count?: number; opacity?: number}> = ({count = 26, opacity = 1}) => {
  const f = useCurrentFrame();
  const {width, height} = useVideoConfig();
  return (
    <AbsoluteFill style={{opacity, mixBlendMode: 'screen'}}>
      {Array.from({length: count}).map((_, i) => {
        const size = 14 + rnd(i + 11) * 80;
        const sp = 0.8 + rnd(i + 21) * 2.2;
        const y = height + size - ((f * sp + rnd(i + 5) * (height + 200)) % (height + size * 2));
        const x = rnd(i + 2) * width + Math.sin(f / 22 + i) * 26;
        const hue = Math.floor(rnd(i + 31) * 360);
        const dots = i % 3 === 0;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: '50%',
              background: dots
                ? `hsl(${hue},100%,60%)`
                : `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95), hsla(${hue},100%,70%,0.25) 45%, hsla(${hue},100%,60%,0.55) 100%)`,
              boxShadow: `0 0 ${size / 2}px hsla(${hue},100%,65%,0.7)`,
              opacity: dots ? 0.7 : 0.9,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** 画面の周囲を暗くして中心の光を強調 */
export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{background: 'radial-gradient(circle at 50% 50%, transparent 45%, rgba(0,0,10,0.65) 100%)'}}
  />
);

/** 呼吸するようなグロー */
export const Glow: React.FC<{hue?: number}> = ({hue = 300}) => {
  const f = useCurrentFrame();
  const o = interpolate(Math.sin(f / 14), [-1, 1], [0.05, 0.28]);
  return (
    <AbsoluteFill
      style={{
        mixBlendMode: 'screen',
        opacity: o,
        background: `radial-gradient(circle at 50% 50%, hsl(${hue},100%,60%), transparent 65%)`,
      }}
    />
  );
};

export {RAINBOW};
