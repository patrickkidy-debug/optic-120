import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Background } from '../components/Background';
import { CtaButton } from '../components/CtaButton';
import { SceneFade } from '../components/SceneFade';
import { colors, fontDisplay, fontBody } from '../theme';
import { SCENES } from '../timings';

/** Scene 7 (25-30s) : logo, promesse, CTA final. */
export const Scene7Cta: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = SCENES.cta.duration;

  const logoSpring = spring({ frame, fps, config: { damping: 13, stiffness: 130 } });
  const logoScale = interpolate(logoSpring, [0, 1], [0.6, 1]);
  const logoOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  const subOpacity = interpolate(frame, [14, 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ctaOpacity = interpolate(frame, [40, 52], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <SceneFade duration={duration} fade={8}>
      <Background />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26, padding: 60 }}>
          <div style={{ opacity: logoOpacity, transform: `scale(${logoScale})`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <Img src={staticFile('logo.png')} style={{ width: 130, height: 130, borderRadius: 30 }} />
            <span style={{ fontFamily: fontDisplay, fontWeight: 800, fontSize: 58, color: colors.text, letterSpacing: -1 }}>
              OculoSaaS
            </span>
          </div>
          <span
            style={{
              opacity: subOpacity,
              fontFamily: fontBody,
              fontWeight: 600,
              fontSize: 32,
              color: colors.textMuted,
              textAlign: 'center',
              maxWidth: 760,
            }}
          >
            Simplifiez la gestion de votre magasin d'optique.
          </span>
          <div style={{ opacity: ctaOpacity, marginTop: 20 }}>
            <CtaButton label="Demandez votre démonstration" delay={40} />
          </div>
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
};
