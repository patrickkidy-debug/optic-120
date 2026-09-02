import { AbsoluteFill } from 'remotion';
import { Background } from '../components/Background';
import { SalesCard } from '../components/SalesCard';
import { PhoneFrame } from '../components/PhoneFrame';
import { SceneFade } from '../components/SceneFade';
import { SceneHeading } from '../components/SceneHeading';
import { SCENES } from '../timings';

/** Scene 4 (13-17s) : client -> commande -> paiement -> facture. */
export const Scene4Sales: React.FC = () => {
  const duration = SCENES.sales.duration;
  return (
    <SceneFade duration={duration}>
      <Background tint="accent" />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 40 }}>
        <div style={{ transform: 'scale(0.86)' }}>
          <PhoneFrame>
            <div style={{ padding: 26, paddingTop: 66 }}>
              <SalesCard delay={4} />
            </div>
          </PhoneFrame>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 140, paddingLeft: 60, paddingRight: 60 }}>
        <SceneHeading title="Gérez vos ventes et vos clients simplement." fontSize={50} delay={0} />
      </AbsoluteFill>
    </SceneFade>
  );
};
