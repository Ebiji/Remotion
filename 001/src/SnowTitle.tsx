import React, {useEffect, useState} from 'react';
import {AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

/** 'Tokyo Snows' の題名(透明背景・10秒)。しっぽり明朝。字間を広く取った2段組で、間に細い氷色の線。
 * 雪が舞い降りるように上からふわりと現れ、ピントが合い、最後にやわらかく消える。揺らさない。 */
export const SNOW_TITLE_DURATION = 300;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const SNOW = '#EEF6FF';
const ICE = '#A8D8F0';
const FONTS: [string, string][] = [
  ['400', 'fonts/shippori-mincho-latin-400-normal.woff2'],
  ['500', 'fonts/shippori-mincho-latin-500-normal.woff2'],
];

export const SnowTitle: React.FC<{dur?: number}> = ({dur = SNOW_TITLE_DURATION}) => {
  const frame = useCurrentFrame();
  const {height, width} = useVideoConfig();
  const [handle] = useState(() => delayRender('font'));
  useEffect(() => {
    const faces = FONTS.map(([weight, file]) => new FontFace('ShipporiMincho', `url(${staticFile(file)})`, {weight}));
    Promise.all(faces.map((f) => f.load())).then(() => { faces.forEach((f) => document.fonts.add(f)); continueRender(handle); }).catch(() => continueRender(handle));
  }, [handle]);

  const size = height * 0.15;
  const out = 1 - ease((frame - (dur - 45)) / 40);                    // 最後の1.5秒でやわらかく消える
  const veil = ease((frame - 2) / 40) * out;
  const pT = ease((frame - 10) / 60);                                // Tokyo: 上から降りてきてピントが合う
  const pL = ease((frame - 50) / 50);                                // 線: 中央から左右へ伸びる
  const pS = ease((frame - 70) / 60);                                // Snows

  const glow = `0 0 ${size * 0.03}px rgba(0,8,24,0.8), 0 0 ${size * 0.16}px rgba(168,216,240,0.65), 0 0 ${size * 0.5}px rgba(127,184,230,0.35)`;
  const base: React.CSSProperties = {fontFamily: 'ShipporiMincho, "Times New Roman", serif', lineHeight: 1, whiteSpace: 'nowrap', color: SNOW, textShadow: glow};

  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', opacity: out}}>
      <div style={{position: 'absolute', left: '50%', top: '50%', width: width * 0.7, height: height * 0.7, transform: 'translate(-50%,-50%)', borderRadius: '50%',
        background: 'radial-gradient(ellipse at center, rgba(6,26,51,0.62) 0%, rgba(6,26,51,0.35) 50%, rgba(6,26,51,0) 74%)', opacity: veil, filter: `blur(${size * 0.1}px)`}} />
      <div style={{position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: size * 0.16}}>
        <div style={{...base, fontWeight: 500, fontSize: size, letterSpacing: size * (0.42 - 0.12 * pT), paddingLeft: size * (0.42 - 0.12 * pT),
          opacity: pT, filter: `blur(${(1 - pT) * size * 0.1}px)`, transform: `translateY(${-(1 - pT) * size * 0.25}px)`}}>TOKYO</div>
        <div style={{width: width * 0.36 * pL, height: Math.max(2, size * 0.018), background: `linear-gradient(90deg, rgba(168,216,240,0), ${ICE} 30%, #fff 50%, ${ICE} 70%, rgba(168,216,240,0))`,
          boxShadow: `0 0 ${size * 0.12}px rgba(168,216,240,0.8)`, opacity: pL}} />
        <div style={{...base, fontWeight: 400, fontSize: size * 0.82, letterSpacing: size * (0.5 - 0.14 * pS), paddingLeft: size * (0.5 - 0.14 * pS),
          opacity: pS, filter: `blur(${(1 - pS) * size * 0.1}px)`, transform: `translateY(${-(1 - pS) * size * 0.25}px)`}}>Snows</div>
      </div>
    </AbsoluteFill>
  );
};
