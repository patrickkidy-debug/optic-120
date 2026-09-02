import type { LucideIcon } from 'lucide-react';
import { TrendingUp } from 'lucide-react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, fontBody, fontDisplay } from '../theme';
import { AnimatedCounter } from './AnimatedCounter';

export const KpiCard: React.FC<{
  icon: LucideIcon;
  label: string;
  value: number;
  formatter?: (n: number) => string;
  trend?: string;
  delay?: number;
}> = ({ icon: Icon, label, value, formatter, trend, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - delay;
  const enter = spring({ frame: local, fps, config: { damping: 16, stiffness: 130, mass: 0.7 } });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const y = interpolate(enter, [0, 1], [26, 0]);

  if (local < -6) return <div style={{ width: '100%', height: 168 }} />;

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${y}px)`,
        background: 'linear-gradient(160deg, rgba(22,32,58,0.9) 0%, rgba(17,26,46,0.9) 100%)',
        border: `1px solid ${colors.border}`,
        borderRadius: 26,
        padding: '26px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 13,
            background: colors.primarySoft,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={22} color={colors.primary} strokeWidth={2.2} />
        </div>
        {trend && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              color: colors.success,
              fontFamily: fontBody,
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            <TrendingUp size={16} strokeWidth={2.5} />
            {trend}
          </div>
        )}
      </div>
      <div style={{ fontFamily: fontDisplay, fontWeight: 800, fontSize: 44, color: colors.text, letterSpacing: -1 }}>
        <AnimatedCounter to={value} delay={delay + 4} formatter={formatter} />
      </div>
      <div style={{ fontFamily: fontBody, fontWeight: 600, fontSize: 18, color: colors.textMuted }}>{label}</div>
    </div>
  );
};
