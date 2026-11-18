import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/prisma.js', () => ({ prisma: {} }));
const { popupEligible, POPUP_RULES } = await import('./announcements.service.js');

const at = (iso: string) => new Date(iso);

describe('popupEligible', () => {
  const now = at('2026-11-18T15:00:00Z');

  it('s’ouvre la première fois', () => {
    expect(popupEligible([], now)).toBe(true);
  });

  it('attend 4 h entre deux affichages', () => {
    expect(popupEligible([at('2026-11-18T12:00:00Z')], now)).toBe(false);
    expect(popupEligible([at('2026-11-18T10:30:00Z')], now)).toBe(true);
  });

  it('pas plus de 2 fois le même jour', () => {
    const today = [at('2026-11-18T06:00:00Z'), at('2026-11-18T10:00:00Z')];
    expect(popupEligible(today, at('2026-11-18T22:00:00Z'))).toBe(false);
    // Le lendemain, ça reprend.
    expect(popupEligible(today, at('2026-11-19T08:00:00Z'))).toBe(true);
  });

  it('s’arrête après 6 affichages (3 jours)', () => {
    const six = Array.from({ length: POPUP_RULES.maxTotal }, (_, i) => at(`2026-11-1${i}T08:00:00Z`));
    expect(popupEligible(six, at('2026-11-30T08:00:00Z'))).toBe(false);
  });
});
