import { useEffect, useState } from 'react';
import { useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { RefreshCw, Home } from 'lucide-react';
import { Logo } from '../components/Logo';

/**
 * Filet de sécurité final du routeur (posé sur la route racine dans
 * router.tsx) : sans lui, TOUTE erreur non rattrapée pendant le rendu d'une
 * page — y compris un chunk qui ne charge plus après un déploiement, une fois
 * les tentatives de `onChunkError` (lib/lazyChunk.ts) épuisées — retombe sur
 * l'écran générique de React Router ("Unexpected Application Error!"),
 * illisible pour un client qui clique un lien /activer depuis WhatsApp.
 *
 * Repère spécifiquement l'échec de chargement d'un chunk JS (texte du message
 * qui varie selon le moteur : Chrome/Firefox disent "Failed to fetch
 * dynamically imported module", Safari/WebKit dit "Importing a module script
 * failed.") pour proposer un rechargement immédiat plutôt qu'un message
 * générique — c'est la cause la plus fréquente ici : un onglet resté ouvert,
 * ou un lien partagé mis en cache, référence encore les fichiers d'un
 * déploiement précédent.
 */
function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /dynamically imported module|importing a module script failed|unable to preload css/i.test(msg);
}

export function RouteErrorPage() {
  const error = useRouteError();
  const chunkError = !isRouteErrorResponse(error) && isChunkLoadError(error);
  const [reloading, setReloading] = useState(false);

  // Une erreur de chargement de chunk se corrige d'elle-même en rechargeant :
  // on le fait automatiquement une fois, sans attendre le clic, avec la même
  // garde anti-boucle (10 s) que `onChunkError` pour ne jamais boucler.
  useEffect(() => {
    if (!chunkError) return;
    const k = 'oculo-chunk-reload';
    const last = Number(sessionStorage.getItem(k) || 0);
    if (Date.now() - last > 10000) {
      sessionStorage.setItem(k, String(Date.now()));
      setReloading(true);
      window.location.reload();
    }
  }, [chunkError]);

  useEffect(() => {
    if (!chunkError) console.error('Erreur de rendu non rattrapée :', error);
  }, [chunkError, error]);

  return (
    <div className="grid min-h-screen place-items-center bg-surface px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <h1 className="font-display text-2xl font-bold text-content">
          {reloading ? 'Mise à jour en cours…' : chunkError ? 'Une nouvelle version est disponible' : 'Une erreur est survenue'}
        </h1>
        <p className="mt-2 text-content-muted">
          {reloading
            ? "L'application se recharge pour récupérer la dernière version."
            : chunkError
              ? "Cette page a été mise à jour depuis votre dernière visite. Rechargez pour continuer."
              : "Quelque chose s'est mal passé. Rechargez la page ; si le problème persiste, contactez le support."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => window.location.reload()} className="btn-primary" disabled={reloading}>
            <RefreshCw className="h-4 w-4" /> Recharger la page
          </button>
          <a href="/" className="btn-outline">
            <Home className="h-4 w-4" /> Accueil
          </a>
        </div>
      </div>
    </div>
  );
}
