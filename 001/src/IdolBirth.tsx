import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame} from 'remotion';

export const IDOL_FPS = 30;
export const IDOL_DURATION = 10 * IDOL_FPS; // 10秒

const FADE_IN = 2 * IDOL_FPS; // 2秒
const FADE_OUT = 1 * IDOL_FPS; // 1秒
const TITLE = 'アイドル誕生'.split('');
const TITLE_START = 3.2 * IDOL_FPS;
const STAGGER = 7; // 1文字ごとの遅延(frame)

const fontFace = `
@font-face {
  font-family: 'Shippori Mincho Title';
  src: url('${staticFile('ShipporiMincho-title.ttf')}') format('truetype');
  font-weight: 800;
}`;

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export const IdolBirth: React.FC = () => {
  const frame = useCurrentFrame();

  // 全体フェード: 2秒フェードイン / 1秒フェードアウト
  const fade = interpolate(
    frame,
    [0, FADE_IN, IDOL_DURATION - FADE_OUT, IDOL_DURATION],
    [0, 1, 1, 0],
    clamp
  );

  // ゆっくりしたプッシュイン
  const t = frame / IDOL_DURATION;
  const scale = 1.03 + t * 0.07;
  const panX = -t * 18;

  // タイトル全体: 文字間がゆっくり詰まる
  const spacing = interpolate(frame, [TITLE_START, IDOL_DURATION], [0.62, 0.34], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });

  // 光の掃引(全文字が出揃った後)
  const sweepStart = TITLE_START + STAGGER * TITLE.length + 22;
  const sweep = interpolate(frame, [sweepStart, sweepStart + 45], [-30, 130], {
    ...clamp,
    easing: Easing.inOut(Easing.quad),
  });

  // 文字出現直前の白いフラッシュ
  const flash = interpolate(
    frame,
    [TITLE_START - 4, TITLE_START + 2, TITLE_START + 24],
    [0, 0.22, 0],
    clamp
  );

  const lineProgress = interpolate(frame, [TITLE_START + 30, TITLE_START + 75], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });

  const bgDim = interpolate(frame, [TITLE_START - 20, TITLE_START + 30], [0, 0.28], clamp);

  return (
    <AbsoluteFill style={{backgroundColor: '#000'}}>
      <style>{fontFace}</style>
      <AbsoluteFill style={{opacity: fade}}>
        {/* 背景画像(色調補正: 明るく) */}
        <AbsoluteFill style={{overflow: 'hidden'}}>
          <Img
            src={staticFile('idol_bg.jpg')}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'brightness(1.22) contrast(1.06) saturate(1.1)',
              transform: `translateX(${panX}px) scale(${scale})`,
              transformOrigin: '50% 60%',
            }}
          />
        </AbsoluteFill>

        {/* タイトルの可読性のための暗幕とビネット */}
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse at 50% 38%, rgba(20,6,10,${bgDim}) 0%, rgba(20,6,10,${bgDim * 0.6}) 45%, rgba(0,0,0,${bgDim * 0.9}) 100%)`,
          }}
        />
        <AbsoluteFill style={{backgroundColor: '#fff', opacity: flash}} />

        {/* タイトル */}
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', paddingBottom: 600}}>
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
            <div
              style={{
                width: `${lineProgress * 760}px`,
                height: 2,
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)',
                marginBottom: 34,
              }}
            />
            <div
              style={{
                display: 'flex',
                fontFamily: "'Shippori Mincho Title', 'Noto Serif JP', serif",
                fontWeight: 800,
                fontSize: 156,
                lineHeight: 1,
                letterSpacing: `${spacing}em`,
                marginRight: `-${spacing}em`, // letter-spacing末尾分を打ち消して中央揃え
              }}
            >
              {TITLE.map((ch, i) => {
                const start = TITLE_START + i * STAGGER;
                const p = interpolate(frame, [start, start + 34], [0, 1], {
                  ...clamp,
                  easing: Easing.out(Easing.cubic),
                });
                const blur = (1 - p) * 26;
                const y = (1 - p) * 34;
                const s = 1 + (1 - p) * 0.35;
                // 光の掃引: 文字位置に応じた明るさの帯
                const pos = (i / (TITLE.length - 1)) * 100;
                const glow = Math.max(0, 1 - Math.abs(pos - sweep) / 22);
                return (
                  <span
                    key={i}
                    style={{
                      display: 'inline-block',
                      opacity: p,
                      transform: `translateY(${y}px) scale(${s})`,
                      filter: `blur(${blur}px)`,
                      color: `rgb(255, ${248 - glow * 6}, ${240 - glow * 40})`,
                      textShadow: `0 0 ${10 + glow * 40}px rgba(255,${200 + glow * 40},${150 + glow * 60},${0.35 + glow * 0.6}), 0 4px 22px rgba(30,5,10,0.85), 0 0 3px rgba(30,5,10,0.6)`,
                    }}
                  >
                    {ch}
                  </span>
                );
              })}
            </div>
            <div
              style={{
                width: `${lineProgress * 760}px`,
                height: 2,
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)',
                marginTop: 34,
              }}
            />
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
