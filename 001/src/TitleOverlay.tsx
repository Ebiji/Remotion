import React, {useEffect, useState} from 'react';
import {AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

export const TITLE_DURATION = 450; // 15秒 @30fps

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const CREAM = '#fff6e6';
const GOLD = '#f3c77a';

const FONTS: [string, string, string, string][] = [
  ['300', 'italic', 'fonts/cormorant-garamond-latin-300-italic.woff2', 'italic'],
  ['300', 'normal', 'fonts/cormorant-garamond-latin-300-normal.woff2', 'normal'],
  ['500', 'normal', 'fonts/cormorant-garamond-latin-500-normal.woff2', 'normal'],
];

/** 透明背景の題名。縦三段組(Flowers / & / Towers)。ゆっくり現れ、動きは揺らさず、最後にやわらかく消える。 */
export const TitleOverlay: React.FC<{text?: string; dur?: number}> = ({dur = TITLE_DURATION}) => {
  const frame = useCurrentFrame();
  const {height, width} = useVideoConfig();
  const [handle] = useState(() => delayRender('font'));
  useEffect(() => {
    const faces = FONTS.map(([weight, style, file]) => new FontFace('CormorantGaramond', `url(${staticFile(file)})`, {weight, style}));
    Promise.all(faces.map((f) => f.load())).then(() => { faces.forEach((f) => document.fonts.add(f)); continueRender(handle); }).catch(() => continueRender(handle));
  }, [handle]);

  const size = height * 0.17;
  const out = 1 - ease((frame - (dur - 42)) / 36);                 // 最後の1.2秒でやわらかく消える
  const veil = ease((frame - 4) / 40) * out;

  const pF = ease((frame - 14) / 62);                              // Flowers: ぼけからピントが合い、字間がふわっと広がる
  const pA = ease((frame - 70) / 34);                              // &
  const pT = ease((frame - 96) / 62);                              // Towers: 下から立ち上がる

  const glow = (c: string, a: string) => `0 0 ${size * 0.14}px ${c}, 0 0 ${size * 0.5}px rgba(${a}, 0.45)`;
  const base: React.CSSProperties = {fontFamily: 'CormorantGaramond, "Times New Roman", serif', lineHeight: 1, textAlign: 'center', whiteSpace: 'nowrap'};

  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', opacity: out}}>
      <div style={{position: 'absolute', left: '50%', top: '50%', width: width * 0.62, height: height * 0.86, transform: 'translate(-50%,-50%)', borderRadius: '50%', background: 'radial-gradient(ellipse at center, rgba(6,3,24,0.66) 0%, rgba(6,3,24,0.4) 48%, rgba(6,3,24,0) 74%)', opacity: veil, filter: `blur(${size * 0.1}px)`}} />
      <div style={{position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: size * 0.1}}>
        <div style={{...base, fontWeight: 300, fontStyle: 'italic', fontSize: size, letterSpacing: size * (0.16 - 0.12 * pF), opacity: pF, filter: `blur(${(1 - pF) * size * 0.12}px)`, color: CREAM,
          textShadow: `0 0 ${size * 0.04}px rgba(0,0,0,0.75), ${glow('rgba(255,214,170,0.75)', '255,150,210')}`}}>Flowers</div>
        <div style={{...base, fontWeight: 300, fontSize: size * 0.42, color: GOLD, opacity: pA, transform: `scale(${0.9 + 0.1 * pA})`,
          textShadow: `0 0 ${size * 0.04}px rgba(0,0,0,0.7), 0 0 ${size * 0.18}px rgba(243,199,122,0.7)`}}>&amp;</div>
        <div style={{...base, fontWeight: 500, fontSize: size, letterSpacing: size * 0.05, color: CREAM, opacity: pT,
          clipPath: `inset(${(1 - pT) * 100}% 0 0 0)`, transform: `translateY(${(1 - pT) * size * 0.14}px)`,
          textShadow: `0 0 ${size * 0.04}px rgba(0,0,0,0.75), ${glow('rgba(255,214,170,0.75)', '255,150,210')}`}}>Towers</div>
      </div>
    </AbsoluteFill>
  );
};
