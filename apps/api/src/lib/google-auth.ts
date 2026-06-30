import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';
import { badRequest } from './http-error.js';

const client = new OAuth2Client(env.GOOGLE_CLIENT_ID || undefined);

export interface GoogleProfile {
  googleId: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  pictureUrl: string | null;
}

/**
 * Vérifie un jeton d'identité Google (ID token) émis par Google Identity
 * Services côté navigateur. Ne fait JAMAIS confiance au contenu décodé sans
 * cette vérification cryptographique (signature + audience + émetteur).
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  if (!env.GOOGLE_CLIENT_ID) {
    throw badRequest("Connexion Google non configurée côté serveur (GOOGLE_CLIENT_ID manquant)");
  }
  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    throw badRequest('Jeton Google invalide ou expiré');
  }
  if (!payload?.email) throw badRequest('Profil Google incomplet (email manquant)');

  const [first, ...rest] = (payload.name ?? payload.email.split('@')[0]).split(' ');
  return {
    googleId: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified ?? false,
    firstName: payload.given_name || first || 'Utilisateur',
    lastName: payload.family_name || rest.join(' ') || '-',
    pictureUrl: payload.picture ?? null,
  };
}
