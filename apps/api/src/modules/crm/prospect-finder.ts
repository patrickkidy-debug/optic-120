import { ProspectSegment, ProspectSource, ProspectStatus, WhatsappStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { notFound } from '../../lib/http-error.js';
import { allDialCodes, computeLeadScore, normalizePhone, whatsappStatusFromPhone } from './prospect.utils.js';
import { getCrmSettings } from './crm.service.js';

/**
 * Agent de prospection : trouve des magasins d'optique dans une ville et les
 * propose au fondateur avant import dans le CRM.
 *
 * Sources publiques d'ÉTABLISSEMENTS uniquement (fiches d'entreprise) :
 *  - OpenStreetMap (gratuit, toujours actif) ;
 *  - Google Maps / Places, dès que GOOGLE_PLACES_API_KEY est posée sur le serveur.
 * L'adresse e-mail est lue sur la page d'accueil du site du magasin quand il
 * en a un. Aucun envoi automatique : le contact reste un clic du fondateur
 * (un envoi WhatsApp en masse à des inconnus fait bannir le numéro par Meta).
 */

const UA = 'OculoSaaS-CRM/1.0 (+https://oculosaas.com; support@oculosaas.com)';
const GOOGLE_KEY = () => process.env.GOOGLE_PLACES_API_KEY ?? '';

export interface FinderCandidate {
  externalId: string;
  origin: 'osm' | 'google';
  establishmentName: string;
  phone: string | null;
  phoneNormalized: string | null;
  phoneCountry: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  country: string;
  /** Déjà dans le CRM (même numéro, même e-mail ou même fiche). */
  alreadyInCrm: boolean;
}

export interface FinderResult {
  candidates: FinderCandidate[];
  sources: { osm: boolean; google: boolean };
  errors: string[];
}

/** Pays proposés dans l'agent : ceux dont le CRM connaît l'indicatif. */
export function finderCountries() {
  return allDialCodes().map((c) => ({ code: c.code, name: c.name, flag: c.flag }));
}

const PT = new Set(['CV', 'AO', 'MZ', 'GW', 'ST', 'BR', 'PT']);
const EN = new Set(['NG', 'GH', 'KE', 'TZ', 'UG', 'ZA', 'LR', 'SL', 'GM', 'MU', 'RW', 'ZM', 'ZW', 'BW', 'NA', 'CA']);
function langOf(country: string | null | undefined): 'fr' | 'pt' | 'en' {
  const c = (country ?? '').toUpperCase();
  return PT.has(c) ? 'pt' : EN.has(c) ? 'en' : 'fr';
}

async function fetchJson<T>(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 20000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, headers: { 'User-Agent': UA, ...(init.headers ?? {}) } });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

/* -------------------------------- OpenStreetMap -------------------------------- */

const OVERPASS_HOSTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

interface OsmElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
}

async function searchOsm(countryCode: string, city: string, limit: number): Promise<Omit<FinderCandidate, 'alreadyInCrm'>[]> {
  let area: string;
  if (city) {
    // Ville → point central (Nominatim), puis magasins dans un rayon de 20 km.
    const geo = await fetchJson<{ lat: string; lon: string }[]>(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=${countryCode.toLowerCase()}&city=${encodeURIComponent(city)}`,
    );
    if (!geo[0]) return [];
    area = `(around:20000,${geo[0].lat},${geo[0].lon})`;
  } else {
    area = '(area.a)';
  }
  const query = `[out:json][timeout:25];${city ? '' : `area["ISO3166-1"="${countryCode}"][admin_level=2]->.a;`}(nwr["shop"="optician"]${area};nwr["healthcare"="optometrist"]${area};nwr["craft"="optician"]${area};);out tags ${limit * 2};`;
  // Le serveur public principal est souvent saturé : miroirs essayés à la suite.
  let data: { elements: OsmElement[] } | null = null;
  let lastError: unknown;
  for (const host of OVERPASS_HOSTS) {
    try {
      data = await fetchJson<{ elements: OsmElement[] }>(host, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeoutMs: 30000,
      });
      break;
    } catch (e) {
      lastError = e;
    }
  }
  if (!data) throw lastError instanceof Error ? lastError : new Error('Overpass indisponible');
  return data.elements
    .filter((el) => el.tags?.name)
    .map((el) => {
      const t = el.tags!;
      const rawPhone = t.phone ?? t['contact:phone'] ?? t['contact:mobile'] ?? t['contact:whatsapp'] ?? null;
      const phone = rawPhone ? rawPhone.split(';')[0]!.trim() : null;
      const n = normalizePhone(phone, countryCode);
      return {
        externalId: `osm:${el.type}/${el.id}`,
        origin: 'osm' as const,
        establishmentName: t.name!,
        phone,
        phoneNormalized: n.valid ? n.e164 : null,
        phoneCountry: n.country ?? countryCode,
        email: (t.email ?? t['contact:email'] ?? null)?.split(';')[0]?.trim() ?? null,
        website: t.website ?? t['contact:website'] ?? null,
        address: [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ') || null,
        city: t['addr:city'] ?? (city || null),
        country: countryCode,
      };
    });
}

/* ------------------------------ Google Places ------------------------------ */

interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
}

const QUERY_WORD = { fr: 'opticien', pt: 'óptica', en: 'optician' } as const;

async function searchGoogle(countryCode: string, countryName: string, city: string, limit: number) {
  const out: Omit<FinderCandidate, 'alreadyInCrm'>[] = [];
  let pageToken: string | undefined;
  const lang = langOf(countryCode);
  do {
    const data = await fetchJson<{ places?: GooglePlace[]; nextPageToken?: string }>(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_KEY(),
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.nationalPhoneNumber,places.websiteUri,nextPageToken',
        },
        body: JSON.stringify({
          textQuery: `${QUERY_WORD[lang]} ${city ? `${city}, ` : ''}${countryName}`,
          regionCode: countryCode,
          languageCode: lang,
          pageSize: 20,
          ...(pageToken ? { pageToken } : {}),
        }),
      },
    );
    for (const p of data.places ?? []) {
      const phone = p.internationalPhoneNumber ?? p.nationalPhoneNumber ?? null;
      const n = normalizePhone(phone, countryCode);
      out.push({
        externalId: `google:${p.id}`,
        origin: 'google',
        establishmentName: p.displayName?.text ?? 'Opticien',
        phone,
        phoneNormalized: n.valid ? n.e164 : null,
        phoneCountry: n.country ?? countryCode,
        email: null,
        website: p.websiteUri ?? null,
        address: p.formattedAddress ?? null,
        city: city || null,
        country: countryCode,
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken && out.length < limit);
  return out;
}

/* ------------------------------ E-mail du site ------------------------------ */

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const NOT_EMAIL = /\.(png|jpe?g|gif|svg|webp)$|example\.|sentry|wixpress|@2x/i;

async function emailFromWebsite(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url.startsWith('http') ? url : `https://${url}`, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA },
      redirect: 'follow',
    });
    clearTimeout(t);
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('html')) return null;
    const html = (await res.text()).slice(0, 400_000);
    const mailto = html.match(/mailto:([^"'?>\s]+)/i)?.[1];
    if (mailto && !NOT_EMAIL.test(mailto)) return decodeURIComponent(mailto).toLowerCase();
    return (html.match(EMAIL_RE) ?? []).find((e) => !NOT_EMAIL.test(e))?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

/** Exécute `fn` sur chaque élément, au plus `n` à la fois. */
async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]!);
  }));
}

/* --------------------------------- Recherche --------------------------------- */

export async function searchOpticians(input: { country: string; city?: string; limit?: number }): Promise<FinderResult> {
  const countryCode = input.country.toUpperCase();
  const city = (input.city ?? '').trim();
  const limit = Math.min(Math.max(input.limit ?? 40, 5), 60);
  const countryName = finderCountries().find((c) => c.code === countryCode)?.name ?? countryCode;
  const errors: string[] = [];
  const useGoogle = Boolean(GOOGLE_KEY());

  const [osm, google] = await Promise.all([
    searchOsm(countryCode, city, limit).catch((e: Error) => {
      errors.push(`OpenStreetMap : ${e.message}`);
      return [];
    }),
    useGoogle
      ? searchGoogle(countryCode, countryName, city, limit).catch((e: Error) => {
          errors.push(`Google Maps : ${e.message}`);
          return [];
        })
      : Promise.resolve([]),
  ]);

  // Fusion : Google d'abord (fiches plus complètes), un même numéro ou un même
  // nom dans la même ville n'apparaît qu'une fois.
  const seen = new Set<string>();
  const merged: Omit<FinderCandidate, 'alreadyInCrm'>[] = [];
  for (const c of [...google, ...osm]) {
    const keys = [c.phoneNormalized, `${c.establishmentName.toLowerCase()}|${(c.city ?? '').toLowerCase()}`].filter(Boolean) as string[];
    if (keys.some((k) => seen.has(k))) continue;
    keys.forEach((k) => seen.add(k));
    merged.push(c);
    if (merged.length >= limit) break;
  }

  await pool(merged.filter((c) => !c.email && c.website), 5, async (c) => {
    c.email = await emailFromWebsite(c.website!);
  });

  const existing = await prisma.prospect.findMany({
    where: {
      OR: [
        { externalId: { in: merged.map((c) => c.externalId) } },
        { phoneNormalized: { in: merged.map((c) => c.phoneNormalized).filter(Boolean) as string[] } },
        { email: { in: merged.map((c) => c.email).filter(Boolean) as string[] } },
      ],
    },
    select: { externalId: true, phoneNormalized: true, email: true },
  });
  const known = new Set(existing.flatMap((p) => [p.externalId, p.phoneNormalized, p.email]).filter(Boolean));

  return {
    candidates: merged.map((c) => ({
      ...c,
      alreadyInCrm: [c.externalId, c.phoneNormalized, c.email].some((k) => k && known.has(k)),
    })),
    sources: { osm: true, google: useGoogle },
    errors,
  };
}

/** Ajoute au CRM les magasins choisis (ceux sans téléphone ni e-mail sont ignorés). */
export async function importCandidates(candidates: FinderCandidate[], userId: string): Promise<{ created: number; skipped: number }> {
  let created = 0;
  for (const c of candidates) {
    if (!c.phoneNormalized && !c.email) continue;
    const whatsappStatus = c.phoneNormalized
      ? whatsappStatusFromPhone({ e164: c.phoneNormalized, country: c.phoneCountry, valid: true })
      : WhatsappStatus.PHONE_INVALID;
    try {
      await prisma.prospect.create({
        data: {
          establishmentName: c.establishmentName.slice(0, 200),
          phone: c.phone,
          phoneNormalized: c.phoneNormalized,
          phoneCountry: c.phoneCountry,
          email: c.email,
          website: c.website,
          address: c.address,
          city: c.city,
          country: c.country,
          externalId: c.externalId,
          source: ProspectSource.AUTO_SEARCH,
          whatsappStatus,
          leadScore: computeLeadScore({
            establishmentName: c.establishmentName,
            email: c.email,
            website: c.website,
            segment: ProspectSegment.STANDARD,
            status: ProspectStatus.NEW,
            whatsappStatus,
          }),
          events: {
            create: {
              type: 'IMPORTED',
              label: `Trouvé par l'agent de prospection (${c.origin === 'google' ? 'Google Maps' : 'OpenStreetMap'})`,
              createdById: userId,
            },
          },
        },
      });
      created++;
    } catch {
      // Doublon (numéro, fiche) apparu entre la recherche et l'import : ignoré.
    }
  }
  return { created, skipped: candidates.length - created };
}

/* ------------------------------ Message rédigé par l'IA ------------------------------ */

const LANG_NAME = { fr: 'français', pt: 'portugais', en: 'anglais' } as const;

/**
 * Premier message personnalisé pour un prospect. Sans clé Anthropic, renvoie
 * null : l'interface garde alors les modèles de message habituels.
 */
export async function draftMessage(prospectId: string, channel: 'whatsapp' | 'email'): Promise<{ subject: string; body: string } | null> {
  if (!env.ANTHROPIC_API_KEY) return null;
  const [p, settings] = await Promise.all([prisma.prospect.findUnique({ where: { id: prospectId } }), getCrmSettings()]);
  if (!p) throw notFound('Prospect introuvable');
  const lang = langOf(p.phoneCountry ?? p.country);
  const link = settings.signupUrl || 'https://oculosaas.com/activation';

  const facts = [
    `Établissement : ${p.establishmentName}`,
    p.firstName || p.lastName ? `Contact : ${[p.firstName, p.lastName].filter(Boolean).join(' ')}` : null,
    p.city ? `Ville : ${p.city}` : null,
    p.website ? `Site web : ${p.website}` : null,
    p.notes ? `Notes du fondateur : ${p.notes.slice(0, 500)}` : null,
  ].filter(Boolean).join('\n');

  const system = `Tu écris des messages de prospection B2B pour OculoSaaS, logiciel de gestion pour magasins d'optique (stock de montures et verres, ventes et devis, ordonnances, encaissements avec mobile money, rapports ; sur ordinateur, tablette et téléphone ; essai gratuit, configuration accompagnée par l'équipe).
Règles : ${LANG_NAME[lang]} ; ton chaleureux et professionnel, vouvoiement ; ${channel === 'whatsapp' ? '60 à 90 mots, 1 ou 2 emojis maximum, pas de markdown' : '90 à 140 mots, texte brut'} ; mentionne le nom du magasin ; une seule question ou invitation claire à la fin ; inclus ce lien tel quel : ${link} ; signe « L'équipe OculoSaaS ». N'invente AUCUN chiffre, client, témoignage, prix ni promotion. Ne prétends pas connaître le magasin au-delà des informations fournies.
Réponds uniquement en JSON : {"subject": "objet court (e-mail uniquement, sinon chaîne vide)", "body": "le message"}`;

  const res = await fetch(`${env.ANTHROPIC_BASE_URL}/v1/messages`, {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 600,
      system,
      messages: [{ role: 'user', content: `Premier message ${channel === 'whatsapp' ? 'WhatsApp' : 'e-mail'} pour ce prospect :\n${facts}` }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  const text = data.content.find((b) => b.type === 'text')?.text ?? '';
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return { subject: '', body: text.trim() };
  const parsed = JSON.parse(json) as { subject?: string; body?: string };
  return { subject: parsed.subject ?? '', body: (parsed.body ?? '').trim() };
}
