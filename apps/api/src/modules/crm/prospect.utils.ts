import { SUPPORTED_COUNTRIES } from '@oculo/shared-types';
import { ProspectSegment, ProspectStatus, WhatsappStatus } from '@prisma/client';

export interface DialCode {
  dial: string;
  code: string;
  name: string;
  flag: string;
}

export interface NormalizedPhone {
  /** E.164 (+225...) ou null si irrécupérable. */
  e164: string | null;
  /** Code pays ISO-2 déduit de l'indicatif, si reconnu. */
  country: string | null;
  valid: boolean;
}

/** Retire les diacritiques : « Algérie » et « Algerie » doivent se valoir. */
export function stripAccents(s: string): string {
  let out = '';
  for (const ch of s.normalize('NFD')) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 0x0300 || c > 0x036f) out += ch;
  }
  return out;
}

/**
 * Liste d'indicatifs mémoïsée. Lazy : PROSPECT_DIAL_CODES est déclaré plus bas
 * dans le fichier, une constante de module l'évaluerait avant son initialisation.
 */
let dialCache: DialCode[] | null = null;
function dialCodes(): DialCode[] {
  if (!dialCache) dialCache = allDialCodes();
  return dialCache;
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
    const match = dialCodes().find((c) => digits.startsWith(c.dial));
    if (!match) return { e164: null, country: null, valid: false };
    const rest = digits.slice(match.dial.length);
    // Numéro de remplissage (0000000, 1111111) : invalide.
    if (rest.length < 6 || /^(\d)\1+$/.test(rest)) return { e164: null, country: match.code, valid: false };
    return { e164: `${match.dial}${rest}`, country: match.code, valid: true };
  }

  // Indicatif présent mais « + » oublié : « 212661798080 ». Sans ce rattrapage
  // la même ligne écrite avec et sans « + » produirait deux clés, donc deux
  // prospects, et le même magasin serait démarché deux fois.
  //
  // Restreint aux indicatifs à 3 chiffres (+212, +225…) : ce sont tous nos
  // marchés, et ils ne peuvent pas être confondus avec un numéro national, qui
  // commence par 0 ou par un préfixe opérateur court. Les indicatifs à 1-2
  // chiffres (+1, +20, +27, +33, +41) sont volontairement exclus — « 4165551234 »
  // est un numéro canadien, pas un suisse, et rien dans la chaîne ne permet de
  // trancher. Mieux vaut le signaler que le rattacher au mauvais pays.
  if (!defaultCountry?.trim()) {
    const guess = dialCodes().find(
      (c) => c.dial.length === 4 && digits.startsWith(c.dial.slice(1)),
    );
    if (guess) {
      const rest = digits.slice(3);
      if (rest.length >= 8 && !/^(\d)\1+$/.test(rest)) {
        return { e164: `${guess.dial}${rest}`, country: guess.code, valid: true };
      }
    }
  }

  // Pas d'indicatif : on ne peut trancher que si le pays est fourni par ailleurs
  // (colonne « Pays » du fichier importé).
  const wanted = defaultCountry?.trim().toLowerCase();
  const fallback = wanted
    ? dialCodes().find(
        (c) => c.code.toLowerCase() === wanted || stripAccents(c.name).toLowerCase() === stripAccents(wanted),
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

/**
 * Indicatifs reconnus pour la PROSPECTION uniquement — volontairement plus
 * large que SUPPORTED_COUNTRIES, qui définit les pays où un client peut
 * s'inscrire et être facturé (et dépend donc des devises gérées).
 *
 * On peut démarcher un opticien marocain ou camerounais bien avant d'ouvrir
 * la facturation dans son pays : rejeter son numéro à l'import n'aurait aucun
 * sens. Les deux listes sont donc distinctes et le resteront.
 */
export const PROSPECT_DIAL_CODES: DialCode[] = [
  // Afrique du Nord
  { dial: '+212', code: 'MA', name: 'Maroc', flag: '🇲🇦' },
  { dial: '+213', code: 'DZ', name: 'Algérie', flag: '🇩🇿' },
  { dial: '+216', code: 'TN', name: 'Tunisie', flag: '🇹🇳' },
  { dial: '+218', code: 'LY', name: 'Libye', flag: '🇱🇾' },
  { dial: '+20', code: 'EG', name: 'Égypte', flag: '🇪🇬' },
  // Afrique centrale
  { dial: '+237', code: 'CM', name: 'Cameroun', flag: '🇨🇲' },
  { dial: '+241', code: 'GA', name: 'Gabon', flag: '🇬🇦' },
  { dial: '+242', code: 'CG', name: 'Congo', flag: '🇨🇬' },
  { dial: '+243', code: 'CD', name: 'RD Congo', flag: '🇨🇩' },
  { dial: '+235', code: 'TD', name: 'Tchad', flag: '🇹🇩' },
  { dial: '+236', code: 'CF', name: 'Centrafrique', flag: '🇨🇫' },
  { dial: '+240', code: 'GQ', name: 'Guinée équatoriale', flag: '🇬🇶' },
  // Afrique de l'Est / australe
  { dial: '+254', code: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { dial: '+255', code: 'TZ', name: 'Tanzanie', flag: '🇹🇿' },
  { dial: '+256', code: 'UG', name: 'Ouganda', flag: '🇺🇬' },
  { dial: '+250', code: 'RW', name: 'Rwanda', flag: '🇷🇼' },
  { dial: '+257', code: 'BI', name: 'Burundi', flag: '🇧🇮' },
  { dial: '+27', code: 'ZA', name: 'Afrique du Sud', flag: '🇿🇦' },
  { dial: '+261', code: 'MG', name: 'Madagascar', flag: '🇲🇬' },
  { dial: '+230', code: 'MU', name: 'Maurice', flag: '🇲🇺' },
  // Europe francophone (diaspora, partenaires)
  { dial: '+33', code: 'FR', name: 'France', flag: '🇫🇷' },
  { dial: '+32', code: 'BE', name: 'Belgique', flag: '🇧🇪' },
  { dial: '+41', code: 'CH', name: 'Suisse', flag: '🇨🇭' },
  { dial: '+1', code: 'CA', name: 'Canada / USA', flag: '🇨🇦' },
];

/**
 * Tous les indicatifs acceptés à l'import, pays servis en premier : un
 * indicatif court (+1, +20, +27) ne doit jamais capter un numéro d'un pays
 * servi dont l'indicatif commence pareil.
 */
export function allDialCodes(): DialCode[] {
  const served = SUPPORTED_COUNTRIES.map((c) => ({
    dial: c.dial,
    code: c.code as string,
    name: c.name,
    flag: c.flag,
  }));
  // Tri par longueur d'indicatif décroissante : +225 est testé avant +22,
  // +212 avant +21. Sans ça, un préfixe court volerait les numéros d'un autre.
  return [...served, ...PROSPECT_DIAL_CODES].sort((a, b) => b.dial.length - a.dial.length);
}
