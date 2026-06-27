import { randomBytes, createHash, randomUUID } from 'node:crypto';

/**
 * Refresh tokens : opaques (256 bits aléatoires), jamais stockés en clair.
 * Seul le SHA-256 du token est persisté (RefreshToken.tokenHash).
 */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Identifiant de "famille" de rotation, pour détecter le rejeu d'un token volé. */
export function newTokenFamily(): string {
  return randomUUID();
}

/** Token de réinitialisation de mot de passe (opaque, hashé en base). */
export function generateResetToken(): string {
  return randomBytes(32).toString('base64url');
}
