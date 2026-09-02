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
  PlayCircle,
  Target,
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
  ListChecks,
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
  badge?: 'lowStock' | 'lensOverdue';
}

export interface NavGroup {
  titleKey: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    titleKey: 'nav.group.home',
    items: [
      { to: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
      { to: '/configuration-boutique', labelKey: 'nav.storeSetup', icon: ListChecks, permission: 'dashboard.view' },
      { to: '/parametres/abonnement', labelKey: 'nav.subscription', icon: Crown, permission: 'billing.view' },
      { to: '/demo/videos', labelKey: 'nav.demoVideos', icon: PlayCircle, permission: 'dashboard.view' },
    ],
  },
  {
    titleKey: 'nav.group.sales',
    items: [
      { to: '/optique/caisse', labelKey: 'nav.pos', icon: ShoppingCart, permission: 'optique.sales.create' },
      { to: '/optique/ventes', labelKey: 'nav.sales', icon: ReceiptText, permission: 'optique.sales.view' },
      { to: '/optique/devis', labelKey: 'nav.quotes', icon: FileText, permission: 'optique.quotes.view' },
      { to: '/optique/caisse-session', labelKey: 'nav.cashSession', icon: Lock, permission: 'optique.cashregister.view' },
      { to: '/optique/commandes-verres', labelKey: 'nav.lensOrders', icon: Glasses, permission: 'optique.sales.view', badge: 'lensOverdue' },
      { to: '/optique/reparations', labelKey: 'nav.repairs', icon: Wrench, permission: 'optique.sales.view' },
      { to: '/gestion/creances', labelKey: 'nav.receivables', icon: Coins, permission: 'optique.sales.view' },
    ],
  },
  {
    titleKey: 'nav.group.patients',
    items: [
      { to: '/clinique/dashboard', labelKey: 'nav.clinicDashboard', icon: LayoutDashboard, permission: 'clinic.patients.view' },
      { to: '/clinique/patients', labelKey: 'nav.patients', icon: Users, permission: 'clinic.patients.view' },
      { to: '/optique/clients', labelKey: 'nav.clients', icon: Contact, permission: 'optique.customers.view' },
      { to: '/clinique/consultations', labelKey: 'nav.consultations', icon: Stethoscope, permission: 'clinic.consultations.view' },
      { to: '/clinique/rendez-vous', labelKey: 'nav.appointments', icon: CalendarDays, permission: 'clinic.appointments.view' },
      { to: '/clinique/chirurgies', labelKey: 'nav.surgeries', icon: Scissors, permission: 'clinic.surgeries.view' },
      { to: '/optique/renouvellements', labelKey: 'nav.renewals', icon: BellRing, permission: 'optique.customers.view' },
    ],
  },
  {
    titleKey: 'nav.group.catalog',
    items: [
      { to: '/optique/stock', labelKey: 'nav.stock', icon: Boxes, permission: 'optique.stock.view', badge: 'lowStock' },
      { to: '/optique/produits?category=MONTURE', labelKey: 'nav.montures', icon: Package, permission: 'optique.products.view' },
      { to: '/optique/produits?category=VERRE', labelKey: 'nav.verres', icon: Glasses, permission: 'optique.products.view' },
      { to: '/optique/produits', labelKey: 'nav.products', icon: Package, permission: 'optique.products.view' },
      { to: '/optique/etiquettes', labelKey: 'nav.labels', icon: Barcode, permission: 'optique.products.view' },
      { to: '/gestion/fournisseurs', labelKey: 'nav.suppliers', icon: Truck, permission: 'suppliers.view' },
    ],
  },
  {
    titleKey: 'nav.group.management',
    items: [
      { to: '/gestion/finance', labelKey: 'nav.finance', icon: Wallet, permission: 'finance.expenses.view' },
      { to: '/gestion/rapports', labelKey: 'nav.reports', icon: BarChart3, permission: 'optique.sales.view' },
      { to: '/gestion/personnel', labelKey: 'nav.hr', icon: UserCog, permission: 'hr.employees.view' },
      { to: '/gestion/assurances', labelKey: 'nav.insurance', icon: ShieldCheck, permission: 'insurance.view' },
    ],
  },
  {
    titleKey: 'nav.group.settings',
    items: [
      { to: '/parametres/utilisateurs', labelKey: 'nav.users', icon: Users, permission: 'rbac.users.view' },
      { to: '/parametres/roles', labelKey: 'nav.roles', icon: ShieldHalf, permission: 'rbac.roles.view' },
      { to: '/parametres/magasins', labelKey: 'nav.branches', icon: Store, permission: 'settings.branches.view' },
      { to: '/parametres/paiements', labelKey: 'nav.payments', icon: CreditCard, permission: 'settings.payments.view' },
      { to: '/parametres/journal', labelKey: 'nav.audit', icon: ScrollText, permission: 'audit.logs.view' },
      { to: '/parametres/profil', labelKey: 'nav.settingsShortcut', icon: Settings },
      { to: '/aide', labelKey: 'nav.support', icon: LifeBuoy },
    ],
  },
  {
    titleKey: 'nav.operator',
    items: [
      { to: '/plateforme', labelKey: 'nav.platform', icon: Server, operatorOnly: true },
      { to: '/plateforme/crm', labelKey: 'nav.crm', icon: Target, operatorOnly: true },
    ],
  },
];
