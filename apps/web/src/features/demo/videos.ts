export interface DemoVideo {
  key: string;
  title: string;
  /** Bénéfice concret, pas une description technique : c'est un support de vente. */
  benefit: string;
  /** Durée réelle du fichier, annoncée d'avance pour réduire l'abandon au démarrage. */
  durationLabel: string;
  src: string;
  poster: string;
}

/**
 * Tutoriels courts, filmés sur le vrai logiciel (compte de démonstration,
 * données fictives) : une vidéo par partie importante d'OculoSaaS, étapes
 * commentées à l'écran. Clés « a1…a8 » : nouvelle série, progression repartie
 * de zéro par rapport aux 4 anciennes vidéos longues.
 */
const v = (n: number, title: string, benefit: string, durationLabel: string): DemoVideo => ({
  key: `a${n}`,
  title,
  benefit,
  durationLabel,
  src: `/videos/demo/tuto-${n}.mp4`,
  poster: `/videos/demo/tuto-${n}.jpg`,
});

export const DEMO_VIDEOS: DemoVideo[] = [
  v(1, 'Prise en main', 'Tableau de bord, menu, choix du magasin et recherche rapide : vous savez où tout se trouve.', '51 s'),
  v(2, 'Encaisser une vente', 'Ouvrir la caisse, ajouter une monture, composer les verres et encaisser en quelques secondes.', '1 min 13'),
  v(3, 'Produits, stock et étiquettes', 'Catalogue, import Excel, réception de livraison, stock faible et étiquettes de branche.', '1 min 23'),
  v(4, 'Clients et ordonnances', 'Le dossier complet de chaque client, son ordonnance et les relances au bon moment.', '54 s'),
  v(5, 'Commander des verres avec OculoRX', 'Catalogue fournisseur, conseil d’indice, envoi groupé et relevé mensuel.', '1 min 09'),
  v(6, 'Suivre les colis avec OculoTrack', 'Colis, étiquette QR, scan à chaque étape et portail du laboratoire.', '59 s'),
  v(7, 'Prendre les mesures', 'Écart pupillaire, hauteurs et paramètres individuels, au téléphone ou en saisie manuelle.', '48 s'),
  v(8, 'Équipe, réglages et aide', 'Employés, rôles, configuration guidée, préférences de l’appareil et support.', '1 min 08'),
];

export const DEMO_VIDEO_COUNT = DEMO_VIDEOS.length;
