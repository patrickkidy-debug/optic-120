import { describe, it, expect } from 'vitest';
import { realSubState } from './console.service.js';

/**
 * L'état réel d'un abonnement décide de trois choses à la fois : le compteur
 * « abonnements payants », le MRR, et ce qu'affiche chaque ligne de liste.
 * S'il est faux, les trois le sont ensemble et se confirment mutuellement.
 */

const now = Date.parse('2026-09-23T12:00:00.000Z');
const past = new Date(now - 5 * 86_400_000);
const future = new Date(now + 5 * 86_400_000);

describe('état réel d’un abonnement', () => {
  it('actif et période en cours : payant', () => {
    expect(realSubState('ACTIVE', future, now)).toBe('paying');
  });

  /**
   * Le cas qui faisait mentir la console : la base dit « ACTIVE » alors que la
   * période est terminée. Le garde d'abonnement refuse déjà l'accès ; afficher
   * « actif » ferait croire à un client payant qui ne peut plus se connecter.
   */
  it('actif mais période terminée : expiré, pas payant', () => {
    expect(realSubState('ACTIVE', past, now)).toBe('expired');
  });

  it('essai en cours : essai, et non payant', () => {
    expect(realSubState('TRIALING', future, now)).toBe('trialing');
  });

  it('essai terminé : expiré', () => {
    expect(realSubState('TRIALING', past, now)).toBe('expired');
  });

  /** Une suspension prime sur la date : l'accès est coupé quoi qu'il arrive. */
  it('suspendu reste suspendu, même avec une période valide', () => {
    expect(realSubState('SUSPENDED', future, now)).toBe('suspended');
    expect(realSubState('SUSPENDED', past, now)).toBe('suspended');
  });

  it('annulé reste annulé', () => {
    expect(realSubState('CANCELLED', future, now)).toBe('cancelled');
  });

  it('impayé (PAST_DUE) n’est jamais compté comme payant', () => {
    expect(realSubState('PAST_DUE', future, now)).toBe('expired');
    expect(realSubState('PAST_DUE', past, now)).toBe('expired');
  });

  /**
   * L'échéance exacte : tant que l'instant présent n'a pas dépassé la fin de
   * période, l'accès est ouvert. Tester l'égalité évite qu'un abonnement bascule
   * « expiré » une milliseconde trop tôt.
   */
  it('à la milliseconde près, la période reste valide jusqu’à son terme', () => {
    expect(realSubState('ACTIVE', new Date(now + 1), now)).toBe('paying');
    expect(realSubState('ACTIVE', new Date(now - 1), now)).toBe('expired');
  });

  it('un seul état est rendu par abonnement — jamais deux compteurs à la fois', () => {
    const states = [
      realSubState('ACTIVE', future, now),
      realSubState('ACTIVE', past, now),
      realSubState('TRIALING', future, now),
      realSubState('SUSPENDED', future, now),
      realSubState('CANCELLED', past, now),
    ];
    expect(new Set(states).size).toBe(5);
  });
});
