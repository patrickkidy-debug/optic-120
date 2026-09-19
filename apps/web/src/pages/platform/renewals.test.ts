import { describe, it, expect } from 'vitest';
import { DEFAULT_RENEWAL_TEMPLATE } from '@oculo/shared-types';
import type { RenewalRow } from '../../features/billing/api';
import {
  describeDelay,
  describeLastReminder,
  matchesRenewal,
  remindedToday,
  renderRenewalMessage,
  urgencyOf,
} from './renewals';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const row = (over: Partial<RenewalRow> = {}): RenewalRow => ({
  tenantId: 't1',
  tenantName: 'Optique Lumière',
  whatsapp: '+2250700000000',
  status: 'ACTIVE',
  planName: 'Standard',
  planPrice: 25000,
  currency: 'XOF',
  currentPeriodEnd: '2026-09-22T10:00:00.000Z',
  msLeft: 3 * DAY,
  autoRenew: true,
  lastReminderAt: null,
  reminderCount: 0,
  ...over,
});

describe('describeDelay', () => {
  it('parle en jours au-delà d’une journée', () => {
    expect(describeDelay(3 * DAY)).toBe('dans 3 jours');
    expect(describeDelay(1 * DAY)).toBe('dans 1 jour');
  });

  /**
   * L'essai gratuit dure deux heures par défaut. Arrondi au jour, un essai qui
   * expire dans 90 minutes s'afficherait « dans 0 jour » — le fondateur ne
   * saurait pas qu'il doit relancer maintenant.
   */
  it('descend à l’heure pour un essai court', () => {
    expect(describeDelay(2 * HOUR)).toBe('dans 2 heures');
    expect(describeDelay(90 * MIN)).toBe('dans 2 heures');
  });

  it('descend à la minute sous l’heure, sans jamais afficher 0', () => {
    expect(describeDelay(40 * MIN)).toBe('dans 40 minutes');
    expect(describeDelay(5_000)).toBe('dans 1 minute');
  });

  it('dit « dépassée » pour une échéance passée', () => {
    expect(describeDelay(-2 * DAY)).toBe('dépassée depuis 2 jours');
    expect(describeDelay(-3 * HOUR)).toBe('dépassée depuis 3 heures');
  });
});

describe('urgencyOf', () => {
  it('classe par proximité de l’échéance', () => {
    expect(urgencyOf(-1)).toBe('expired');
    expect(urgencyOf(2 * HOUR)).toBe('critical');
    expect(urgencyOf(2 * DAY)).toBe('critical');
    expect(urgencyOf(5 * DAY)).toBe('soon');
    expect(urgencyOf(20 * DAY)).toBe('later');
  });
});

describe('remindedToday / describeLastReminder', () => {
  const now = new Date('2026-09-19T15:00:00');

  it('reconnaît une relance du jour même', () => {
    expect(remindedToday('2026-09-19T08:30:00', now)).toBe(true);
    expect(remindedToday('2026-09-18T23:59:00', now)).toBe(false);
    expect(remindedToday(null, now)).toBe(false);
  });

  it('décrit la dernière relance', () => {
    expect(describeLastReminder(null, now)).toBe('Jamais relancé');
    expect(describeLastReminder('2026-09-17T15:00:00', now)).toBe('Il y a 2 jours');
    expect(describeLastReminder('2026-09-19T08:05:00', now)).toMatch(/^Aujourd'hui à 08:05$/);
  });
});

describe('matchesRenewal', () => {
  const r = row();

  it('laisse tout passer quand la recherche est vide', () => {
    expect(matchesRenewal(r, '')).toBe(true);
    expect(matchesRenewal(r, '   ')).toBe(true);
  });

  it('trouve par nom d’établissement, sans tenir compte de la casse', () => {
    expect(matchesRenewal(r, 'OPTIQUE')).toBe(true);
    expect(matchesRenewal(r, 'inconnu')).toBe(false);
  });

  /** Personne ne tape les accents dans une barre de recherche. */
  it('ignore les accents', () => {
    expect(matchesRenewal(r, 'lumiere')).toBe(true);
    expect(matchesRenewal(row({ tenantName: 'Optique Lumiere' }), 'Lumière')).toBe(true);
  });

  it('trouve par offre', () => {
    expect(matchesRenewal(r, 'standard')).toBe(true);
  });

  /**
   * Le numéro est saisi dans des formats variés à l'inscription (espaces,
   * tirets, indicatif). Seuls les chiffres doivent compter.
   */
  it('trouve par numéro quel que soit le format tapé', () => {
    expect(matchesRenewal(r, '07 00 00')).toBe(true);
    expect(matchesRenewal(r, '+225 07')).toBe(true);
    expect(matchesRenewal(r, '0799')).toBe(false);
  });

  it('ne compare pas un texte sans chiffre au numéro', () => {
    // « abc » n'a aucun chiffre : sans garde, "" serait contenu dans tout numéro.
    expect(matchesRenewal(r, 'abc')).toBe(false);
  });

  it('gère un établissement sans numéro', () => {
    expect(matchesRenewal(row({ whatsapp: null }), '0700')).toBe(false);
  });
});

describe('renderRenewalMessage', () => {
  const url = 'https://oculosaas.com/activer';

  it('remplit toutes les variables du modèle par défaut', () => {
    const text = renderRenewalMessage(DEFAULT_RENEWAL_TEMPLATE, row(), url);
    expect(text).toContain('Optique Lumière');
    expect(text).toContain('*Standard*');
    expect(text).toContain('échéance dans 3 jours');
    expect(text).toContain(url);
    // Aucune variable ne doit rester non remplie dans le message envoyé.
    expect(text).not.toMatch(/\{\w+\}/);
  });

  /**
   * Le modèle dit « échéance {delai} » et non « arrive à échéance {delai} » :
   * la seconde formulation donnerait « arrive à échéance dépassée depuis… ».
   */
  it('reste correct pour un abonnement déjà échu', () => {
    const text = renderRenewalMessage(DEFAULT_RENEWAL_TEMPLATE, row({ msLeft: -2 * DAY }), url);
    expect(text).toContain('échéance dépassée depuis 2 jours');
  });

  it('remplace une variable inconnue par une chaîne vide plutôt que de la laisser brute', () => {
    expect(renderRenewalMessage('Bonjour {inconnue}!', row(), url)).toBe('Bonjour !');
  });

  it('conserve les retours à la ligne du modèle', () => {
    const text = renderRenewalMessage(DEFAULT_RENEWAL_TEMPLATE, row(), url);
    expect(text.split('\n').length).toBeGreaterThan(3);
  });
});
