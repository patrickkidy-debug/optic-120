import { SUPPORTED_COUNTRIES } from '@oculo/shared-types';
import { ProspectSegment, ProspectStatus, WhatsappStatus } from '@prisma/client';

export interface NormalizedPhone {
  /** E.164 (+225...) ou null si irrécupérable. */
  e164: string | null;
  /** Code pays ISO-2 déduit de l'indicatif, si reconnu. */
  country: string | null;
  valid: boolean;
}

/**
 * Convertit un numéro saisi librement en E.164, en déduisant le pays depuis
 * l'indicatif. Accepte les écritures locales courantes : « 07 58 12 34 56 »,
 * « 00225 0758123456 », « +225-07.58.12.34.56 ».
 *
 * Un numéro sans indicatif reconnaissable reste invalide plutôt que d'être
 * rattaché au hasard à un pays : mieux vaut un prospect signalé à corriger
 * qu'un mauvais numéro contacté.
 */
export function normalizePhone(raw: string | null | undefined, defaultCountry?: string): NormalizedPhone {
  if (!raw) return { e164: null, country: null, valid: false };

  let digits = String(raw).replace(/[^\d+]/g, '');
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  // Un « + » égaré ailleurs qu'en tête n'a pas de sens : on ne garde que le premier.
  if (digits.includes('+')) digits = `+${digits.replace(/\+/g, '')}`;

  if (digits.startsWith('+')) {
    const match = SUPPORTED_COUNTRIES.find((c) => digits.startsWith(c.dial));
    if (!match) return { e164: null, country: null, valid: false };
    const rest = digits.slice(match.dial.length);
    // Numéro de remplissage (0000000, 1111111) : invalide.
    if (rest.length < 6 || /^(\d)\1+$/.test(rest)) return { e164: null, country: match.code, valid: false };
    return { e164: `${match.dial}${rest}`, country: match.code, valid: true };
  }

  // Pas d'indicatif : on ne peut trancher que si le pays est fourni par ailleurs
  // (colonne « Pays » du fichier importé).
  const fallback = defaultCountry
    ? SUPPORTED_COUNTRIES.find(
        (c) => c.code.toLowerCase() === defaultCountry.toLowerCase() ||
               c.name.toLowerCase() === defaultCountry.toLowerCase(),
      )
    : undefined;
  if (!fallback) return { e164: null, country: null, valid: false };

  // On NE retire PAS le zéro initial : en Afrique de l'Ouest il fait partie du
  // numéro national (Côte d'Ivoire : 07 58 12 34 56 = +225 07 58 12 34 56), ce
  // n'est pas un préfixe interurbain comme en Europe. Le retirer donnerait une
  // clé différente de la même ligne saisie avec indicatif, et le doublon
  // passerait au travers.
  if (digits.length < 6) return { e164: null, country: fallback.code, valid: false };
  return { e164: `${fallback.dial}${digits}`, country: fallback.code, valid: true };
}

/**
 * Statut de joignabilité déduit du SEUL format. Ne vaut jamais WHATSAPP_VERIFIED :
 * Meta n'expose aucun moyen officiel de savoir si un numéro possède WhatsApp
 * sans lui écrire. Le vert ne s'obtient que par une preuve réelle (le prospect
 * a répondu) ou un marquage manuel du fondateur.
 */
export function whatsappStatusFromPhone(phone: NormalizedPhone): WhatsappStatus {
  return phone.valid
    ? WhatsappStatus.PHONE_VALID_WHATSAPP_UNCONFIRMED
    : WhatsappStatus.PHONE_INVALID;
}

export interface ScoreInput {
  establishmentName?: string | null;
  email?: string | null;
  segment: ProspectSegment;
  status: ProspectStatus;
  whatsappStatus: WhatsappStatus;
  website?: string | null;
}

const GENERIC_EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'yahoo.fr', 'hotmail.com', 'outlook.com', 'icloud.com'];

/** Barème documenté dans le cahier des charges (§6). Toujours borné 0-100. */
export function computeLeadScore(input: ScoreInput): number {
  let score = 0;

  // Structure : plusieurs établissements / réseau (indices dans le nom).
  const name = (input.establishmentName ?? '').toLowerCase();
  if (/\b(groupe|réseau|reseau|chaine|chaîne|holding)\b/.test(name)) score += 20;
  if (/\b(clinique|centre|hopital|hôpital|polyclinique)\b/.test(name)) score += 15;

  if (input.whatsappStatus === WhatsappStatus.WHATSAPP_VERIFIED) score += 15;
  else if (input.whatsappStatus === WhatsappStatus.PHONE_VALID_WHATSAPP_UNCONFIRMED) score += 10;

  // Email professionnel = domaine propre (pas gmail/yahoo...).
  const email = (input.email ?? '').toLowerCase();
  if (email.includes('@')) {
    const domain = email.split('@')[1] ?? '';
    if (domain && !GENERIC_EMAIL_DOMAINS.includes(domain)) score += 10;
  }
  if (input.website) score += 5;
  if (input.segment === ProspectSegment.PREMIUM) score += 10;

  // Engagement réel : le plus fort signal d'achat.
  if (input.status === ProspectStatus.REPLIED) score += 10;
  if (input.status === ProspectStatus.DEMO_SCHEDULED) score += 20;
  if (input.status === ProspectStatus.DEMO_COMPLETED) score += 25;
  if (input.status === ProspectStatus.TRIAL) score += 30;
  if (input.status === ProspectStatus.CUSTOMER) score = 100;
  if (input.status === ProspectStatus.LOST) score = 0;

  return Math.max(0, Math.min(100, score));
}

export type ScoreBand = 'HOT' | 'WARM' | 'COLD' | 'LOW';

export function scoreBand(score: number): ScoreBand {
  if (score >= 80) return 'HOT';
  if (score >= 60) return 'WARM';
  if (score >= 40) return 'COLD';
  return 'LOW';
}

/** Remplace {{first_name}}, {{establishment_name}}, {{city}}... dans un modèle. */
export function fillTemplate(body: string, vars: Record<string, string | null | undefined>): string {
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key: string) => {
    const v = vars[key.toLowerCase()];
    return v == null || v === '' ? '' : String(v);
  });
}
