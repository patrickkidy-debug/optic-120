/**
 * Base de connaissances de la page Aide : réponses courtes, chemins de menu
 * exacts et lien direct vers l'écran concerné, pour que l'utilisateur trouve
 * seul la réponse avant d'écrire au support.
 */
export interface HelpArticle {
  q: string;
  a: string;
  /** Écran à ouvrir pour appliquer la réponse. */
  to?: string;
  /** Mots-clés supplémentaires pour la recherche. */
  tags?: string;
}

export interface HelpCategory {
  key: string;
  label: string;
  articles: HelpArticle[];
}

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    key: 'caisse',
    label: 'Caisse et ventes',
    articles: [
      {
        q: 'Comment encaisser une vente ?',
        a: 'Ouvrez Caisse / Vente, ajoutez les produits (recherche ou lecteur de code-barres), choisissez le client puis cliquez sur « Encaisser » et sélectionnez le moyen de paiement (espèces, Wave, Orange Money, carte…).',
        to: '/optique/caisse',
        tags: 'vendre paiement panier',
      },
      {
        q: 'Comment vendre un verre sur mesure (type + traitements) ?',
        a: 'Dans la caisse, utilisez le compositeur de verre : choisissez le type puis les traitements. Le prix vient de votre barème (Réglages → Personnalisation des documents → Tarifs des verres). Aucune nouvelle fiche produit n’est créée.',
        to: '/optique/caisse',
        tags: 'progressif unifocal anti-reflet barème',
      },
      {
        q: 'Pourquoi les verres n’ont-ils pas de TVA ?',
        a: 'Les verres correcteurs sont exonérés de TVA : seules les montures et les accessoires la portent. La facture l’indique avec la mention « Verres correcteurs exonérés de TVA ».',
        tags: 'taxe facture exonération',
      },
      {
        q: 'Le client paie en Mobile Money, comment l’enregistrer ?',
        a: 'À l’encaissement, choisissez Wave, Orange Money, MTN… comme moyen de paiement : la vente est enregistrée avec ce moyen. Pour encaisser en ligne directement sur votre propre compte de paiement, contactez le support pour le brancher.',
        tags: 'wave orange mtn moov paiement',
      },
      {
        q: 'Comment ouvrir et fermer la caisse ?',
        a: 'Menu Session de caisse : ouvrez la session avec le fond de caisse le matin, fermez-la le soir en comptant les espèces. Le rapport de session s’imprime depuis l’historique.',
        to: '/optique/caisse-session',
        tags: 'fond de caisse clôture rapport',
      },
      {
        q: 'Comment modifier ou annuler une vente ?',
        a: 'Ouvrez Ventes, cliquez sur la vente puis utilisez les actions de la fiche (modifier, retour, annulation selon vos droits).',
        to: '/optique/ventes',
        tags: 'retour remboursement erreur',
      },
    ],
  },
  {
    key: 'stock',
    label: 'Produits et stock',
    articles: [
      {
        q: 'Comment importer tout mon catalogue d’un coup ?',
        a: 'Produits → « Importer » : chargez un fichier Excel ou CSV (nom, marque, prix, quantité…). Un aperçu s’affiche avant l’enregistrement.',
        to: '/optique/produits',
        tags: 'excel csv fichier catalogue',
      },
      {
        q: 'Comment imprimer les étiquettes des montures ?',
        a: 'Menu Étiquettes : étiquettes de branche 38 × 12 mm avec nom, prix et code-barres. Imprimez d’abord une seule étiquette pour vérifier le format.',
        to: '/optique/etiquettes',
        tags: 'code-barres impression branche',
      },
      {
        q: 'Comment corriger une quantité en stock ?',
        a: 'Stock → « Ajuster » sur le produit. Pour une livraison fournisseur, utilisez « Réception » ; tout est tracé dans l’historique des mouvements.',
        to: '/optique/stock',
        tags: 'inventaire réception mouvement',
      },
      {
        q: 'Comment être prévenu quand un produit va manquer ?',
        a: 'Renseignez un seuil d’alerte sur le produit : il apparaît en « Stock faible » dès que la quantité passe en dessous.',
        to: '/optique/stock',
        tags: 'alerte rupture seuil',
      },
    ],
  },
  {
    key: 'clients',
    label: 'Clients et ordonnances',
    articles: [
      {
        q: 'Où enregistrer l’ordonnance d’un client ?',
        a: 'Ouvrez la fiche du client dans Clients : l’ordonnance (sphère, cylindre, axe, addition) s’y enregistre et se retrouve ensuite dans les commandes de verres et OculoRX.',
        to: '/optique/clients',
        tags: 'prescription od og sphère',
      },
      {
        q: 'Comment relancer les clients pour leur contrôle de vue ?',
        a: 'Menu Renouvellements : la liste des clients à relancer, avec envoi d’un message WhatsApp pré-rempli.',
        to: '/optique/renouvellements',
        tags: 'rappel whatsapp fidélité',
      },
    ],
  },
  {
    key: 'verres',
    label: 'Commandes de verres',
    articles: [
      {
        q: 'Comment commander des verres au fournisseur ?',
        a: 'OculoRX → « Nouvelle commande » : choisissez le client et son ordonnance, le verre du catalogue fournisseur, puis envoyez la commande par WhatsApp ou via le portail du fournisseur.',
        to: '/oculorx',
        tags: 'oculorx fournisseur laboratoire',
      },
      {
        q: 'Comment envoyer toutes les commandes du jour en une fois ?',
        a: 'OculoRX → Commandes : cochez les commandes puis choisissez l’envoi groupé par WhatsApp ou en colis OculoTrack.',
        to: '/oculorx/commandes',
        tags: 'groupé lot journée',
      },
      {
        q: 'Comment suivre un colis entre la boutique et le laboratoire ?',
        a: 'OculoTrack : chaque colis a une étiquette QR à imprimer, avec le téléphone de l’expéditeur et du destinataire. Chaque scan met à jour le statut.',
        to: '/optique/oculotrack',
        tags: 'colis qr suivi livraison',
      },
    ],
  },
  {
    key: 'compte',
    label: 'Compte et sécurité',
    articles: [
      {
        q: 'Comment ajouter un employé ?',
        a: 'Paramètres → Utilisateurs → « Nouvel utilisateur », puis choisissez son rôle. Transmettez-lui le mot de passe temporaire : il le changera à sa première connexion.',
        to: '/parametres/utilisateurs',
        tags: 'collaborateur caissier opticien accès',
      },
      {
        q: 'Comment limiter ce qu’un employé peut voir ?',
        a: 'Paramètres → Rôles et permissions : chaque rôle donne accès à des écrans précis (par exemple un caissier sans accès aux prix d’achat).',
        to: '/parametres/roles',
        tags: 'droits permissions rôle',
      },
      {
        q: 'Comment activer la double authentification ?',
        a: 'Réglages → Mon profil → section Sécurité → activer la 2FA, puis scannez le QR code avec une application d’authentification.',
        to: '/parametres/profil',
        tags: '2fa sécurité code',
      },
      {
        q: 'J’ai oublié mon mot de passe',
        a: 'Sur l’écran de connexion, cliquez sur « Mot de passe oublié » et suivez le lien reçu par email. Un administrateur peut aussi vous générer un mot de passe temporaire.',
        tags: 'connexion réinitialiser',
      },
      {
        q: 'Comment gérer plusieurs magasins ?',
        a: 'Paramètres → Magasins : ajoutez vos points de vente puis basculez de l’un à l’autre avec le sélecteur en haut de l’écran. Disponible selon votre offre.',
        to: '/parametres/magasins',
        tags: 'succursale boutique multi',
      },
    ],
  },
  {
    key: 'abonnement',
    label: 'Abonnement et paiement',
    articles: [
      {
        q: 'Comment payer mon abonnement ?',
        a: 'Réglages → Abonnement : paiement en ligne sécurisé par KkiaPay (Mobile Money ou carte, l’opérateur se choisit dans la fenêtre de paiement) ou par virement bancaire.',
        to: '/parametres/abonnement',
        tags: 'kkiapay facture renouveler',
      },
      {
        q: 'Combien dure l’essai gratuit ?',
        a: 'Les nouveaux comptes bénéficient de 7 jours d’essai gratuit, sans engagement.',
        tags: 'gratuit test',
      },
      {
        q: 'Où trouver mes factures d’abonnement ?',
        a: 'Réglages → Abonnement : l’historique de vos paiements et factures y est disponible.',
        to: '/parametres/abonnement',
        tags: 'reçu historique',
      },
    ],
  },
  {
    key: 'technique',
    label: 'Problèmes techniques',
    articles: [
      {
        q: 'L’application fonctionne-t-elle sans internet ?',
        a: 'Oui pour l’essentiel : les opérations faites hors ligne sont gardées sur l’appareil puis envoyées dès que la connexion revient. Ne videz pas les données du navigateur tant qu’elles ne sont pas synchronisées.',
        tags: 'hors ligne synchronisation réseau',
      },
      {
        q: 'Une page ne s’affiche pas correctement',
        a: 'Rechargez la page (Ctrl + Maj + R sur ordinateur). Si le problème persiste : Réglages → Mon profil → « Réparer l’application », qui vide le cache sans toucher à vos données.',
        to: '/parametres/profil',
        tags: 'bug cache écran blanc mise à jour',
      },
      {
        q: 'Comment installer OculoSaaS sur mon téléphone ou ordinateur ?',
        a: 'Utilisez le bouton « Installer » proposé par l’application (ou le menu du navigateur → « Installer l’application ») : OculoSaaS s’ouvre alors en plein écran comme une application.',
        tags: 'pwa installer mobile',
      },
    ],
  },
];

/** Normalise pour la recherche : minuscules, sans accents. */
export function normalizeSearch(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
