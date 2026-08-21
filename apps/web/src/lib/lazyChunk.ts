/**
 * Après un nouveau déploiement, un onglet resté ouvert référence encore les
 * anciens chunks (hash) qui n'existent plus sur le serveur → « Failed to fetch
 * dynamically imported module ». On recharge alors la page UNE fois pour
 * récupérer le nouvel index et les nouveaux chunks (garde anti-boucle de 10 s).
 * Sans ce filet, un `lazy()` dont l'import échoue rejette silencieusement et le
 * composant concerné n'apparaît tout simplement jamais.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function onChunkError(err: unknown): Promise<any> {
  const k = 'oculo-chunk-reload';
  const last = Number(sessionStorage.getItem(k) || 0);
  if (Date.now() - last > 10000) {
    sessionStorage.setItem(k, String(Date.now()));
    window.location.reload();
    // Promesse jamais résolue : suspend le rendu le temps du rechargement.
    return new Promise(() => {});
  }
  throw err;
}

/** Import nommé (export non-default) protégé par `onChunkError`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const named = (p: Promise<any>, key: string) =>
  p.then((m) => ({ default: m[key] })).catch(onChunkError);
