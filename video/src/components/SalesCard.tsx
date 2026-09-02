import { Check, CreditCard, Receipt, ShoppingCart, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, fontBody, fontDisplay } from '../theme';
import { formatFcfa } from '../theme';
import { AnimatedCounter } from './AnimatedCounter';

const STEPS: { icon: LucideIcon; label: string }[] = [
  { icon: User, label: 'Client' },
  { icon: ShoppingCart, label: 'Commande' },
  { icon: CreditCard, label: 'Paiement' },
  { icon: Receipt, label: 'Facture' },
];

/** Flux vente : client -> commande -> paiement -> facture, ligne qui se remplit pas a pas. */
export const SalesCard: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - delay;

  const fill = spring({ frame: local, fps, durationInFrames: 70, config: { damping: 200 } });
  const fillPct = interpolate(fill, [0, 1], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const activeIndex = Math.min(3, Math.floor((fillPct / 100) * 4));

  const cardIn = spring({ frame: local, fps, config: { damping: 18, stiffness: 130 } });
  const opacity = interpolate(cardIn, [0, 1], [0, 1]);
  const y = interpolate(cardIn, [0, 1], [26, 0]);

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${y}px)`,
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 28,
        padding: '32px 24px',
        width: '100%',
      }}
    >
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
        <div
          style={{
            position: 'absolute',
            top: 27,
            left: 34,
            right: 34,
            height: 4,
            borderRadius: 2,
            background: colors.surface3,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 27,
            left: 34,
            width: `calc(${fillPct}% - ${(fillPct / 100) * 68}px)`,
            height: 4,
            borderRadius: 2,
            background: colors.primary,
            boxShadow: `0 0 16px ${colors.primary}`,
          }}
        />
        {STEPS.map((s, i) => {
          const done = i <= activeIndex && fillPct > i * 25 + 5;
          const Icon = s.icon;
          return (
            <div key={s.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, zIndex: 1 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: done ? colors.primary : colors.surface3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s',
                  boxShadow: done ? `0 0 24px ${colors.primary}88` : undefined,
                }}
              >
                {done ? (
                  <Check size={26} color={colors.white} strokeWidth={3} />
                ) : (
                  <Icon size={24} color={colors.textMuted} strokeWidth={2.2} />
                )}
              </div>
              <span
                style={{
                  fontFamily: fontBody,
                  fontWeight: 700,
                  fontSize: 15,
                  color: done ? colors.text : colors.textFaint,
                }}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
      <div
        style={{
          borderTop: `1px solid ${colors.border}`,
          marginTop: 6,
          paddingTop: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontFamily: fontBody, fontWeight: 600, fontSize: 18, color: colors.textMuted }}>
          Facture N° 00214
        </span>
        <span style={{ fontFamily: fontDisplay, fontWeight: 800, fontSize: 28, color: colors.text }}>
          <AnimatedCounter to={45000} delay={delay + 40} durationInFrames={30} formatter={formatFcfa} />
        </span>
      </div>
    </div>
  );
};
