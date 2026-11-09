import { afterEach, describe, expect, it, vi } from 'vitest';
import { WaveProvider, waveSign, waveStatus } from './wave.provider.js';

const base = {
  apiKey: 'wave_ci_prod_test',
  baseUrl: 'https://api.wave.test',
  successUrl: 'https://app.oculosaas.com/parametres/abonnement',
  errorUrl: 'https://app.oculosaas.com/parametres/abonnement',
};

const input = {
  paymentId: 'pay_123',
  amount: 15000.4,
  currency: 'XOF',
  method: 'WAVE' as never,
  customerName: 'Optique Lumière',
  saleNumber: 'FAC-2026-000001',
};

describe('statut Wave', () => {
  it('ne crédite que sur payment_status « succeeded »', () => {
    expect(waveStatus({ checkout_status: 'complete', payment_status: 'succeeded' })).toBe('SUCCESS');
    expect(waveStatus({ checkout_status: 'open', payment_status: 'processing' })).toBe('PENDING');
    // Échec d'une tentative : la session reste ouverte, le client peut réessayer.
    expect(waveStatus({ checkout_status: 'open', payment_status: 'cancelled' })).toBe('PENDING');
    expect(waveStatus({ checkout_status: 'expired', payment_status: 'cancelled' })).toBe('CANCELLED');
    expect(waveStatus({ checkout_status: 'weird', payment_status: 'unknown' })).toBe('PENDING');
    expect(waveStatus(undefined)).toBe('PENDING');
  });
});

describe('création de session Wave', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('envoie un montant entier en texte, notre référence, et renvoie wave_launch_url', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      new Response(
        JSON.stringify({
          id: 'cos-18qq25rgr100a',
          checkout_status: 'open',
          payment_status: 'processing',
          wave_launch_url: 'https://pay.wave.com/c/cos-18qq25rgr100a',
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const res = await new WaveProvider(base).initiatePayment({ ...input, returnUrl: 'https://app.oculosaas.com/activation/retour?session=x' });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.wave.test/v1/checkout/sessions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer wave_ci_prod_test');
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      amount: '15000',
      currency: 'XOF',
      client_reference: 'pay_123',
      success_url: 'https://app.oculosaas.com/activation/retour?session=x',
    });
    expect(res).toMatchObject({ providerRef: 'cos-18qq25rgr100a', status: 'PENDING', redirectUrl: 'https://pay.wave.com/c/cos-18qq25rgr100a' });
  });

  it('signe la requête quand un secret de signature est configuré', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      new Response(JSON.stringify({ id: 'cos-1', wave_launch_url: 'https://pay.wave.com/c/cos-1' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await new WaveProvider({ ...base, signingSecret: 'wave_ci_AKS_secret' }).initiatePayment(input);
    const init = fetchMock.mock.calls[0]![1];
    const header = (init.headers as Record<string, string>)['Wave-Signature']!;
    const [, t, v1] = /^t=(\d+),v1=([0-9a-f]+)$/.exec(header)!;
    expect(v1).toBe(waveSign('wave_ci_AKS_secret', t!, String(init.body)));
  });

  it('refuse une autre devise que le XOF', async () => {
    await expect(new WaveProvider(base).initiatePayment({ ...input, currency: 'EUR' })).rejects.toThrow(/XOF/);
  });

  it('remonte le message d’erreur de Wave', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: 'request-validation-error', message: 'Invalid amount' }), { status: 400 })));
    await expect(new WaveProvider(base).initiatePayment(input)).rejects.toThrow(/Invalid amount/);
  });
});

describe('webhook Wave', () => {
  const secret = 'wave_ci_WHS_secret';
  const raw = JSON.stringify({
    id: 'EV_1',
    type: 'checkout.session.completed',
    data: { id: 'cos-1', checkout_status: 'complete', payment_status: 'succeeded', client_reference: 'pay_123' },
  });
  const provider = new WaveProvider({ ...base, webhookSecret: secret });
  const now = () => String(Math.floor(Date.now() / 1000));

  it('accepte une signature valide (parmi plusieurs v1)', async () => {
    const t = now();
    const res = await provider.handleWebhook(JSON.parse(raw), undefined, {
      rawBody: raw,
      headers: { 'wave-signature': `t=${t},v1=deadbeef,v1=${waveSign(secret, t, raw)}` },
    });
    expect(res).toMatchObject({ providerRef: 'cos-1', status: 'SUCCESS' });
  });

  it('refuse une signature fausse, un corps modifié ou un horodatage trop ancien', async () => {
    const t = now();
    await expect(
      provider.handleWebhook(JSON.parse(raw), undefined, { rawBody: raw, headers: { 'wave-signature': `t=${t},v1=00` } }),
    ).rejects.toThrow();
    await expect(
      provider.handleWebhook(JSON.parse(raw), undefined, {
        rawBody: raw.replace('pay_123', 'pay_999'),
        headers: { 'wave-signature': `t=${t},v1=${waveSign(secret, t, raw)}` },
      }),
    ).rejects.toThrow();
    const old = String(Math.floor(Date.now() / 1000) - 600);
    await expect(
      provider.handleWebhook(JSON.parse(raw), undefined, { rawBody: raw, headers: { 'wave-signature': `t=${old},v1=${waveSign(secret, old, raw)}` } }),
    ).rejects.toThrow(/expiré/);
  });

  it('accepte le mode secret partagé (Authorization: Bearer)', async () => {
    const res = await provider.handleWebhook(JSON.parse(raw), undefined, { rawBody: raw, headers: { authorization: `Bearer ${secret}` } });
    expect(res.providerRef).toBe('cos-1');
    await expect(
      provider.handleWebhook(JSON.parse(raw), undefined, { rawBody: raw, headers: { authorization: 'Bearer autre' } }),
    ).rejects.toThrow();
  });

  it('refuse tout webhook sans authentification ou sans secret configuré', async () => {
    await expect(provider.handleWebhook(JSON.parse(raw), undefined, { rawBody: raw, headers: {} })).rejects.toThrow();
    await expect(new WaveProvider(base).handleWebhook(JSON.parse(raw), undefined, { rawBody: raw, headers: {} })).rejects.toThrow();
  });
});
