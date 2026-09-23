import { describe, it, expect } from 'vitest';
import { SubInvoiceStatus, invoiceTotals, manualInvoiceSchema, refundSchema } from '@oculo/shared-types';
import { isOverdue, settlementStatus, startOfTodayUtc } from './invoicing.service.js';

/**
 * Ces tests portent sur les trois règles qui décident si de l'argent est
 * considéré comme reçu. Ce sont elles qui, fausses, font qu'une facture impayée
 * s'affiche « Payée » — l'erreur la plus coûteuse du module.
 */

describe('statut de règlement', () => {
  it('sans encaissement, la facture reste en attente', () => {
    expect(settlementStatus(100_000, 0)).toBe(SubInvoiceStatus.PENDING);
  });

  it('un acompte donne « partiellement payée », pas « payée »', () => {
    expect(settlementStatus(100_000, 50_000)).toBe(SubInvoiceStatus.PARTIALLY_PAID);
  });

  /** Le cas qui fait perdre de l'argent : il manque une pièce, ce n'est pas soldé. */
  it("un franc restant dû n'est pas soldé", () => {
    expect(settlementStatus(100_000, 99_999)).toBe(SubInvoiceStatus.PARTIALLY_PAID);
  });

  it('le solde exact solde la facture', () => {
    expect(settlementStatus(100_000, 100_000)).toBe(SubInvoiceStatus.PAID);
  });

  it('un trop-perçu solde aussi la facture', () => {
    expect(settlementStatus(100_000, 120_000)).toBe(SubInvoiceStatus.PAID);
  });
});

describe('retard', () => {
  const past = new Date(Date.now() - 5 * 86_400_000);
  const future = new Date(Date.now() + 5 * 86_400_000);

  it("une facture due dont l'échéance est passée est en retard", () => {
    expect(isOverdue({ status: 'PENDING', dueDate: past, amount: 100, amountPaid: 0 })).toBe(true);
  });

  it('une facture partiellement payée et échue est en retard', () => {
    expect(isOverdue({ status: 'PARTIALLY_PAID', dueDate: past, amount: 100, amountPaid: 40 })).toBe(true);
  });

  it("une facture dont l'échéance est à venir ne l'est pas", () => {
    expect(isOverdue({ status: 'PENDING', dueDate: future, amount: 100, amountPaid: 0 })).toBe(false);
  });

  /**
   * Le cas qui envoyait une relance « en retard » le matin même de l'échéance :
   * le client a la journée entière pour payer.
   */
  it("une facture due AUJOURD'HUI n'est pas encore en retard", () => {
    const today = new Date(startOfTodayUtc());
    expect(isOverdue({ status: 'PENDING', dueDate: today, amount: 100, amountPaid: 0 })).toBe(false);
  });

  it("une facture due hier est en retard", () => {
    const yesterday = new Date(startOfTodayUtc() - 86_400_000);
    expect(isOverdue({ status: 'PENDING', dueDate: yesterday, amount: 100, amountPaid: 0 })).toBe(true);
  });

  /**
   * Une facture payée ou annulée ne peut pas être « en retard », même si son
   * échéance est loin derrière : le retard qualifie une dette, pas une date.
   */
  it('une facture payée ou annulée ne vieillit pas en retard', () => {
    expect(isOverdue({ status: 'PAID', dueDate: past, amount: 100, amountPaid: 100 })).toBe(false);
    expect(isOverdue({ status: 'CANCELLED', dueDate: past, amount: 100, amountPaid: 0 })).toBe(false);
  });
});

describe('calcul du total', () => {
  it('additionne les lignes, retire la remise, ajoute la taxe', () => {
    const t = invoiceTotals({
      items: [
        { quantity: 2, unitPrice: 25_000 },
        { quantity: 1, unitPrice: 10_000 },
      ],
      discount: 5_000,
      tax: 1_000,
    });
    expect(t).toEqual({ subtotal: 60_000, discount: 5_000, tax: 1_000, total: 56_000 });
  });

  it('ne rend jamais un total négatif', () => {
    expect(invoiceTotals({ items: [{ quantity: 1, unitPrice: 1_000 }], discount: 5_000 }).total).toBe(0);
  });

  /** Le serveur recalcule : un total envoyé par le client n'est jamais cru. */
  it('remise supérieure au sous-total : refusée à la validation', () => {
    const parsed = manualInvoiceSchema.safeParse({
      tenantId: 't1',
      items: [{ description: 'Abonnement', quantity: 1, unitPrice: 10_000 }],
      discount: 20_000,
    });
    expect(parsed.success).toBe(false);
  });
});

describe('validation des saisies', () => {
  const base = {
    tenantId: 't1',
    items: [{ description: 'Abonnement Standard', quantity: 1, unitPrice: 12_000 }],
  };

  it('accepte une facture minimale', () => {
    expect(manualInvoiceSchema.safeParse(base).success).toBe(true);
  });

  it('refuse une facture sans ligne', () => {
    expect(manualInvoiceSchema.safeParse({ ...base, items: [] }).success).toBe(false);
  });

  it('refuse un règlement à zéro', () => {
    const parsed = manualInvoiceSchema.safeParse({
      ...base,
      payment: { amount: 0, method: 'WAVE' },
    });
    expect(parsed.success).toBe(false);
  });

  it('refuse un montant négatif', () => {
    expect(
      manualInvoiceSchema.safeParse({
        ...base,
        items: [{ description: 'Ligne', quantity: 1, unitPrice: -100 }],
      }).success,
    ).toBe(false);
  });

  it('exige un motif de remboursement', () => {
    expect(refundSchema.safeParse({ amount: 1_000, reason: '' }).success).toBe(false);
    expect(refundSchema.safeParse({ amount: 1_000, reason: 'Doublon de paiement' }).success).toBe(true);
  });
});
