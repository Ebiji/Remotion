import React, {useEffect, useState} from 'react';
import {AbsoluteFill, continueRender, delayRender, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

export const TITLE_DURATION = 450; // 15秒 @30fps

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ease = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

/** 透明背景のタイトル文字。1文字ずつ ぼかしながら浮かび上がり、虹色がゆっくり移ろい、最後に消える。 */
export const TitleOverlay: React.FC<{text?: string}> = ({text = 'Fluctuating Flowers'}) => {
  const frame = useCurrentFrame();
  const {height, width} = useVideoConfig();
  const [handle] = useState(() => delayRender('font'));
  useEffect(() => {
    const f = new FontFace('CormorantGaramond', `url(${staticFile('fonts/cormorant-garamond-latin-500-normal.woff2')})`, {weight: '500'});
    const fi = new FontFace('CormorantGaramond', `url(${staticFile('fonts/cormorant-garamond-latin-500-italic.woff2')})`, {weight: '500', style: 'italic'});
    Promise.all([f.load(), fi.load()]).then(() => { document.fonts.add(f); document.fonts.add(fi); continueRender(handle); }).catch(() => continueRender(handle));
  }, [handle]);

  const size = height * 0.125;
  const chars = Array.from(text);
  const split = text.indexOf(' ');
  const out = interpolate(frame, [TITLE_DURATION - 40, TITLE_DURATION - 6], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const line = ease((frame - 10) / 50) * (1 - clamp01((frame - (TITLE_DURATION - 40)) / 34));

  return (
    <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: height * 0.17, opacity: out}}>
      <div style={{position: 'absolute', left: '50%', bottom: height * 0.17 - size * 0.55, width: width * 0.78, height: size * 2.6, transform: 'translateX(-50%)', borderRadius: '50%', background: 'radial-gradient(ellipse at center, rgba(4,0,18,0.62) 0%, rgba(4,0,18,0.38) 45%, rgba(4,0,18,0) 72%)', opacity: ease((frame - 20) / 40), filter: `blur(${size * 0.12}px)`}} />
      <div style={{display: 'flex', alignItems: 'baseline', whiteSpace: 'pre', fontFamily: 'CormorantGaramond, "Times New Roman", serif', fontWeight: 500, fontSize: size, letterSpacing: size * 0.16, lineHeight: 1.1}}>
        {chars.map((c, i) => {
          const p = ease((frame - (40 + i * 3.2)) / 26);
          const hue = (i * 17 + frame * 1.6) % 360;
          const col = `hsl(${hue}, 92%, 88%)`;
          const bob = Math.sin(frame * 0.07 + i * 0.55) * size * 0.022;      // 揺らぎ(Fluctuating)
          const italic = split >= 0 && i > split;                              // 後半の単語はイタリック
          return (
            <span key={i} style={{
              display: 'inline-block', opacity: p, color: col, fontStyle: italic ? 'italic' : 'normal',
              transform: `translateY(${(1 - p) * size * 0.28 + bob}px)`, filter: `blur(${(1 - p) * size * 0.14}px)`,
              textShadow: `0 0 ${size * 0.05}px rgba(0,0,0,0.85), 0 ${size * 0.02}px ${size * 0.09}px rgba(0,0,0,0.7), 0 0 ${size * 0.2}px ${col}, 0 0 ${size * 0.55}px hsla(${hue}, 90%, 62%, 0.5)`,
            }}>{c}</span>
          );
        })}
      </div>
      <div style={{marginTop: size * 0.32, height: Math.max(2, height * 0.0016), width: width * 0.34 * line, background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.9), rgba(255,255,255,0))', boxShadow: '0 0 18px rgba(255,255,255,0.6)'}} />
    </AbsoluteFill>
  );
};
