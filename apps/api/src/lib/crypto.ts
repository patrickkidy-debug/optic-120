import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Chiffrement symétrique AES-256-GCM pour les secrets stockés au repos
 * (ex : clé API CinetPay). Format de sortie : iv:authTag:ciphertext (hex).
 */
// Une vraie clé AES-256 fait 32 octets. Si ENCRYPTION_KEY est fournie sous la
// forme de 64 caractères hexadécimaux, on l'utilise telle quelle ; sinon on en
// dérive 32 octets déterministes via SHA-256. Ainsi n'importe quelle valeur de
// secret suffisamment longue produit une clé valide (pas de format imposé).
const HEX_64 = /^[0-9a-fA-F]{64}$/;
const KEY = HEX_64.test(env.ENCRYPTION_KEY)
  ? Buffer.from(env.ENCRYPTION_KEY, 'hex')
  : createHash('sha256').update(env.ENCRYPTION_KEY).digest(); // 32 octets
const ALGO = 'aes-256-gcm';

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(':');
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error('Format de secret chiffré invalide');
  }
  const decipher = createDecipheriv(ALGO, KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString(
    'utf8',
  );
}
