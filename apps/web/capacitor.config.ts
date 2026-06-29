import type { CapacitorConfig } from '@capacitor/cli';

/**
 * App mobile native (Android/iOS) générée à partir de l'app web via Capacitor.
 * `server.url` pointe vers le site en ligne : l'app native affiche toujours la
 * dernière version déployée, sans recompiler à chaque mise à jour web.
 * (Pour une app 100% hors-ligne, retirer `server.url` et empaqueter `webDir`.)
 */
const config: CapacitorConfig = {
  appId: 'com.oculosaas.app',
  appName: 'OculoSaaS',
  webDir: 'dist',
  server: {
    url: 'https://oculosaas.com',
    cleartext: false,
  },
  backgroundColor: '#080c16',
  android: {
    backgroundColor: '#080c16',
  },
};

export default config;
