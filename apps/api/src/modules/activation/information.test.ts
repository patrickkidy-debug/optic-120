import { describe, it, expect } from 'vitest';
import { activationInformationSchema } from '@oculo/shared-types';

const base = {
  fullName: 'Awa Diop',
  establishmentName: 'Optique Lumière',
  phone: '0700000001',
  whatsapp: '+225 07 12 34 56',
  email: 'awa@exemple.com',
  country: 'CI',
  city: 'Abidjan',
  password: 'TunnelTest!2026',
};

const parse = (over: Record<string, unknown> = {}) =>
  activationInformationSchema.safeParse({ ...base, ...over });

describe('coordonnées du tunnel', () => {
  it('accepte un dossier complet', () => {
    expect(parse().success).toBe(true);
  });

  /**
   * L'indicatif est la seule chose qui rend le numéro joignable depuis un
   * autre pays. Sans lui, l'équipe ne peut pas rappeler le client pour
   * configurer son espace — le numéro est inutilisable.
   */
  it('refuse un numéro WhatsApp sans indicatif', () => {
    expect(parse({ whatsapp: '0712345678' }).success).toBe(false);
    expect(parse({ whatsapp: '07 12 34 56' }).success).toBe(false);
  });

  it('refuse un indicatif hors des pays desservis', () => {
    expect(parse({ whatsapp: '+33 6 12 34 56 78' }).success).toBe(false);
  });

  it('accepte les indicatifs des pays desservis', () => {
    for (const n of ['+221 77 123 45 67', '+225 07 12 34 56', '+229 97 12 34 56']) {
      expect(parse({ whatsapp: n }).success).toBe(true);
    }
  });

  it('tolère espaces, tirets et parenthèses', () => {
    expect(parse({ whatsapp: '+225-07.12 34 (56)' }).success).toBe(true);
  });

  /** Un chiffre répété après l'indicatif est un numéro de remplissage. */
  it('refuse un numéro de remplissage', () => {
    expect(parse({ whatsapp: '+225 0000000' }).success).toBe(false);
  });

  it('laisse le téléphone fixe plus souple que le WhatsApp', () => {
    // Le rappel passe par WhatsApp : c'est lui qui porte l'exigence.
    expect(parse({ phone: '0700000001' }).success).toBe(true);
  });

  it('refuse un email invalide', () => {
    expect(parse({ email: 'pas-un-email' }).success).toBe(false);
  });
});
