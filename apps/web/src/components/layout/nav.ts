import {
  LayoutDashboard,
  Users,
  Stethoscope,
  CalendarDays,
  Scissors,
  Package,
  Boxes,
  ShoppingCart,
  ReceiptText,
  FileText,
  Contact,
  UserCog,
  Wallet,
  Truck,
  ShieldCheck,
  ShieldHalf,
  Store,
  CreditCard,
  ScrollText,
  Crown,
  Server,
  LifeBuoy,
  Glasses,
  Wrench,
  BellRing,
  Barcode,
  Settings,
  Coins,
  Lock,
  BarChart3,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  permission?: string;
  /** Réservé à l'éditeur du SaaS (console plateforme). */
  operatorOnly?: boolean;
  soon?: boolean;
  badge?: 'lowStock';
}

export interface NavGroup {
  titleKey: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    titleKey: 'nav.main',
    items: [
      { to: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
      { to: '/parametres/abonnement', labelKey: 'nav.subscription', icon: Crown, permission: 'billing.view' },
    ],
  },
  {
    titleKey: 'nav.optics',
    items: [
      { to: '/optique/produits', labelKey: 'nav.products', icon: Package, permission: 'optique.products.view' },
      { to: '/optique/stock', labelKey: 'nav.stock', icon: Boxes, permission: 'optique.stock.view', badge: 'lowStock' },
      { to: '/optique/clients', labelKey: 'nav.clients', icon: Contact, permission: 'optique.customers.view' },
      { to: '/optique/caisse', labelKey: 'nav.pos', icon: ShoppingCart, permission: 'optique.sales.create' },
      { to: '/optique/ventes', labelKey: 'nav.sales', icon: ReceiptText, permission: 'optique.sales.view' },
      { to: '/optique/devis', labelKey: 'nav.quotes', icon: FileText, permission: 'optique.quotes.view' },
      { to: '/optique/commandes-verres', labelKey: 'nav.lensOrders', icon: Glasses, permission: 'optique.sales.view' },
      { to: '/optique/reparations', labelKey: 'nav.repairs', icon: Wrench, permission: 'optique.sales.view' },
      { to: '/optique/renouvellements', labelKey: 'nav.renewals', icon: BellRing, permission: 'optique.customers.view' },
      { to: '/optique/etiquettes', labelKey: 'nav.labels', icon: Barcode, permission: 'optique.products.view' },
      { to: '/optique/caisse-session', labelKey: 'nav.cashSession', icon: Lock, permission: 'optique.cashregister.view' },
    ],
  },
  {
    titleKey: 'nav.clinic',
    items: [
      { to: '/clinique/dashboard', labelKey: 'nav.clinicDashboard', icon: LayoutDashboard, permission: 'clinic.patients.view' },
      { to: '/clinique/patients', labelKey: 'nav.patients', icon: Users, permission: 'clinic.patients.view' },
      { to: '/clinique/consultations', labelKey: 'nav.consultations', icon: Stethoscope, permission: 'clinic.consultations.view' },
      { to: '/clinique/rendez-vous', labelKey: 'nav.appointments', icon: CalendarDays, permission: 'clinic.appointments.view' },
      { to: '/clinique/chirurgies', labelKey: 'nav.surgeries', icon: Scissors, permission: 'clinic.surgeries.view' },
    ],
  },
  {
    titleKey: 'nav.management',
    items: [
      { to: '/gestion/creances', labelKey: 'nav.receivables', icon: Coins, permission: 'optique.sales.view' },
      { to: '/gestion/rapports', labelKey: 'nav.reports', icon: BarChart3, permission: 'optique.sales.view' },
      { to: '/gestion/personnel', labelKey: 'nav.hr', icon: UserCog, permission: 'hr.employees.view' },
      { to: '/gestion/finance', labelKey: 'nav.finance', icon: Wallet, permission: 'finance.expenses.view' },
      { to: '/gestion/fournisseurs', labelKey: 'nav.suppliers', icon: Truck, permission: 'suppliers.view' },
      { to: '/gestion/assurances', labelKey: 'nav.insurance', icon: ShieldCheck, permission: 'insurance.view' },
    ],
  },
  {
    titleKey: 'nav.settings',
    items: [
      { to: '/parametres/roles', labelKey: 'nav.roles', icon: ShieldHalf, permission: 'rbac.roles.view' },
      { to: '/parametres/utilisateurs', labelKey: 'nav.users', icon: Users, permission: 'rbac.users.view' },
      { to: '/parametres/magasins', labelKey: 'nav.branches', icon: Store, permission: 'settings.branches.view' },
      { to: '/parametres/paiements', labelKey: 'nav.payments', icon: CreditCard, permission: 'settings.payments.view' },
      { to: '/parametres/journal', labelKey: 'nav.audit', icon: ScrollText, permission: 'audit.logs.view' },
      { to: '/aide', labelKey: 'nav.support', icon: LifeBuoy },
      { to: '/parametres/profil', labelKey: 'nav.settingsShortcut', icon: Settings },
    ],
  },
  {
    titleKey: 'nav.operator',
    items: [
      { to: '/plateforme', labelKey: 'nav.platform', icon: Server, operatorOnly: true },
    ],
  },
];
