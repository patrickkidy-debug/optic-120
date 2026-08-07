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
    // L'app s'ouvre sur la connexion, pas sur la vitrine marketing : celui qui
    // l'a installée veut accéder à son espace. (Le routeur redirige de toute
    // façon « / » vers /login en natif.)
    url: 'https://oculosaas.com/login',
    cleartext: false,
  },
  backgroundColor: '#080c16',
  android: {
    backgroundColor: '#080c16',
  },
};

export default config;
