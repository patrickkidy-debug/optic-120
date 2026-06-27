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
