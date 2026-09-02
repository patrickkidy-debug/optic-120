import { AbsoluteFill } from 'remotion';
import { Background } from '../components/Background';
import { InventoryCard } from '../components/InventoryCard';
import { PhoneFrame } from '../components/PhoneFrame';
import { SceneFade } from '../components/SceneFade';
import { SceneHeading } from '../components/SceneHeading';
import { SCENES } from '../timings';

/** Scene 3 (9-13s) : maitrise du stock, mouvements de quantite en direct. */
export const Scene3Stock: React.FC = () => {
  const duration = SCENES.stock.duration;
  return (
    <SceneFade duration={duration}>
      <Background />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 40 }}>
        <div style={{ transform: 'scale(0.86)' }}>
          <PhoneFrame>
            <div style={{ padding: 26, paddingTop: 66 }}>
              <InventoryCard delay={4} />
            </div>
          </PhoneFrame>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 140 }}>
        <SceneHeading title="Maîtrisez votre stock." fontSize={62} delay={0} />
      </AbsoluteFill>
    </SceneFade>
  );
};
