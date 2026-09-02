import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, gradients } from '../theme';

/**
 * Fond commun a toutes les scenes : degrade sombre + halos qui derivent
 * lentement + grille fine. Continuite visuelle entre les sequences.
 */
export const Background: React.FC<{ tint?: 'primary' | 'accent' }> = ({ tint = 'primary' }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / durationInFrames;
  const orbColor = tint === 'primary' ? colors.primary : colors.accent;

  return (
    <AbsoluteFill style={{ background: gradients.bg }}>
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.05) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(120% 90% at 50% 30%, black 40%, transparent 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 900,
          height: 900,
          borderRadius: '50%',
          background: orbColor,
          opacity: 0.16,
          filter: 'blur(160px)',
          left: -250 + Math.sin(t * Math.PI * 2) * 60,
          top: -300 + Math.cos(t * Math.PI * 2) * 40,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 700,
          height: 700,
          borderRadius: '50%',
          background: colors.cyan,
          opacity: 0.1,
          filter: 'blur(170px)',
          right: -220 + Math.cos(t * Math.PI * 2) * 50,
          bottom: -260 + Math.sin(t * Math.PI * 2) * 40,
        }}
      />
    </AbsoluteFill>
  );
};
