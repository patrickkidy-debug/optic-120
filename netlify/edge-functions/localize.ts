/**
 * Localisation de la vitrine, exécutée en périphérie (Netlify Edge).
 *
 * Deux rôles, tous deux impossibles côté client :
 *
 *  1. GeoIP — Netlify fournit le pays du visiteur dans `context.geo`, déduit de
 *     son IP. Aucune API tierce, aucune latence ajoutée, aucune donnée envoyée
 *     à un service externe. On le transmet au client par cookie.
 *
 *  2. SEO international — hreflang, canonique, `<html lang>` et métadonnées
 *     traduites doivent être dans le HTML *servi*, pas ajoutés après coup par
 *     React : Google indexe surtout la réponse initiale. On réécrit donc le
 *     head ici.
 *
 * Ne s'applique qu'aux pages publiques (vitrine, inscription, connexion).
 * L'application connectée n'a aucun intérêt SEO et n'est pas touchée.
 */

const SITE = 'https://oculosaas.com';
const LOCALES = ['fr', 'en', 'pt'] as const;
type Locale = (typeof LOCALES)[number];
const DEFAULT_LOCALE: Locale = 'fr';

/** Pays servis (inscription possible) et leur langue officielle. */
const COUNTRY_LOCALE: Record<string, Locale> = {
  BJ: 'fr', BF: 'fr', CI: 'fr', GN: 'fr', ML: 'fr',
  MR: 'fr', NE: 'fr', SN: 'fr', TG: 'fr',
  CV: 'pt', GW: 'pt', AO: 'pt', MZ: 'pt',
  GM: 'en', GH: 'en', LR: 'en', NG: 'en', SL: 'en',
};

/** Métadonnées traduites : ce que voient Google et les aperçus de partage. */
const META: Record<Locale, { title: string; description: string }> = {
  fr: {
    title: 'OculoSaaS — Logiciel de gestion pour optique & clinique en Afrique',
    description:
      "OculoSaaS : le logiciel tout-en-un pour gérer votre optique ou clinique ophtalmologique — caisse, stocks, patients, paiements mobiles et rapports.",
  },
  en: {
    title: 'OculoSaaS — Management software for optical stores & eye clinics in Africa',
    description:
      'OculoSaaS: the all-in-one software to run your optical store or eye clinic — till, stock, patients, mobile payments and reports.',
  },
  pt: {
    title: 'OculoSaaS — Software de gestão para óticas e clínicas oftalmológicas em África',
    description:
      'OculoSaaS: o software tudo-em-um para gerir a sua ótica ou clínica oftalmológica — caixa, stock, pacientes, pagamentos móveis e relatórios.',
  },
};

/** Chemins publics : seuls ceux-là méritent un traitement SEO. */
function isPublicPath(pathname: string): boolean {
  const p = pathname.replace(/^\/(fr|en|pt)(?=\/|$)/, '') || '/';
  return p === '/' || p === '/signup' || p === '/login';
}

function localeFromPath(pathname: string): Locale | null {
  const seg = pathname.split('/')[1]?.toLowerCase();
  return (LOCALES as readonly string[]).includes(seg) ? (seg as Locale) : null;
}

function localeFromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  // « pt-BR,pt;q=0.9,en;q=0.8 » — on respecte l'ordre de préférence déclaré.
  const tags = header
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of tags) {
    const base = tag.split('-')[0];
    if ((LOCALES as readonly string[]).includes(base)) return base as Locale;
  }
  return null;
}

function esc(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default async function handler(request: Request, context: any): Promise<Response> {
  const url = new URL(request.url);
  if (!isPublicPath(url.pathname)) return context.next();

  const response = await context.next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html')) return response;

  const pathLocale = localeFromPath(url.pathname);
  const country: string | undefined = context.geo?.country?.code;
  const stored = request.headers
    .get('cookie')
    ?.match(/(?:^|; )oculo_locale=([^;]*)/)?.[1];

  // Même ordre de priorité que le client (voir lib/locale-resolve.ts) : URL,
  // puis choix manuel memorise, puis pays, puis navigateur.
  const locale: Locale =
    pathLocale ??
    ((LOCALES as readonly string[]).includes(stored ?? '') ? (stored as Locale) : null) ??
    (country ? COUNTRY_LOCALE[country.toUpperCase()] ?? null : null) ??
    localeFromAcceptLanguage(request.headers.get('accept-language')) ??
    DEFAULT_LOCALE;

  const meta = META[locale];
  const bare = url.pathname.replace(/^\/(fr|en|pt)(?=\/|$)/, '') || '/';

  // Le canonique dépend de l'URL DEMANDÉE, jamais de la langue détectée.
  // Sinon « / » visité depuis Luanda se déclarerait doublon de « /pt/ », et
  // Googlebot (qui explore surtout depuis des IP américaines) ferait pointer
  // « / » vers « /en/ » — la version française perdrait son URL propre.
  const canonical = pathLocale
    ? `${SITE}/${pathLocale}${bare === '/' ? '/' : bare}`
    : `${SITE}${bare === '/' ? '/' : bare}`;

  // hreflang : declare a Google les equivalents de cette page dans chaque
  // langue, plus x-default pour les visiteurs hors zone couverte.
  const alternates = [
    ...LOCALES.map((l) => {
      const href = `${SITE}${l === DEFAULT_LOCALE ? '' : '/' + l}${bare === '/' ? '/' : bare}`;
      return `<link rel="alternate" hreflang="${l}" href="${href}" />`;
    }),
    `<link rel="alternate" hreflang="x-default" href="${SITE}${bare === '/' ? '/' : bare}" />`,
  ].join('\n    ');

  let html = await response.text();

  html = html
    .replace('<html lang="fr"', `<html lang="${locale}"`)
    .replace(
      /<title>[\s\S]*?<\/title>/,
      `<title>${esc(meta.title)}</title>`,
    )
    .replace(
      /<meta\s+name="description"[\s\S]*?\/>/,
      `<meta name="description" content="${esc(meta.description)}" />`,
    )
    .replace(
      /<link rel="canonical"[^>]*\/>/,
      `<link rel="canonical" href="${canonical}" />\n    ${alternates}`,
    )
    // Aperçus de partage (WhatsApp, Facebook, LinkedIn) dans la bonne langue.
    .replace(
      /<meta property="og:title"[^>]*\/>/,
      `<meta property="og:title" content="${esc(meta.title)}" />`,
    )
    .replace(
      /<meta property="og:description"[^>]*\/>/,
      `<meta property="og:description" content="${esc(meta.description)}" />`,
    )
    .replace(
      /<meta property="og:locale"[^>]*\/>/,
      `<meta property="og:locale" content="${locale}" />`,
    );

  const out = new Response(html, response);
  out.headers.set('content-type', 'text/html; charset=utf-8');
  // Langue retenue et pays : lus par le client avant le premier rendu, ce qui
  // evite d'afficher brievement la mauvaise langue.
  out.headers.append(
    'set-cookie',
    `oculo_geo_locale=${locale}; Path=/; Max-Age=86400; SameSite=Lax`,
  );
  if (country) {
    out.headers.append(
      'set-cookie',
      `oculo_country=${country.toUpperCase()}; Path=/; Max-Age=86400; SameSite=Lax`,
    );
  }
  // Le HTML depend de la langue negociee : sans Vary, un CDN servirait la
  // version d'un visiteur a tous les suivants.
  out.headers.set('vary', 'accept-language, cookie');
  return out;
}

export const config = { path: ['/', '/fr', '/en', '/pt', '/signup', '/login'] };
