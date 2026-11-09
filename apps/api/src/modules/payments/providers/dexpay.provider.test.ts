import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DexPayProvider, DEXPAY_LIVE_URL, DEXPAY_SANDBOX_URL, dexpayEnvironment, dexpayStatus } from './dexpay.provider.js';

const cfg = {
  apiKey: 'pk_test_abc',
  apiSecret: 'sk_test_secret',
  webhookUrl: 'https://api.oculosaas.com/webhooks/dexpay-subscription',
  successUrl: 'https://app.oculosaas.com/parametres/abonnement',
  failureUrl: 'https://app.oculosaas.com/parametres/abonnement',
};

const input = {
  paymentId: 'cmpay123',
  amount: 25000.2,
  currency: 'XOF',
  method: 'ORANGE_MONEY' as never,
  customerName: 'Optique Lumière',
  saleNumber: 'FAC-2026-000002',
};

describe('statut DexPay', () => {
  it('crédite sur completed / success, jamais sur un statut inconnu', () => {
    expect(dexpayStatus('completed')).toBe('SUCCESS');
    expect(dexpayStatus('success')).toBe('SUCCESS');
    expect(dexpayStatus('failed')).toBe('FAILED');
    expect(dexpayStatus('cancelled')).toBe('CANCELLED');
    expect(dexpayStatus('refunded')).toBe('REFUNDED');
    expect(dexpayStatus('processing')).toBe('PENDING');
    expect(dexpayStatus('bizarre')).toBe('PENDING');
    expect(dexpayStatus(undefined)).toBe('PENDING');
  });

  it('considère abandonnée une session en attente expirée', () => {
    const now = Date.parse('2026-11-09T12:00:00Z');
    expect(dexpayStatus('initiated', '2026-11-09T11:00:00Z', now)).toBe('CANCELLED');
    expect(dexpayStatus('pending', '2026-11-09T13:00:00Z', now)).toBe('PENDING');
  });

  it('déduit l’environnement du préfixe des clés', () => {
    expect(dexpayEnvironment('pk_test_x')).toBe('sandbox');
    expect(dexpayEnvironment('pk_live_x', 'sk_live_y')).toBe('live');
    expect(dexpayEnvironment('autre')).toBe('');
  });
});

describe('création de session DexPay', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('vise la sandbox avec une clé de test et envoie notre référence', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      new Response(
        JSON.stringify({
          status: 201,
          data: { reference: 'cmpay123', payment_url: 'https://pay.dexpay.africa/checkout/cmpay123', status: 'initiated' },
        }),
        { status: 201 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const res = await new DexPayProvider(cfg).initiatePayment({ ...input, returnUrl: 'https://app.oculosaas.com/activation/retour?session=t' });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${DEXPAY_SANDBOX_URL}/checkout-sessions`);
    const h = init.headers as Record<string, string>;
    expect(h['x-api-key']).toBe('pk_test_abc');
    expect(h['x-api-secret']).toBe('sk_test_secret');
    expect(JSON.parse(String(init.body))).toMatchObject({
      reference: 'cmpay123',
      amount: 25000,
      currency: 'XOF',
      webhook_url: cfg.webhookUrl,
      success_url: 'https://app.oculosaas.com/activation/retour?session=t',
      failure_url: 'https://app.oculosaas.com/activation/retour?session=t',
    });
    expect(res).toMatchObject({ providerRef: 'cmpay123', status: 'PENDING', redirectUrl: 'https://pay.dexpay.africa/checkout/cmpay123' });
  });

  it('vise la production avec une clé live', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      new Response(JSON.stringify({ data: { reference: 'cmpay123', payment_url: 'https://pay.dexpay.africa/checkout/cmpay123' } }), { status: 201 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await new DexPayProvider({ ...cfg, apiKey: 'pk_live_a', apiSecret: 'sk_live_b' }).initiatePayment(input);
    expect(fetchMock.mock.calls[0]![0]).toBe(`${DEXPAY_LIVE_URL}/checkout-sessions`);
  });

  it('remonte le message d’erreur de DexPay', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ statusCode: 400, message: ['amount must be positive'] }), { status: 400 })));
    await expect(new DexPayProvider(cfg).initiatePayment(input)).rejects.toThrow(/amount must be positive/);
  });

  it('refuse l’euro', async () => {
    await expect(new DexPayProvider(cfg).initiatePayment({ ...input, currency: 'EUR' })).rejects.toThrow(/XOF/);
  });

  it('lit le statut d’une session', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 200, data: { reference: 'cmpay123', status: 'completed', amount: 25000 } }), { status: 200 })));
    const v = await new DexPayProvider(cfg).verifyPayment('cmpay123');
    expect(v.status).toBe('SUCCESS');
  });
});

describe('webhook DexPay', () => {
  const provider = new DexPayProvider(cfg);
  const flat = JSON.stringify({ event: 'checkout.completed', reference: 'cmpay123', status: 'completed', amount: 25000 });
  const nested = JSON.stringify({ event: 'checkout.completed', data: { reference: 'cmpay123', status: 'success' } });
  const sign = (body: string) => createHmac('sha256', cfg.apiSecret).update(body).digest('hex');

  it('accepte les deux formes documentées quand la signature est bonne', async () => {
    for (const raw of [flat, nested]) {
      const r = await provider.handleWebhook(JSON.parse(raw), sign(raw), { rawBody: raw });
      expect(r).toMatchObject({ providerRef: 'cmpay123', status: 'SUCCESS' });
    }
  });

  it('refuse une signature fausse, absente ou un corps modifié', async () => {
    await expect(provider.handleWebhook(JSON.parse(flat), 'ab'.repeat(32), { rawBody: flat })).rejects.toThrow();
    await expect(provider.handleWebhook(JSON.parse(flat), undefined, { rawBody: flat })).rejects.toThrow();
    const tampered = flat.replace('25000', '1');
    await expect(provider.handleWebhook(JSON.parse(tampered), sign(flat), { rawBody: tampered })).rejects.toThrow();
  });
});
