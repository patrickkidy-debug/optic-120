/**
 * Déverrouillage instantané de la session verrouillée (écran de veille après
 * inactivité). Le verrou est une protection de confidentialité côté client :
 * on vérifie le mot de passe localement, sans aller-retour serveur ni Argon2,
 * ce qui rend le déverrouillage immédiat même si l'API s'est endormie.
 *
 * Le vérificateur (sel + empreinte SHA-256) vit UNIQUEMENT en mémoire de l'onglet
 * — jamais écrit sur disque, effacé à la déconnexion et perdu au rechargement.
 * Menace couverte : un passant sur un poste laissé sans surveillance. Un attaquant
 * capable d'ouvrir les devtools disposerait déjà du jeton d'accès en mémoire, donc
 * ce contrôle local n'affaiblit pas la sécurité réelle du verrou de veille.
 */
let secret: { salt: string; digest: string } | null = null;

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Mémorise le mot de passe (sous forme salée/hachée) pour un déverrouillage local. */
export async function setUnlockSecret(password: string): Promise<void> {
  try {
    const salt = crypto.randomUUID();
    secret = { salt, digest: await sha256Hex(salt + password) };
  } catch {
    secret = null; // environnement sans SubtleCrypto : on retombera sur le serveur.
  }
}

/**
 * Vérifie le mot de passe localement.
 * @returns true/false si un vérificateur local existe, `null` s'il faut interroger
 *          le serveur (ex. session restaurée après rechargement, sans mot de passe).
 */
export async function tryLocalUnlock(password: string): Promise<boolean | null> {
  if (!secret) return null;
  try {
    return (await sha256Hex(secret.salt + password)) === secret.digest;
  } catch {
    return null;
  }
}

export function clearUnlockSecret(): void {
  secret = null;
}
