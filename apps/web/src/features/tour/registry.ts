import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Contact,
  ReceiptText,
  Users,
  Stethoscope,
  BarChart3,
  Wallet,
  Settings,
  ShieldHalf,
  Compass,
  Glasses,
  CalendarDays,
} from 'lucide-react';
import type { TourDefinition, TourStep } from './types';

/* ============================================================
 * Registre des visites guidées.
 *
 * AJOUTER UNE ÉTAPE : poser `data-tour="mon-ancre"` sur l'élément visé, puis
 * ajouter un objet ici. Aucun autre fichier à toucher — le moteur lit ce
 * registre. Incrémenter `version` d'une visite la re-propose aux utilisateurs
 * qui l'avaient déjà terminée.
 * ============================================================ */

/** Étapes communes à tous les parcours : repères de navigation. */
const SHELL_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Bienvenue sur OculoSaaS',
    content:
      "Deux minutes pour faire le tour du logiciel. Vous pouvez quitter à tout moment et reprendre plus tard, exactement où vous vous êtes arrêté.",
    icon: Compass,
    placement: 'center',
  },
  {
    id: 'sidebar',
    target: '[data-tour="sidebar"]',
    title: 'Le menu principal',
    content:
      "Tous vos écrans sont ici, regroupés par métier : optique, clinique, gestion et réglages. Vous ne voyez que ce que votre rôle vous autorise.",
    placement: 'right',
  },
  {
    id: 'branch',
    target: '[data-tour="branch-switch"]',
    title: 'Votre magasin actif',
    content:
      'Si vous gérez plusieurs magasins, ce sélecteur change celui sur lequel vous travaillez. Ventes, stocks et rapports suivent ce choix.',
    placement: 'bottom',
  },
];

const DASHBOARD_STEP: TourStep = {
  id: 'dashboard',
  target: '[data-tour="nav:/dashboard"]',
  route: '/dashboard',
  title: 'Le tableau de bord',
  content:
    "Votre chiffre d'affaires du jour et du mois, les ventes récentes et les alertes de stock. Tout se met à jour automatiquement.",
  icon: LayoutDashboard,
  placement: 'right',
};

const SETTINGS_STEP: TourStep = {
  id: 'settings',
  target: '[data-tour="nav:/parametres/profil"]',
  title: 'Vos réglages',
  content:
    'Votre profil, le logo et les coordonnées de votre établissement, et la personnalisation de vos factures et devis.',
  icon: Settings,
  placement: 'right',
};

const FINISH_STEP: TourStep = {
  id: 'finish',
  title: 'Vous êtes prêt',
  content:
    "C'est tout pour l'essentiel. Vous pouvez relancer cette visite quand vous voulez depuis Réglages ou Aide & support.",
  icon: Compass,
  placement: 'center',
};

/** Étapes optique, filtrées par permission pour ne jamais viser un écran absent. */
const OPTIQUE_STEPS: TourStep[] = [
  {
    id: 'pos',
    target: '[data-tour="nav:/optique/caisse"]',
    title: 'La caisse',
    content:
      "C'est ici que vous encaissez. Ajoutez des articles, ajustez librement les prix, appliquez une remise, puis encaissez — en une fois ou de façon échelonnée.",
    icon: ShoppingCart,
    placement: 'right',
    enabled: (c) => c.permissions.has('optique.sales.create'),
  },
  {
    id: 'sales',
    target: '[data-tour="nav:/optique/ventes"]',
    title: "L'historique des ventes",
    content:
      "Toutes vos ventes. Vous pouvez rééditer une facture en PDF, encaisser un solde restant, enregistrer un retour ou annuler une vente — le chiffre d'affaires se corrige tout seul.",
    icon: ReceiptText,
    placement: 'right',
    enabled: (c) => c.permissions.has('optique.sales.view'),
  },
  {
    id: 'stock',
    target: '[data-tour="nav:/optique/stock"]',
    title: 'Le stock',
    content:
      "Vos quantités par magasin. Une pastille rouge apparaît dès qu'un article passe sous son seuil d'alerte.",
    icon: Boxes,
    placement: 'right',
    enabled: (c) => c.permissions.has('optique.stock.view'),
  },
  {
    id: 'clients',
    target: '[data-tour="nav:/optique/clients"]',
    title: 'Vos clients',
    content:
      'Le fichier client avec ses ordonnances. Vous pouvez exporter la liste complète en PDF et lancer un devis en un clic.',
    icon: Contact,
    placement: 'right',
    enabled: (c) => c.permissions.has('optique.customers.view'),
  },
  {
    id: 'lens-orders',
    target: '[data-tour="nav:/optique/commandes-verres"]',
    title: 'Les commandes de verres',
    content:
      'Le suivi de vos commandes au laboratoire. La colonne « Délai livraison » signale en rouge toute commande en retard.',
    icon: Glasses,
    placement: 'right',
    enabled: (c) => c.permissions.has('optique.sales.view'),
  },
];

const CLINIC_STEPS: TourStep[] = [
  {
    id: 'patients',
    target: '[data-tour="nav:/clinique/patients"]',
    title: 'Vos patients',
    content:
      'Les dossiers patients : antécédents, consultations, tension oculaire et ordonnances médicales imprimables.',
    icon: Users,
    placement: 'right',
    enabled: (c) => c.permissions.has('clinic.patients.view'),
  },
  {
    id: 'consultations',
    target: '[data-tour="nav:/clinique/consultations"]',
    title: 'Les consultations',
    content:
      "L'historique des consultations et la rédaction des ordonnances, rattachées au dossier du patient.",
    icon: Stethoscope,
    placement: 'right',
    enabled: (c) => c.permissions.has('clinic.consultations.view'),
  },
  {
    id: 'appointments',
    target: '[data-tour="nav:/clinique/rendez-vous"]',
    title: 'Les rendez-vous',
    content: "L'agenda de votre clinique : planification et suivi des rendez-vous.",
    icon: CalendarDays,
    placement: 'right',
    enabled: (c) => c.permissions.has('clinic.appointments.view'),
  },
];

const MANAGEMENT_STEPS: TourStep[] = [
  {
    id: 'reports',
    target: '[data-tour="nav:/gestion/rapports"]',
    title: 'Rapports & statistiques',
    content:
      'Vos ventes sur la période de votre choix, avec le panier moyen, et un export CSV pour votre comptable.',
    icon: BarChart3,
    placement: 'right',
    enabled: (c) => c.permissions.has('optique.sales.view'),
  },
  {
    id: 'finance',
    target: '[data-tour="nav:/gestion/finance"]',
    title: 'La finance',
    content:
      'Vos recettes et vos dépenses du mois. Le résultat net se recalcule seul à chaque vente, encaissement ou annulation.',
    icon: Wallet,
    placement: 'right',
    enabled: (c) => c.permissions.has('finance.expenses.view'),
  },
];

const USERS_STEP: TourStep = {
  id: 'users',
  target: '[data-tour="nav:/parametres/utilisateurs"]',
  title: 'Votre équipe',
  content:
    'Créez les comptes de vos employés et attribuez leur rôle. Chaque rôle ouvre un jeu de permissions précis.',
  icon: ShieldHalf,
  placement: 'right',
  enabled: (c) => c.permissions.has('rbac.users.view'),
};

export const TOURS: TourDefinition[] = [
  {
    id: 'admin',
    label: 'Visite administrateur',
    roles: ['super_admin', 'admin', 'gestionnaire'],
    version: 1,
    steps: [
      ...SHELL_STEPS,
      DASHBOARD_STEP,
      ...OPTIQUE_STEPS,
      ...CLINIC_STEPS,
      ...MANAGEMENT_STEPS,
      USERS_STEP,
      SETTINGS_STEP,
      FINISH_STEP,
    ],
  },
  {
    id: 'opticien',
    label: 'Visite opticien',
    roles: ['opticien', 'responsable_stocks'],
    version: 1,
    steps: [...SHELL_STEPS, DASHBOARD_STEP, ...OPTIQUE_STEPS, SETTINGS_STEP, FINISH_STEP],
  },
  {
    id: 'ophtalmologue',
    label: 'Visite ophtalmologue',
    roles: ['ophtalmologue', 'orthoptiste'],
    version: 1,
    steps: [...SHELL_STEPS, DASHBOARD_STEP, ...CLINIC_STEPS, SETTINGS_STEP, FINISH_STEP],
  },
  {
    id: 'secretaire',
    label: 'Visite secrétariat',
    roles: ['secretaire', 'receptionniste'],
    version: 1,
    steps: [
      ...SHELL_STEPS,
      DASHBOARD_STEP,
      ...CLINIC_STEPS,
      OPTIQUE_STEPS[3], // clients
      SETTINGS_STEP,
      FINISH_STEP,
    ],
  },
  {
    id: 'commercial',
    label: 'Visite commerciale',
    roles: ['commercial', 'caissier'],
    version: 1,
    steps: [
      ...SHELL_STEPS,
      DASHBOARD_STEP,
      OPTIQUE_STEPS[0], // caisse
      OPTIQUE_STEPS[1], // ventes
      OPTIQUE_STEPS[3], // clients
      SETTINGS_STEP,
      FINISH_STEP,
    ],
  },
  {
    // Repli : tout rôle non listé ci-dessus (comptable…) a quand même une visite.
    id: 'default',
    label: 'Visite guidée',
    roles: ['*'],
    version: 1,
    steps: [...SHELL_STEPS, DASHBOARD_STEP, ...MANAGEMENT_STEPS, SETTINGS_STEP, FINISH_STEP],
  },
];

/** Visite correspondant à un rôle, avec repli sur `default`. */
export function resolveTour(roleCode?: string | null): TourDefinition {
  const byRole = roleCode && TOURS.find((t) => t.roles.includes(roleCode));
  return byRole || TOURS.find((t) => t.roles.includes('*')) || TOURS[0];
}

export function getTourById(id: string): TourDefinition | undefined {
  return TOURS.find((t) => t.id === id);
}
