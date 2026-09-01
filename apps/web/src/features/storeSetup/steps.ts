import { Store, Users, Package, Boxes, CreditCard, Contact, FileText, type LucideIcon } from 'lucide-react';
import { STORE_SETUP_STEPS, type StoreSetupStepKey } from '@oculo/shared-types';

export { STORE_SETUP_STEPS };
export type { StoreSetupStepKey };

export interface StoreSetupStepMeta {
  key: StoreSetupStepKey;
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
  whyKey: string;
  /** Page existante vers laquelle l'assistant renvoie — jamais de formulaire dupliqué. */
  route: string;
  /** Permission nécessaire pour agir sur cette étape (voir la page cible). */
  permission: string;
}

export const STORE_SETUP_STEP_META: Record<StoreSetupStepKey, StoreSetupStepMeta> = {
  store_information: {
    key: 'store_information',
    icon: Store,
    titleKey: 'storeSetup.steps.storeInformation.title',
    descKey: 'storeSetup.steps.storeInformation.desc',
    whyKey: 'storeSetup.steps.storeInformation.why',
    route: '/parametres/profil?tab=marque',
    permission: 'settings.branches.update',
  },
  team: {
    key: 'team',
    icon: Users,
    titleKey: 'storeSetup.steps.team.title',
    descKey: 'storeSetup.steps.team.desc',
    whyKey: 'storeSetup.steps.team.why',
    route: '/parametres/utilisateurs',
    permission: 'rbac.users.create',
  },
  products: {
    key: 'products',
    icon: Package,
    titleKey: 'storeSetup.steps.products.title',
    descKey: 'storeSetup.steps.products.desc',
    whyKey: 'storeSetup.steps.products.why',
    route: '/optique/produits',
    permission: 'optique.products.create',
  },
  inventory: {
    key: 'inventory',
    icon: Boxes,
    titleKey: 'storeSetup.steps.inventory.title',
    descKey: 'storeSetup.steps.inventory.desc',
    whyKey: 'storeSetup.steps.inventory.why',
    route: '/optique/stock',
    permission: 'optique.stock.adjust',
  },
  payments: {
    key: 'payments',
    icon: CreditCard,
    titleKey: 'storeSetup.steps.payments.title',
    descKey: 'storeSetup.steps.payments.desc',
    whyKey: 'storeSetup.steps.payments.why',
    route: '/parametres/paiements',
    permission: 'settings.payments.update',
  },
  customers: {
    key: 'customers',
    icon: Contact,
    titleKey: 'storeSetup.steps.customers.title',
    descKey: 'storeSetup.steps.customers.desc',
    whyKey: 'storeSetup.steps.customers.why',
    route: '/optique/clients',
    permission: 'optique.customers.create',
  },
  documents: {
    key: 'documents',
    icon: FileText,
    titleKey: 'storeSetup.steps.documents.title',
    descKey: 'storeSetup.steps.documents.desc',
    whyKey: 'storeSetup.steps.documents.why',
    route: '/parametres/profil?tab=documents',
    permission: 'settings.branches.update',
  },
};

export const STORE_SETUP_STEP_LIST: StoreSetupStepMeta[] = STORE_SETUP_STEPS.map(
  (key) => STORE_SETUP_STEP_META[key],
);
