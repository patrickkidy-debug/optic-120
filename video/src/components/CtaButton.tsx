import { ArrowRight } from 'lucide-react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, fontBody, gradients } from '../theme';

/** Bouton CTA final : entree en spring + halo pulsant en boucle. */
export const CtaButton: React.FC<{ label: string; delay?: number }> = ({ label, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - delay;

  const enter = spring({ frame: local, fps, config: { damping: 14, stiffness: 130, mass: 0.7 } });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const scale = interpolate(enter, [0, 1], [0.8, 1]);
  const pulse = 1 + Math.sin(Math.max(0, local - 14) / 9) * 0.035;

  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale * (local > 14 ? pulse : 1)})`,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 14,
        padding: '26px 48px',
        borderRadius: 999,
        background: gradients.brand,
        boxShadow: `0 0 0 1px rgba(255,255,255,0.08), 0 20px 60px -10px ${colors.primary}99`,
      }}
    >
      <span style={{ fontFamily: fontBody, fontWeight: 800, fontSize: 30, color: colors.white, whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <ArrowRight size={28} color={colors.white} strokeWidth={2.8} />
    </div>
  );
};
