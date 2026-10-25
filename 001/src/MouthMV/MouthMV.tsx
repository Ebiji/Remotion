import React, {useLayoutEffect, useRef} from 'react';
import {AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {MVScene} from './scene';
import {FRAMES, SONG} from './audio';

export const MOUTH_DURATION = FRAMES;

export const MouthMV: React.FC<{withAudio?: boolean; hide?: string; audioFile?: string}> = ({withAudio = true, hide = '', audioFile = `${SONG}_mastered.mp3`}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<MVScene | null>(null);

  useLayoutEffect(() => {
    if (!sceneRef.current && canvasRef.current) sceneRef.current = new MVScene(canvasRef.current, width, height, hide);
    sceneRef.current?.frame(frame);
  }, [frame, width, height]);
  useLayoutEffect(() => () => { sceneRef.current?.dispose(); sceneRef.current = null; }, []);

  const fadeIn = interpolate(frame, [0, 24], [1, 0], {extrapolateRight: 'clamp'});
  const fadeOut = interpolate(frame, [FRAMES - 45, FRAMES - 1], [0, 1], {extrapolateLeft: 'clamp'});
  void fps;
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <canvas ref={canvasRef} width={width} height={height} style={{width, height, display: 'block'}} />
      <AbsoluteFill style={{background: '#000', opacity: Math.max(fadeIn, fadeOut)}} />
      {withAudio ? <Audio src={staticFile(audioFile)} /> : null}
    </AbsoluteFill>
  );
};
