import { AbsoluteFill } from 'remotion';
import { Background } from '../components/Background';
import { OrderTimeline } from '../components/OrderTimeline';
import { PhoneFrame } from '../components/PhoneFrame';
import { SceneFade } from '../components/SceneFade';
import { SceneHeading } from '../components/SceneHeading';
import { SCENES } from '../timings';

/** Scene 5 (17-21s) : suivi de commande verres, etapes qui s'allument. */
export const Scene5Orders: React.FC = () => {
  const duration = SCENES.orders.duration;
  return (
    <SceneFade duration={duration}>
      <Background />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 40 }}>
        <div style={{ transform: 'scale(0.86)' }}>
          <PhoneFrame>
            <div style={{ padding: 26, paddingTop: 66 }}>
              <OrderTimeline delay={4} />
            </div>
          </PhoneFrame>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 140 }}>
        <SceneHeading title="Suivez chaque commande." fontSize={60} delay={0} />
      </AbsoluteFill>
    </SceneFade>
  );
};
