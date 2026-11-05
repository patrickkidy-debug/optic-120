import { randomInt } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

/**
 * Hash Argon2id (recommandation OWASP). `@node-rs/argon2` fournit des binaires
 * précompilés ABI-stables (napi-rs) — pas de compilation native requise.
 */
const OPTIONS = {
  memoryCost: 19456, // ~19 Mo
  timeCost: 2,
  parallelism: 1,
};

/**
 * Mot de passe tel qu'il doit être compris : sans espaces en début / fin ni
 * caractères invisibles. Un mot de passe copié depuis WhatsApp ou un email
 * embarque souvent une espace finale, une espace insécable ou un marqueur de
 * direction (U+200E…) : la connexion échouait alors sans raison visible.
 */
export function normalizePassword(plain: string): string {
  return plain
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, '')
    .replace(/[\u00A0\u202F]/g, ' ')
    .normalize('NFC')
    .trim();
}

export function hashPassword(plain: string): Promise<string> {
  return hash(normalizePassword(plain), OPTIONS);
}

export async function verifyPassword(hashStr: string, plain: string): Promise<boolean> {
  try {
    // Forme normalisée d'abord (nouveaux mots de passe), puis telle quelle :
    // un ancien mot de passe enregistré avec une espace reste valable.
    const clean = normalizePassword(plain);
    if (await verify(hashStr, clean)) return true;
    return clean !== plain ? await verify(hashStr, plain) : false;
  } catch {
    return false;
  }
}

// Alphabet sans caractères ambigus (pas de 0/O, 1/l/I) : lisible à l'oral/WhatsApp.
const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/** Mot de passe temporaire lisible, pour réinitialisation manuelle (sans email). */
export function generateTempPassword(length = 10): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += TEMP_PASSWORD_ALPHABET[randomInt(TEMP_PASSWORD_ALPHABET.length)];
  }
  return out;
}
