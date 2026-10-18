import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';

const W = 720;
const H = 1280;
// 水素原子バルマー線(nm)と色
const LINES = [
  {nm: 410, name: 'Hδ', color: '#8a5cff'},
  {nm: 434, name: 'Hγ', color: '#4d6bff'},
  {nm: 486, name: 'Hβ', color: '#27d8ff'},
  {nm: 656, name: 'Hα', color: '#ff3a52'},
];
const nmToX = (nm: number) => 60 + ((nm - 400) / 300) * 600;

/** 2つの波源の同心円→干渉縞(モアレ) */
const Interference: React.FC = () => {
  const f = useCurrentFrame();
  const c1 = {x: W * (0.5 + 0.28 * Math.sin(f / 90)), y: H * (0.42 + 0.12 * Math.cos(f / 70))};
  const c2 = {x: W * (0.5 + 0.28 * Math.cos(f / 80 + 1)), y: H * (0.48 + 0.12 * Math.sin(f / 60))};
  const ring = (c: {x: number; y: number}, color: string, phase: number) =>
    Array.from({length: 34}).map((_, k) => (
      <circle
        key={k}
        cx={c.x}
        cy={c.y}
        r={(k * 30 + ((f * 0.9 + phase) % 30)) | 0}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        opacity={0.55 * (1 - k / 36)}
      />
    ));
  return (
    <AbsoluteFill style={{mixBlendMode: 'screen', opacity: 0.38}}>
      <svg width={W} height={H}>
        {ring(c1, '#27d8ff', 0)}
        {ring(c2, '#ff3aa0', 15)}
      </svg>
    </AbsoluteFill>
  );
};

/** 軌道を回る電子(尾を引く) */
const Orbitals: React.FC = () => {
  const f = useCurrentFrame();
  const cx = W / 2;
  const cy = H * 0.45;
  const orbits = [
    {rx: 190, ry: 70, tilt: 0, speed: 0.07, color: '#27d8ff'},
    {rx: 260, ry: 100, tilt: 60, speed: -0.05, color: '#ff3aa0'},
    {rx: 330, ry: 130, tilt: 120, speed: 0.035, color: '#8a5cff'},
  ];
  return (
    <AbsoluteFill style={{mixBlendMode: 'screen', opacity: 0.85}}>
      <svg width={W} height={H}>
        {orbits.map((o, i) => {
          const tilt = o.tilt + f * 0.15 * (i % 2 ? -1 : 1);
          return (
            <g key={i} transform={`rotate(${tilt} ${cx} ${cy})`}>
              <ellipse cx={cx} cy={cy} rx={o.rx} ry={o.ry} fill="none" stroke={o.color} strokeWidth={1.4} opacity={0.45} />
              {Array.from({length: 14}).map((_, t) => {
                const a = f * o.speed - t * 0.07 * Math.sign(o.speed);
                const x = cx + o.rx * Math.cos(a);
                const y = cy + o.ry * Math.sin(a);
                const k = 1 - t / 14;
                return (
                  <g key={t}>
                    <circle cx={x} cy={y} r={14 * k} fill={o.color} opacity={0.18 * k} />
                    <circle cx={x} cy={y} r={5 * k + 1} fill="#fff" opacity={0.95 * k} />
                  </g>
                );
              })}
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={10 + 3 * Math.sin(f / 8)} fill="#fff" opacity={0.9} />
        <circle cx={cx} cy={cy} r={46 + 8 * Math.sin(f / 11)} fill="#ff3a52" opacity={0.12} />
      </svg>
    </AbsoluteFill>
  );
};

/** 画面下部のスペクトル線(発光スペクトル) */
const Spectrum: React.FC = () => {
  const f = useCurrentFrame();
  const y = H - 118;
  return (
    <AbsoluteFill>
      <svg width={W} height={H}>
        <defs>
          <linearGradient id="spec" x1="0" x2="1">
            <stop offset="0" stopColor="#5a2bff" />
            <stop offset="0.25" stopColor="#2a6bff" />
            <stop offset="0.45" stopColor="#27d8ff" />
            <stop offset="0.7" stopColor="#ffd23a" />
            <stop offset="1" stopColor="#ff3a52" />
          </linearGradient>
        </defs>
        <rect x={60} y={y} width={600} height={26} fill="url(#spec)" opacity={0.18} />
        <rect x={60} y={y} width={600} height={26} fill="none" stroke="#fff" strokeOpacity={0.25} />
        {LINES.map((l, i) => {
          const x = nmToX(l.nm);
          const pulse = 0.55 + 0.45 * Math.sin(f / 9 - i * 1.3);
          return (
            <g key={l.nm}>
              <rect x={x - 6} y={y - 10} width={12} height={46} fill={l.color} opacity={0.28 * pulse} />
              <rect x={x - 1.5} y={y - 10} width={3} height={46} fill={l.color} opacity={0.4 + 0.6 * pulse} />
              <text x={x} y={y + 62 + (i % 2) * 22} fill="#fff" opacity={0.75} fontSize={17} textAnchor="middle" fontFamily="monospace">
                {l.name} {l.nm}
              </text>
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

export const QuantumOverlay: React.FC = () => (
  <>
    <Interference />
    <Orbitals />
    <Spectrum />
  </>
);
