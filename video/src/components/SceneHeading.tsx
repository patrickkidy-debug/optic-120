import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, fontDisplay, fontBody } from '../theme';

/**
 * Titre de scene : reveal par clip-path (wipe) + montee douce, sortie en fondu
 * juste avant la fin de la scene. `delay` cale l'entree sur le beat voulu.
 */
export const SceneHeading: React.FC<{
  title: string;
  subtitle?: string;
  delay?: number;
  align?: 'center' | 'left';
  accent?: boolean;
  fontSize?: number;
}> = ({ title, subtitle, delay = 0, align = 'center', accent = false, fontSize = 76 }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const local = frame - delay;

  const reveal = spring({ frame: local, fps, config: { damping: 200, mass: 0.6 }, durationInFrames: 18 });
  const rise = interpolate(reveal, [0, 1], [28, 0]);
  const clip = interpolate(reveal, [0, 1], [100, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const outStart = durationInFrames - 14;
  const outOpacity = interpolate(frame, [outStart, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = local < 0 ? 0 : outOpacity;

  return (
    <div
      style={{
        textAlign: align,
        opacity,
        transform: `translateY(${rise}px)`,
        maxWidth: 940,
      }}
    >
      <div style={{ overflow: 'hidden' }}>
        <h1
          style={{
            fontFamily: fontDisplay,
            fontWeight: 800,
            fontSize,
            lineHeight: 1.08,
            letterSpacing: -1.5,
            color: colors.text,
            margin: 0,
            clipPath: `inset(0 ${align === 'center' ? clip / 2 : 0}% 0 ${clip}%)`,
            textShadow: accent ? `0 0 60px ${colors.primary}55` : undefined,
          }}
        >
          {title}
        </h1>
      </div>
      {subtitle && (
        <p
          style={{
            fontFamily: fontBody,
            fontWeight: 500,
            fontSize: 34,
            color: colors.textMuted,
            marginTop: 22,
            lineHeight: 1.35,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
};
