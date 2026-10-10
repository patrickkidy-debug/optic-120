/**
 * Base de connaissances du conseiller commercial IA.
 *
 * Chaque fiche décrit ce que le logiciel fait RÉELLEMENT (vérifié dans le
 * code). Aucun prix ici : les forfaits viennent de la base (outil get_offers),
 * pour suivre les changements faits depuis la console fondateur.
 * Toute nouvelle fiche doit pouvoir être montrée dans le logiciel.
 */

export type DemoKey =
  | 'dashboard'
  | 'frames_catalog'
  | 'add_frame'
  | 'stock'
  | 'sales'
  | 'client_file'
  | 'lens_orders'
  | 'oculotrack'
  | 'lab_portal'
  | 'client_tracking'
  | 'centering'
  | 'suppliers_whatsapp'
  | 'mobile'
  | 'video';

/** Supports visuels existants (vraies captures du logiciel, compte de démonstration). */
export const DEMOS: Record<DemoKey, { kind: 'image' | 'video'; src: string; title: string }> = {
  dashboard: { kind: 'image', src: '/images/advisor/dashboard.webp', title: 'Tableau de bord' },
  frames_catalog: { kind: 'image', src: '/images/advisor/montures.webp', title: 'Catalogue des montures' },
  add_frame: { kind: 'image', src: '/images/advisor/ajout-monture.webp', title: 'Ajouter une monture avec photo' },
  stock: { kind: 'image', src: '/images/advisor/stock.webp', title: 'Gestion du stock' },
  sales: { kind: 'image', src: '/images/advisor/ventes.webp', title: 'Historique des ventes' },
  client_file: { kind: 'image', src: '/images/advisor/dossier.webp', title: 'Dossier client' },
  lens_orders: { kind: 'image', src: '/images/advisor/commandes.webp', title: 'Commandes de verres' },
  oculotrack: { kind: 'image', src: '/images/landing/oculotrack.webp', title: 'OculoTrack — suivi des commandes' },
  lab_portal: { kind: 'image', src: '/images/landing/portail-montage.webp', title: 'Portail laboratoire' },
  client_tracking: { kind: 'image', src: '/images/landing/suivi-client.webp', title: 'Lien de suivi client' },
  centering: { kind: 'image', src: '/images/landing/assistant.webp', title: 'Assistant de centrage' },
  suppliers_whatsapp: { kind: 'image', src: '/images/landing/fournisseur-whatsapp.webp', title: 'Fournisseurs et WhatsApp' },
  mobile: { kind: 'image', src: '/images/advisor/mobile-ventes.webp', title: 'Sur smartphone' },
  video: { kind: 'video', src: '/videos/demo-dashboard.mp4', title: 'Démonstration vidéo' },
};

export interface KnowledgeEntry {
  id: string;
  title: string;
  keywords: string[];
  text: string;
  demo?: DemoKey;
}

export const KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: 'product',
    title: "Qu'est-ce qu'OculoSaaS",
    keywords: ['oculosaas', 'logiciel', 'quoi', 'présentation', 'tout-en-un', 'opticien', 'clinique'],
    text: "Logiciel de gestion en ligne pour magasins d'optique et cliniques ophtalmologiques : caisse, stock, clients et ordonnances, commandes de verres, clinique, finances, équipe. Fonctionne dans le navigateur (ordinateur, tablette, téléphone), avec aussi une application Android. Disponible en français, anglais et portugais.",
    demo: 'dashboard',
  },
  {
    id: 'pos',
    title: 'Caisse et encaissement',
    keywords: ['caisse', 'encaisser', 'paiement', 'vente', 'mobile money', 'wave', 'orange', 'mtn', 'carte', 'espèces', 'reçu', 'facture', 'devis'],
    text: "Caisse : espèces, carte, chèque et les mobile money du pays du magasin (Wave, Orange Money, MTN MoMo, Moov, Free Money, M-Pesa, etc.), saisis au comptoir — le logiciel enregistre le paiement, il ne le prélève pas lui-même. Plusieurs paiements possibles sur une même vente. La part assurance est calculée selon le contrat du client. Devis transformables en vente en un clic. Factures, devis et reçus en A4 ou A5, imprimés ou en PDF. Sessions de caisse : ouverture avec fond de caisse, clôture avec comptage et écart affiché.",
    demo: 'sales',
  },
  {
    id: 'sales',
    title: 'Ventes, retours, créances',
    keywords: ['ventes', 'historique', 'retour', 'annulation', 'reste à payer', 'créance', 'crédit'],
    text: "Historique de toutes les ventes avec export, encaissement d'un reste à payer, retours produits et annulations. Écran des créances : restes à payer des clients et parts dues par les assurances.",
    demo: 'sales',
  },
  {
    id: 'stock',
    title: 'Produits et stock',
    keywords: ['stock', 'monture', 'montures', 'verres', 'lentilles', 'inventaire', 'rupture', 'alerte', 'catalogue', 'photo', 'produit', 'étiquette', 'code-barres', 'transfert'],
    text: "Catalogue montures (avec photos, marque, forme, taille, couleur, prix) et verres. Seuil d'alerte de stock par produit, réceptions, ajustements et historique des mouvements. Transferts de stock entre magasins avec confirmation. Inventaire en scannant les codes-barres. Impression d'étiquettes code-barres avec prix.",
    demo: 'frames_catalog',
  },
  {
    id: 'add_frame',
    title: 'Ajouter une monture avec photo',
    keywords: ['ajouter', 'nouvelle monture', 'photo', 'créer produit', 'enregistrer monture'],
    text: "Bouton « Ajouter une monture » dans le catalogue : on glisse ou choisit une photo du produit, puis on saisit marque, modèle, référence (générée si vide), code-barres, type de monture, genre, forme, matière, couleur, taille (calibre-pont-branches), emplacement en boutique, fournisseur et prix. Un aperçu montre la fiche telle qu'elle apparaîtra au catalogue.",
    demo: 'add_frame',
  },
  {
    id: 'import',
    title: 'Reprendre ses données (Excel)',
    keywords: ['excel', 'import', 'cahier', 'reprendre', 'migration', 'fichier', 'données existantes', 'csv'],
    text: "Import Excel ou CSV des produits (prix d'achat et de vente reconnus quel que soit le nom des colonnes, aperçu et correction avant d'enregistrer, références en double numérotées automatiquement) et import des clients. Exports possibles à tout moment.",
    demo: 'stock',
  },
  {
    id: 'clients',
    title: 'Clients et ordonnances',
    keywords: ['client', 'dossier', 'ordonnance', 'prescription', 'patient', 'anniversaire', 'renouvellement', 'fidélité', 'relance'],
    text: "Dossier client complet : ordonnances optiques (sphère, cylindre, axe, addition par œil, écarts pupillaires, hauteurs, date d'expiration, photo de l'ordonnance), achats, devis, historique. Anniversaires du jour avec message WhatsApp prêt. Renouvellements : liste des clients à relancer (ordonnance ancienne ou pas d'achat récent, seuils réglables) avec lien WhatsApp.",
    demo: 'client_file',
  },
  {
    id: 'lens_orders',
    title: 'Commandes de verres',
    keywords: ['commande', 'verres', 'laboratoire', 'labo', 'atelier', 'montage', 'fiche technique', 'retard'],
    text: "Commandes de verres suivies sur 11 étapes (de « à commander » à « livré »), en liste, tableau ou calendrier, avec alertes de retard. Fiche technique pour le laboratoire en PDF (prescription, verres, monture, mesures, sans les prix).",
    demo: 'lens_orders',
  },
  {
    id: 'oculotrack',
    title: 'OculoTrack et portail laboratoire',
    keywords: ['oculotrack', 'suivi', 'colis', 'qr', 'portail', 'laboratoire', 'transport', 'où est la monture'],
    text: "OculoTrack suit chaque commande et chaque colis du magasin au laboratoire et retour : numéro de suivi, QR code sur le colis (sans donnée client), date, heure et responsable de chaque étape, anomalies et alertes de retard. Le laboratoire peut être invité sur un portail séparé (il ne voit que les commandes qui lui sont envoyées) pour réceptionner et mettre à jour le montage depuis son téléphone. Le client peut recevoir un lien de suivi par WhatsApp, sans donnée médicale.",
    demo: 'oculotrack',
  },
  {
    id: 'centering',
    title: 'Assistant de centrage (mesures à la caméra)',
    keywords: ['mesure', 'centrage', 'caméra', 'écart pupillaire', 'ep', 'hauteur', 'pupillomètre'],
    text: "L'assistant de centrage mesure à la caméra du téléphone ou de la tablette les écarts pupillaires, hauteurs, calibre et pont, avec calibration (carte bancaire, monture ou cote connue), repères déplaçables et score de fiabilité. L'opticien vérifie avant d'enregistrer : la décision reste la sienne.",
    demo: 'centering',
  },
  {
    id: 'clinic',
    title: 'Module clinique',
    keywords: ['clinique', 'ophtalmologue', 'consultation', 'rendez-vous', 'chirurgie', 'patient', 'tension', 'réfraction', 'oct'],
    text: "Pour les cliniques : dossiers patients, consultations (acuité visuelle, réfraction, tension oculaire, biomicroscopie, fond d'œil, OCT, champ visuel, diagnostic), rendez-vous (planifié, confirmé, honoré, annulé, absent), chirurgies (œil, chirurgien, date, résultat, suivi).",
  },
  {
    id: 'management',
    title: 'Gestion, finance et rapports',
    keywords: ['rapport', 'statistique', 'tableau de bord', 'finance', 'dépense', 'bénéfice', 'chiffre', 'prévision', 'assurance', 'personnel', 'employé'],
    text: "Tableau de bord avec prévision du chiffre d'affaires sur 14 jours et produits qui risquent la rupture (calcul statistique sur l'historique des ventes). Rapports : chiffre d'affaires, encaissements, panier moyen, comparaison avec la période précédente, exports CSV. Finance : recettes, dépenses et résultat du mois. Dépenses et versements. Assurances : assureurs, contrats, prises en charge, remboursements. Liste du personnel.",
    demo: 'dashboard',
  },
  {
    id: 'suppliers',
    title: 'Fournisseurs',
    keywords: ['fournisseur', 'whatsapp', 'commande fournisseur', 'relance'],
    text: "Fiches fournisseurs avec délais, conditions de paiement, commandes en cours et messages WhatsApp prêts à envoyer (demande de prix, commande, relance, facture) en français, anglais ou portugais.",
    demo: 'suppliers_whatsapp',
  },
  {
    id: 'multi_store',
    title: 'Plusieurs magasins',
    keywords: ['plusieurs magasins', 'multi', 'succursale', 'agence', 'points de vente', 'magasins'],
    text: "Plusieurs magasins dans un même compte, avec un filtre par magasin et des transferts de stock entre magasins. Le nombre de magasins et d'utilisateurs dépend du forfait : vérifier avec get_offers.",
  },
  {
    id: 'team',
    title: 'Équipe, rôles et contrôle',
    keywords: ['employé', 'rôle', 'permission', 'accès', 'utilisateur', 'contrôle', 'journal', 'erreur', 'correction'],
    text: "Rôles personnalisables avec permissions précises par employé, gestion des utilisateurs, journal d'activité (qui a fait quoi et quand), corrections d'erreurs de vente ou de stock avec demande, validation et historique.",
  },
  {
    id: 'security',
    title: 'Sécurité des données',
    keywords: ['sécurité', 'données', 'confidentialité', 'sauvegarde', 'piratage', 'mot de passe', 'protégé'],
    text: "Faits vérifiés : chaque établissement a ses données cloisonnées des autres ; mots de passe stockés hachés ; accès par rôles et permissions ; journal d'activité ; connexion chiffrée (HTTPS). Pour toute question plus précise (certifications, localisation des serveurs, fréquence des sauvegardes), ne pas inventer : proposer le support.",
  },
  {
    id: 'offline',
    title: 'Coupures de réseau',
    keywords: ['internet', 'connexion', 'hors ligne', 'coupure', 'réseau', 'offline'],
    text: "Mode hors connexion partiel : les ventes et les ajustements de stock faits pendant une coupure sont gardés sur l'appareil puis envoyés au retour du réseau. Les autres écrans nécessitent Internet.",
  },
  {
    id: 'mobile',
    title: 'Sur téléphone',
    keywords: ['téléphone', 'smartphone', 'android', 'application', 'mobile', 'iphone', 'tablette'],
    text: "Le logiciel s'utilise dans le navigateur du téléphone ou de la tablette, et une application Android est téléchargeable depuis oculosaas.com. Pas d'application iPhone dédiée vérifiée : sur iPhone, utiliser le navigateur.",
    demo: 'mobile',
  },
  {
    id: 'onboarding',
    title: 'Démarrage',
    keywords: ['démarrer', 'commencer', 'inscription', 'installer', 'informatique', 'facile', 'formation', 'prise en main', 'configuration'],
    text: "Rien à installer. Inscription en quelques étapes sur la page d'activation : type d'établissement, besoins, choix du forfait, coordonnées, paiement. L'espace s'ouvre dès que le paiement est confirmé. Un démarrage guidé en 9 étapes aide à configurer la boutique (équipe, produits, stock, caisse, prix des verres, assurances, clients, documents). Une vidéo de démonstration est disponible dans le logiciel.",
    demo: 'video',
  },
  {
    id: 'subscription',
    title: "Paiement de l'abonnement",
    keywords: ['payer', 'abonnement', 'paiement', 'mobile money', 'virement', 'carte', 'essai', 'gratuit', 'résiliation', 'engagement', 'durée'],
    text: "L'abonnement se paie pour 1, 3 ou 6 mois (remises éventuelles selon get_offers), par mobile money en ligne selon le pays, ou par virement bancaire s'il est proposé (get_offers indique sa disponibilité et l'essai éventuel). Pas de paiement par carte pour l'abonnement. Les conditions précises de résiliation et de remboursement ne sont pas dans la base : orienter vers le support.",
  },
  {
    id: 'support',
    title: 'Support',
    keywords: ['support', 'aide', 'problème', 'contact', 'humain', 'conseiller', 'téléphone', 'appeler'],
    text: "Support par WhatsApp au +221 76 888 17 39 et par e-mail à support@oculosaas.com. Il est aussi possible de demander à être rappelé (formulaire de rappel).",
  },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Recherche simple par mots-clés : renvoie les fiches les plus pertinentes. */
export function searchKnowledge(query: string, limit = 3): KnowledgeEntry[] {
  const q = norm(query);
  const words = q.split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const scored = KNOWLEDGE.map((e) => {
    let score = 0;
    for (const k of e.keywords) if (q.includes(norm(k))) score += 3;
    const hay = norm(`${e.title} ${e.text}`);
    for (const w of words) if (hay.includes(w)) score += 1;
    return { e, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.e);
}
