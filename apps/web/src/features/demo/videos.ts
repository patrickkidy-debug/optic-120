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

export const DEMO_VIDEOS: DemoVideo[] = [
  {
    key: '1',
    title: 'Prise en main et tableau de bord',
    benefit: 'Pilotez votre activité en un coup d’œil : recettes du jour, alertes et chiffres clés.',
    durationLabel: '9 min',
    src: '/videos/demo/1.mp4',
    poster: '/videos/demo/1.jpg',
  },
  {
    key: '2',
    title: 'Encaisser une vente',
    benefit: 'De la sélection des articles au reçu imprimé, encaissez un client en moins d’une minute.',
    durationLabel: '3 min',
    src: '/videos/demo/2.mp4',
    poster: '/videos/demo/2.jpg',
  },
  {
    key: '3',
    title: 'Stock, produits et inventaire',
    benefit: 'Ne soyez plus jamais en rupture : alertes automatiques et inventaire physique guidé.',
    durationLabel: '7 min',
    src: '/videos/demo/3.mp4',
    poster: '/videos/demo/3.jpg',
  },
  {
    key: '4',
    title: 'Clients, ordonnances et suivi',
    benefit: 'Retrouvez l’historique complet de chaque client et relancez au bon moment.',
    durationLabel: '7 min',
    src: '/videos/demo/4.mp4',
    poster: '/videos/demo/4.jpg',
  },
];

export const DEMO_VIDEO_COUNT = DEMO_VIDEOS.length;
