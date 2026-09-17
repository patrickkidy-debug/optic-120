import { describe, it, expect } from 'vitest';
import { numberSeriesPrefix, nextSeriesNumber } from './document-number.js';

describe('numberSeriesPrefix', () => {
  it('compose le préfixe annuel', () => {
    expect(numberSeriesPrefix('DEV', 2026)).toBe('DEV-2026-');
  });
});

describe('nextSeriesNumber', () => {
  it('démarre à 1 sur une série vide', () => {
    expect(nextSeriesNumber('DEV', 2026, null)).toBe('DEV-2026-000001');
    expect(nextSeriesNumber('DEV', 2026, undefined)).toBe('DEV-2026-000001');
  });

  it('suit le dernier numéro émis', () => {
    expect(nextSeriesNumber('DEV', 2026, 'DEV-2026-000004')).toBe('DEV-2026-000005');
  });

  /**
   * Le bug signalé : après conversion d'un devis en vente, la ligne est
   * renommée (DEV-… devient VEN-…). Le NOMBRE de devis baisse, mais le dernier
   * numéro émis, lui, ne recule pas — c'est exactement ce qu'un COUNT() ratait.
   */
  it('ne recule pas quand une pièce a quitté la série (devis converti)', () => {
    const emitted = ['DEV-2026-000001', 'DEV-2026-000002', 'DEV-2026-000003', 'DEV-2026-000004', 'DEV-2026-000005'];
    const afterConversion = emitted.filter((n) => n !== 'DEV-2026-000003'); // 4 lignes restantes
    const last = [...afterConversion].sort().at(-1) ?? null;

    // Un COUNT() aurait donné 4 + 1 = DEV-2026-000005, déjà attribué.
    expect(afterConversion.length + 1).toBe(5);
    expect(nextSeriesNumber('DEV', 2026, last)).toBe('DEV-2026-000006');
    expect(afterConversion).not.toContain(nextSeriesNumber('DEV', 2026, last));
  });

  it('respecte la largeur demandée', () => {
    expect(nextSeriesNumber('PEC', 2026, 'PEC-2026-00041', 5)).toBe('PEC-2026-00042');
  });

  it('passe la largeur sans perdre de chiffre au débordement', () => {
    expect(nextSeriesNumber('PEC', 2026, 'PEC-2026-99999', 5)).toBe('PEC-2026-100000');
  });

  it('repart à 1 sur un changement d’année', () => {
    expect(nextSeriesNumber('DEV', 2027, null)).toBe('DEV-2027-000001');
  });

  it('retombe sur 1 si le suffixe est illisible', () => {
    expect(nextSeriesNumber('DEV', 2026, 'DEV-2026-XXXXXX')).toBe('DEV-2026-000001');
  });

  /**
   * Garde-fou sur l'hypothèse de tri : `orderBy number desc` est lexicographique.
   * Elle ne tient que parce que la partie séquentielle est cadrée à largeur fixe.
   */
  it('garde un ordre lexicographique cohérent à largeur fixe', () => {
    const series = ['DEV-2026-000009', 'DEV-2026-000010', 'DEV-2026-000100'];
    expect([...series].sort().at(-1)).toBe('DEV-2026-000100');
  });

  it('signale la limite connue : le tri lexicographique casse au débordement', () => {
    // Documenté volontairement : à 1 000 000 pièces dans une même série
    // annuelle, « 1000000 » se classe avant « 999999 ». Aucun établissement
    // n'atteint ce volume, mais l'hypothèse doit rester explicite.
    expect(['DEV-2026-999999', 'DEV-2026-1000000'].sort().at(-1)).toBe('DEV-2026-999999');
  });
});
