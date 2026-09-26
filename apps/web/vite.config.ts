import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Liste des fichiers de l'application, lue par le service worker a son
 * installation pour les mettre TOUS en cache (voir public/sw.js).
 *
 * Sans elle, seuls les ecrans deja ouverts etaient disponibles hors ligne : les
 * pages sont chargees a la demande, et ouvrir sans reseau un ecran jamais
 * visite echouait. Seuls les scripts et feuilles de style sont listes — les
 * gros fichiers optionnels (xlsx, charts) en font partie, ce qui est voulu :
 * l'import Excel ne marche pas hors ligne, mais son absence ne doit pas casser
 * le chargement d'un ecran qui l'importe.
 */
function precacheManifest(): Plugin {
  return {
    name: 'oculo-precache-manifest',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle)
        .filter((f) => /\.(js|css)$/.test(f))
        .map((f) => `/${f}`)
        .sort();
      this.emitFile({ type: 'asset', fileName: 'precache.json', source: JSON.stringify(files) });
    },
  };
}

export default defineConfig({
  plugins: [react(), precacheManifest()],
  // Identifiant de build (horodatage) injecté dans le client. Sert à forcer la
  // détection d'une nouvelle version du service worker à chaque déploiement
  // (l'URL /sw.js?v=<build> change → le navigateur réinstalle le SW → MAJ auto).
  define: {
    __SW_VERSION__: JSON.stringify(String(Date.now())),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        // Sépare les grosses dépendances en chunks dédiés (meilleur cache,
        // bundle initial plus léger). chart.js ne se charge que sur le dashboard.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          charts: ['chart.js', 'react-chartjs-2'],
          query: ['@tanstack/react-query', '@tanstack/react-table'],
          forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
          i18n: ['i18next', 'react-i18next'],
        },
      },
    },
  },
});
