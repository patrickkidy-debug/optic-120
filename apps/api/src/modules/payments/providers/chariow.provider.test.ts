import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ChariowProvider,
  mapChariowStatus,
  parseChariowProducts,
  splitName,
  splitPhone,
  verifyPulseSignature,
} from './chariow.provider.js';

const SECRET = 'whsec_test_123';
const sign = (raw: string) => `sha256=${createHmac('sha256', SECRET).update(raw, 'utf8').digest('hex')}`;

describe('téléphone au format Chariow', () => {
  it('sépare le pays et le numéro', () => {
    expect(splitPhone('+225 07 12 34 56')).toEqual({ country_code: 'CI', number: '07123456' });
    expect(splitPhone('+221 77 123 45 67')).toEqual({ country_code: 'SN', number: '771234567' });
    expect(splitPhone('+250 788 12 34 56')).toEqual({ country_code: 'RW', number: '788123456' });
    expect(splitPhone('+352 621 123 456')).toEqual({ country_code: 'LU', number: '621123456' });
  });
  it('refuse un numéro sans indicatif ou hors des pays desservis', () => {
    expect(splitPhone('0712345678')).toBeNull();
    expect(splitPhone('+49 151 2345 6789')).toBeNull();
    expect(splitPhone(undefined)).toBeNull();
  });
});

describe('nom au format Chariow', () => {
  it('coupe prénom et nom, toujours les deux remplis', () => {
    expect(splitName('Optique Lumière Abidjan')).toEqual({ first_name: 'Optique', last_name: 'Lumière Abidjan' });
    expect(splitName('Optima')).toEqual({ first_name: 'Optima', last_name: 'OculoSaaS' });
  });
});

describe('statuts', () => {
  it('seules les ventes terminées ou réglées valent paiement', () => {
    expect(mapChariowStatus('completed')).toBe('SUCCESS');
    expect(mapChariowStatus('settled')).toBe('SUCCESS');
    expect(mapChariowStatus('failed')).toBe('FAILED');
    expect(mapChariowStatus('abandoned')).toBe('CANCELLED');
    expect(mapChariowStatus('awaiting_payment')).toBe('PENDING');
    expect(mapChariowStatus('inconnu')).toBe('PENDING');
  });
});

describe('signature des Pulses', () => {
  // Corps tel que Chariow l'envoie : « / » échappés, unicode en \\uXXXX.
  const raw = '{"event":"successful.sale","sale":{"id":"sal_1","url":"https:\\/\\/x.com","name":"Optique Lumi\\u00e8re"}}';

  it('accepte la signature du corps brut', () => {
    expect(verifyPulseSignature(raw, sign(raw), SECRET)).toBe(true);
  });

  /** Le piège documenté par Chariow : ré-encoder le JSON change les octets. */
  it('refuse une signature calculée sur le JSON ré-encodé', () => {
    const reencoded = JSON.stringify(JSON.parse(raw));
    expect(reencoded).not.toBe(raw);
    expect(verifyPulseSignature(raw, sign(reencoded), SECRET)).toBe(false);
  });

  it('refuse une signature absente, fausse ou d’un autre secret', () => {
    expect(verifyPulseSignature(raw, undefined, SECRET)).toBe(false);
    expect(verifyPulseSignature(raw, 'sha256=00', SECRET)).toBe(false);
    expect(verifyPulseSignature(raw, sign(raw), 'whsec_autre')).toBe(false);
  });
});

describe('configuration des produits', () => {
  it('lit la correspondance offre -> produit', () => {
    expect(parseChariowProducts('{"STANDARD:1":"prd_a","GROWTH:6":"prd_b"}')).toEqual({ 'STANDARD:1': 'prd_a', 'GROWTH:6': 'prd_b' });
  });
  it('un JSON invalide donne une configuration vide, sans planter le serveur', () => {
    expect(parseChariowProducts('pas du json')).toEqual({});
    expect(parseChariowProducts('["prd_a"]')).toEqual({});
  });
});

describe('ouverture du paiement', () => {
  afterEach(() => vi.unstubAllGlobals());

  const provider = new ChariowProvider({
    apiKey: 'sk_test',
    baseUrl: 'https://api.chariow.test/v1',
    pulseSecret: SECRET,
    products: { 'STANDARD:1': 'prd_std_1' },
  });
  const input = {
    paymentId: 'pay_1',
    amount: 12000,
    currency: 'XOF',
    method: 'WAVE' as never,
    customerName: 'Optique Lumière',
    customerPhone: '+225 07 12 34 56',
    customerEmail: 'awa@optique.ci',
    saleNumber: 'FAC-2026-000001',
    returnUrl: 'https://oculosaas.com/activation/retour',
    productKey: 'STANDARD:1',
  };

  it('envoie le bon produit, le client et la référence du paiement', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ data: { step: 'payment', purchase: { id: 'sal_9', status: 'awaiting_payment' }, payment: { checkout_url: 'https://pay.chariow/x' } } }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await provider.initiatePayment(input);
    expect(res).toMatchObject({ providerRef: 'sal_9', status: 'PENDING', redirectUrl: 'https://pay.chariow/x' });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.chariow.test/v1/checkout');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk_test');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      product_id: 'prd_std_1',
      email: 'awa@optique.ci',
      first_name: 'Optique',
      last_name: 'Lumière',
      phone: { country_code: 'CI', number: '07123456' },
      redirect_url: 'https://oculosaas.com/activation/retour',
      custom_metadata: { payment_id: 'pay_1', invoice: 'FAC-2026-000001' },
    });
  });

  it('refuse une offre sans produit Chariow', async () => {
    await expect(provider.initiatePayment({ ...input, productKey: 'GROWTH:6' })).rejects.toThrow(/CHARIOW_PRODUCTS/);
  });

  it('refuse un numéro sans indicatif avant d’appeler Chariow', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(provider.initiatePayment({ ...input, customerPhone: '0712345678' })).rejects.toThrow(/indicatif/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /** Le cas qui bloquerait tout renouvellement : produit d'un type non rachetable. */
  it('explique le blocage « already_purchased »', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: { step: 'already_purchased' } }), { status: 200 })));
    await expect(provider.initiatePayment(input)).rejects.toThrow(/Licence/);
  });
});
