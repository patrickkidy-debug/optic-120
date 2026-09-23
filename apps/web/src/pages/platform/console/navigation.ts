import {
  BadgeCheck,
  BellRing,
  Building2,
  CalendarClock,
  CreditCard,
  Flame,
  Handshake,
  LayoutDashboard,
  Layers,
  LifeBuoy,
  ListChecks,
  Lock,
  Megaphone,
  Receipt,
  Repeat,
  Settings,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { FounderOverview } from '../../../features/billing/console';

/**
 * Plan de navigation de la console (§3, §33).
 *
 * Une seule source pour la barre latérale, le titre de la barre supérieure et
 * les liens profonds : trois listes séparées finiraient par ne plus désigner
 * les mêmes écrans.
 *
 * L'identifiant d'une section EST son segment d'URL : `/plateforme/factures`
 * ouvre la section `factures`. Un lien de la console est donc partageable, et
 * un rechargement ne ramène pas à l'accueil.
 */

export type SectionId =
  | 'overview'
  | 'utilisateurs'
  | 'etablissements'
  | 'demos'
  | 'engagement'
  | 'abonnements'
  | 'renouvellements'
  | 'a-confirmer'
  | 'offres'
  | 'finances'
  | 'factures'
  | 'paiements'
  | 'revenus'
  | 'configuration'
  | 'equipe'
  | 'partenaires'
  | 'nouveautes'
  | 'support'
  | 'parametres';

export interface NavItem {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  /** Titre de la barre supérieure, quand il diffère du libellé du menu. */
  pageTitle?: string;
  subtitle?: string;
  /** Compteur d'action à afficher en pastille, lu depuis la vue d'ensemble. */
  badge?: (o: FounderOverview) => number;
}

export interface NavGroup {
  id: string;
  label: string | null;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'accueil',
    label: null,
    items: [
      {
        id: 'overview',
        label: "Vue d'ensemble",
        icon: LayoutDashboard,
        pageTitle: 'Vue d’ensemble',
        subtitle: 'Ce qui se passe sur OculoSaaS',
      },
    ],
  },
  {
    id: 'croissance',
    label: 'Croissance',
    items: [
      { id: 'utilisateurs', label: 'Utilisateurs', icon: Users, subtitle: 'Comptes de tous les établissements' },
      { id: 'etablissements', label: 'Établissements', icon: Building2, subtitle: 'Clients d’OculoSaaS' },
      {
        id: 'demos',
        label: 'Démos',
        icon: CalendarClock,
        subtitle: 'Demandes de démonstration',
        badge: (o) => o.actionRequired.demosToProcess,
      },
      { id: 'engagement', label: 'Engagement', icon: Flame, subtitle: 'Usage réel du logiciel' },
    ],
  },
  {
    id: 'abonnements',
    label: 'Abonnements',
    items: [
      { id: 'abonnements', label: 'Abonnements', icon: Repeat, subtitle: 'État de chaque abonnement' },
      {
        id: 'renouvellements',
        label: 'Renouvellements',
        icon: BellRing,
        subtitle: 'Échéances à relancer',
        badge: (o) => o.renewals.next48h,
      },
      {
        id: 'a-confirmer',
        label: 'À confirmer',
        icon: BadgeCheck,
        subtitle: 'Paiements manuels en attente',
        badge: (o) => o.actionRequired.pendingConfirmations,
      },
      { id: 'offres', label: 'Offres', icon: Layers, subtitle: 'Plans et tarifs' },
    ],
  },
  {
    id: 'finances',
    label: 'Finances',
    items: [
      { id: 'finances', label: 'Vue financière', icon: Wallet, pageTitle: 'Vue financière', subtitle: 'Revenus et encours' },
      {
        id: 'factures',
        label: 'Factures',
        icon: Receipt,
        subtitle: 'Émission, encaissement, relance',
        badge: (o) => o.actionRequired.overdueInvoices,
      },
      {
        id: 'paiements',
        label: 'Paiements',
        icon: CreditCard,
        subtitle: 'Mouvements encaissés',
        badge: (o) => o.actionRequired.failedPayments,
      },
      { id: 'revenus', label: 'Revenus', icon: TrendingUp, subtitle: 'Évolution du chiffre d’affaires' },
    ],
  },
  {
    id: 'plateforme',
    label: 'Plateforme',
    items: [
      { id: 'configuration', label: 'Configuration boutique', icon: ListChecks, subtitle: 'Avancement des installations' },
      { id: 'equipe', label: 'Équipe & accès', icon: Lock, subtitle: 'Opérateurs de la console' },
      { id: 'partenaires', label: 'Partenaires', icon: Handshake, subtitle: 'Apporteurs et commissions' },
      { id: 'nouveautes', label: 'Nouveautés', icon: Megaphone, subtitle: 'Annonces produit' },
    ],
  },
  {
    id: 'support',
    label: 'Support',
    items: [{ id: 'support', label: 'Support', icon: LifeBuoy, subtitle: 'Demandes des utilisateurs' }],
  },
  {
    id: 'parametres',
    label: 'Paramètres',
    items: [
      {
        id: 'parametres',
        label: 'Paramètres plateforme',
        icon: Settings,
        pageTitle: 'Paramètres plateforme',
        subtitle: 'Essai, facturation, messages',
      },
    ],
  },
];

export const ALL_SECTIONS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function findSection(id: string | undefined): NavItem {
  return ALL_SECTIONS.find((s) => s.id === id) ?? ALL_SECTIONS[0];
}

export function isSectionId(value: string | undefined): value is SectionId {
  return ALL_SECTIONS.some((s) => s.id === value);
}
