import { CURRENCY_FORMAT, type SupportedCurrency } from '@oculo/shared-types';

/**
 * Devise de l'établissement connecté. `formatCurrency` est appelé sans argument
 * de devise dans des dizaines d'écrans : plutôt que de la propager partout, on
 * la fixe une fois à l'ouverture de session (voir setActiveCurrency).
 */
let activeCurrency = 'XOF';

/** Définie au chargement de la session, depuis AuthUser.tenantCurrency. */
export function setActiveCurrency(currency?: string | null): void {
  activeCurrency = currency || 'XOF';
}

export function getActiveCurrency(): string {
  return activeCurrency;
}

export function formatCurrency(amount: number, currency?: string): string {
  const code = (currency || activeCurrency) as SupportedCurrency;
  const fmt = CURRENCY_FORMAT[code];
  const n = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: fmt?.decimals ?? 0,
    minimumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
  return `${n} ${fmt?.symbol ?? code}`;
}

export function formatDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    date,
  );
}

export function formatDateTime(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function initials(first?: string, last?: string): string {
  return `${(first?.[0] ?? '').toUpperCase()}${(last?.[0] ?? '').toUpperCase()}` || 'U';
}
