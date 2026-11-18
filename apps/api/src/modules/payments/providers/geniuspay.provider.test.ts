import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { GeniusPayProvider, geniusPayAmountCovers } from './geniuspay.provider.js';

const SECRET = 'whsec_test';
const provider = new GeniusPayProvider({ apiKey: 'pk_sandbox_x', apiSecret: 'sk_sandbox_x', baseUrl: 'https://example.invalid', webhookSecret: SECRET });

function signed(body: object, ts = Math.floor(Date.now() / 1000)) {
  const raw = JSON.stringify(body);
  const sig = createHmac('sha256', SECRET).update(`${ts}.${raw}`).digest('hex');
  return { raw, sig, headers: { 'x-webhook-timestamp': String(ts) } };
}

describe('webhook GeniusPay', () => {
  const body = { event: 'payment.completed', data: { reference: 'MTX-1', status: 'completed' } };

  it('accepte une signature valide et lit la référence', async () => {
    const { raw, sig, headers } = signed(body);
    const r = await provider.handleWebhook(JSON.parse(raw), sig, { rawBody: raw, headers });
    expect(r.providerRef).toBe('MTX-1');
    expect(r.status).toBe('SUCCESS');
  });

  it('refuse une signature fausse', async () => {
    const { raw, headers } = signed(body);
    await expect(provider.handleWebhook(JSON.parse(raw), 'f'.repeat(64), { rawBody: raw, headers })).rejects.toThrow();
  });

  it('refuse un webhook rejoué (plus de 5 minutes)', async () => {
    const { raw, sig, headers } = signed(body, Math.floor(Date.now() / 1000) - 600);
    await expect(provider.handleWebhook(JSON.parse(raw), sig, { rawBody: raw, headers })).rejects.toThrow();
  });
});

describe('montant GeniusPay', () => {
  it('abonnement 7 500 + 500 de frais : 8 000 payés couvrent le paiement', () => {
    expect(geniusPayAmountCovers(8000, { data: { amount: 8000, currency: 'XOF' } })).toBe(true);
  });
  it('7 500 payés sans les frais : refusé', () => {
    expect(geniusPayAmountCovers(8000, { data: { amount: 7500, currency: 'XOF' } })).toBe(false);
  });
  it('montant illisible ou autre devise : refusé', () => {
    expect(geniusPayAmountCovers(8000, { data: {} })).toBe(false);
    expect(geniusPayAmountCovers(8000, { data: { amount: 8000, currency: 'EUR' } })).toBe(false);
  });
});
