import { Boxes } from 'lucide-react';
import { colors, fontBody, fontDisplay } from '../theme';
import { ProductRow } from './ProductRow';

const PRODUCTS = [
  { name: 'Ray-Ban Aviator', sku: 'MON-0231', max: 40, from: 18, to: 12, low: 10 },
  { name: 'Verre Essilor 1.6', sku: 'VER-0980', max: 60, from: 22, to: 8, low: 10 },
  { name: 'Oakley Holbrook', sku: 'MON-0410', max: 30, from: 9, to: 24, low: 8 },
];

/** Panneau inventaire : titre + lignes produit animees en cascade. */
export const InventoryCard: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  return (
    <div
      style={{
        background: colors.surface,
        borderRadius: 28,
        border: `1px solid ${colors.border}`,
        padding: 26,
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: colors.primarySoft,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Boxes size={20} color={colors.primary} strokeWidth={2.2} />
        </div>
        <span style={{ fontFamily: fontDisplay, fontWeight: 800, fontSize: 24, color: colors.text }}>
          Inventaire
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontFamily: fontBody,
            fontWeight: 700,
            fontSize: 14,
            color: colors.success,
            background: colors.successSoft,
            padding: '6px 12px',
            borderRadius: 999,
          }}
        >
          Sync en direct
        </span>
      </div>
      {PRODUCTS.map((p, i) => (
        <ProductRow
          key={p.sku}
          name={p.name}
          sku={p.sku}
          maxStock={p.max}
          fromStock={p.from}
          toStock={p.to}
          lowThreshold={p.low}
          delay={delay + i * 10}
        />
      ))}
    </div>
  );
};
