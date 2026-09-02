import { AbsoluteFill, Sequence } from 'remotion';
import './fonts';
import { Scene1Problem } from './scenes/Scene1Problem';
import { Scene2Intro } from './scenes/Scene2Intro';
import { Scene3Stock } from './scenes/Scene3Stock';
import { Scene4Sales } from './scenes/Scene4Sales';
import { Scene5Orders } from './scenes/Scene5Orders';
import { Scene6Overview } from './scenes/Scene6Overview';
import { Scene7Cta } from './scenes/Scene7Cta';
import { SCENES } from './timings';
import { colors, fontBody } from './theme';

/**
 * Publicite OculoSaaS 9:16 (1080x1920, 30fps, 30s). Chaque scene vit dans sa
 * propre Sequence (frame locale a 0), assemblee ici selon le decoupage de
 * `timings.ts` (cale sur la voix-off du brief).
 */
export const Video: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: colors.bg, fontFamily: fontBody }}>
      <Sequence from={SCENES.problem.from} durationInFrames={SCENES.problem.duration}>
        <Scene1Problem />
      </Sequence>
      <Sequence from={SCENES.intro.from} durationInFrames={SCENES.intro.duration}>
        <Scene2Intro />
      </Sequence>
      <Sequence from={SCENES.stock.from} durationInFrames={SCENES.stock.duration}>
        <Scene3Stock />
      </Sequence>
      <Sequence from={SCENES.sales.from} durationInFrames={SCENES.sales.duration}>
        <Scene4Sales />
      </Sequence>
      <Sequence from={SCENES.orders.from} durationInFrames={SCENES.orders.duration}>
        <Scene5Orders />
      </Sequence>
      <Sequence from={SCENES.overview.from} durationInFrames={SCENES.overview.duration}>
        <Scene6Overview />
      </Sequence>
      <Sequence from={SCENES.cta.from} durationInFrames={SCENES.cta.duration}>
        <Scene7Cta />
      </Sequence>
    </AbsoluteFill>
  );
};
