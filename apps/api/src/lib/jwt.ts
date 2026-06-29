import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env.js';

const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const ALG = 'HS256';

export interface AccessTokenClaims {
  sub: string; // userId
  tenantId: string;
  roleId: string;
}

export async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  return new SignJWT({ tenantId: claims.tenantId, roleId: claims.roleId })
    .setProtectedHeader({ alg: ALG })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(env.JWT_ACCESS_TTL)
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });
  return {
    sub: String(payload.sub),
    tenantId: String(payload.tenantId),
    roleId: String(payload.roleId),
  };
}

/**
 * Jeton court (5 min) émis après le mot de passe quand la 2FA est active.
 * Échangé contre une vraie session une fois le code TOTP validé.
 */
export async function signTwoFactorChallenge(userId: string): Promise<string> {
  return new SignJWT({ typ: '2fa' })
    .setProtectedHeader({ alg: ALG })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secret);
}

export async function verifyTwoFactorChallenge(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });
  if (payload.typ !== '2fa') throw new Error('Jeton 2FA invalide');
  return String(payload.sub);
}
