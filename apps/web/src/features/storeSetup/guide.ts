import type { StoreSetupStepKey } from '@oculo/shared-types';

/**
 * Mode d'emploi de la configuration boutique : pensé pour qu'un opticien
 * configure seul son espace, sans formation. Chaque étape dit ce qu'il faut
 * faire sur l'écran cible, combien de temps ça prend, et à quel moment
 * l'étape se valide d'elle-même.
 */
export interface StepGuide {
  /** Durée indicative en minutes. */
  minutes: number;
  /** Actions concrètes, dans l'ordre, sur la page ouverte par « Commencer ». */
  howTo: string[];
  /** Condition qui coche l'étape automatiquement (calculée par le serveur). */
  doneWhen: string;
  /** Étape facultative : peut être passée sans gêner le reste. */
  optional?: boolean;
}

export interface SetupPhase {
  title: string;
  subtitle: string;
  steps: StoreSetupStepKey[];
}

/**
 * Ordre méthodique : d'abord l'identité de la boutique (elle apparaît sur
 * chaque document), puis le catalogue et l'équipe, enfin la première vente
 * qui vérifie que tout fonctionne de bout en bout.
 */
export const SETUP_PHASES: SetupPhase[] = [
  {
    title: 'Votre boutique',
    subtitle: 'Les informations imprimées sur vos factures, devis et reçus.',
    steps: ['store_information', 'documents', 'lens_pricing'],
  },
  {
    title: 'Votre catalogue et votre équipe',
    subtitle: 'Ce que vous vendez, ce que vous avez en rayon, et qui travaille avec vous.',
    steps: ['products', 'inventory', 'team', 'insurance'],
  },
  {
    title: 'Premier client, première vente',
    subtitle: 'Un essai complet pour vérifier que tout est prêt.',
    steps: ['customers', 'cash_and_sales'],
  },
];

/** Ordre d'affichage, aligné sur les phases. */
export const SETUP_ORDER: StoreSetupStepKey[] = SETUP_PHASES.flatMap((p) => p.steps);

export const STEP_GUIDES: Record<StoreSetupStepKey, StepGuide> = {
  store_information: {
    minutes: 3,
    howTo: [
      'Ouvrez l’onglet « Image de marque ».',
      'Renseignez le nom de l’établissement et ajoutez votre logo (facultatif).',
      'Saisissez la « Situation géographique » puis le téléphone dans « Contact de l’entreprise ».',
      'Chaque bloc a son propre bouton d’enregistrement : cliquez-le après chaque saisie.',
    ],
    doneWhen: 'L’adresse et le téléphone sont enregistrés.',
  },
  documents: {
    minutes: 3,
    howTo: [
      'Ouvrez l’onglet « Personnalisation des documents ».',
      'Vérifiez les mentions de bas de facture (RCCM, NIF, conditions…).',
      'Cliquez sur « Enregistrer » : vos factures et reçus reprennent ces réglages.',
    ],
    doneWhen: 'Les réglages des documents sont enregistrés une première fois.',
  },
  lens_pricing: {
    minutes: 5,
    howTo: [
      'Dans « Personnalisation des documents », descendez jusqu’à « Tarifs des verres ».',
      'Indiquez le prix de chaque type de verre (unifocal, progressif…) et des traitements.',
      'Enregistrez : la caisse calcule alors le prix d’un verre toute seule.',
    ],
    doneWhen: 'Un barème de verres est enregistré.',
  },
  products: {
    minutes: 10,
    howTo: [
      'Cliquez sur « Ajouter une monture » pour créer vos montures une par une,',
      'ou sur « Importer » pour charger tout votre catalogue depuis un fichier Excel.',
      'Pour chaque produit : nom, marque, prix de vente et quantité en stock.',
    ],
    doneWhen: 'Au moins un produit existe dans le catalogue.',
  },
  inventory: {
    minutes: 5,
    howTo: [
      'Vérifiez les quantités affichées pour chaque produit.',
      'Utilisez « Ajuster » pour corriger une quantité, « Réception » pour une livraison.',
      'Les produits sous le seuil apparaissent en « Stock faible ».',
    ],
    doneWhen: 'Au moins un produit a du stock enregistré.',
  },
  team: {
    minutes: 3,
    howTo: [
      'Cliquez sur « Nouvel utilisateur ».',
      'Saisissez le prénom, le nom et l’email de votre collaborateur, puis choisissez son rôle.',
      'Notez le mot de passe temporaire et transmettez-le lui : il le changera à sa première connexion.',
    ],
    doneWhen: 'Un deuxième utilisateur a été créé.',
    optional: true,
  },
  insurance: {
    minutes: 3,
    howTo: [
      'Cliquez sur « Nouvelle assurance ».',
      'Saisissez le nom de l’assureur et son taux de prise en charge par défaut.',
      'Les prises en charge et remboursements se suivront ensuite depuis cette page.',
    ],
    doneWhen: 'Au moins une assurance est enregistrée.',
    optional: true,
  },
  customers: {
    minutes: 2,
    howTo: [
      'Cliquez sur « Nouveau client ».',
      'Saisissez son nom et son téléphone (l’ordonnance peut être ajoutée plus tard).',
      'Enregistrez : sa fiche gardera ses achats et ses ordonnances.',
    ],
    doneWhen: 'Au moins un client est enregistré.',
  },
  cash_and_sales: {
    minutes: 3,
    howTo: [
      'Ouvrez la caisse si elle est fermée.',
      'Ajoutez un produit au panier et choisissez le client.',
      'Cliquez sur « Encaisser » et choisissez le moyen de paiement. Vous pourrez annuler cette vente d’essai.',
    ],
    doneWhen: 'Une première vente est enregistrée.',
  },
};
