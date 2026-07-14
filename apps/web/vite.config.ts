import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
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
