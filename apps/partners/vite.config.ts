import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  // Servi sous oculosaas.com/partners/* (proxy Netlify vers ce site — voir le
  // netlify.toml racine). Sans ce préfixe, les assets (JS/CSS) seraient
  // référencés en `/assets/...` : la racine du domaine principal les servirait
  // avec le mauvais index.html au lieu de les faire proxyer vers cette app.
  base: '/partners/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5174,
    host: true,
  },
  preview: {
    port: 5174,
  },
});
