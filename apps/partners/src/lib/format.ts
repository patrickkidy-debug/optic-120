import { CURRENCY_FORMAT, type SupportedCurrency } from '@oculo/shared-types';

/** Formate un montant avec la devise EXPLICITE de la ligne (une commission
 * porte sa propre devise — un partenaire peut avoir des clients dans
 * plusieurs pays, il n'y a pas de "devise active" unique comme côté magasin). */
export function formatCurrency(amount: number, currency: string = 'XOF'): string {
  const fmt = CURRENCY_FORMAT[currency as SupportedCurrency];
  const n = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: fmt?.decimals ?? 0,
    minimumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
  return `${n} ${fmt?.symbol ?? currency}`;
}

export function formatDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}
