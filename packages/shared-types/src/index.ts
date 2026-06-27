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
  ],

  opticien: [
    'dashboard.view',
    'optique.products.view',
    'optique.stock.view', 'optique.stock.adjust',
    'optique.sales.view', 'optique.sales.create', 'optique.sales.update',
    'optique.quotes.view', 'optique.quotes.create', 'optique.quotes.convert',
    'optique.cashregister.view', 'optique.cashregister.open', 'optique.cashregister.close',
    'optique.customers.view', 'optique.customers.create', 'optique.customers.update',
  ],

  ophtalmologue: ['dashboard.view', 'optique.customers.view'],
  orthoptiste: ['dashboard.view', 'optique.customers.view'],

  secretaire: [
    'dashboard.view',
    'optique.customers.view', 'optique.customers.create', 'optique.customers.update',
    'optique.quotes.view',
  ],

  receptionniste: [
    'dashboard.view',
    'optique.customers.view', 'optique.customers.create',
    'optique.sales.view',
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
  ],

  comptable: [
    'dashboard.view',
    'optique.sales.view',
    'settings.payments.view',
    'audit.logs.view',
  ],

  commercial: [
    'dashboard.view',
    'optique.products.view',
    'optique.customers.view', 'optique.customers.create', 'optique.customers.update',
    'optique.quotes.view', 'optique.quotes.create',
    'optique.sales.view', 'optique.sales.create',
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
