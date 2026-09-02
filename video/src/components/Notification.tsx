import type { LucideIcon } from 'lucide-react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, fontBody } from '../theme';

/**
 * Carte "notification" flottante : entree par spring (scale+translate),
 * legere respiration continue. Utilisee pour le chaos (scene 1) et les
 * alertes stock (scene 3).
 */
export const Notification: React.FC<{
  icon: LucideIcon;
  label: string;
  sub?: string;
  tone?: 'primary' | 'danger' | 'success' | 'accent';
  x: number;
  y: number;
  rotate?: number;
  delay?: number;
  width?: number;
}> = ({ icon: Icon, label, sub, tone = 'primary', x, y, rotate = 0, delay = 0, width = 320 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - delay;
  const enter = spring({ frame: local, fps, config: { damping: 12, stiffness: 140, mass: 0.6 } });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const scale = interpolate(enter, [0, 1], [0.7, 1]);
  const float = Math.sin((frame + delay) / 18) * 4;

  const toneColor = { primary: colors.primary, danger: colors.danger, success: colors.success, accent: colors.accent }[
    tone
  ];
  const toneSoft = { primary: colors.primarySoft, danger: colors.dangerSoft, success: colors.successSoft, accent: colors.accentSoft }[
    tone
  ];

  if (local < -6) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y + float,
        width,
        opacity,
        transform: `scale(${scale}) rotate(${rotate}deg)`,
        transformOrigin: 'center',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '16px 20px',
        borderRadius: 22,
        background: 'rgba(17, 26, 46, 0.88)',
        border: `1px solid ${colors.border}`,
        boxShadow: '0 20px 50px -12px rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: 14,
          background: toneSoft,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={24} color={toneColor} strokeWidth={2.2} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: fontBody, fontWeight: 700, fontSize: 21, color: colors.text, whiteSpace: 'nowrap' }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontFamily: fontBody, fontWeight: 500, fontSize: 16, color: colors.textMuted }}>{sub}</div>
        )}
      </div>
    </div>
  );
};
