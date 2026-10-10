import { fileToResizedDataUrl } from '../../lib/image';

/**
 * Pièce jointe OculoTrack → data URL. Photos réduites (1600 px, ~900 Ko max)
 * avec le compresseur commun ; PDF transmis tel quel (4 Mo max).
 *
 * Les pièces OculoTrack restent PRIVÉES (en base, servies après contrôle
 * d'accès) : une prescription ne doit jamais avoir d'adresse publique, d'où
 * l'absence d'envoi vers le stockage public d'images.
 */
export async function trackFileToDataUrl(file: File): Promise<string> {
  if (file.type === 'application/pdf') {
    if (file.size > 4 * 1024 * 1024) throw new Error('PDF > 4 Mo');
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }
  return fileToResizedDataUrl(file, 1600, 900 * 1024);
}
