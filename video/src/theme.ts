// Charte OculoSaaS reprise depuis apps/web/src/styles/tokens.css (thème sombre).
export const colors = {
  bg: '#080c16',
  bgSubtle: '#0b1120',
  surface: '#111a2e',
  surface2: '#16203a',
  surface3: '#1d2949',
  border: 'rgba(148, 163, 184, 0.16)',
  primary: '#8b5cf6',
  primaryHover: '#7c3aed',
  primarySoft: 'rgba(139, 92, 246, 0.16)',
  accent: '#f97316',
  accentSoft: 'rgba(249, 115, 22, 0.16)',
  cyan: '#22d3ee',
  text: '#e8edf7',
  textMuted: '#94a3b8',
  textFaint: '#5b6b85',
  success: '#22c55e',
  successSoft: 'rgba(34, 197, 94, 0.16)',
  danger: '#ef4444',
  dangerSoft: 'rgba(239, 68, 68, 0.16)',
  white: '#ffffff',
} as const;

export const gradients = {
  bg: `radial-gradient(120% 100% at 50% 0%, ${colors.bgSubtle} 0%, ${colors.bg} 55%, #05070d 100%)`,
  brand: `linear-gradient(120deg, ${colors.primary} 0%, #a78bfa 50%, ${colors.accent} 100%)`,
  card: `linear-gradient(160deg, ${colors.surface2} 0%, ${colors.surface} 100%)`,
};

export const fontDisplay = "'Manrope', 'Outfit', 'Inter', system-ui, sans-serif";
export const fontBody = "'Inter', system-ui, sans-serif";

// FCFA, formaté en groupes de milliers avec espace fine (convention ouest-africaine).
export function formatFcfa(n: number): string {
  return `${Math.round(n).toLocaleString('fr-FR').replace(/ |,/g, ' ')} FCFA`;
}
