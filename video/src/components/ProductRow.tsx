import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, fontBody } from '../theme';

/**
 * Ligne produit d'inventaire : barre de stock qui se remplit/varie, alerte
 * visuelle quand la quantite passe sous le seuil.
 */
export const ProductRow: React.FC<{
  name: string;
  sku: string;
  maxStock: number;
  fromStock: number;
  toStock: number;
  lowThreshold: number;
  delay?: number;
}> = ({ name, sku, maxStock, fromStock, toStock, lowThreshold, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = frame - delay;

  const enter = spring({ frame: local, fps, config: { damping: 18, stiffness: 130 } });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const x = interpolate(enter, [0, 1], [-24, 0]);

  const changeStart = 26;
  const changeProgress = spring({ frame: local - changeStart, fps, config: { damping: 200 } });
  const stock = interpolate(changeProgress, [0, 1], [fromStock, toStock], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const pct = Math.max(0, Math.min(100, (stock / maxStock) * 100));
  const isLow = stock <= lowThreshold;
  const barColor = isLow ? colors.danger : colors.primary;
  const pulse = isLow ? 0.75 + Math.sin(frame / 5) * 0.25 : 1;

  if (local < -6) return null;

  return (
    <div style={{ opacity, transform: `translateX(${x}px)`, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontFamily: fontBody, fontWeight: 700, fontSize: 20, color: colors.text }}>{name}</span>
          <span style={{ fontFamily: fontBody, fontWeight: 500, fontSize: 14, color: colors.textFaint }}>{sku}</span>
        </div>
        <span
          style={{
            fontFamily: fontBody,
            fontWeight: 800,
            fontSize: 22,
            color: isLow ? colors.danger : colors.text,
            opacity: isLow ? pulse : 1,
          }}
        >
          {Math.round(stock)}
        </span>
      </div>
      <div style={{ height: 10, borderRadius: 6, background: colors.surface3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 6, background: barColor }} />
      </div>
    </div>
  );
};
