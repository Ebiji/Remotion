import {Composition} from 'remotion';
import {FractalFlowers, DURATION} from './FractalFlowers';
import {SingleImageMorph, MORPH_DURATION} from './SingleImageMorph';
import {MorphChain, CHAIN_DURATION} from './MorphChain';
import {QuantumMorph, QUANTUM_DURATION} from './QuantumMorph';
import {MouthMV, MOUTH_DURATION} from './MouthMV/MouthMV';
import {TitleOverlay, TITLE_DURATION} from './TitleOverlay';

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
  <Composition id="QuantumMorph169" component={QuantumMorph} defaultProps={{withAudio: false}} durationInFrames={QUANTUM_DURATION} fps={30} width={1280} height={720} />
  <Composition id="MouthMV" component={MouthMV} durationInFrames={MOUTH_DURATION} fps={30} width={1280} height={720} />
  <Composition id="TitleOverlay" component={TitleOverlay} defaultProps={{text: 'Flowers & Towers', dur: TITLE_DURATION}} durationInFrames={TITLE_DURATION} fps={30} width={2560} height={1440} />
  <Composition id="TitleOverlay10" component={TitleOverlay} defaultProps={{text: 'Flowers & Towers', dur: 300}} durationInFrames={300} fps={30} width={2560} height={1440} />
  </>
);
