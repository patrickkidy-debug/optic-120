/**
 * Génère le sitemap multilingue de la vitrine.
 *
 * Chaque page publique est déclarée une fois par langue, avec ses équivalents
 * (`xhtml:link hreflang`) : c'est ce qui indique à Google que /en/ et /pt/ sont
 * des traductions et non du contenu dupliqué.
 *
 *   node scripts/build-sitemap.js
 */
const fs = require('fs');
const path = require('path');

const SITE = 'https://oculosaas.com';
const LOCALES = ['fr', 'en', 'pt'];
const DEFAULT_LOCALE = 'fr';

/** Pages publiques uniquement : l'application connectée n'a rien à indexer. */
const PAGES = [
  { bare: '/', priority: '1.0', changefreq: 'weekly' },
  { bare: '/signup', priority: '0.9', changefreq: 'monthly' },
  { bare: '/login', priority: '0.5', changefreq: 'monthly' },
];

const href = (locale, bare) =>
  `${SITE}${locale === DEFAULT_LOCALE ? '' : '/' + locale}${bare}`;

function alternates(bare) {
  return [
    ...LOCALES.map(
      (l) => `      <xhtml:link rel="alternate" hreflang="${l}" href="${href(l, bare)}" />`,
    ),
    `      <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}${bare}" />`,
  ].join('\n');
}

const today = new Date().toISOString().slice(0, 10);
const urls = PAGES.flatMap(({ bare, priority, changefreq }) =>
  LOCALES.map(
    (l) => `  <url>
    <loc>${href(l, bare)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
${alternates(bare)}
  </url>`,
  ),
);

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Sitemap multilingue : chaque page est declaree dans les 3 langues, avec ses
     equivalents (hreflang). Genere par scripts/build-sitemap.js. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;

const out = path.join(__dirname, '..', 'apps', 'web', 'public', 'sitemap.xml');
fs.writeFileSync(out, xml);
console.log(`✅ sitemap.xml — ${urls.length} URLs (${PAGES.length} pages × ${LOCALES.length} langues)`);
