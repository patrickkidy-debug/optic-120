import { AbsoluteFill } from 'remotion';
import { Background } from '../components/Background';
import { Dashboard } from '../components/Dashboard';
import { PhoneFrame } from '../components/PhoneFrame';
import { SceneFade } from '../components/SceneFade';
import { SceneHeading } from '../components/SceneHeading';
import { SCENES } from '../timings';

/** Scene 6 (21-25s) : vue d'ensemble, tous les KPI cles. */
export const Scene6Overview: React.FC = () => {
  const duration = SCENES.overview.duration;
  return (
    <SceneFade duration={duration}>
      <Background tint="accent" />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 40 }}>
        <div style={{ transform: 'scale(0.86)' }}>
          <PhoneFrame>
            <div style={{ padding: 26, paddingTop: 66 }}>
              <Dashboard delay={4} />
            </div>
          </PhoneFrame>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 140 }}>
        <SceneHeading title="Tout votre magasin. Un seul outil." fontSize={54} delay={0} />
      </AbsoluteFill>
    </SceneFade>
  );
};
