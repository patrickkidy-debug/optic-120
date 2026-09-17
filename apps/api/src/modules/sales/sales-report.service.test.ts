import { describe, it, expect } from 'vitest';
import { previousPeriod, pickGranularity, reportWhere } from './sales-report.service.js';

const day = (s: string, end = false): Date =>
  new Date(`${s}T${end ? '23:59:59.999' : '00:00:00.000'}Z`);

describe('previousPeriod', () => {
  /**
   * L'exigence métier : comparer à la période précédente de MÊME durée,
   * immédiatement contiguë — sans chevauchement (qui compterait deux fois les
   * mêmes ventes) ni trou (qui en perdrait).
   */
  it('produit une période contiguë de même durée', () => {
    const from = day('2026-08-18');
    const to = day('2026-09-17', true);
    const prev = previousPeriod(from, to);

    expect(prev.to.getTime()).toBe(from.getTime() - 1);
    expect(to.getTime() - from.getTime()).toBe(prev.to.getTime() - prev.from.getTime());
    // Du 18 août au 17 septembre inclus = 31 jours (14 en août + 17 en
    // septembre). Les 31 jours précédents s'arrêtant le 17 août commencent donc
    // le 18 juillet, et non le 19 : l'exemple de la spécification comparait
    // 31 jours à 30, ce qui fausse mécaniquement toutes les variations.
    expect(prev.from.toISOString().slice(0, 10)).toBe('2026-07-18');
    expect(prev.to.toISOString().slice(0, 10)).toBe('2026-08-17');
  });

  it('ne chevauche jamais la période courante', () => {
    const from = day('2026-09-01');
    const to = day('2026-09-30', true);
    const prev = previousPeriod(from, to);
    expect(prev.to.getTime()).toBeLessThan(from.getTime());
  });

  it('gère une période d’un seul jour', () => {
    const from = day('2026-09-17');
    const to = day('2026-09-17', true);
    const prev = previousPeriod(from, to);
    expect(prev.from.toISOString().slice(0, 10)).toBe('2026-09-16');
    expect(prev.to.toISOString().slice(0, 10)).toBe('2026-09-16');
  });
});

describe('pickGranularity', () => {
  it('détaille au jour sur un mois ou moins', () => {
    expect(pickGranularity(day('2026-09-01'), day('2026-09-30', true))).toBe('day');
  });

  it('regroupe par semaine au-delà d’un mois', () => {
    expect(pickGranularity(day('2026-06-01'), day('2026-09-30', true))).toBe('week');
  });

  it('regroupe par mois au-delà de six mois', () => {
    expect(pickGranularity(day('2026-01-01'), day('2026-12-31', true))).toBe('month');
  });
});

describe('reportWhere', () => {
  const base = { from: day('2026-09-01'), to: day('2026-09-30', true) };

  it('exclut toujours les ventes annulées', () => {
    const w = reportWhere(base) as { status: { in: string[] } };
    expect(w.status.in).not.toContain('CANCELLED');
    expect(w.status.in).toEqual(['CONFIRMED', 'PARTIALLY_PAID', 'PAID']);
  });

  it('ignore un statut inconnu plutôt que de tout filtrer à vide', () => {
    const w = reportWhere({ ...base, statuses: ['CANCELLED', 'INEXISTANT'] }) as {
      status: { in: string[] };
    };
    expect(w.status.in).toEqual(['CONFIRMED', 'PARTIALLY_PAID', 'PAID']);
  });

  it('retient les statuts demandés quand ils sont valides', () => {
    const w = reportWhere({ ...base, statuses: ['PARTIALLY_PAID', 'CONFIRMED'] }) as {
      status: { in: string[] };
    };
    expect(w.status.in).toEqual(['PARTIALLY_PAID', 'CONFIRMED']);
  });

  it('ne retient un mode de paiement que s’il a abouti', () => {
    const w = reportWhere({ ...base, method: 'CASH' }) as {
      payments: { some: { method: string; status: string } };
    };
    expect(w.payments.some).toEqual({ method: 'CASH', status: 'SUCCESS' });
  });

  it('cherche sur le numéro, le client, son téléphone et le vendeur', () => {
    const w = reportWhere({ ...base, search: 'daouda' }) as { OR: unknown[] };
    expect(w.OR).toHaveLength(6);
  });

  it('n’ajoute aucun filtre de recherche pour une chaîne vide', () => {
    expect(reportWhere({ ...base, search: '   ' })).not.toHaveProperty('OR');
  });
});
