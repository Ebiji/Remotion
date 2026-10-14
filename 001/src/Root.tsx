import {Composition} from 'remotion';
import {FractalFlowers, DURATION} from './FractalFlowers';

export const Root: React.FC = () => (
  <Composition
    id="FractalFlowers"
    component={FractalFlowers}
    durationInFrames={DURATION}
    fps={30}
    width={720}
    height={1280}
  />
);
