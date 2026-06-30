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

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(hashStr: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashStr, plain);
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
