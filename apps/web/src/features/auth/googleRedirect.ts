/**
 * Connexion Google par REDIRECTION (OpenID Connect, flux id_token).
 *
 * Le bouton Google officiel ouvre une fenêtre popup : dans une PWA installée
 * sur iPhone (mode « standalone »), iOS ouvre cette popup à part et le résultat
 * ne revient jamais à l'application — la connexion Google est impossible.
 * Ici la page entière part chez Google puis revient sur /auth/google/callback
 * avec le jeton dans le fragment d'URL ; il est ensuite transmis au même flux
 * que le bouton (useGoogleAuthFlow).
 *
 * Protection : `state` et `nonce` aléatoires mémorisés dans sessionStorage et
 * vérifiés au retour (un jeton reçu sans demande de cette page est ignoré).
 */

const KEY = 'oculo_google_redirect';
const RESULT_KEY = 'oculo_google_result';
const CALLBACK_PATH = '/auth/google/callback';

/** PWA installée sur iPhone / iPad : la popup Google n'y fonctionne pas. */
export function isIosStandalone(): boolean {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  return ios && standalone;
}

function random(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Part chez Google ; au retour, l'utilisateur revient sur `returnTo`. */
export function startGoogleRedirect(clientId: string, returnTo: string): void {
  const state = random();
  const nonce = random();
  sessionStorage.setItem(KEY, JSON.stringify({ state, nonce, returnTo }));
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: window.location.origin + CALLBACK_PATH,
    response_type: 'id_token',
    scope: 'openid email profile',
    nonce,
    state,
    prompt: 'select_account',
  });
  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

function payloadOf(jwt: string): { nonce?: string } | null {
  try {
    const part = jwt.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(part)))) as { nonce?: string };
  } catch {
    return null;
  }
}

/**
 * Traitement du retour de Google (page /auth/google/callback). Renvoie la page
 * où revenir ; le jeton (ou l'erreur) attend d'être repris par le formulaire.
 */
export function completeGoogleRedirect(hash: string): string {
  const saved = (() => {
    try {
      return JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as { state: string; nonce: string; returnTo: string } | null;
    } catch {
      return null;
    }
  })();
  sessionStorage.removeItem(KEY);
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  const returnTo = saved?.returnTo && saved.returnTo.startsWith('/') ? saved.returnTo : '/login';
  const idToken = q.get('id_token');
  const ok = Boolean(saved && idToken && q.get('state') === saved.state && payloadOf(idToken!)?.nonce === saved.nonce);
  sessionStorage.setItem(
    RESULT_KEY,
    JSON.stringify(ok ? { idToken } : { error: q.get('error') === 'access_denied' ? 'cancelled' : 'failed' }),
  );
  return returnTo;
}

/** Jeton Google rapporté par une redirection, à consommer une seule fois. */
export function takeGoogleRedirectResult(): { idToken?: string; error?: 'cancelled' | 'failed' } | null {
  const raw = sessionStorage.getItem(RESULT_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(RESULT_KEY);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
