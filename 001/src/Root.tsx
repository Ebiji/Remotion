import {Composition} from 'remotion';
import {FractalFlowers, DURATION} from './FractalFlowers';
import {SingleImageMorph, MORPH_DURATION} from './SingleImageMorph';
import {MorphChain, CHAIN_DURATION} from './MorphChain';
import {QuantumMorph, QUANTUM_DURATION} from './QuantumMorph';

export const Root: React.FC = () => (
  <>
  <Composition
    id="FractalFlowers"
    component={FractalFlowers}
    durationInFrames={DURATION}
    fps={30}
    width={720}
    height={1280}
  />
  <Composition id="SingleImageMorph" component={SingleImageMorph} durationInFrames={MORPH_DURATION} fps={30} width={720} height={1280} />
  <Composition id="MorphChain" component={MorphChain} durationInFrames={CHAIN_DURATION} fps={30} width={720} height={1280} />
  <Composition id="QuantumMorph" component={QuantumMorph} durationInFrames={QUANTUM_DURATION} fps={30} width={720} height={1280} />
  </>
);
