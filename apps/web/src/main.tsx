import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import './lib/i18n';
import './styles/index.css';
import { queryClient } from './lib/queryClient';
import { router } from './router';
import { applyTheme, getStoredTheme, watchSystemTheme } from './lib/theme';
import { useAuthStore } from './store/auth';
import { useUIStore } from './store/ui';
import { refreshSession } from './lib/api';
import { trackPixelPageView } from './lib/pixel';
import { PwaControls } from './components/PwaControls';

applyTheme(getStoredTheme());

// SPA : le script de base (index.html) ne déclenche le PageView Meta Pixel
// qu'au tout premier chargement. On retrace chaque navigation client ici.
let lastPixelPath = router.state.location.pathname;
router.subscribe((state) => {
  if (state.location.pathname === lastPixelPath) return;
  lastPixelPath = state.location.pathname;
  trackPixelPageView();
});

function Root() {
  useEffect(() => {
    const unwatch = watchSystemTheme(() => useUIStore.getState().theme);
    void refreshSession().then((token) => {
      if (!token) useAuthStore.getState().setStatus('unauthenticated');
    });
    return unwatch;
  }, []);

  // On rend l'app immédiatement : les pages publiques (accueil, connexion,
  // inscription) s'affichent sans attendre la vérification de session (qui,
  // sur un serveur endormi, peut prendre plusieurs secondes). Seules les routes
  // protégées patientent derrière le splash (voir RequireAuth).
  return (
    <>
      <RouterProvider router={router} />
      {/* Invite d'installation PWA (Android/desktop + guide iOS) + bandeau hors ligne,
          disponible partout : landing, connexion et application. */}
      <PwaControls />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Root />
    </QueryClientProvider>
  </React.StrictMode>,
);

// Après un déploiement, un ancien chunk peut manquer (404). Vite émet alors
// « vite:preloadError » : on recharge une fois pour charger la nouvelle version.
window.addEventListener('vite:preloadError', () => {
  const k = 'oculo-chunk-reload';
  if (Date.now() - Number(sessionStorage.getItem(k) || 0) > 10000) {
    sessionStorage.setItem(k, String(Date.now()));
    window.location.reload();
  }
});

// PWA : enregistre le service worker (rend l'app installable + hors-ligne) ET
// synchronise les mises à jour sur les PWA installés (PC, Android, iOS).
//
// - L'URL /sw.js?v=<build> change à chaque déploiement → le navigateur détecte
//   un nouveau service worker et l'installe (sinon un octet identique = jamais
//   de MAJ, l'app installée reste figée sur l'ancienne version).
// - On vérifie une nouvelle version au démarrage, au retour au premier plan et
//   toutes les heures (une session PWA reste ouverte longtemps).
// - Quand le nouveau SW prend le contrôle, on recharge UNE fois pour appliquer
//   la mise à jour, sans casser l'installation initiale.
if ('serviceWorker' in navigator) {
  const SW_URL = `/sw.js?v=${__SW_VERSION__}`;
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloaded = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Au tout premier chargement (aucun contrôleur au départ), le passage de
    // contrôle est l'installation initiale : ne pas recharger. Sinon, c'est une
    // nouvelle version → recharge unique.
    if (!hadController || reloaded) return;
    reloaded = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(SW_URL, { updateViaCache: 'none' })
      .then((reg) => {
        const check = () => reg.update().catch(() => {});
        check();
        window.setInterval(check, 60 * 60 * 1000);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check();
        });
      })
      .catch(() => {});
  });
}
