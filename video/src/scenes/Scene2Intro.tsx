import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Background } from '../components/Background';
import { Dashboard } from '../components/Dashboard';
import { PhoneFrame } from '../components/PhoneFrame';
import { SceneFade } from '../components/SceneFade';
import { colors, fontDisplay, fontBody } from '../theme';
import { SCENES } from '../timings';

/** Scene 2 (5-9s) : le chaos se dissipe, logo + promesse, apparition du dashboard. */
export const Scene2Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = SCENES.intro.duration;

  const logoSpring = spring({ frame, fps, config: { damping: 12, stiffness: 140 } });
  const logoScale = interpolate(logoSpring, [0, 1], [0.5, 1]);
  const logoOpacity = interpolate(frame, [0, 10, 40, 52], [0, 1, 1, 0], { extrapolateRight: 'clamp' });

  const phoneStart = 58;
  const phoneSpring = spring({ frame: frame - phoneStart, fps, config: { damping: 16, stiffness: 120 } });
  const phoneScale = interpolate(phoneSpring, [0, 1], [0.86, 1]);
  const phoneOpacity = interpolate(frame, [phoneStart, phoneStart + 12], [0, 1], { extrapolateLeft: 'clamp' });

  return (
    <SceneFade duration={duration}>
      <Background />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: logoOpacity }}>
        <div style={{ transform: `scale(${logoScale})`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
          <Img src={staticFile('logo.png')} style={{ width: 150, height: 150, borderRadius: 34 }} />
          <span style={{ fontFamily: fontDisplay, fontWeight: 800, fontSize: 64, color: colors.text, letterSpacing: -1 }}>
            OculoSaaS
          </span>
          <span style={{ fontFamily: fontBody, fontWeight: 500, fontSize: 30, color: colors.textMuted, maxWidth: 720, textAlign: 'center' }}>
            Une seule plateforme pour gérer votre magasin d'optique.
          </span>
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: phoneOpacity }}>
        <div style={{ transform: `scale(${phoneScale * 0.82})` }}>
          <PhoneFrame>
            <div style={{ padding: 26, paddingTop: 64 }}>
              <Dashboard delay={frame - phoneStart - 10} />
            </div>
          </PhoneFrame>
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
};
