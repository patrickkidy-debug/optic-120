import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Rafraîchit au retour sur l'onglet/la fenêtre : les quantités (produits,
      // stock, caisse) et les tarifs (réglages) restent synchronisés entre
      // sections sans rechargement manuel.
      refetchOnWindowFocus: true,
      // Fraîcheur : données considérées « à jour » 30 s → pas de refetch au
      // changement de page dans cet intervalle (navigations instantanées).
      staleTime: 30_000,
      // Conservation en cache 10 min : revenir sur une page affiche aussitôt
      // les données en cache (rafraîchies en arrière-plan si périmées).
      gcTime: 10 * 60_000,
    },
  },
});
