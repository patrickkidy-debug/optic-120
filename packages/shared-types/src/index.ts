import { z } from 'zod';

/* ============================================================
 * ENUMS — doivent rester synchronisés avec schema.prisma
 * ============================================================ */

export const ProductCategory = {
  MONTURE: 'MONTURE',
  VERRE: 'VERRE',
  LENTILLE: 'LENTILLE',
  ACCESSOIRE: 'ACCESSOIRE',
  /** Sprays, lingettes, solutions pour lentilles... */
  ENTRETIEN: 'ENTRETIEN',
  SERVICE: 'SERVICE',
  /** Divers, hors des familles ci-dessus. */
  AUTRE: 'AUTRE',
} as const;
export type ProductCategory = (typeof ProductCategory)[keyof typeof ProductCategory];

export const StockMovementType = {
  PURCHASE_IN: 'PURCHASE_IN',
  SALE_OUT: 'SALE_OUT',
  ADJUSTMENT: 'ADJUSTMENT',
  RETURN_IN: 'RETURN_IN',
  TRANSFER: 'TRANSFER',
} as const;
export type StockMovementType = (typeof StockMovementType)[keyof typeof StockMovementType];

export const SaleType = {
  QUOTE: 'QUOTE',
  SALE: 'SALE',
  RETURN: 'RETURN',
} as const;
export type SaleType = (typeof SaleType)[keyof typeof SaleType];

export const SaleStatus = {
  DRAFT: 'DRAFT',
  CONFIRMED: 'CONFIRMED',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
} as const;
export type SaleStatus = (typeof SaleStatus)[keyof typeof SaleStatus];

export const PaymentMethod = {
  CASH: 'CASH',
  WAVE: 'WAVE',
  ORANGE_MONEY: 'ORANGE_MONEY',
  MTN_MOMO: 'MTN_MOMO',
  MOOV_MONEY: 'MOOV_MONEY',
  FREE_MONEY: 'FREE_MONEY',
  CARD: 'CARD',
  // Marchés lusophones (encaissement manuel au comptoir, comme les autres).
  MPESA: 'MPESA', // Mozambique (Vodacom)
  EMOLA: 'EMOLA', // Mozambique (Movitel)
  MKESH: 'MKESH', // Mozambique (Tmcel)
  MULTICAIXA: 'MULTICAIXA', // Angola (Multicaixa Express)
  UNITEL_MONEY: 'UNITEL_MONEY', // Angola
  VINTI4: 'VINTI4', // Cap-Vert
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

/** Méthodes Mobile Money qui passent par un provider (CinetPay) plutôt qu'un encaissement manuel. */
export const MOBILE_MONEY_METHODS: PaymentMethod[] = [
  PaymentMethod.WAVE,
  PaymentMethod.ORANGE_MONEY,
  PaymentMethod.MTN_MOMO,
  PaymentMethod.MOOV_MONEY,
  PaymentMethod.FREE_MONEY,
];

/**
 * Moyens d'encaissement proposés en caisse selon le pays de l'établissement.
 * Évite qu'un caissier de Dakar voie « M-Pesa » ou qu'un caissier de Maputo
 * voie « Wave ». Espèces et carte sont proposées partout.
 */
export const PAYMENT_METHODS_BY_COUNTRY: Record<string, PaymentMethod[]> = {
  MZ: [PaymentMethod.MPESA, PaymentMethod.EMOLA, PaymentMethod.MKESH],
  AO: [PaymentMethod.MULTICAIXA, PaymentMethod.UNITEL_MONEY],
  CV: [PaymentMethod.VINTI4],
};

/** Moyens proposés par défaut (Afrique de l'Ouest francophone). */
export const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  PaymentMethod.WAVE,
  PaymentMethod.ORANGE_MONEY,
  PaymentMethod.MTN_MOMO,
  PaymentMethod.MOOV_MONEY,
  PaymentMethod.FREE_MONEY,
];

/** Liste finale (hors espèces/carte) pour un pays donné. */
export function paymentMethodsForCountry(countryCode?: string | null): PaymentMethod[] {
  if (countryCode && PAYMENT_METHODS_BY_COUNTRY[countryCode]) {
    return PAYMENT_METHODS_BY_COUNTRY[countryCode];
  }
  return DEFAULT_PAYMENT_METHODS;
}

export const PaymentStatus = {
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const TenantStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  TRIAL: 'TRIAL',
} as const;
export type TenantStatus = (typeof TenantStatus)[keyof typeof TenantStatus];

export const CashRegisterStatus = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
} as const;
export type CashRegisterStatus = (typeof CashRegisterStatus)[keyof typeof CashRegisterStatus];

/* --- Clinique & gestion (Phase 2) --- */

export const Gender = { MALE: 'MALE', FEMALE: 'FEMALE', OTHER: 'OTHER' } as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

export const Eye = { OD: 'OD', OG: 'OG', OU: 'OU' } as const;
export type Eye = (typeof Eye)[keyof typeof Eye];

export const AppointmentStatus = {
  SCHEDULED: 'SCHEDULED',
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW',
} as const;
export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus];

export const SurgeryStatus = {
  PLANNED: 'PLANNED',
  DONE: 'DONE',
  CANCELLED: 'CANCELLED',
} as const;
export type SurgeryStatus = (typeof SurgeryStatus)[keyof typeof SurgeryStatus];

export const EmployeeStatus = {
  ACTIVE: 'ACTIVE',
  ON_LEAVE: 'ON_LEAVE',
  TERMINATED: 'TERMINATED',
} as const;
export type EmployeeStatus = (typeof EmployeeStatus)[keyof typeof EmployeeStatus];

export const ExpenseCategory = {
  RENT: 'RENT',
  SALARIES: 'SALARIES',
  ELECTRICITY: 'ELECTRICITY',
  WATER: 'WATER',
  INTERNET: 'INTERNET',
  MARKETING: 'MARKETING',
  TRANSPORT: 'TRANSPORT',
  SUPPLIES: 'SUPPLIES',
  MAINTENANCE: 'MAINTENANCE',
  TAXES: 'TAXES',
  OTHER: 'OTHER',
} as const;
export type ExpenseCategory = (typeof ExpenseCategory)[keyof typeof ExpenseCategory];

export const SupplierType = { LOCAL: 'LOCAL', INTERNATIONAL: 'INTERNATIONAL' } as const;
export type SupplierType = (typeof SupplierType)[keyof typeof SupplierType];

export const InsurerType = {
  HEALTH_INSURANCE: 'HEALTH_INSURANCE',
  MUTUAL: 'MUTUAL',
  PRIVATE: 'PRIVATE',
  THIRD_PARTY: 'THIRD_PARTY',
} as const;
export type InsurerType = (typeof InsurerType)[keyof typeof InsurerType];

/* --- Abonnements SaaS --- */

export const SubscriptionStatus = {
  TRIALING: 'TRIALING',
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  SUSPENDED: 'SUSPENDED',
  CANCELLED: 'CANCELLED',
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const SubInvoiceStatus = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  VOID: 'VOID',
} as const;
export type SubInvoiceStatus = (typeof SubInvoiceStatus)[keyof typeof SubInvoiceStatus];

/** Catalogue des offres — source de vérité pour le seed et l'affichage. Pas d'essai gratuit : toutes les offres sont payantes dès l'inscription. */
export interface PlanDef {
  code: 'STARTER' | 'STANDARD' | 'GROWTH';
  name: string;
  description: string;
  priceMonthly: number;
  /** Conservé pour compat schéma (toujours 0 : plus d'essai). */
  trialDays: number;
  maxUsers: number | null; // null = illimité
  maxBranches: number | null;
  maxPatients: number | null;
  maxSales: number | null;
  features: string[];
  sortOrder: number;
}

export const PLAN_CATALOG: PlanDef[] = [
  {
    code: 'STARTER',
    name: 'Starter',
    description: "Toutes les fonctionnalités essentielles pour démarrer, jusqu'à 2 magasins.",
    priceMonthly: 7500,
    trialDays: 0,
    maxUsers: null,
    maxBranches: 2,
    maxPatients: null,
    maxSales: null,
    features: [
      "Jusqu'à 2 magasins",
      'Utilisateurs illimités',
      'Assurances',
      'Encaissement & paiements',
      'Rôles & permissions',
      'Rapports',
      'Gestion des stocks (inventaire)',
      'Support standard',
    ],
    sortOrder: 1,
  },
  {
    code: 'STANDARD',
    name: 'Standard',
    description: "Gestion complète d'une optique ou clinique, jusqu'à 10 magasins.",
    priceMonthly: 12000,
    trialDays: 0,
    maxUsers: null,
    maxBranches: 10,
    maxPatients: null,
    maxSales: null,
    features: [
      "Jusqu'à 10 magasins",
      'Utilisateurs illimités',
      'Tout Starter, en plus grand',
      'Gestion des stocks, patients et ventes',
      'Tableau de bord complet',
      'Support prioritaire',
    ],
    sortOrder: 2,
  },
  {
    code: 'GROWTH',
    name: 'Growth',
    description: 'Toutes les fonctionnalités, multi-agences et utilisateurs illimités.',
    priceMonthly: 23000,
    trialDays: 0,
    maxUsers: null,
    maxBranches: null,
    maxPatients: null,
    maxSales: null,
    features: [
      'Magasins illimités',
      'Utilisateurs illimités',
      'Multi-agences',
      'Gestion financière et RH avancées',
      'Rapports et statistiques avancés',
      'Sauvegardes renforcées',
      'Support premium',
    ],
    sortOrder: 3,
  },
];

/** Offre présélectionnée par défaut après la création d'un compte. */
export const DEFAULT_PLAN_CODE = 'STARTER';

/**
 * Tarif mensuel par devise. `priceMonthly` d'un PlanDef reste la référence en
 * XOF ; cette table donne le prix affiché et facturé dans les autres devises.
 *
 * ⚠️ Montants INDICATIFS, alignés en ordre de grandeur sur le tarif XOF. Le
 * kwanza et le metical fluctuent : à revoir avant toute campagne commerciale.
 * Une devise absente de cette table retombe sur le tarif XOF.
 */
export const PLAN_PRICES: Record<string, Partial<Record<SupportedCurrency, number>>> = {
  STARTER: { XOF: 7500, XAF: 7500, CVE: 1250, AOA: 12000, MZN: 800 },
  STANDARD: { XOF: 12000, XAF: 12000, CVE: 2000, AOA: 20000, MZN: 1250 },
  GROWTH: { XOF: 23000, XAF: 23000, CVE: 3900, AOA: 38000, MZN: 2400 },
};

/** Prix mensuel d'une offre dans la devise de l'établissement. */
export function planPrice(planCode: string, currency: string): number {
  const row = PLAN_PRICES[planCode];
  const fallback = PLAN_CATALOG.find((p) => p.code === planCode)?.priceMonthly ?? 0;
  if (!row) return fallback;
  return row[currency as SupportedCurrency] ?? fallback;
}

/** Cycle de facturation choisi par le client : mensuel, ou 6 mois payés en une fois. */
export const BillingCycle = {
  MONTHLY: 'MONTHLY',
  SEMIANNUAL: 'SEMIANNUAL',
} as const;
export type BillingCycle = (typeof BillingCycle)[keyof typeof BillingCycle];

/** Nombre de mois couverts par chaque cycle de facturation. */
export const BILLING_CYCLE_MONTHS: Record<BillingCycle, number> = {
  MONTHLY: 1,
  SEMIANNUAL: 6,
};

/** Remise accordée au paiement groupé 6 mois (payé en une seule fois). */
export const SEMIANNUAL_DISCOUNT = 0.1;

/**
 * Montant total facturé pour un cycle donné : mensuel = tarif normal ;
 * 6 mois = 6 × le tarif mensuel, moins 10 % (paiement anticipé).
 */
export function planPriceForCycle(planCode: string, currency: string, cycle: BillingCycle): number {
  const monthly = planPrice(planCode, currency);
  const months = BILLING_CYCLE_MONTHS[cycle];
  const total = monthly * months;
  return cycle === 'SEMIANNUAL' ? Math.round(total * (1 - SEMIANNUAL_DISCOUNT)) : total;
}

/* ============================================================
 * RÔLES SYSTÈME (12) — seedés comme templates globaux (tenantId = null)
 * ============================================================ */

export interface SystemRoleDef {
  code: string;
  label: string;
  /** Accès à toutes les succursales du tenant sans restriction UserBranch. */
  allBranches: boolean;
  /** Rôle réservé à l'éditeur de la plateforme (cross-tenant). */
  platform?: boolean;
}

export const SYSTEM_ROLES: SystemRoleDef[] = [
  { code: 'super_admin', label: 'Super administrateur', allBranches: true, platform: true },
  { code: 'admin', label: 'Administrateur', allBranches: true },
  { code: 'gestionnaire', label: 'Gestionnaire', allBranches: true },
  { code: 'opticien', label: 'Opticien', allBranches: false },
  { code: 'ophtalmologue', label: 'Ophtalmologue', allBranches: false },
  { code: 'orthoptiste', label: 'Orthoptiste', allBranches: false },
  { code: 'secretaire', label: 'Secrétaire', allBranches: false },
  { code: 'receptionniste', label: 'Réceptionniste', allBranches: false },
  { code: 'caissier', label: 'Caissier', allBranches: false },
  { code: 'responsable_stocks', label: 'Responsable des stocks', allBranches: true },
  { code: 'comptable', label: 'Comptable', allBranches: true },
  { code: 'commercial', label: 'Commercial', allBranches: false },
];

/* ============================================================
 * CATALOGUE DE PERMISSIONS (module.action)
 * ============================================================ */

export interface PermissionDef {
  module: string;
  action: string;
  label: string;
}

export const PERMISSIONS: PermissionDef[] = [
  { module: 'dashboard', action: 'view', label: 'Voir le tableau de bord' },

  { module: 'optique.products', action: 'view', label: 'Voir les produits' },
  { module: 'optique.products', action: 'create', label: 'Créer des produits' },
  { module: 'optique.products', action: 'update', label: 'Modifier des produits' },
  { module: 'optique.products', action: 'delete', label: 'Supprimer des produits' },

  { module: 'optique.stock', action: 'view', label: 'Voir le stock' },
  { module: 'optique.stock', action: 'adjust', label: 'Ajuster le stock' },
  { module: 'optique.stock', action: 'transfer', label: 'Transférer du stock' },

  { module: 'optique.sales', action: 'view', label: 'Voir les ventes' },
  { module: 'optique.sales', action: 'create', label: 'Créer des ventes' },
  { module: 'optique.sales', action: 'update', label: 'Modifier des ventes' },
  { module: 'optique.sales', action: 'cancel', label: 'Annuler des ventes' },
  { module: 'optique.sales', action: 'refund', label: 'Rembourser des ventes' },

  { module: 'optique.quotes', action: 'view', label: 'Voir les devis' },
  { module: 'optique.quotes', action: 'create', label: 'Créer des devis' },
  { module: 'optique.quotes', action: 'convert', label: 'Convertir un devis en vente' },

  { module: 'optique.cashregister', action: 'view', label: 'Voir les caisses' },
  { module: 'optique.cashregister', action: 'open', label: 'Ouvrir une caisse' },
  { module: 'optique.cashregister', action: 'close', label: 'Fermer une caisse' },

  { module: 'optique.customers', action: 'view', label: 'Voir les clients' },
  { module: 'optique.customers', action: 'create', label: 'Créer des clients' },
  { module: 'optique.customers', action: 'update', label: 'Modifier des clients' },

  { module: 'optique.prescriptions', action: 'view', label: 'Voir les ordonnances' },
  { module: 'optique.prescriptions', action: 'create', label: 'Créer des ordonnances' },

  { module: 'rbac.roles', action: 'view', label: 'Voir les rôles' },
  { module: 'rbac.roles', action: 'create', label: 'Créer des rôles' },
  { module: 'rbac.roles', action: 'update', label: 'Modifier des rôles' },
  { module: 'rbac.roles', action: 'delete', label: 'Supprimer des rôles' },

  { module: 'rbac.users', action: 'view', label: 'Voir les utilisateurs' },
  { module: 'rbac.users', action: 'create', label: 'Créer des utilisateurs' },
  { module: 'rbac.users', action: 'update', label: 'Modifier des utilisateurs' },
  { module: 'rbac.users', action: 'deactivate', label: 'Désactiver des utilisateurs' },

  { module: 'settings.branches', action: 'view', label: 'Voir les magasins' },
  { module: 'settings.branches', action: 'create', label: 'Créer des magasins' },
  { module: 'settings.branches', action: 'update', label: 'Modifier des magasins' },

  { module: 'settings.payments', action: 'view', label: 'Voir la configuration des paiements' },
  { module: 'settings.payments', action: 'update', label: 'Modifier la configuration des paiements' },

  { module: 'audit.logs', action: 'view', label: "Voir le journal d'activité" },

  // --- Clinique ---
  { module: 'clinic.patients', action: 'view', label: 'Voir les patients' },
  { module: 'clinic.patients', action: 'create', label: 'Créer des patients' },
  { module: 'clinic.patients', action: 'update', label: 'Modifier des patients' },
  { module: 'clinic.patients', action: 'delete', label: 'Supprimer des patients' },

  { module: 'clinic.consultations', action: 'view', label: 'Voir les consultations' },
  { module: 'clinic.consultations', action: 'create', label: 'Créer des consultations' },

  { module: 'clinic.appointments', action: 'view', label: 'Voir les rendez-vous' },
  { module: 'clinic.appointments', action: 'create', label: 'Créer des rendez-vous' },
  { module: 'clinic.appointments', action: 'update', label: 'Modifier des rendez-vous' },

  { module: 'clinic.surgeries', action: 'view', label: 'Voir les chirurgies' },
  { module: 'clinic.surgeries', action: 'create', label: 'Planifier des chirurgies' },
  { module: 'clinic.surgeries', action: 'update', label: 'Modifier des chirurgies' },

  // --- Gestion ---
  { module: 'hr.employees', action: 'view', label: 'Voir le personnel' },
  { module: 'hr.employees', action: 'create', label: 'Ajouter du personnel' },
  { module: 'hr.employees', action: 'update', label: 'Modifier le personnel' },

  { module: 'finance.expenses', action: 'view', label: 'Voir les dépenses' },
  { module: 'finance.expenses', action: 'create', label: 'Créer des dépenses' },
  { module: 'finance.expenses', action: 'update', label: 'Modifier des dépenses' },
  { module: 'finance.expenses', action: 'delete', label: 'Supprimer des dépenses' },
  { module: 'finance.reports', action: 'view', label: 'Voir les rapports financiers' },

  { module: 'suppliers', action: 'view', label: 'Voir les fournisseurs' },
  { module: 'suppliers', action: 'create', label: 'Créer des fournisseurs' },
  { module: 'suppliers', action: 'update', label: 'Modifier des fournisseurs' },

  { module: 'insurance', action: 'view', label: 'Voir les assurances' },
  { module: 'insurance', action: 'create', label: 'Créer des assurances' },
  { module: 'insurance', action: 'update', label: 'Modifier des assurances' },

  { module: 'billing', action: 'view', label: "Voir l'abonnement et les factures" },
  { module: 'billing', action: 'manage', label: "Gérer l'abonnement (souscrire/payer)" },
  { module: 'platform', action: 'manage', label: 'Administrer la plateforme SaaS (opérateur)' },
];

/** Clé canonique d'une permission : "module.action". */
export function permKey(p: PermissionDef): string {
  return `${p.module}.${p.action}`;
}

export const ALL_PERMISSION_KEYS: string[] = PERMISSIONS.map(permKey);

/* ============================================================
 * MATRICE PAR DÉFAUT : code rôle -> permissions
 * ============================================================ */

const ALL = ALL_PERMISSION_KEYS;

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ALL,
  admin: ALL,

  gestionnaire: [
    'dashboard.view',
    'optique.products.view', 'optique.products.create', 'optique.products.update',
    'optique.stock.view', 'optique.stock.adjust', 'optique.stock.transfer',
    'optique.sales.view', 'optique.sales.create', 'optique.sales.update', 'optique.sales.cancel', 'optique.sales.refund',
    'optique.quotes.view', 'optique.quotes.create', 'optique.quotes.convert',
    'optique.cashregister.view', 'optique.cashregister.open', 'optique.cashregister.close',
    'optique.customers.view', 'optique.customers.create', 'optique.customers.update',
    'rbac.users.view',
    'settings.branches.view', 'settings.branches.create', 'settings.branches.update',
    'audit.logs.view',
    'optique.prescriptions.view',
    'clinic.patients.view', 'clinic.appointments.view',
    'hr.employees.view', 'hr.employees.create', 'hr.employees.update',
    'finance.expenses.view', 'finance.expenses.create', 'finance.expenses.update', 'finance.expenses.delete', 'finance.reports.view',
    'suppliers.view', 'suppliers.create', 'suppliers.update',
    'insurance.view', 'insurance.create', 'insurance.update',
    'billing.view',
  ],

  opticien: [
    'dashboard.view',
    'optique.products.view',
    'optique.stock.view', 'optique.stock.adjust',
    'optique.sales.view', 'optique.sales.create', 'optique.sales.update', 'optique.sales.cancel', 'optique.sales.refund',
    'optique.quotes.view', 'optique.quotes.create', 'optique.quotes.convert',
    'optique.cashregister.view', 'optique.cashregister.open', 'optique.cashregister.close',
    'optique.customers.view', 'optique.customers.create', 'optique.customers.update',
    'optique.prescriptions.view', 'optique.prescriptions.create',
  ],

  ophtalmologue: [
    'dashboard.view', 'optique.customers.view',
    'optique.prescriptions.view', 'optique.prescriptions.create',
    'clinic.patients.view', 'clinic.patients.create', 'clinic.patients.update',
    'clinic.consultations.view', 'clinic.consultations.create',
    'clinic.appointments.view', 'clinic.appointments.create', 'clinic.appointments.update',
    'clinic.surgeries.view', 'clinic.surgeries.create', 'clinic.surgeries.update',
  ],
  orthoptiste: [
    'dashboard.view', 'optique.customers.view',
    'clinic.patients.view',
    'clinic.consultations.view', 'clinic.consultations.create',
    'clinic.appointments.view',
  ],

  secretaire: [
    'dashboard.view',
    'optique.customers.view', 'optique.customers.create', 'optique.customers.update',
    'optique.prescriptions.view',
    'optique.quotes.view',
    'clinic.patients.view', 'clinic.patients.create', 'clinic.patients.update',
    'clinic.appointments.view', 'clinic.appointments.create', 'clinic.appointments.update',
  ],

  receptionniste: [
    'dashboard.view',
    'optique.customers.view', 'optique.customers.create',
    'optique.sales.view',
    'clinic.patients.view', 'clinic.patients.create',
    'clinic.appointments.view', 'clinic.appointments.create', 'clinic.appointments.update',
  ],

  caissier: [
    'dashboard.view',
    'optique.products.view',
    'optique.sales.view', 'optique.sales.create', 'optique.sales.cancel', 'optique.sales.refund',
    'optique.cashregister.view', 'optique.cashregister.open', 'optique.cashregister.close',
    'optique.customers.view',
  ],

  responsable_stocks: [
    'dashboard.view',
    'optique.products.view', 'optique.products.create', 'optique.products.update', 'optique.products.delete',
    'optique.stock.view', 'optique.stock.adjust', 'optique.stock.transfer',
    'suppliers.view', 'suppliers.create', 'suppliers.update',
  ],

  comptable: [
    'dashboard.view',
    'optique.sales.view',
    'settings.payments.view',
    'audit.logs.view',
    'finance.expenses.view', 'finance.expenses.create', 'finance.expenses.update', 'finance.expenses.delete', 'finance.reports.view',
    'suppliers.view',
    'insurance.view',
  ],

  commercial: [
    'dashboard.view',
    'optique.products.view',
    'optique.customers.view', 'optique.customers.create', 'optique.customers.update',
    'optique.prescriptions.view', 'optique.prescriptions.create',
    'optique.quotes.view', 'optique.quotes.create',
    'optique.sales.view', 'optique.sales.create', 'optique.sales.cancel', 'optique.sales.refund',
    'suppliers.view',
    'insurance.view',
  ],
};

/* ============================================================
 * CONSTANTES MÉTIER
 * ============================================================ */

export const DEFAULT_CURRENCY = 'XOF';
export const SUPPORTED_CURRENCIES = ['XOF', 'XAF', 'CVE', 'AOA', 'MZN'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/**
 * Symbole affiché et nombre de décimales par devise. Le franc CFA se note
 * « FCFA » (pas « XOF ») et s'écrit sans centimes ; l'escudo, le kwanza et le
 * metical utilisent bien 2 décimales.
 */
export const CURRENCY_FORMAT: Record<
  SupportedCurrency,
  { symbol: string; decimals: number; label: string }
> = {
  XOF: { symbol: 'FCFA', decimals: 0, label: 'Franc CFA (UEMOA)' },
  XAF: { symbol: 'FCFA', decimals: 0, label: 'Franc CFA (CEMAC)' },
  CVE: { symbol: '$', decimals: 0, label: 'Escudo cap-verdien' },
  AOA: { symbol: 'Kz', decimals: 0, label: 'Kwanza angolais' },
  MZN: { symbol: 'MT', decimals: 0, label: 'Metical mozambicain' },
};

export const VAT_RATE = 0.18; // TVA 18 % (UEMOA)

/**
 * Taux de TVA par défaut selon le pays. L'établissement peut le modifier dans
 * ses réglages ; ces valeurs ne sont qu'un point de départ à l'inscription.
 */
export const DEFAULT_VAT_BY_COUNTRY: Record<string, number> = {
  CV: 15, // Cap-Vert
  AO: 14, // Angola
  MZ: 16, // Mozambique
};
export const SUPPORTED_LOCALES = ['fr', 'en', 'pt'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/* ============================================================
 * SCHÉMAS ZOD (DTO partagés front/back)
 * ============================================================ */

const passwordSchema = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
  .max(128);

/**
 * Pays desservis, avec indicatif, devise et langue par défaut. Source unique du
 * sélecteur d'indicatif à l'inscription, de la validation du numéro WhatsApp,
 * ET de la devise attribuée à l'établissement (déduite de son indicatif, le
 * formulaire ne demandant pas le pays séparément).
 *
 * Couvre la CEDEAO + Mauritanie, plus les marchés lusophones hors Afrique de
 * l'Ouest (Angola, Mozambique) ouverts en test.
 */
export const SUPPORTED_COUNTRIES = [
  { code: 'BJ', name: 'Bénin', dial: '+229', flag: '🇧🇯', currency: 'XOF', locale: 'fr' },
  { code: 'BF', name: 'Burkina Faso', dial: '+226', flag: '🇧🇫', currency: 'XOF', locale: 'fr' },
  { code: 'CV', name: 'Cap-Vert', dial: '+238', flag: '🇨🇻', currency: 'CVE', locale: 'pt' },
  { code: 'CI', name: "Côte d'Ivoire", dial: '+225', flag: '🇨🇮', currency: 'XOF', locale: 'fr' },
  { code: 'GM', name: 'Gambie', dial: '+220', flag: '🇬🇲', currency: 'XOF', locale: 'en' },
  { code: 'GH', name: 'Ghana', dial: '+233', flag: '🇬🇭', currency: 'XOF', locale: 'en' },
  { code: 'GN', name: 'Guinée', dial: '+224', flag: '🇬🇳', currency: 'XOF', locale: 'fr' },
  { code: 'GW', name: 'Guinée-Bissau', dial: '+245', flag: '🇬🇼', currency: 'XOF', locale: 'pt' },
  { code: 'LR', name: 'Libéria', dial: '+231', flag: '🇱🇷', currency: 'XOF', locale: 'en' },
  { code: 'ML', name: 'Mali', dial: '+223', flag: '🇲🇱', currency: 'XOF', locale: 'fr' },
  { code: 'MR', name: 'Mauritanie', dial: '+222', flag: '🇲🇷', currency: 'XOF', locale: 'fr' },
  { code: 'NE', name: 'Niger', dial: '+227', flag: '🇳🇪', currency: 'XOF', locale: 'fr' },
  { code: 'NG', name: 'Nigéria', dial: '+234', flag: '🇳🇬', currency: 'XOF', locale: 'en' },
  { code: 'SN', name: 'Sénégal', dial: '+221', flag: '🇸🇳', currency: 'XOF', locale: 'fr' },
  { code: 'SL', name: 'Sierra Leone', dial: '+232', flag: '🇸🇱', currency: 'XOF', locale: 'en' },
  { code: 'TG', name: 'Togo', dial: '+228', flag: '🇹🇬', currency: 'XOF', locale: 'fr' },
  // Marchés lusophones ouverts en test (hors CEDEAO).
  { code: 'AO', name: 'Angola', dial: '+244', flag: '🇦🇴', currency: 'AOA', locale: 'pt' },
  { code: 'MZ', name: 'Mozambique', dial: '+258', flag: '🇲🇿', currency: 'MZN', locale: 'pt' },
] as const;

export type SupportedCountry = (typeof SUPPORTED_COUNTRIES)[number];

/** Indicatifs acceptés (dérivés de SUPPORTED_COUNTRIES). */
export const SUPPORTED_DIAL_CODES = SUPPORTED_COUNTRIES.map((c) => c.dial);

/**
 * Retrouve le pays à partir d'un numéro international. Les indicatifs les plus
 * longs sont testés d'abord : sans cela « +22 » masquerait « +225 ».
 */
export function countryFromPhone(phone: string): SupportedCountry | undefined {
  const cleaned = phone.replace(/[\s().-]/g, '');
  return [...SUPPORTED_COUNTRIES]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((c) => cleaned.startsWith(c.dial));
}

/**
 * Numéro WhatsApp du responsable (obligatoire à l'inscription). Doit porter
 * l'indicatif international d'un pays d'Afrique de l'Ouest (CEDEAO + Mauritanie),
 * suivi de 5 à 12 chiffres. Espaces / tirets / points / parenthèses tolérés.
 */
export const whatsappSchema = z
  .string()
  .trim()
  .min(8, 'Numéro WhatsApp requis')
  .max(24, 'Numéro WhatsApp trop long')
  .refine(
    (v) => {
      const cleaned = v.replace(/[\s().-]/g, '');
      if (!/^\+\d{8,15}$/.test(cleaned)) return false;
      const dial = SUPPORTED_DIAL_CODES.find((d) => cleaned.startsWith(d));
      if (!dial) return false;
      // Rejette les numéros de remplissage : après l'indicatif, un même
      // chiffre répété (+225 0000000, +221 1111111…) n'est pas un vrai numéro.
      const rest = cleaned.slice(dial.length);
      return rest.length >= 5 && !/^(\d)\1+$/.test(rest);
    },
    "Numéro invalide — indicatif d'un pays desservi requis (ex : +221 77 123 45 67)",
  );

export const signupSchema = z.object({
  tenantName: z.string().min(2).max(120),
  branchName: z.string().min(2).max(120).default('Magasin principal'),
  adminFirstName: z.string().min(1).max(80),
  adminLastName: z.string().min(1).max(80),
  adminEmail: z.string().email(),
  // Numéro WhatsApp obligatoire : permet au fondateur de contacter le client.
  whatsapp: whatsappSchema,
  adminUsername: z.string().min(3).max(40).optional(),
  adminPassword: passwordSchema,
  // Offre choisie (présélectionnée à Starter si absente) — aucun essai
  // gratuit : l'accès au dashboard reste bloqué jusqu'au paiement.
  plan: z.enum(['STARTER', 'STANDARD', 'GROWTH']).default(DEFAULT_PLAN_CODE),
});
export type SignupInput = z.infer<typeof signupSchema>;

/* --- Connexion avec Google --- */

export const googleLoginSchema = z.object({
  idToken: z.string().min(20),
});
export type GoogleLoginInput = z.infer<typeof googleLoginSchema>;

export const googleSignupSchema = z.object({
  idToken: z.string().min(20),
  tenantName: z.string().min(2).max(120),
  branchName: z.string().min(2).max(120).default('Magasin principal'),
  // Numéro WhatsApp obligatoire, comme pour l'inscription par mot de passe.
  whatsapp: whatsappSchema,
  plan: z.enum(['STARTER', 'STANDARD', 'GROWTH']).default(DEFAULT_PLAN_CODE),
});
export type GoogleSignupInput = z.infer<typeof googleSignupSchema>;

export const loginSchema = z.object({
  identifier: z.string().min(1, "Email ou nom d'utilisateur requis"),
  password: z.string().min(1, 'Mot de passe requis'),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Un même email peut gérer plusieurs établissements : choix à la connexion. */
export interface EstablishmentChoice {
  tenantId: string;
  tenantName: string;
}

/** 2ᵉ étape de connexion quand l'email correspond à plusieurs établissements. */
export const loginSelectSchema = z.object({
  selectionToken: z.string().min(10),
  tenantId: z.string().min(1),
});
export type LoginSelectInput = z.infer<typeof loginSelectSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/**
 * Changement de mot de passe par un utilisateur connecté. La session active
 * suffit (pas d'ancien mot de passe demandé) : permet à un utilisateur arrivé
 * avec un mot de passe temporaire de définir directement le sien. Les autres
 * sessions sont révoquées côté serveur après le changement.
 */
export const changePasswordSchema = z.object({
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const verifyPasswordSchema = z.object({
  password: z.string().min(1),
});
export type VerifyPasswordInput = z.infer<typeof verifyPasswordSchema>;

/* --- 2FA (TOTP) --- */
const totpCode = z.string().trim().regex(/^[0-9]{6}$/, 'Code à 6 chiffres');

export const twoFactorEnableSchema = z.object({ code: totpCode });
export type TwoFactorEnableInput = z.infer<typeof twoFactorEnableSchema>;

export const twoFactorDisableSchema = z.object({
  password: z.string().min(1),
  code: totpCode,
});
export type TwoFactorDisableInput = z.infer<typeof twoFactorDisableSchema>;

export const twoFactorLoginSchema = z.object({
  challenge: z.string().min(10),
  code: totpCode,
});
export type TwoFactorLoginInput = z.infer<typeof twoFactorLoginSchema>;

/* --- Support --- */
export const supportTicketSchema = z.object({
  subject: z.string().trim().min(2).max(160),
  message: z.string().trim().min(5).max(4000),
});
export type SupportTicketInput = z.infer<typeof supportTicketSchema>;

export const productCategoryEnum = z.enum([
  ProductCategory.MONTURE,
  ProductCategory.VERRE,
  ProductCategory.LENTILLE,
  ProductCategory.ACCESSOIRE,
  ProductCategory.ENTRETIEN,
  ProductCategory.SERVICE,
  ProductCategory.AUTRE,
]);

/* ============================================================
 * CATALOGUE OPTIQUE — référentiels montures & verres
 * Ces listes alimentent les formulaires et les filtres du catalogue.
 * Les attributs correspondants vivent dans `Product.attributes` (JSON) :
 * aucune migration n'est nécessaire pour en ajouter un.
 * ============================================================ */

/** Nombre maximum de photos secondaires par produit (poids de la base). */
export const MAX_PRODUCT_PHOTOS = 5;

/** Familles affichées dans le catalogue, dans l'ordre des onglets. */
export const CATALOG_FAMILIES = [
  { key: ProductCategory.MONTURE, label: 'Montures' },
  { key: ProductCategory.VERRE, label: 'Verres' },
  { key: ProductCategory.LENTILLE, label: 'Lentilles' },
  { key: ProductCategory.ACCESSOIRE, label: 'Accessoires' },
  { key: ProductCategory.ENTRETIEN, label: "Produits d'entretien" },
  { key: ProductCategory.AUTRE, label: 'Autres' },
] as const;

/* ------------------------------ MONTURES ------------------------------ */

export const FRAME_GENDERS = ['Homme', 'Femme', 'Mixte', 'Enfant', 'Junior'] as const;

export const FRAME_SHAPES = [
  'Rectangulaire',
  'Carrée',
  'Ronde',
  'Ovale',
  'Papillon',
  'Aviateur',
  'Pantos',
  'Cat-eye',
  'Sans monture',
] as const;

export const FRAME_MATERIALS = [
  'Acétate',
  'Métal',
  'Titane',
  'Acier inoxydable',
  'TR90',
  'Bois',
  'Mixte',
] as const;

/** Couleurs courantes, avec leur rendu pour la pastille du filtre. */
export const FRAME_COLORS = [
  { name: 'Noir', hex: '#111827' },
  { name: 'Écaille', hex: '#8b5e34' },
  { name: 'Marron', hex: '#6b4423' },
  { name: 'Or', hex: '#d4af37' },
  { name: 'Argent', hex: '#c0c5ce' },
  { name: 'Bleu', hex: '#2563eb' },
  { name: 'Rouge', hex: '#dc2626' },
  { name: 'Rose', hex: '#ec4899' },
  { name: 'Vert', hex: '#16a34a' },
  { name: 'Transparent', hex: '#e5e7eb' },
  { name: 'Blanc', hex: '#f8fafc' },
] as const;

/** Attributs propres à une monture (stockés dans `attributes`). */
export const frameAttributesSchema = z.object({
  model: z.string().max(80).optional().or(z.literal('')),
  gender: z.string().max(20).optional().or(z.literal('')),
  shape: z.string().max(30).optional().or(z.literal('')),
  color: z.string().max(30).optional().or(z.literal('')),
  material: z.string().max(30).optional().or(z.literal('')),
  /** Taille façon optique : 52-18-140 (calibre-pont-branches). */
  size: z.string().max(20).optional().or(z.literal('')),
  ean: z.string().max(40).optional().or(z.literal('')),
  location: z.string().max(60).optional().or(z.literal('')),
  supplier: z.string().max(80).optional().or(z.literal('')),
});
export type FrameAttributes = z.infer<typeof frameAttributesSchema>;

/* ------------------------------- VERRES ------------------------------- */

/**
 * Familles de verres. `visual` pilote l'illustration de la carte : le verre
 * se reconnaît d'un coup d'œil sans lire la fiche.
 */
export const LENS_FAMILIES = [
  { key: 'UNIFOCAL', label: 'Unifocal', visual: 'single' },
  { key: 'PROGRESSIF', label: 'Progressif', visual: 'progressive' },
  { key: 'BIFOCAL', label: 'Bifocal', visual: 'bifocal' },
  { key: 'MI_DISTANCE', label: 'Mi-distance', visual: 'mid' },
  { key: 'PHOTOCHROMIQUE', label: 'Photochromique', visual: 'photochromic' },
  { key: 'SOLAIRE', label: 'Solaire', visual: 'sun' },
  { key: 'ANTI_FATIGUE', label: 'Anti-fatigue', visual: 'single' },
  { key: 'ORDINATEUR', label: 'Ordinateur', visual: 'computer' },
  { key: 'PERSONNALISE', label: 'Personnalisé', visual: 'single' },
] as const;
export type LensFamilyKey = (typeof LENS_FAMILIES)[number]['key'];
export type LensVisual = (typeof LENS_FAMILIES)[number]['visual'];

export const LENS_MATERIALS = [
  'Organique (CR-39)',
  'Polycarbonate',
  'Trivex',
  'Minéral',
  'Haut indice',
] as const;

export const LENS_TINTS = [
  'Incolore',
  'Gris',
  'Brun',
  'Vert',
  'Dégradé gris',
  'Dégradé brun',
  'Polarisé',
  'Miroir',
] as const;

export const LENS_DESIGNS = ['Sphérique', 'Asphérique', 'Bi-asphérique', 'Double face'] as const;

export const LENS_USAGES = [
  'Vision de loin',
  'Vision de près',
  'Vision intermédiaire',
  'Toutes distances',
  'Écrans',
  'Conduite',
  'Sport',
  'Soleil',
] as const;

/** Attributs propres à un verre (stockés dans `attributes`). */
export const lensAttributesSchema = z.object({
  /** Famille : clé de LENS_FAMILIES. */
  family: z.string().max(30).optional().or(z.literal('')),
  range: z.string().max(80).optional().or(z.literal('')),
  index: z.string().max(10).optional().or(z.literal('')),
  material: z.string().max(40).optional().or(z.literal('')),
  treatments: z.array(z.string().max(40)).optional(),
  tint: z.string().max(30).optional().or(z.literal('')),
  design: z.string().max(30).optional().or(z.literal('')),
  usage: z.string().max(40).optional().or(z.literal('')),
  /** Verre haut de gamme : mis en avant dans le catalogue. */
  premium: z.boolean().optional(),
});
export type LensAttributes = z.infer<typeof lensAttributesSchema>;

/** Illustration à utiliser pour un verre, d'après sa famille. */
export function lensVisualFor(family: string | null | undefined): LensVisual {
  return LENS_FAMILIES.find((f) => f.key === family)?.visual ?? 'single';
}

/**
 * Étiquettes d'un verre pour la carte et la comparaison : famille, indice,
 * traitements, teinte, gamme premium. Libellés courts, prêts à afficher.
 */
export function lensTags(attrs: LensAttributes | null | undefined): string[] {
  if (!attrs) return [];
  const family = LENS_FAMILIES.find((f) => f.key === attrs.family)?.label;
  return [
    family,
    attrs.index ? `Indice ${attrs.index}` : null,
    ...(attrs.treatments ?? []),
    attrs.tint && attrs.tint !== 'Incolore' ? attrs.tint : null,
    attrs.premium ? 'Premium' : null,
  ].filter((t): t is string => Boolean(t));
}

export const productCreateSchema = z.object({
  // Référence facultative : générée côté serveur si absente (verres, accessoires…).
  sku: z.string().max(60).optional(),
  category: productCategoryEnum,
  brand: z.string().max(80).optional(),
  name: z.string().min(1).max(160),
  attributes: z.record(z.any()).optional(),
  /** Photo principale (data URL) : donnee centrale du catalogue visuel. */
  photoUrl: z.string().optional().or(z.literal('')),
  /** Photos secondaires (data URLs), plafonnees pour preserver la base. */
  photos: z.array(z.string()).max(MAX_PRODUCT_PHOTOS).optional(),
  buyPrice: z.number().nonnegative(),
  sellPrice: z.number().nonnegative(),
  createdAt: z.string().optional(),
});
export type ProductCreateInput = z.infer<typeof productCreateSchema>;

export const productUpdateSchema = productCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

export const stockAdjustSchema = z.object({
  delta: z.number().int(),
  reason: z.string().max(200).optional(),
  type: z
    .enum([
      StockMovementType.PURCHASE_IN,
      StockMovementType.ADJUSTMENT,
      StockMovementType.RETURN_IN,
      StockMovementType.TRANSFER,
    ])
    .default(StockMovementType.ADJUSTMENT),
  minAlert: z.number().int().nonnegative().optional(),
});
export type StockAdjustInput = z.infer<typeof stockAdjustSchema>;

export const customerCreateSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  phone: z.string().max(40).optional(),
  email: z.string().email().optional().or(z.literal('')),
  // Fiche complète : sert aux relances et aux conseils liés à l'âge.
  dateOfBirth: z.string().optional().or(z.literal('')),
  gender: z.enum([Gender.MALE, Gender.FEMALE, Gender.OTHER]).optional().or(z.literal('')),
  address: z.string().max(200).optional().or(z.literal('')),
  profession: z.string().max(120).optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
});
export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;

/** Âge en années à partir d'une date de naissance (null si absente/invalide). */
export function ageFromBirthDate(dob: string | Date | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

/** Ordonnance optique (prescription de verres : sphère/cylindre/axe/addition). */
const opt = z.string().max(20).optional().or(z.literal(''));
export const prescriptionCreateSchema = z.object({
  date: z.string().optional().or(z.literal('')),
  prescriberName: z.string().max(120).optional().or(z.literal('')),
  odSphere: opt,
  odCylinder: opt,
  odAxis: opt,
  odAddition: opt,
  ogSphere: opt,
  ogCylinder: opt,
  ogAxis: opt,
  ogAddition: opt,
  pupillaryDistance: z.string().max(40).optional().or(z.literal('')),
  lensType: z.string().max(60).optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
  // Mesures avancées de montage
  odHeight: opt,
  ogHeight: opt,
  odNearPd: opt,
  ogNearPd: opt,
  vertex: opt,
  pantoTilt: opt,
  /** Fin de validité ; vide = calculée depuis les réglages de l'établissement. */
  expiresAt: z.string().optional().or(z.literal('')),
  /** Photo / scan d'ordonnance papier (data URL). */
  photoUrl: z.string().optional().or(z.literal('')),
});
export type PrescriptionCreateInput = z.infer<typeof prescriptionCreateSchema>;

/* ------------------------ Réglages métier optique ------------------------ */

/**
 * Paramètres du cabinet : durée de validité d'une ordonnance, seuils de
 * relance, garantie accordée par défaut et valeur d'un point de fidélité.
 * Remplacent les valeurs codées en dur.
 */
export const opticalSettingsSchema = z.object({
  /** Validité d'une ordonnance, en mois. */
  prescriptionValidityMonths: z.number().int().min(1).max(120).default(18),
  /** Relance « nouvelle ordonnance » passé ce délai, en mois. */
  prescriptionReminderMonths: z.number().int().min(1).max(120).default(18),
  /** Relance « pas d'achat depuis », en mois. */
  purchaseReminderMonths: z.number().int().min(1).max(120).default(12),
  /** Garantie proposée par défaut sur une vente, en mois (0 = aucune). */
  defaultWarrantyMonths: z.number().int().min(0).max(120).default(12),
  /** Valeur d'un point de fidélité, en unité monétaire. */
  loyaltyPointValue: z.number().min(0).max(10000).default(25),
});
export type OpticalSettings = z.infer<typeof opticalSettingsSchema>;

export const DEFAULT_OPTICAL_SETTINGS: OpticalSettings = {
  prescriptionValidityMonths: 18,
  prescriptionReminderMonths: 18,
  purchaseReminderMonths: 12,
  defaultWarrantyMonths: 12,
  loyaltyPointValue: 25,
};

/** Garanties proposées en caisse (en mois). */
export const WARRANTY_PRESETS = [0, 3, 6, 12, 24] as const;

/* --------------------------- Opérations de stock --------------------------- */

const stockLineSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

/** Réception d'une commande fournisseur : entrée de stock tracée + coût. */
export const stockReceiveSchema = z.object({
  branchId: z.string().uuid(),
  supplierId: z.string().uuid().optional(),
  reference: z.string().max(80).optional().or(z.literal('')),
  items: z
    .array(stockLineSchema.extend({ unitCost: z.number().nonnegative().optional() }))
    .min(1, 'Au moins un article'),
});
export type StockReceiveInput = z.infer<typeof stockReceiveSchema>;

/** Transfert de stock entre deux magasins. */
export const stockTransferSchema = z
  .object({
    fromBranchId: z.string().uuid(),
    toBranchId: z.string().uuid(),
    reason: z.string().max(200).optional().or(z.literal('')),
    items: z.array(stockLineSchema).min(1, 'Au moins un article'),
  })
  .refine((v) => v.fromBranchId !== v.toBranchId, {
    message: 'Les magasins source et destination doivent être différents',
    path: ['toBranchId'],
  });
export type StockTransferInput = z.infer<typeof stockTransferSchema>;

/** Inventaire physique : quantités comptées, régularisées en une fois. */
export const stockCountSchema = z.object({
  branchId: z.string().uuid(),
  note: z.string().max(200).optional().or(z.literal('')),
  items: z
    .array(z.object({ productId: z.string().uuid(), countedQuantity: z.number().int().min(0) }))
    .min(1, 'Au moins un article'),
});
export type StockCountInput = z.infer<typeof stockCountSchema>;

/* --- Commandes de verres (laboratoire) & SAV / réparations --- */

/**
 * Colonnes du Kanban des commandes de verres, dans l'ordre d'affichage.
 * CANCELLED existe côté données (une commande annulée doit rester traçable)
 * mais n'est volontairement PAS une colonne du tableau : elle se déclenche
 * depuis une carte et les commandes annulées sont retirées du plateau.
 */
export const LENS_ORDER_BOARD_STATUSES = [
  'TO_ORDER',
  'ORDERED',
  'LAB_CONFIRMED',
  'IN_PRODUCTION',
  'SHIPPED',
  'RECEIVED',
  'CONTROL',
  'MOUNTING',
  'READY',
  'DELIVERED',
] as const;
/** Toutes les valeurs possibles en base, colonnes du plateau + annulée. */
export const LENS_ORDER_STATUSES = [...LENS_ORDER_BOARD_STATUSES, 'CANCELLED'] as const;
export type LensOrderStatus = (typeof LENS_ORDER_STATUSES)[number];

export const LENS_ORDER_STATUS_LABELS: Record<LensOrderStatus, string> = {
  TO_ORDER: 'À commander',
  ORDERED: 'Commandé',
  LAB_CONFIRMED: 'Confirmé laboratoire',
  IN_PRODUCTION: 'En fabrication',
  SHIPPED: 'Expédié',
  RECEIVED: 'Reçu',
  CONTROL: 'Contrôle',
  MOUNTING: 'Montage',
  READY: 'Prêt',
  DELIVERED: 'Livré',
  CANCELLED: 'Annulé',
};

export const REPAIR_STATUSES = ['RECEIVED', 'IN_PROGRESS', 'READY', 'DELIVERED', 'CANCELLED'] as const;
export type RepairStatus = (typeof REPAIR_STATUSES)[number];

export const LENS_ORDER_CATEGORIES = ['VERRES', 'LENTILLES', 'ACCESSOIRE', 'MONTURE', 'AUTRE'] as const;
export type LensOrderCategory = (typeof LENS_ORDER_CATEGORIES)[number];
export const REPAIR_CATEGORIES = ['MONTURE', 'VERRE', 'VIS', 'PLAQUETTES', 'NETTOYAGE', 'AUTRE'] as const;
export type RepairCategory = (typeof REPAIR_CATEGORIES)[number];

export const lensOrderCreateSchema = z.object({
  customerId: z.string().uuid().optional().or(z.literal('')),
  category: z.enum(LENS_ORDER_CATEGORIES).optional(),
  supplierName: z.string().max(120).optional().or(z.literal('')),
  description: z.string().trim().min(2).max(400),
  /** Détail par œil (catégorie VERRES) : affiché tel quel sur la carte Kanban. */
  odLens: z.string().max(200).optional().or(z.literal('')),
  ogLens: z.string().max(200).optional().or(z.literal('')),
  /** Monture associée (facultative) : sert de vignette Kanban. */
  frameProductId: z.string().uuid().optional().or(z.literal('')),
  expectedAt: z.string().optional().or(z.literal('')),
  cost: z.coerce.number().min(0).optional(),
  notes: z.string().max(1000).optional().or(z.literal('')),
});
export type LensOrderCreateInput = z.infer<typeof lensOrderCreateSchema>;
export const lensOrderStatusSchema = z.object({ status: z.enum(LENS_ORDER_STATUSES) });

export const repairCreateSchema = z.object({
  customerId: z.string().uuid().optional().or(z.literal('')),
  category: z.enum(REPAIR_CATEGORIES).optional(),
  description: z.string().trim().min(2).max(400),
  cost: z.coerce.number().min(0).optional(),
  notes: z.string().max(1000).optional().or(z.literal('')),
});
export type RepairCreateInput = z.infer<typeof repairCreateSchema>;
export const repairStatusSchema = z.object({ status: z.enum(REPAIR_STATUSES) });

export const branchCreateSchema = z.object({
  name: z.string().min(2).max(120),
  city: z.string().max(80).optional(),
});
export type BranchCreateInput = z.infer<typeof branchCreateSchema>;

export const saleItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  // Prix unitaire personnalisé (optionnel) : si absent, le serveur applique le
  // prix catalogue du produit. Permet de fixer un prix libre à la caisse.
  unitPrice: z.number().nonnegative().optional(),
});

export const saleCreateSchema = z.object({
  branchId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  type: z.enum([SaleType.SALE, SaleType.QUOTE]).default(SaleType.SALE),
  items: z.array(saleItemSchema).min(1, 'Au moins un article requis'),
  discountAmount: z.number().nonnegative().default(0),
  insuranceAmount: z.number().nonnegative().default(0),
  /** Assureur prenant en charge insuranceAmount (suivi des paiements trimestriels). */
  insurerId: z.string().uuid().optional(),
  /**
   * Taux de TVA de CETTE vente en % (0 = exonéré). Omis → taux de
   * l'établissement. Permet de vendre hors taxe ou à un taux différent
   * ponctuellement, sans modifier les réglages.
   */
  vatRate: z.number().min(0).max(100).optional(),
  /** Garantie accordée, en mois (0 ou omis = aucune). */
  warrantyMonths: z.number().int().min(0).max(120).optional(),
  /** Points de fidélité du client convertis en remise sur cette vente. */
  loyaltyPointsUsed: z.number().int().min(0).optional(),
  /** Ordonnance à joindre au document (facultatif). */
  prescriptionId: z.string().uuid().optional(),
});
export type SaleCreateInput = z.infer<typeof saleCreateSchema>;

/** Taux de TVA proposés en caisse (en %). 0 = vente exonérée. */
export const VAT_RATE_PRESETS = [0, 5, 10, 18, 20] as const;

/**
 * Modification d'une vente ou d'un devis existant (permission
 * `optique.sales.update`). Les montants sont recalculés côté serveur et le
 * stock est réajusté sur la différence entre l'ancien et le nouveau contenu.
 * Seuls les champs fournis sont modifiés.
 */
export const saleUpdateSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  items: z.array(saleItemSchema).min(1, 'Au moins un article requis').optional(),
  discountAmount: z.number().nonnegative().optional(),
  insuranceAmount: z.number().nonnegative().optional(),
  insurerId: z.string().uuid().nullable().optional(),
  vatRate: z.number().min(0).max(100).optional(),
  /** Ordonnance jointe au document (null = détacher). */
  prescriptionId: z.string().uuid().nullable().optional(),
});
export type SaleUpdateInput = z.infer<typeof saleUpdateSchema>;

export const paymentMethodEnum = z.enum([
  PaymentMethod.CASH,
  PaymentMethod.WAVE,
  PaymentMethod.ORANGE_MONEY,
  PaymentMethod.MTN_MOMO,
  PaymentMethod.MOOV_MONEY,
  PaymentMethod.FREE_MONEY,
  PaymentMethod.CARD,
]);

export const paymentCreateSchema = z.object({
  method: paymentMethodEnum,
  amount: z.number().positive(),
  customerPhone: z.string().max(40).optional(),
});
export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;

export const roleCreateSchema = z.object({
  name: z.string().min(2).max(60),
  permissions: z.array(z.string()).default([]),
});
export type RoleCreateInput = z.infer<typeof roleCreateSchema>;

export const roleUpdateSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  permissions: z.array(z.string()).optional(),
});
export type RoleUpdateInput = z.infer<typeof roleUpdateSchema>;

export const userCreateSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  email: z.string().email(),
  // Vrai numéro exigé (comme à l'inscription) : joignable par l'établissement
  // et par le support.
  phone: whatsappSchema,
  username: z.string().min(3).max(40).optional(),
  password: passwordSchema,
  roleId: z.string().uuid(),
  branchIds: z.array(z.string().uuid()).default([]),
});
export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const cashOpenSchema = z.object({
  branchId: z.string().uuid(),
  openingAmount: z.number().nonnegative(),
});
export type CashOpenInput = z.infer<typeof cashOpenSchema>;

export const cashCloseSchema = z.object({
  closingAmount: z.number().nonnegative(),
});
export type CashCloseInput = z.infer<typeof cashCloseSchema>;

/**
 * Validation d'une image reçue en data URL base64 (redimensionnée côté client)
 * ou d'une URL https, ou d'une chaîne vide (pour retirer). Formats matriciels
 * uniquement — le SVG est refusé (risque XSS s'il était rendu en ligne).
 * ~3 Mo de chaîne ≈ image ~2 Mo après encodage base64.
 */
const IMAGE_DATA_URL_RE = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i;
export const imageDataString = z
  .string()
  .max(3_000_000, 'Image trop volumineuse (max ~2 Mo)')
  .refine(
    (v) => v === '' || IMAGE_DATA_URL_RE.test(v) || /^https:\/\/\S+$/i.test(v),
    'Image invalide (formats acceptés : PNG, JPEG, WebP, GIF)',
  );

/** Coordonnées d'encaissement manuel de la boutique (QR + numéro Mobile Money). */
export const collectInfoSchema = z.object({
  network: z.string().max(40).optional().default(''),
  number: z.string().max(40).optional().default(''),
  name: z.string().max(120).optional().default(''),
  qr: imageDataString.optional().default(''),
});
export type CollectInfoInput = z.infer<typeof collectInfoSchema>;

export const paymentConfigSchema = z.object({
  provider: z.enum(['paytech', 'moneroo']).default('paytech'),
  apiKey: z.string().optional().default(''),
  apiSecret: z.string().optional().default(''),
  siteId: z.string().optional().default(''),
  environment: z.enum(['sandbox', 'production']).default('sandbox'),
  webhookUrl: z.string().optional().default(''),
  simulationMode: z.boolean().default(true),
});
export type PaymentConfigInput = z.infer<typeof paymentConfigSchema>;

/* --- Clinique --- */

export const patientCreateSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  gender: z.enum([Gender.MALE, Gender.FEMALE, Gender.OTHER]).optional(),
  dateOfBirth: z.string().optional().or(z.literal('')),
  phone: z.string().max(40).optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().max(200).optional().or(z.literal('')),
  bloodGroup: z.string().max(8).optional().or(z.literal('')),
  allergies: z.string().max(500).optional().or(z.literal('')),
  medicalHistory: z.string().max(2000).optional().or(z.literal('')),
});
export type PatientCreateInput = z.infer<typeof patientCreateSchema>;

export const consultationCreateSchema = z.object({
  patientId: z.string().uuid(),
  date: z.string().optional().or(z.literal('')),
  visualAcuityRight: z.string().max(40).optional().or(z.literal('')),
  visualAcuityLeft: z.string().max(40).optional().or(z.literal('')),
  refractionRight: z.string().max(80).optional().or(z.literal('')),
  refractionLeft: z.string().max(80).optional().or(z.literal('')),
  tonometryRight: z.string().max(40).optional().or(z.literal('')),
  tonometryLeft: z.string().max(40).optional().or(z.literal('')),
  biomicroscopy: z.string().max(1000).optional().or(z.literal('')),
  fundus: z.string().max(1000).optional().or(z.literal('')),
  oct: z.string().max(1000).optional().or(z.literal('')),
  visualField: z.string().max(1000).optional().or(z.literal('')),
  diagnosis: z.string().max(1000).optional().or(z.literal('')),
  prescription: z.string().max(1000).optional().or(z.literal('')),
  lensType: z.string().max(60).optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
});
export type ConsultationCreateInput = z.infer<typeof consultationCreateSchema>;

/** Réservation de démonstration gratuite depuis le tableau de bord. */
export const demoRequestCreateSchema = z.object({
  contactName: z.string().min(2, 'Nom requis').max(120),
  contactEmail: z.string().email('Email invalide'),
  contactPhone: z.string().max(40).optional().or(z.literal('')),
  preferredAt: z.string().min(1, 'Date souhaitée requise'),
  notes: z.string().max(1000).optional().or(z.literal('')),
});
export type DemoRequestCreateInput = z.infer<typeof demoRequestCreateSchema>;

export const appointmentCreateSchema = z.object({
  patientId: z.string().uuid(),
  scheduledAt: z.string().min(1, 'Date requise'),
  reason: z.string().max(200).optional().or(z.literal('')),
  practitionerName: z.string().max(120).optional().or(z.literal('')),
  status: z
    .enum([
      AppointmentStatus.SCHEDULED,
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.COMPLETED,
      AppointmentStatus.CANCELLED,
      AppointmentStatus.NO_SHOW,
    ])
    .default(AppointmentStatus.SCHEDULED),
  notes: z.string().max(1000).optional().or(z.literal('')),
});
export type AppointmentCreateInput = z.infer<typeof appointmentCreateSchema>;

export const appointmentUpdateSchema = appointmentCreateSchema.partial().omit({ patientId: true });
export type AppointmentUpdateInput = z.infer<typeof appointmentUpdateSchema>;

export const surgeryCreateSchema = z.object({
  patientId: z.string().uuid(),
  type: z.string().min(1).max(160),
  eye: z.enum([Eye.OD, Eye.OG, Eye.OU]).default(Eye.OU),
  scheduledAt: z.string().optional().or(z.literal('')),
  surgeonName: z.string().max(120).optional().or(z.literal('')),
  status: z
    .enum([SurgeryStatus.PLANNED, SurgeryStatus.DONE, SurgeryStatus.CANCELLED])
    .default(SurgeryStatus.PLANNED),
  outcome: z.string().max(1000).optional().or(z.literal('')),
  followUpNotes: z.string().max(1000).optional().or(z.literal('')),
});
export type SurgeryCreateInput = z.infer<typeof surgeryCreateSchema>;
export const surgeryUpdateSchema = surgeryCreateSchema.partial().omit({ patientId: true });
export type SurgeryUpdateInput = z.infer<typeof surgeryUpdateSchema>;

/* --- Gestion --- */

export const employeeCreateSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  phone: z.string().max(40).optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  position: z.string().min(1).max(120),
  salary: z.number().nonnegative().optional(),
  hireDate: z.string().optional().or(z.literal('')),
  status: z
    .enum([EmployeeStatus.ACTIVE, EmployeeStatus.ON_LEAVE, EmployeeStatus.TERMINATED])
    .default(EmployeeStatus.ACTIVE),
  branchId: z.string().uuid().optional(),
});
export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;
export const employeeUpdateSchema = employeeCreateSchema.partial();
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>;

export const expenseCategoryEnum = z.enum([
  ExpenseCategory.RENT,
  ExpenseCategory.SALARIES,
  ExpenseCategory.ELECTRICITY,
  ExpenseCategory.WATER,
  ExpenseCategory.INTERNET,
  ExpenseCategory.MARKETING,
  ExpenseCategory.TRANSPORT,
  ExpenseCategory.SUPPLIES,
  ExpenseCategory.MAINTENANCE,
  ExpenseCategory.TAXES,
  ExpenseCategory.OTHER,
]);

export const expenseCreateSchema = z.object({
  category: expenseCategoryEnum,
  label: z.string().min(1).max(160),
  amount: z.number().positive(),
  date: z.string().optional().or(z.literal('')),
  branchId: z.string().uuid().optional(),
  notes: z.string().max(1000).optional().or(z.literal('')),
});
export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>;
export const expenseUpdateSchema = expenseCreateSchema.partial();
export type ExpenseUpdateInput = z.infer<typeof expenseUpdateSchema>;

export const supplierCreateSchema = z.object({
  name: z.string().min(1).max(160),
  type: z.enum([SupplierType.LOCAL, SupplierType.INTERNATIONAL]).default(SupplierType.LOCAL),
  contactName: z.string().max(120).optional().or(z.literal('')),
  phone: z.string().max(40).optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().max(200).optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
});
export type SupplierCreateInput = z.infer<typeof supplierCreateSchema>;
export const supplierUpdateSchema = supplierCreateSchema.partial();
export type SupplierUpdateInput = z.infer<typeof supplierUpdateSchema>;

export const insurerCreateSchema = z.object({
  name: z.string().min(1).max(160),
  type: z
    .enum([
      InsurerType.HEALTH_INSURANCE,
      InsurerType.MUTUAL,
      InsurerType.PRIVATE,
      InsurerType.THIRD_PARTY,
    ])
    .default(InsurerType.HEALTH_INSURANCE),
  coveragePercent: z.number().int().min(0).max(100).default(0),
  phone: z.string().max(40).optional().or(z.literal('')),
  email: z.string().email().optional().or(z.literal('')),
  notes: z.string().max(1000).optional().or(z.literal('')),
});
export type InsurerCreateInput = z.infer<typeof insurerCreateSchema>;
export const insurerUpdateSchema = insurerCreateSchema.partial();
export type InsurerUpdateInput = z.infer<typeof insurerUpdateSchema>;

/* --- Abonnements --- */

export const subscribeSchema = z.object({
  planId: z.string().uuid(),
  method: paymentMethodEnum,
  customerPhone: z.string().max(40).optional(),
  cycle: z.enum(['MONTHLY', 'SEMIANNUAL']).optional().default('MONTHLY'),
});
export type SubscribeInput = z.infer<typeof subscribeSchema>;

export const subscriptionPaySchema = z.object({
  method: paymentMethodEnum,
  customerPhone: z.string().max(40).optional(),
});
export type SubscriptionPayInput = z.infer<typeof subscriptionPaySchema>;

export const planUpsertSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(300).optional().or(z.literal('')),
  priceMonthly: z.number().nonnegative(),
  trialDays: z.number().int().min(0).default(0),
  maxUsers: z.number().int().positive().nullable().optional(),
  maxBranches: z.number().int().positive().nullable().optional(),
  maxPatients: z.number().int().positive().nullable().optional(),
  maxSales: z.number().int().positive().nullable().optional(),
  features: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});
export type PlanUpsertInput = z.infer<typeof planUpsertSchema>;

/* --- Console plateforme (fondateur) --- */

export const operatorCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().max(120).optional(),
});
export type OperatorCreateInput = z.infer<typeof operatorCreateSchema>;

export const userActiveSchema = z.object({
  isActive: z.boolean(),
});
export type UserActiveInput = z.infer<typeof userActiveSchema>;

/* --- Profil & image de marque --- */

// Image en data URL (base64) redimensionnée côté client, ou chaîne vide pour retirer.
const imageData = imageDataString.optional();

export const profileUpdateSchema = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  photoUrl: imageData,
});
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

/**
 * Personnalisation des documents commerciaux (factures & devis).
 * Tous les champs sont facultatifs : absents = valeurs par défaut du modèle.
 */
export const invoiceSettingsSchema = z
  .object({
    /** Couleur d'accent (en-têtes, tableau) au format #RRGGBB. */
    accentColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Couleur invalide (format #RRGGBB)')
      .optional(),
    /** Mentions légales sous l'en-tête (RCCM, NINEA/IFU, régime TVA…). */
    legalInfo: z.string().max(300).optional(),
    /** Message libre en bas de document (remerciement, conditions…). */
    footerNote: z.string().max(300).optional(),
    /** Durée de validité d'un devis, en jours. */
    quoteValidityDays: z.number().int().min(1).max(365).optional(),
  })
  .strict();
export type InvoiceSettings = z.infer<typeof invoiceSettingsSchema>;

/**
 * Tarifs verres/traitements propres à l'établissement (configurateur de
 * commandes de verres). Prix par verre, en devise de l'établissement. Les
 * indices d'amincissement restent des multiplicateurs physiques, non modifiés.
 */
/** Type de verre personnalisé ajouté par l'établissement (nom + prix libres). */
export const lensCustomTypeSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(60),
  price: z.number().nonnegative(),
});
export type LensCustomType = z.infer<typeof lensCustomTypeSchema>;

export const lensPricingSchema = z
  .object({
    unifocal: z.number().nonnegative(),
    progressif: z.number().nonnegative(),
    degressif: z.number().nonnegative(),
    ar: z.number().nonnegative(),
    blue: z.number().nonnegative(),
    photo: z.number().nonnegative(),
    hard: z.number().nonnegative(),
    // Types de verres ajoutés manuellement par l'établissement (Réglages).
    customTypes: z.array(lensCustomTypeSchema).max(50).optional(),
  })
  .strict();
export type LensPricing = z.infer<typeof lensPricingSchema>;

/** Types de verres proposés dans le catalogue produits (catégorie VERRE). */
export const LENS_PRODUCT_TYPES = [
  'Unifocal',
  'Progressif',
  'Dégressif (bureau)',
  'Bifocal',
  'Mi-distance',
  'Solaire correcteur',
  'Autre',
] as const;
export type LensProductType = (typeof LENS_PRODUCT_TYPES)[number];

/* ---------------- Verres à la carte (type de base + traitements) ---------------- */

/**
 * Verres priçables : type de base (une clé de lensPricing) et traitements
 * (options additionnées). Sert au configurateur produit ET à la caisse/ventes,
 * pour que le prix affiché vienne toujours des Réglages de l'établissement.
 */
export const LENS_BASES = [
  { key: 'unifocal', label: 'Unifocal' },
  { key: 'progressif', label: 'Progressif' },
  { key: 'degressif', label: 'Dégressif (bureau)' },
] as const;
export type LensBaseKey = (typeof LENS_BASES)[number]['key'];

export const LENS_TREATMENTS = [
  { key: 'ar', label: 'Anti-reflet' },
  { key: 'blue', label: 'Anti-lumière bleue' },
  { key: 'photo', label: 'Photochromique' },
  { key: 'hard', label: 'Durci (anti-rayures)' },
] as const;
export type LensTreatmentKey = (typeof LENS_TREATMENTS)[number]['key'];

/** Indices d'amincissement (multiplicateur physique appliqué au prix du verre). */
export const LENS_INDICES = [
  { id: '1.5', label: '1.5 (standard)', mult: 1 },
  { id: '1.6', label: '1.6 (aminci)', mult: 1.3 },
  { id: '1.67', label: '1.67 (extra-aminci)', mult: 1.7 },
  { id: '1.74', label: '1.74 (ultra-aminci)', mult: 2.2 },
] as const;
export type LensIndexId = (typeof LENS_INDICES)[number]['id'];

/**
 * Tous les types de verres disponibles = 3 types fixes + types personnalisés
 * de l'établissement (Réglages). Sert à peupler les listes déroulantes partout.
 */
export function lensBaseOptions(pricing: LensPricing): { key: string; label: string; price: number }[] {
  const fixed = LENS_BASES.map((b) => ({ key: b.key, label: b.label, price: pricing[b.key] ?? 0 }));
  const custom = (pricing.customTypes ?? []).map((c) => ({ key: c.id, label: c.name, price: c.price }));
  return [...fixed, ...custom];
}

/** Prix d'un type de base (fixe ou personnalisé). */
export function lensBasePrice(pricing: LensPricing, base: string): number {
  if (LENS_BASES.some((b) => b.key === base)) return pricing[base as LensBaseKey] ?? 0;
  return (pricing.customTypes ?? []).find((c) => c.id === base)?.price ?? 0;
}

/** Libellé d'un type de base (fixe ou personnalisé). */
export function lensBaseLabel(pricing: LensPricing, base: string): string {
  const fixed = LENS_BASES.find((b) => b.key === base);
  if (fixed) return fixed.label;
  return (pricing.customTypes ?? []).find((c) => c.id === base)?.name ?? base;
}

/** Prix d'un verre = prix du type de base + somme des traitements choisis. */
export function computeLensPrice(
  pricing: LensPricing,
  base: string,
  treatments: LensTreatmentKey[],
): number {
  return Math.round(treatments.reduce((sum, t) => sum + (pricing[t] ?? 0), lensBasePrice(pricing, base)));
}

/** Libellé lisible d'un verre configuré, ex. « Verre progressif · anti-reflet + photochromique ». */
export function lensLabel(pricing: LensPricing, base: string, treatments: LensTreatmentKey[]): string {
  const baseLabel = lensBaseLabel(pricing, base);
  const treats = treatments
    .map((t) => LENS_TREATMENTS.find((x) => x.key === t)?.label ?? t)
    .join(' + ');
  return treats ? `Verre ${baseLabel.toLowerCase()} · ${treats}` : `Verre ${baseLabel.toLowerCase()}`;
}

/** Référence déterministe d'un verre configuré (upsert idempotent côté serveur). */
export function lensSku(base: string, treatments: LensTreatmentKey[]): string {
  const clean = base.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const suffix = [...treatments].sort().join('-');
  return suffix ? `VERRE-${clean}-${suffix.toUpperCase()}` : `VERRE-${clean}`;
}

/** Requête de configuration d'un verre (caisse/ventes). Base = type fixe ou personnalisé. */
export const lensProductSchema = z.object({
  base: z.string().min(1).max(40),
  treatments: z.array(z.enum(['ar', 'blue', 'photo', 'hard'])).default([]),
});
export type LensProductInput = z.infer<typeof lensProductSchema>;

/**
 * Catégories fabriquées sur commande : pas de gestion de stock (les verres sont
 * commandés au labo à chaque vente). La caisse ne bloque donc pas sur le stock.
 */
export const MADE_TO_ORDER_CATEGORIES = ['VERRE'] as const;

/** Vrai pour les catégories fabriquées sur commande (stock illimité, non bloquant). */
export function isMadeToOrderCategory(category: string): boolean {
  return (MADE_TO_ORDER_CATEGORIES as readonly string[]).includes(category);
}

/* ---------------- Modèles de messages WhatsApp (par étape de vente) ---------------- */

/** Étapes du parcours de vente pour lesquelles un message peut être envoyé. */
export const SALE_WA_STAGES = [
  { key: 'quote', label: 'Devis créé' },
  { key: 'sale_paid', label: 'Vente encaissée' },
  { key: 'lens_ordered', label: 'Verres commandés' },
  { key: 'lens_ready', label: 'Verres prêts' },
  { key: 'lens_delivered', label: 'Verres livrés / retirés' },
] as const;
export type SaleWaStage = (typeof SALE_WA_STAGES)[number]['key'];

/** Modèles par défaut. Variables : {client} {etablissement} {numero} {montant} {reste}. */
export const DEFAULT_WA_TEMPLATES: Record<SaleWaStage, string> = {
  quote:
    'Bonjour {client}, voici votre devis {numero} chez {etablissement} : {montant}. Il reste valable quelques jours. Cordialement.',
  sale_paid:
    'Bonjour {client}, nous confirmons votre règlement de {montant} chez {etablissement}. Merci de votre confiance !',
  lens_ordered:
    'Bonjour {client}, vos verres ont bien été commandés chez {etablissement}. Nous vous préviendrons dès leur arrivée.',
  lens_ready:
    'Bonjour {client}, bonne nouvelle : vos verres sont prêts ! Vous pouvez passer les retirer chez {etablissement}.',
  lens_delivered:
    'Bonjour {client}, merci d’avoir retiré vos verres chez {etablissement}. Prenez soin de votre vue !',
};

export const whatsappTemplatesSchema = z
  .object({
    quote: z.string().max(1000),
    sale_paid: z.string().max(1000),
    lens_ordered: z.string().max(1000),
    lens_ready: z.string().max(1000),
    lens_delivered: z.string().max(1000),
  })
  .partial();
export type WhatsappTemplates = z.infer<typeof whatsappTemplatesSchema>;

/** Remplace les variables {xxx} d'un modèle par leurs valeurs (vides si absentes). */
export function fillWaTemplate(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] != null ? String(vars[k]) : ''));
}

/** Barème par défaut (repli quand l'établissement n'a rien configuré). */
export const DEFAULT_LENS_PRICING: LensPricing = {
  unifocal: 15000,
  progressif: 45000,
  degressif: 30000,
  ar: 5000,
  blue: 8000,
  photo: 15000,
  hard: 3000,
};

export const brandingUpdateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  logoUrl: imageData,
  /** Situation géographique (adresse ou lien de carte). */
  location: z.string().max(200).optional(),
  /** Contact de l'entreprise (affichable sur les documents). */
  contactPhone: z.string().max(40).optional(),
  contactEmail: z.string().max(120).optional(),
  /** Taux de TVA de l'établissement, en pourcentage (0 = exonéré). */
  vatRate: z.number().min(0).max(100).optional(),
  invoiceSettings: invoiceSettingsSchema.optional(),
  /** Tarifs verres/traitements de l'établissement. */
  lensPricing: lensPricingSchema.optional(),
  /** Investissement initial (projection d'amortissement, page Finance). */
  initialInvestment: z.number().nonnegative().optional(),
  /** Modèles de messages WhatsApp par étape de vente. */
  whatsappTemplates: whatsappTemplatesSchema.optional(),
  /** Réglages métier optique (validité ordonnance, relances, garantie, fidélité). */
  opticalSettings: opticalSettingsSchema.partial().optional(),
});
export type BrandingUpdateInput = z.infer<typeof brandingUpdateSchema>;

/* ============================================================
 * TYPES DE RÉPONSE PARTAGÉS
 * ============================================================ */

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  username: string | null;
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  roleId: string;
  /** Identifiant stable du rôle (ex: "admin", "opticien") — sûr à comparer. */
  roleCode: string;
  /** Libellé affiché : personnalisable par l'établissement, ne pas comparer. */
  roleName: string;
  permissions: string[];
  branchIds: string[];
  allBranches: boolean;
  tenantName: string;
  tenantLogoUrl: string | null;
  /** Devise de l'établissement (XOF, CVE, AOA, MZN…) — pilote tout l'affichage monétaire. */
  tenantCurrency: string;
  /** Pays ISO-2 : sert à proposer les bons moyens d'encaissement en caisse. */
  tenantCountryCode: string | null;
  /** Situation géographique + contact de l'établissement (documents). */
  tenantLocation: string | null;
  tenantContactPhone: string | null;
  tenantContactEmail: string | null;
  /** Taux de TVA de l'établissement en pourcentage (null = défaut 18 %). */
  tenantVatRate: number | null;
  /** Personnalisation des factures/devis (couleur, mentions légales…). */
  tenantInvoiceSettings: InvoiceSettings | null;
  /** Tarifs verres/traitements de l'établissement (null = barème par défaut). */
  tenantLensPricing: LensPricing | null;
  /** Modèles de messages WhatsApp par étape (null = modèles par défaut). */
  tenantWhatsappTemplates: WhatsappTemplates | null;
  /** Réglages métier optique (validité ordonnance, garantie, fidélité). */
  tenantOpticalSettings: OpticalSettings;
  /** Vrai uniquement pour l'éditeur du SaaS (console plateforme, MRR…). */
  isPlatformOperator: boolean;
  /** Vrai une fois l'adresse email confirmée. */
  emailVerified: boolean;
}

export const verifyEmailSchema = z.object({ token: z.string().min(10) });
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}
