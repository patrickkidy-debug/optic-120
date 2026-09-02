import { Banknote, Boxes, FlaskConical, Glasses, ShoppingCart, Truck, Users } from 'lucide-react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { Background } from '../components/Background';
import { Notification } from '../components/Notification';
import { SceneHeading } from '../components/SceneHeading';
import { SceneFade } from '../components/SceneFade';
import { colors } from '../theme';
import { SCENES } from '../timings';

/** Scene 1 (0-5s) : hook + chaos controle autour d'un opticien stylise. */
export const Scene1Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const duration = SCENES.problem.duration;

  // Petit shake vers la fin pour accentuer la sensation de chaos avant la coupe.
  const shakeStart = duration - 22;
  const shake =
    frame > shakeStart
      ? Math.sin((frame - shakeStart) * 2.2) * interpolate(frame, [shakeStart, duration], [0, 6], { extrapolateLeft: 'clamp' })
      : 0;

  const glassesOpacity = interpolate(frame, [0, 14], [0, 0.22], { extrapolateRight: 'clamp' });

  return (
    <SceneFade duration={duration}>
      <Background tint="accent" />
      <AbsoluteFill style={{ transform: `translateX(${shake}px)` }}>
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Glasses size={340} color={colors.text} strokeWidth={1.2} style={{ opacity: glassesOpacity }} />
        </AbsoluteFill>

        <Notification icon={Boxes} label="Stock" sub="difficile à suivre" tone="danger" x={70} y={330} rotate={-4} delay={6} />
        <Notification icon={FlaskConical} label="Commandes verres" sub="en retard" tone="accent" x={560} y={280} rotate={3} delay={16} width={340} />
        <Notification icon={ShoppingCart} label="Ventes" sub="carnet papier" tone="primary" x={90} y={560} rotate={2} delay={26} />
        <Notification icon={Users} label="Clients" sub="fichiers eparpilles" tone="primary" x={520} y={640} rotate={-3} delay={36} width={360} />
        <Notification icon={Banknote} label="Caisse" sub="comptée à la main" tone="danger" x={100} y={860} rotate={-2} delay={46} width={340} />
        <Notification icon={Truck} label="Fournisseurs" sub="suivi manuel" tone="accent" x={520} y={960} rotate={4} delay={56} width={320} />
        <Notification icon={Boxes} label="Statistiques" sub="introuvables" tone="danger" x={200} y={1120} rotate={2} delay={66} width={340} />

        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 140, paddingLeft: 60, paddingRight: 60 }}>
          <SceneHeading title="Tu gères encore ton magasin comme ça ?" fontSize={58} delay={0} />
        </AbsoluteFill>
      </AbsoluteFill>
    </SceneFade>
  );
};
