import { afterEach, describe, expect, it, vi } from 'vitest';
import { KkiapayProvider, KKIAPAY_LIVE_URL, KKIAPAY_SANDBOX_URL, kkiapayStatus } from './kkiapay.provider.js';

const cfg = {
  publicKey: 'pub_abc',
  privateKey: 'tpk_priv',
  secretKey: 'tsk_secret',
  sandbox: true,
  webhookSecret: 'hash_secret_123',
  checkoutPageUrl: 'https://app.oculosaas.com/paiement/kkiapay',
  returnUrl: 'https://app.oculosaas.com/parametres/abonnement',
};

const input = {
  paymentId: 'cmpay123',
  amount: 25000.4,
  currency: 'XOF',
  method: 'ORANGE_MONEY' as never,
  customerName: 'Optique Lumière',
  customerEmail: 'gerant@optique.test',
  saleNumber: 'FAC-2026-000003',
};

describe('statut KkiaPay', () => {
  it('ne crédite que sur SUCCESS, jamais sur un statut inconnu', () => {
    expect(kkiapayStatus('SUCCESS')).toBe('SUCCESS');
    expect(kkiapayStatus('success')).toBe('SUCCESS');
    expect(kkiapayStatus('FAILED')).toBe('FAILED');
    expect(kkiapayStatus('INSUFFICIENT_FUND')).toBe('FAILED');
    expect(kkiapayStatus('TRANSACTION_NOT_FOUND')).toBe('PENDING');
    expect(kkiapayStatus('PENDING')).toBe('PENDING');
    expect(kkiapayStatus(undefined)).toBe('PENDING');
  });
});

describe('lancement KkiaPay', () => {
  it('renvoie vers notre page widget avec paiement, montant entier, clé publique et retour', async () => {
    const res = await new KkiapayProvider(cfg).initiatePayment({
      ...input,
      returnUrl: 'https://app.oculosaas.com/activation/retour?session=t',
    });
    expect(res.status).toBe('PENDING');
    expect(res.providerRef).toBe('cmpay123');
    const url = new URL(res.redirectUrl!);
    expect(url.origin + url.pathname).toBe(cfg.checkoutPageUrl);
    expect(url.searchParams.get('p')).toBe('cmpay123');
    expect(url.searchParams.get('a')).toBe('25000');
    expect(url.searchParams.get('k')).toBe('pub_abc');
    expect(url.searchParams.get('sb')).toBe('1');
    expect(url.searchParams.get('r')).toBe('https://app.oculosaas.com/activation/retour?session=t');
    // Jamais de clé privée ou secrète dans l'URL envoyée au navigateur.
    expect(res.redirectUrl).not.toContain('tpk_priv');
    expect(res.redirectUrl).not.toContain('tsk_secret');
  });

  it('refuse une autre devise que le XOF', async () => {
    await expect(new KkiapayProvider(cfg).initiatePayment({ ...input, currency: 'EUR' })).rejects.toThrow(/XOF/);
  });
});

describe('vérification KkiaPay', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('interroge la sandbox avec les trois clés et lit le statut', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      new Response(JSON.stringify({ transactionId: 'tx_1', status: 'SUCCESS', amount: 25000, partnerId: 'cmpay123' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const v = await new KkiapayProvider(cfg).verifyPayment('tx_1');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${KKIAPAY_SANDBOX_URL}/api/v1/transactions/status`);
    const h = init.headers as Record<string, string>;
    expect(h['x-api-key']).toBe('pub_abc');
    expect(h['x-private-key']).toBe('tpk_priv');
    expect(h['x-secret-key']).toBe('tsk_secret');
    expect(JSON.parse(String(init.body))).toEqual({ transactionId: 'tx_1' });
    expect(v.status).toBe('SUCCESS');
  });

  it('vise la production hors sandbox', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify({ status: 'SUCCESS' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await new KkiapayProvider({ ...cfg, sandbox: false }).verifyPayment('tx_1');
    expect(fetchMock.mock.calls[0]![0]).toBe(`${KKIAPAY_LIVE_URL}/api/v1/transactions/status`);
  });

  it('reste en attente sur une erreur HTTP ou réseau', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ status: 'TRANSACTION_NOT_FOUND' }), { status: 400 })));
    expect((await new KkiapayProvider(cfg).verifyPayment('tx_x')).status).toBe('PENDING');
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect((await new KkiapayProvider(cfg).verifyPayment('tx_x')).status).toBe('PENDING');
  });
});

describe('webhook KkiaPay', () => {
  const provider = new KkiapayProvider(cfg);
  const body = { transactionId: 'tx_1', isPaymentSucces: true, event: 'transaction.success', partnerId: 'cmpay123', amount: 25000 };

  it('accepte le bon secret', async () => {
    const r = await provider.handleWebhook(body, undefined, { headers: { 'x-kkiapay-secret': 'hash_secret_123' } });
    expect(r).toMatchObject({ providerRef: 'tx_1', status: 'SUCCESS' });
  });

  it('refuse un secret faux, absent, ou un serveur sans secret configuré', async () => {
    await expect(provider.handleWebhook(body, undefined, { headers: { 'x-kkiapay-secret': 'autre' } })).rejects.toThrow();
    await expect(provider.handleWebhook(body, undefined, { headers: {} })).rejects.toThrow();
    await expect(
      new KkiapayProvider({ ...cfg, webhookSecret: undefined }).handleWebhook(body, undefined, { headers: { 'x-kkiapay-secret': 'x' } }),
    ).rejects.toThrow();
  });

  it('lit un échec comme FAILED', async () => {
    const r = await provider.handleWebhook(
      { transactionId: 'tx_2', isPaymentSucces: false, event: 'transaction.failed' },
      undefined,
      { headers: { 'x-kkiapay-secret': 'hash_secret_123' } },
    );
    expect(r.status).toBe('FAILED');
  });
});
