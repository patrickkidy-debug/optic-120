import { tr } from '../../lib/tr';
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
    get title() { return tr('ui.videos.priseEnMainEtTableau'); },
    get benefit() { return tr('ui.videos.pilotezVotreActiviteEnUn'); },
    get durationLabel() { return tr('ui.videos.n9Min'); },
    src: '/videos/demo/1.mp4',
    poster: '/videos/demo/1.jpg',
  },
  {
    key: '2',
    get title() { return tr('ui.videos.encaisserUneVente'); },
    get benefit() { return tr('ui.videos.deLaSelectionDesArticles'); },
    get durationLabel() { return tr('ui.videos.n3Min'); },
    src: '/videos/demo/2.mp4',
    poster: '/videos/demo/2.jpg',
  },
  {
    key: '3',
    get title() { return tr('ui.videos.stockProduitsEtInventaire'); },
    get benefit() { return tr('ui.videos.neSoyezPlusJamaisEn'); },
    get durationLabel() { return tr('ui.videos.n7Min'); },
    src: '/videos/demo/3.mp4',
    poster: '/videos/demo/3.jpg',
  },
  {
    key: '4',
    get title() { return tr('ui.videos.clientsOrdonnancesEtSuivi'); },
    get benefit() { return tr('ui.videos.retrouvezLHistoriqueCompletDe'); },
    get durationLabel() { return tr('ui.videos.n7Min'); },
    src: '/videos/demo/4.mp4',
    poster: '/videos/demo/4.jpg',
  },
];

export const DEMO_VIDEO_COUNT = DEMO_VIDEOS.length;
