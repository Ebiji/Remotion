import React, {useLayoutEffect, useRef} from 'react';
import {AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {MVScene} from './scene';
import {FRAMES} from './audio';

export const MOUTH_DURATION = FRAMES;

export const MouthMV: React.FC<{withAudio?: boolean; hide?: string}> = ({withAudio = true, hide = ''}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<MVScene | null>(null);

  useLayoutEffect(() => {
    if (!sceneRef.current && canvasRef.current) sceneRef.current = new MVScene(canvasRef.current, width, height, hide);
    sceneRef.current?.frame(frame);
  }, [frame, width, height]);
  useLayoutEffect(() => () => { sceneRef.current?.dispose(); sceneRef.current = null; }, []);

  const t = frame / fps;
  const titleOp = interpolate(t, [1.0, 2.5, 6.5, 8.5], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const endOp = interpolate(t, [FRAMES / fps - 7, FRAMES / fps - 5], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const fadeIn = interpolate(frame, [0, 24], [1, 0], {extrapolateRight: 'clamp'});
  const fadeOut = interpolate(frame, [FRAMES - 45, FRAMES - 1], [0, 1], {extrapolateLeft: 'clamp'});
  const op = Math.max(titleOp, endOp);
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <canvas ref={canvasRef} width={width} height={height} style={{width, height, display: 'block'}} />
      <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: height * 0.14, opacity: op, mixBlendMode: 'screen'}}>
        <div style={{fontFamily: '"Helvetica Neue", Arial, sans-serif', fontWeight: 200, fontSize: height * 0.085, letterSpacing: height * 0.04, color: '#fff', textShadow: '0 0 24px rgba(255,120,255,0.9), 0 0 60px rgba(80,200,255,0.7)', paddingLeft: height * 0.04}}>
          MOUTH
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{background: '#000', opacity: Math.max(fadeIn, fadeOut)}} />
      {withAudio ? <Audio src={staticFile('mouth1.mp3')} /> : null}
    </AbsoluteFill>
  );
};
