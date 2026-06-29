import { authenticator } from 'otplib';
import QRCode from 'qrcode';

// Tolérance d'une fenêtre (±30 s) pour absorber le décalage d'horloge.
authenticator.options = { window: 1 };

const ISSUER = 'OculoSaaS';

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

/** URL otpauth:// à encoder dans le QR code (compatible Google Authenticator, Authy…). */
export function otpauthURL(secret: string, account: string): string {
  return authenticator.keyuri(account, ISSUER, secret);
}

export function verifyTotp(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token: token.trim(), secret });
  } catch {
    return false;
  }
}

/** Génère un QR code (data URL PNG) à afficher côté client. */
export function qrDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, { margin: 1, width: 240 });
}
