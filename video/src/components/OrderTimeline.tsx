import { Check, ClipboardList, FlaskConical, PackageCheck, Truck, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, fontBody, fontDisplay } from '../theme';

const STEPS: { icon: LucideIcon; label: string }[] = [
  { icon: ClipboardList, label: 'Reçue' },
  { icon: Wrench, label: 'Préparation' },
  { icon: FlaskConical, label: 'Laboratoire' },
  { icon: PackageCheck, label: 'Reçue' },
  { icon: Truck, label: 'Livrée' },
];

/** Suivi de commande verres : 5 etapes qui s'allument horizontalement l'une apres l'autre. */
export const OrderTimeline: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - delay;

  const cardIn = spring({ frame: local, fps, config: { damping: 18, stiffness: 130 } });
  const opacity = interpolate(cardIn, [0, 1], [0, 1]);

  const fill = spring({ frame: local, fps, durationInFrames: 90, config: { damping: 200 } });
  const fillPct = interpolate(fill, [0, 1], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const activeIndex = Math.min(4, Math.floor((fillPct / 100) * 5));

  return (
    <div
      style={{
        opacity,
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 28,
        padding: '30px 20px',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 26 }}>
        <span style={{ fontFamily: fontDisplay, fontWeight: 800, fontSize: 22, color: colors.text }}>
          Commande #OC-1042
        </span>
      </div>
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between' }}>
        <div
          style={{
            position: 'absolute',
            top: 21,
            left: 21,
            right: 21,
            height: 3,
            borderRadius: 2,
            background: colors.surface3,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 21,
            left: 21,
            width: `calc(${fillPct}% - ${(fillPct / 100) * 42}px)`,
            height: 3,
            borderRadius: 2,
            background: colors.accent,
            boxShadow: `0 0 14px ${colors.accent}`,
          }}
        />
        {STEPS.map((s, i) => {
          const done = i <= activeIndex && fillPct > i * 20 + 4;
          const Icon = s.icon;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, zIndex: 1, width: 60 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  background: done ? colors.accent : colors.surface3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: done ? `0 0 18px ${colors.accent}77` : undefined,
                }}
              >
                {done ? <Check size={19} color={colors.white} strokeWidth={3} /> : <Icon size={18} color={colors.textMuted} strokeWidth={2.2} />}
              </div>
              <span
                style={{
                  fontFamily: fontBody,
                  fontWeight: 700,
                  fontSize: 12.5,
                  textAlign: 'center',
                  color: done ? colors.text : colors.textFaint,
                  lineHeight: 1.15,
                }}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
