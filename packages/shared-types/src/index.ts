import { z } from 'zod';

/* ============================================================
 * ENUMS — doivent rester synchronisés avec schema.prisma
 * ============================================================ */

export const ProductCategory = {
  MONTURE: 'MONTURE',
  VERRE: 'VERRE',
  LENTILLE: 'LENTILLE',
  ACCESSOIRE: 'ACCESSOIRE',
  SERVICE: 'SERVICE',
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

/** Catalogue des offres — source de vérité pour le seed et l'affichage. */
export interface PlanDef {
  code: 'TRIAL' | 'STANDARD' | 'PREMIUM';
  name: string;
  description: string;
  priceMonthly: number;
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
    code: 'TRIAL',
    name: 'Découverte',
    description: "Offre d'essai pour démarrer avec les fonctionnalités essentielles.",
    priceMonthly: 2500,
    trialDays: 14,
    maxUsers: 2,
    maxBranches: 1,
    maxPatients: 50,
    maxSales: 50,
    features: [
      'Fonctionnalités essentielles',
      "Jusqu'à 2 utilisateurs",
      "Jusqu'à 50 patients et 50 ventes",
      'Support standard',
      'Évolutif à tout moment',
    ],
    sortOrder: 1,
  },
  {
    code: 'STANDARD',
    name: 'Standard',
    description: "Gestion complète d'un magasin d'optique ou d'une clinique.",
    priceMonthly: 12000,
    trialDays: 0,
    maxUsers: 10,
    maxBranches: 1,
    maxPatients: null,
    maxSales: null,
    features: [
      'Fonctionnalités principales',
      'Gestion des stocks, patients et ventes',
      'Gestion des paiements et dépenses',
      'Tableau de bord complet',
      "Jusqu'à 10 utilisateurs",
      'Support prioritaire',
    ],
    sortOrder: 2,
  },
  {
    code: 'PREMIUM',
    name: 'Premium',
    description: 'Toutes les fonctionnalités, multi-agences et utilisateurs illimités.',
    priceMonthly: 23000,
    trialDays: 0,
    maxUsers: null,
    maxBranches: null,
    maxPatients: null,
    maxSales: null,
    features: [
      'Toutes les fonctionnalités',
      'Utilisateurs illimités',
      'Multi-agences / multi-magasins',
      'Gestion financière et RH avancées',
      'Rapports et statistiques avancés',
      'Sauvegardes renforcées',
      'Support premium',
    ],
    sortOrder: 3,
  },
];

export const TRIAL_PLAN_CODE = 'TRIAL';

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
    'optique.sales.view', 'optique.sales.create', 'optique.sales.update',
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
    'optique.sales.view', 'optique.sales.create',
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
    'optique.sales.view', 'optique.sales.create',
    'suppliers.view',
    'insurance.view',
  ],
};

/* ============================================================
 * CONSTANTES MÉTIER
 * ============================================================ */

export const DEFAULT_CURRENCY = 'XOF';
export const SUPPORTED_CURRENCIES = ['XOF', 'XAF'] as const;
export const VAT_RATE = 0.18; // TVA 18 % (UEMOA)
export const SUPPORTED_LOCALES = ['fr', 'en', 'pt'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/* ============================================================
 * SCHÉMAS ZOD (DTO partagés front/back)
 * ============================================================ */

const passwordSchema = z
  .string()
  .min(8, 'Le mot de passe doit contenir au moins 8 caractères')
  .max(128);

export const signupSchema = z.object({
  tenantName: z.string().min(2).max(120),
  branchName: z.string().min(2).max(120).default('Magasin principal'),
  adminFirstName: z.string().min(1).max(80),
  adminLastName: z.string().min(1).max(80),
  adminEmail: z.string().email(),
  adminUsername: z.string().min(3).max(40).optional(),
  adminPassword: passwordSchema,
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  identifier: z.string().min(1, "Email ou nom d'utilisateur requis"),
  password: z.string().min(1, 'Mot de passe requis'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const verifyPasswordSchema = z.object({
  password: z.string().min(1),
});
export type VerifyPasswordInput = z.infer<typeof verifyPasswordSchema>;

export const productCategoryEnum = z.enum([
  ProductCategory.MONTURE,
  ProductCategory.VERRE,
  ProductCategory.LENTILLE,
  ProductCategory.ACCESSOIRE,
  ProductCategory.SERVICE,
]);

export const productCreateSchema = z.object({
  sku: z.string().min(1).max(60),
  category: productCategoryEnum,
  brand: z.string().max(80).optional(),
  name: z.string().min(1).max(160),
  attributes: z.record(z.any()).optional(),
  buyPrice: z.number().nonnegative(),
  sellPrice: z.number().nonnegative(),
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
});
export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;

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
});
export type PrescriptionCreateInput = z.infer<typeof prescriptionCreateSchema>;

export const branchCreateSchema = z.object({
  name: z.string().min(2).max(120),
  city: z.string().max(80).optional(),
});
export type BranchCreateInput = z.infer<typeof branchCreateSchema>;

export const saleItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export const saleCreateSchema = z.object({
  branchId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  type: z.enum([SaleType.SALE, SaleType.QUOTE]).default(SaleType.SALE),
  items: z.array(saleItemSchema).min(1, 'Au moins un article requis'),
  discountAmount: z.number().nonnegative().default(0),
  insuranceAmount: z.number().nonnegative().default(0),
});
export type SaleCreateInput = z.infer<typeof saleCreateSchema>;

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

export const paymentConfigSchema = z.object({
  apiKey: z.string().optional().default(''),
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
  notes: z.string().max(2000).optional().or(z.literal('')),
});
export type ConsultationCreateInput = z.infer<typeof consultationCreateSchema>;

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
  roleId: string;
  roleName: string;
  permissions: string[];
  branchIds: string[];
  allBranches: boolean;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}
