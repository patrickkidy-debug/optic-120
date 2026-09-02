import type { PropsWithChildren } from 'react';
import { colors } from '../theme';

/**
 * Chassis telephone stylise qui encadre les mockups d'interface. Donne
 * l'ancrage visuel "app SaaS sur mobile" attendu en 9:16.
 */
export const PhoneFrame: React.FC<PropsWithChildren<{ scale?: number }>> = ({ children, scale = 1 }) => {
  const w = 620;
  const h = 1260;
  return (
    <div
      style={{
        width: w,
        height: h,
        transform: `scale(${scale})`,
        borderRadius: 64,
        padding: 14,
        background: 'linear-gradient(160deg, #2a3350 0%, #12172a 100%)',
        boxShadow: `0 40px 120px -20px rgba(0,0,0,0.65), 0 0 0 1px rgba(148,163,184,0.12), 0 0 90px ${colors.primary}22`,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 50,
          overflow: 'hidden',
          background: colors.bgSubtle,
          position: 'relative',
          border: `1px solid ${colors.border}`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 18,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 140,
            height: 26,
            borderRadius: 14,
            background: '#05070d',
            zIndex: 10,
          }}
        />
        {children}
      </div>
    </div>
  );
};
