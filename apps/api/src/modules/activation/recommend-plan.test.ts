import { describe, it, expect } from 'vitest';
import {
  ACTIVATION_STEP_COUNT,
  ACTIVATION_STEP_ORDER,
  PLAN_CATALOG,
  activationStepNumber,
  recommendPlan,
} from '@oculo/shared-types';

const limitOf = (code: string) => PLAN_CATALOG.find((p) => p.code === code)?.maxBranches ?? null;

describe('recommendPlan', () => {
  it('conseille Starter à un opticien seul', () => {
    const r = recommendPlan('ONE', ['SALES', 'STOCK'], 'INDEPENDENT');
    expect(r.planCode).toBe('STARTER');
    expect(r.reason).toBeTruthy();
  });

  /**
   * La règle qui compte : ne jamais conseiller une offre que le magasin
   * dépasserait dès le premier jour. Starter plafonne à 2 magasins, Standard
   * à 5 — une recommandation en dessous serait une promesse intenable.
   */
  it('ne conseille jamais une offre dont la limite est déjà dépassée', () => {
    const cases = [
      { branches: 'ONE' as const, min: 1 },
      { branches: 'TWO' as const, min: 2 },
      { branches: 'THREE_FIVE' as const, min: 3 },
      { branches: 'SIX_TEN' as const, min: 6 },
      { branches: 'TEN_PLUS' as const, min: 11 },
    ];
    for (const c of cases) {
      const { planCode } = recommendPlan(c.branches, ['SALES']);
      const max = limitOf(planCode);
      // null = illimité
      if (max !== null) expect(max).toBeGreaterThanOrEqual(c.min);
    }
  });

  it('passe à Growth au-delà de 5 magasins', () => {
    expect(recommendPlan('SIX_TEN', ['SALES']).planCode).toBe('GROWTH');
    expect(recommendPlan('TEN_PLUS', ['SALES']).planCode).toBe('GROWTH');
  });

  it('passe à Standard entre 3 et 5 magasins', () => {
    expect(recommendPlan('THREE_FIVE', ['SALES']).planCode).toBe('STANDARD');
  });

  it('monte à Standard sur un besoin multi-boutiques, même avec un seul magasin', () => {
    expect(recommendPlan('ONE', ['MULTI_SHOP']).planCode).toBe('STANDARD');
    expect(recommendPlan('ONE', ['EMPLOYEES']).planCode).toBe('STANDARD');
  });

  it('monte à Standard pour un centre spécialisé', () => {
    expect(recommendPlan('ONE', ['SALES'], 'CENTER').planCode).toBe('STANDARD');
  });

  /** Les besoins ne doivent jamais faire REDESCENDRE l'offre. */
  it('ne redescend jamais sous le niveau imposé par la taille', () => {
    expect(recommendPlan('SIX_TEN', ['SALES'], 'INDEPENDENT').planCode).toBe('GROWTH');
    expect(recommendPlan('THREE_FIVE', ['STOCK'], 'INDEPENDENT').planCode).toBe('STANDARD');
  });

  it('reste prudent quand la taille est inconnue', () => {
    expect(recommendPlan(null, ['SALES']).planCode).toBe('STARTER');
  });
});

describe('étapes du tunnel', () => {
  it('numérote les étapes à partir de 1', () => {
    expect(activationStepNumber('ACTIVITY')).toBe(1);
    expect(activationStepNumber('PAYMENT')).toBe(ACTIVATION_STEP_COUNT);
  });

  it('compte cinq étapes, conformément à « Étape X sur 5 »', () => {
    expect(ACTIVATION_STEP_COUNT).toBe(5);
    expect(ACTIVATION_STEP_ORDER).toHaveLength(5);
  });

  it('exclut l’état terminal de la numérotation', () => {
    expect(activationStepNumber('DONE')).toBe(0);
  });
});
