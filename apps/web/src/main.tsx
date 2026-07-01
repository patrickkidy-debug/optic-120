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
  return <RouterProvider router={router} />;
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

// PWA : enregistre le service worker (rend l'app installable + hors-ligne).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
