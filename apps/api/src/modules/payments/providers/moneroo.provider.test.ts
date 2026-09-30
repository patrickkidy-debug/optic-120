import { afterEach, describe, expect, it, vi } from 'vitest';
import { MonerooProvider, monerooPhone } from './moneroo.provider.js';

describe('téléphone au format Moneroo', () => {
  it('donne un nombre, indicatif compris, sans + ni séparateurs', () => {
    expect(monerooPhone('+225 07 12 34 56 78')).toBe(2250712345678);
    expect(monerooPhone('+221 77-123.45.67')).toBe(221771234567);
    expect(monerooPhone('+33 (6) 12 34 56 78')).toBe(33612345678);
    expect(monerooPhone('00225 07 12 34 56 78')).toBe(2250712345678);
  });

  it('omet un numéro inexploitable plutôt que de faire échouer le paiement', () => {
    expect(monerooPhone(undefined)).toBeUndefined();
    expect(monerooPhone('')).toBeUndefined();
    expect(monerooPhone('12 34')).toBeUndefined();
    expect(monerooPhone('+1234567890123456789')).toBeUndefined();
  });
});

describe('initialisation Moneroo', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('envoie customer.phone comme un nombre', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: { id: 'py_1', checkout_url: 'https://checkout.moneroo.io/py_1' } }), { status: 201 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new MonerooProvider({ secretKey: 'sk_test', baseUrl: 'https://api.moneroo.test/v1' });
    const res = await provider.initiatePayment({
      paymentId: 'pay_1',
      amount: 12000,
      currency: 'XOF',
      method: 'WAVE' as never,
      customerName: 'Optique Lumière',
      customerPhone: '+225 07 12 34 56 78',
      customerEmail: 'awa@optique.ci',
      saleNumber: 'FAC-2026-000001',
    });

    expect(res.redirectUrl).toBe('https://checkout.moneroo.io/py_1');
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    const body = JSON.parse(init.body as string);
    expect(body.customer.phone).toBe(2250712345678);
    expect(typeof body.customer.phone).toBe('number');
  });
});
