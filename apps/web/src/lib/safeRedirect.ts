/**
 * Valide une destination de redirection venant d'un paramètre `?next=`
 * (après connexion/inscription) avant tout `navigate()`. `startsWith('/')`
 * seul ne suffit pas : `//evil.com` commence bien par un `/` mais le
 * navigateur le traite comme une URL protocole-relatif vers `evil.com`
 * (redirection ouverte), et `/\evil.com` est le contournement par
 * antislash documenté pour React Router (GHSA-wrjc-x8rr-h8h6, présent
 * jusqu'à la 7.17.0 — cette validation reste nécessaire même après mise à
 * jour de la librairie, car un `next` forgé n'a jamais à sortir du site).
 *
 * N'autorise qu'un chemin interne : commence par UN SEUL `/`, jamais suivi
 * d'un second `/` ou d'un `\`, et ne contient aucun antislash.
 */
export function safeRedirect(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next) return fallback;
  if (!next.startsWith('/')) return fallback;
  if (next.startsWith('//') || next.startsWith('/\\')) return fallback;
  if (next.includes('\\')) return fallback;
  return next;
}
