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

/**
 * Pays d'Afrique de l'Ouest (CEDEAO + Mauritanie) avec leur indicatif
 * téléphonique international. Sert de source unique au sélecteur d'indicatif du
 * formulaire d'inscription ET à la validation du numéro WhatsApp.
 */
export const WEST_AFRICA_COUNTRIES = [
  { code: 'BJ', name: 'Bénin', dial: '+229', flag: '🇧🇯' },
  { code: 'BF', name: 'Burkina Faso', dial: '+226', flag: '🇧🇫' },
  { code: 'CV', name: 'Cap-Vert', dial: '+238', flag: '🇨🇻' },
  { code: 'CI', name: "Côte d'Ivoire", dial: '+225', flag: '🇨🇮' },
  { code: 'GM', name: 'Gambie', dial: '+220', flag: '🇬🇲' },
  { code: 'GH', name: 'Ghana', dial: '+233', flag: '🇬🇭' },
  { code: 'GN', name: 'Guinée', dial: '+224', flag: '🇬🇳' },
  { code: 'GW', name: 'Guinée-Bissau', dial: '+245', flag: '🇬🇼' },
  { code: 'LR', name: 'Libéria', dial: '+231', flag: '🇱🇷' },
  { code: 'ML', name: 'Mali', dial: '+223', flag: '🇲🇱' },
  { code: 'MR', name: 'Mauritanie', dial: '+222', flag: '🇲🇷' },
  { code: 'NE', name: 'Niger', dial: '+227', flag: '🇳🇪' },
  { code: 'NG', name: 'Nigéria', dial: '+234', flag: '🇳🇬' },
  { code: 'SN', name: 'Sénégal', dial: '+221', flag: '🇸🇳' },
  { code: 'SL', name: 'Sierra Leone', dial: '+232', flag: '🇸🇱' },
  { code: 'TG', name: 'Togo', dial: '+228', flag: '🇹🇬' },
] as const;

/** Indicatifs acceptés (dérivés de WEST_AFRICA_COUNTRIES). */
export const WEST_AFRICA_DIAL_CODES = WEST_AFRICA_COUNTRIES.map((c) => c.dial);

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
      return WEST_AFRICA_DIAL_CODES.some((d) => cleaned.startsWith(d));
    },
    "Indicatif d'Afrique de l'Ouest requis (ex : +221 77 123 45 67)",
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

/** Changement de mot de passe par un utilisateur connecté (exige l'ancien). */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
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
  // Mesures avancées de montage
  odHeight: opt,
  ogHeight: opt,
  odNearPd: opt,
  ogNearPd: opt,
  vertex: opt,
  pantoTilt: opt,
});
export type PrescriptionCreateInput = z.infer<typeof prescriptionCreateSchema>;

/* --- Commandes de verres (laboratoire) & SAV / réparations --- */
export const LENS_ORDER_STATUSES = ['ORDERED', 'RECEIVED', 'MOUNTED', 'DELIVERED', 'CANCELLED'] as const;
export type LensOrderStatus = (typeof LENS_ORDER_STATUSES)[number];
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
  roleName: string;
  permissions: string[];
  branchIds: string[];
  allBranches: boolean;
  tenantName: string;
  tenantLogoUrl: string | null;
  /** Situation géographique + contact de l'établissement (documents). */
  tenantLocation: string | null;
  tenantContactPhone: string | null;
  tenantContactEmail: string | null;
  /** Taux de TVA de l'établissement en pourcentage (null = défaut 18 %). */
  tenantVatRate: number | null;
  /** Personnalisation des factures/devis (couleur, mentions légales…). */
  tenantInvoiceSettings: InvoiceSettings | null;
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
