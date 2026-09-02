import { Banknote, Boxes, ClipboardList, ShoppingBag, Users } from 'lucide-react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, fontBody, fontDisplay, formatFcfa } from '../theme';
import { KpiCard } from './KpiCard';

/** Tableau de bord global : grille de KPI qui s'anime en cascade + mini graphe. */
export const Dashboard: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - delay;
  const barsIn = spring({ frame: local - 60, fps, config: { damping: 200 } });
  const bars = [40, 65, 50, 82, 70, 95];

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <KpiCard icon={Banknote} label="Chiffre d'affaires" value={2450000} formatter={formatFcfa} trend="+18%" delay={delay} />
        <KpiCard icon={ShoppingBag} label="Ventes du mois" value={312} trend="+9%" delay={delay + 6} />
        <KpiCard icon={Boxes} label="Produits en stock" value={1840} delay={delay + 12} />
        <KpiCard icon={Users} label="Clients actifs" value={926} trend="+12%" delay={delay + 18} />
      </div>
      <div
        style={{
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 26,
          padding: '22px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ClipboardList size={18} color={colors.textMuted} />
          <span style={{ fontFamily: fontDisplay, fontWeight: 700, fontSize: 17, color: colors.text }}>
            Commandes en cours
          </span>
          <span style={{ marginLeft: 'auto', fontFamily: fontBody, fontWeight: 800, fontSize: 20, color: colors.accent }}>
            27
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 90 }}>
          {bars.map((b, i) => {
            const h = interpolate(barsIn, [0, 1], [4, b]);
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: h,
                  borderRadius: 6,
                  background: i === bars.length - 1 ? colors.primary : colors.surface3,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
