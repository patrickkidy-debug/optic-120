/** Erreur HTTP typée, transformée en réponse JSON par le gestionnaire d'erreurs. */
export class HttpError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (msg = 'Requête invalide', details?: unknown) =>
  new HttpError(400, 'BAD_REQUEST', msg, details);
export const unauthorized = (msg = 'Non authentifié') =>
  new HttpError(401, 'UNAUTHORIZED', msg);
export const forbidden = (msg = 'Accès refusé') => new HttpError(403, 'FORBIDDEN', msg);
export const paymentRequired = (msg = 'Abonnement requis', details?: unknown) =>
  new HttpError(402, 'PAYMENT_REQUIRED', msg, details);
export const notFound = (msg = 'Ressource introuvable') => new HttpError(404, 'NOT_FOUND', msg);
export const conflict = (msg = 'Conflit') => new HttpError(409, 'CONFLICT', msg);
export const locked = (msg = 'Compte verrouillé') => new HttpError(423, 'LOCKED', msg);
export const tooManyRequests = (msg = 'Trop de requêtes') =>
  new HttpError(429, 'TOO_MANY_REQUESTS', msg);
