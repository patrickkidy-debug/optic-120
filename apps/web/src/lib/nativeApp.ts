/**
 * Application Android / iOS (Capacitor) : détection et version.
 *
 * Les versions 1.0 / 1.1 de l'APK n'embarquent pas le module « App » : son
 * absence suffit à reconnaître une appli à mettre à jour (la 1.0 n'avait pas
 * la permission caméra, d'où le refus systématique de la caméra en direct).
 */
type Cap = { isNativePlatform?: () => boolean; isPluginAvailable?: (name: string) => boolean };
const cap = () => (window as { Capacitor?: Cap }).Capacitor;

export const isNativeApp = (): boolean => Boolean(cap()?.isNativePlatform?.());

export const isOutdatedApp = (): boolean => isNativeApp() && !cap()?.isPluginAvailable?.('App');

/** Adresse de téléchargement de la dernière APK (à ouvrir dans Chrome). */
export const APK_URL = 'https://oculosaas.com/downloads/OculoSaaS.apk';
