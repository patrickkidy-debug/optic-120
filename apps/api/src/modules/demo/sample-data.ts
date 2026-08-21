import { randomUUID } from 'node:crypto';
import {
  ProductCategory,
  SupplierType,
  Gender,
  SaleType,
  SaleStatus,
  PaymentMethod,
  PaymentStatus,
  StockMovementType,
} from '@oculo/shared-types';
import type { Prisma } from '@prisma/client';

/* ------------------------------ Générateurs ------------------------------ */

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(randInt(9, 18), randInt(0, 59), randInt(0, 59), 0);
  return d;
}

const FRAME_BRANDS = ['Ray-Ban', 'Oakley', 'Persol', 'Carrera', 'Prada', 'Gucci', 'Dolce & Gabbana', 'Police', 'Vogue', 'Fendi'];
const FRAME_MODELS = ['Aviator', 'Wayfarer', 'Clubmaster', 'Sport Pro', 'Élégance', 'Urban', 'Classic', 'Rétro', 'Slim', 'Bold'];
const LENS_TYPES = ['Unifocal Standard', 'Unifocal Anti-reflet', 'Progressif Confort', 'Progressif Premium', 'Anti-lumière bleue', 'Photochromique'];
const LENTILLE_TYPES = ['Journalières', 'Mensuelles', 'Toriques', 'Couleur', 'Souples'];
const ACCESSOIRE_ITEMS = ['Étui rigide', 'Étui souple', 'Chiffon microfibre', 'Spray nettoyant', 'Chaînette lunettes', 'Cordon sport'];
const ENTRETIEN_ITEMS = ['Solution lentilles 250ml', 'Solution lentilles 500ml', 'Sérum yeux secs', 'Lingettes nettoyantes'];

const FIRST_NAMES = [
  'Aminata', 'Mamadou', 'Fatou', 'Ibrahima', 'Aïssatou', 'Ousmane', 'Mariam', 'Cheikh', 'Awa', 'Moussa',
  'Khadija', 'Abdoulaye', 'Ndeye', 'Sekou', 'Bineta', 'Amadou', 'Adjoua', 'Kouassi', 'Akissi', 'Yao',
  'Konan', 'Affoué', 'Fatoumata', 'Boubacar', 'Rokhaya', 'Modou', 'Aya', 'Salimata', 'Issa', 'Djeneba',
];
const LAST_NAMES = [
  'Sow', 'Diallo', 'Ndiaye', 'Traoré', 'Koné', 'Kouassi', 'Bamba', 'Diarra', 'Cissé', 'Bah',
  'Fall', 'Gueye', 'Camara', 'Touré', 'Sylla', 'Konaté', 'Ouattara', 'Diop', 'Sarr', 'Kaba',
];
const DOCTOR_NAMES = ['Dr. Kouassi Yao', 'Dr. Aminata Diallo', 'Dr. Serge N\'Guessan'];

interface ProductSeed {
  id: string;
  sku: string;
  category: (typeof ProductCategory)[keyof typeof ProductCategory];
  brand: string | null;
  name: string;
  buyPrice: number;
  sellPrice: number;
  initialStock: number;
  minAlert: number;
}

function buildProducts(): ProductSeed[] {
  const products: ProductSeed[] = [];
  let seq = 0;

  const push = (
    category: ProductSeed['category'],
    brand: string | null,
    name: string,
    sellRange: [number, number],
    marginPct: number,
    stockRange: [number, number],
    minAlert: number,
  ) => {
    seq += 1;
    const sellPrice = Math.round(randInt(sellRange[0], sellRange[1]) / 500) * 500;
    const buyPrice = Math.round((sellPrice * marginPct) / 500) * 500;
    const prefix = { MONTURE: 'MON', VERRE: 'VER', LENTILLE: 'LEN', ACCESSOIRE: 'ACC', ENTRETIEN: 'ENT', SERVICE: 'SRV', AUTRE: 'AUT' }[category];
    products.push({
      id: randomUUID(),
      sku: `${prefix}-${String(seq).padStart(4, '0')}`,
      category,
      brand,
      name,
      buyPrice,
      sellPrice,
      initialStock: randInt(stockRange[0], stockRange[1]),
      minAlert,
    });
  };

  // Montures (55, dont solaires)
  for (let i = 0; i < 55; i++) {
    const brand = pick(FRAME_BRANDS);
    const model = pick(FRAME_MODELS);
    const sun = i % 4 === 0;
    push(ProductCategory.MONTURE, brand, `${model}${sun ? ' Solaire' : ''}`, [18000, 220000], 0.58, [5, 30], 5);
  }
  // Verres (30)
  for (let i = 0; i < 30; i++) {
    push(ProductCategory.VERRE, null, pick(LENS_TYPES), [8000, 75000], 0.55, [5, 25], 4);
  }
  // Lentilles (15)
  for (let i = 0; i < 15; i++) {
    push(ProductCategory.LENTILLE, pick(['Acuvue', 'Biofinity', 'Air Optix']), pick(LENTILLE_TYPES), [5000, 25000], 0.6, [8, 30], 5);
  }
  // Accessoires (20)
  for (let i = 0; i < 20; i++) {
    push(ProductCategory.ACCESSOIRE, null, pick(ACCESSOIRE_ITEMS), [1000, 15000], 0.5, [10, 60], 8);
  }
  // Entretien (10)
  for (let i = 0; i < 10; i++) {
    push(ProductCategory.ENTRETIEN, null, pick(ENTRETIEN_ITEMS), [2000, 8000], 0.55, [10, 60], 8);
  }
  return products;
}

interface CustomerSeed {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  dateOfBirth: Date | null;
  gender: (typeof Gender)[keyof typeof Gender] | null;
}

function buildCustomers(count: number): CustomerSeed[] {
  const out: CustomerSeed[] = [];
  for (let i = 0; i < count; i++) {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const countryCode = pick(['+225', '+221']);
    const gender = Math.random() < 0.5 ? Gender.MALE : Gender.FEMALE;
    out.push({
      id: randomUUID(),
      firstName,
      lastName,
      phone: `${countryCode}0${randInt(1, 7)}${String(randInt(0, 9999999)).padStart(7, '0')}`,
      email: Math.random() < 0.4 ? `${firstName}.${lastName}@example.com`.toLowerCase() : null,
      dateOfBirth: Math.random() < 0.6 ? daysAgo(randInt(365 * 18, 365 * 70)) : null,
      gender: Math.random() < 0.85 ? gender : null,
    });
  }
  return out;
}

export interface SampleDataManifest {
  supplierIds: string[];
  productIds: string[];
  customerIds: string[];
  prescriptionIds: string[];
  saleIds: string[];
  saleItemIds: string[];
  paymentIds: string[];
  stockItemIds: string[];
  stockMovementIds: string[];
}

/**
 * Remplit un établissement (démo ou compte réel fraîchement inscrit) avec des
 * produits, un stock (dont ruptures/stock faible), des clients, des
 * ordonnances, des ventes et des paiements factices cohérents entre eux.
 * Retourne l'identifiant de chaque ligne créée : un compte réel peut mélanger
 * ces données d'exemple avec ses propres vraies données pendant la visite
 * guidée, la purge doit donc pouvoir cibler précisément ce qui a été semé ici
 * — jamais par simple tenantId (voir `purgeSampleData` dans demo.service.ts).
 */
export async function seedSampleBusinessData(
  tx: Prisma.TransactionClient,
  tenantId: string,
  branchId: string,
  cashierId: string,
): Promise<SampleDataManifest> {
  /* --- Fournisseurs --- */
  const suppliers = [
    { id: randomUUID(), name: 'Essilor Afrique', type: SupplierType.INTERNATIONAL, contactName: 'Jean-Marc Kouadio', phone: '+2250759112233' },
    { id: randomUUID(), name: 'Optic 2000 Distribution', type: SupplierType.LOCAL, contactName: 'Solange Aka', phone: '+2250161223344' },
    { id: randomUUID(), name: 'Luxottica West Africa', type: SupplierType.INTERNATIONAL, contactName: "Paul N'Guessan", phone: '+2250709887766' },
    { id: randomUUID(), name: 'Verres & Co Abidjan', type: SupplierType.LOCAL, contactName: 'Chantal Yao', phone: '+2250505443322' },
  ];
  await tx.supplier.createMany({
    data: suppliers.map((s) => ({
      id: s.id,
      tenantId,
      name: s.name,
      type: s.type,
      contactName: s.contactName,
      phone: s.phone,
    })),
  });

  /* --- Produits + stock initial --- */
  const products = buildProducts();
  await tx.product.createMany({
    data: products.map((p) => ({
      id: p.id,
      tenantId,
      sku: p.sku,
      category: p.category,
      brand: p.brand,
      name: p.name,
      buyPrice: p.buyPrice,
      sellPrice: p.sellPrice,
      isActive: true,
    })),
  });

  const receivedAt = daysAgo(55);

  /* --- Clients --- */
  const customers = buildCustomers(40);
  await tx.customer.createMany({
    data: customers.map((c) => ({
      id: c.id,
      tenantId,
      firstName: c.firstName,
      lastName: c.lastName,
      phone: c.phone,
      email: c.email,
      dateOfBirth: c.dateOfBirth,
      gender: c.gender,
      loyaltyPoints: randInt(0, 200),
    })),
  });

  /* --- Ordonnances (pour ~15 clients) --- */
  const prescribedCustomers = [...customers].sort(() => Math.random() - 0.5).slice(0, 15);
  const prescriptionIds = prescribedCustomers.map(() => randomUUID());
  await tx.opticalPrescription.createMany({
    data: prescribedCustomers.map((c, i) => {
      const sphereOptions = [-6, -4.5, -3, -1.5, -0.75, 0, 0.75, 1.5, 2.5, 4];
      return {
        id: prescriptionIds[i],
        tenantId,
        customerId: c.id,
        date: daysAgo(randInt(10, 300)),
        prescriberName: pick(DOCTOR_NAMES),
        odSphere: String(pick(sphereOptions)),
        odCylinder: String(-randInt(0, 2)),
        odAxis: String(randInt(0, 180)),
        ogSphere: String(pick(sphereOptions)),
        ogCylinder: String(-randInt(0, 2)),
        ogAxis: String(randInt(0, 180)),
        pupillaryDistance: String(randInt(58, 66)),
        expiresAt: new Date(Date.now() + 18 * 30 * 24 * 60 * 60 * 1000),
      };
    }),
  });

  /* --- Ventes + articles + paiements + mouvements de stock --- */
  const sold = new Map<string, number>(); // productId -> quantité vendue
  const frameLike = products.filter((p) => p.category === ProductCategory.MONTURE);
  const lensLike = products.filter((p) => p.category === ProductCategory.VERRE);
  const otherLike = products.filter((p) => p.category === ProductCategory.LENTILLE || p.category === ProductCategory.ACCESSOIRE || p.category === ProductCategory.ENTRETIEN);

  const saleRows: Prisma.SaleCreateManyInput[] = [];
  const saleItemRows: Prisma.SaleItemCreateManyInput[] = [];
  const paymentRows: Prisma.PaymentCreateManyInput[] = [];
  const saleOutMovements: Prisma.StockMovementCreateManyInput[] = [];

  const year = new Date().getFullYear();
  const methods = [PaymentMethod.CASH, PaymentMethod.WAVE, PaymentMethod.ORANGE_MONEY, PaymentMethod.CARD, PaymentMethod.MTN_MOMO];

  function takeQty(p: ProductSeed, want: number): number {
    const already = sold.get(p.id) ?? 0;
    const available = Math.max(0, p.initialStock - already);
    const qty = Math.min(want, available);
    if (qty > 0) sold.set(p.id, already + qty);
    return qty;
  }

  for (let i = 0; i < 60; i++) {
    const saleId = randomUUID();
    const createdAt = daysAgo(randInt(0, 45));
    const items: { productId: string; quantity: number; unitPrice: number; lineTotal: number }[] = [];

    // Article principal : une monture (le plus souvent), parfois un verre/lentille/accessoire seul.
    const primary = Math.random() < 0.7 && frameLike.length ? pick(frameLike) : pick([...lensLike, ...otherLike]);
    const primaryQty = takeQty(primary, 1);
    if (primaryQty > 0) {
      items.push({ productId: primary.id, quantity: primaryQty, unitPrice: primary.sellPrice, lineTotal: primary.sellPrice * primaryQty });
    }
    // Article secondaire (verres assortis à la monture) dans ~55% des ventes.
    if (Math.random() < 0.55 && lensLike.length) {
      const secondary = pick(lensLike);
      const qty = takeQty(secondary, 1);
      if (qty > 0) items.push({ productId: secondary.id, quantity: qty, unitPrice: secondary.sellPrice, lineTotal: secondary.sellPrice * qty });
    }
    if (items.length === 0) continue; // stock épuisé pour les tirages du jour : on saute cette vente

    const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);
    const taxAmount = Math.round(subtotal * 0.18);
    const totalAmount = subtotal + taxAmount;
    const partial = Math.random() < 0.15;
    const paidAmount = partial ? Math.round(totalAmount * 0.5) : totalAmount;
    const customer = Math.random() < 0.7 ? pick(customers) : null;
    const method = pick(methods);

    saleRows.push({
      id: saleId,
      tenantId,
      branchId,
      customerId: customer?.id ?? null,
      cashierId,
      number: `VEN-${year}-${String(i + 1).padStart(6, '0')}`,
      type: SaleType.SALE,
      status: partial ? SaleStatus.PARTIALLY_PAID : SaleStatus.PAID,
      subtotal,
      discountAmount: 0,
      taxAmount,
      insuranceAmount: 0,
      totalAmount,
      paidAmount,
      currency: 'XOF',
      createdAt,
      updatedAt: createdAt,
    });

    for (const it of items) {
      saleItemRows.push({
        id: randomUUID(),
        saleId,
        productId: it.productId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        lineTotal: it.lineTotal,
      });
      saleOutMovements.push({
        id: randomUUID(),
        tenantId,
        stockItemId: it.productId, // remplacé par le vrai stockItemId juste après (map productId -> stockItemId)
        type: StockMovementType.SALE_OUT,
        quantity: -it.quantity,
        reason: 'Vente',
        saleId,
        createdAt,
      });
    }

    paymentRows.push({
      id: randomUUID(),
      tenantId,
      saleId,
      method,
      provider: 'manual',
      providerRef: `DEMO-${saleId.slice(0, 8)}`,
      status: PaymentStatus.SUCCESS,
      amount: paidAmount,
      currency: 'XOF',
      createdAt,
      updatedAt: createdAt,
    });
  }

  /* --- StockItem (quantité finale = stock initial − vendu), avec quelques
         ruptures et stocks faibles forcés pour que la visite les montre. --- */
  const stockItemIdByProduct = new Map<string, string>();
  const stockItemRows: Prisma.StockItemCreateManyInput[] = products.map((p) => {
    const id = randomUUID();
    stockItemIdByProduct.set(p.id, id);
    const soldQty = sold.get(p.id) ?? 0;
    return {
      id,
      tenantId,
      productId: p.id,
      branchId,
      quantity: Math.max(0, p.initialStock - soldQty),
      minAlert: p.minAlert,
    };
  });

  // Force quelques ruptures et stocks faibles, indépendamment du hasard des ventes.
  const shuffled = [...stockItemRows].sort(() => Math.random() - 0.5);
  shuffled.slice(0, 8).forEach((row) => { row.quantity = 0; });
  shuffled.slice(8, 20).forEach((row) => {
    const p = products.find((pr) => stockItemIdByProduct.get(pr.id) === row.id);
    row.quantity = randInt(1, Math.max(1, (p?.minAlert ?? 5) - 1));
  });

  await tx.stockItem.createMany({ data: stockItemRows });

  // Mouvement de réception initiale (avant toute vente).
  const purchaseInMovements: Prisma.StockMovementCreateManyInput[] = products.map((p) => ({
    id: randomUUID(),
    tenantId,
    stockItemId: stockItemIdByProduct.get(p.id)!,
    type: StockMovementType.PURCHASE_IN,
    quantity: p.initialStock,
    reason: 'Réception initiale',
    supplierId: pick(suppliers).id,
    unitCost: p.buyPrice,
    createdAt: receivedAt,
  }));
  await tx.stockMovement.createMany({ data: purchaseInMovements });

  // Corrige les mouvements de sortie (stockItemId était temporairement le productId).
  for (const m of saleOutMovements) {
    m.stockItemId = stockItemIdByProduct.get(m.stockItemId as string)!;
  }
  if (saleOutMovements.length > 0) await tx.stockMovement.createMany({ data: saleOutMovements });

  if (saleRows.length > 0) await tx.sale.createMany({ data: saleRows });
  if (saleItemRows.length > 0) await tx.saleItem.createMany({ data: saleItemRows });
  if (paymentRows.length > 0) await tx.payment.createMany({ data: paymentRows });

  return {
    supplierIds: suppliers.map((s) => s.id),
    productIds: products.map((p) => p.id),
    customerIds: customers.map((c) => c.id),
    prescriptionIds,
    saleIds: saleRows.map((s) => s.id as string),
    saleItemIds: saleItemRows.map((s) => s.id as string),
    paymentIds: paymentRows.map((p) => p.id as string),
    stockItemIds: stockItemRows.map((s) => s.id as string),
    stockMovementIds: [...purchaseInMovements, ...saleOutMovements].map((m) => m.id as string),
  };
}
