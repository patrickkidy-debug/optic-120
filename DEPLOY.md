# Déploiement — OculoSaaS

Architecture : **monorepo full-stack**.

| Partie | Techno | Hébergeur |
|--------|--------|-----------|
| `apps/web` | Vite + React (SPA) | **Vercel** |
| `apps/api` | Fastify + Prisma | **Render** (web service) |
| Base de données | PostgreSQL | **Render** (managée) |

Le frontend (Vercel) et l'API (Render) sont sur des domaines différents : les cookies
d'auth sont donc configurés en `SameSite=None` + `Secure` (voir `COOKIE_*` plus bas).

---

## Ordre de déploiement

Toujours dans cet ordre : **backend d'abord** (le frontend a besoin de son URL),
puis frontend, puis on reconnecte le CORS.

### 1. Backend + base de données — Render

1. [render.com](https://render.com) → se connecter avec GitHub.
2. **New +** → **Blueprint** → sélectionner le repo `optic-120`.
   Render lit [`render.yaml`](./render.yaml) et provisionne l'API + PostgreSQL.
3. Renseigner les variables marquées `sync: false` :
   | Variable | Valeur |
   |----------|--------|
   | `ENCRYPTION_KEY` | 64 caractères hex — générer : `openssl rand -hex 32` |
   | `PLATFORM_ADMIN_EMAILS` | ton email admin (ex. `patrickkidy@gmail.com`) |
   | `CORS_ORIGIN` | `*` temporairement (corrigé à l'étape 3) |
4. **Apply**. Les migrations Prisma s'appliquent automatiquement au démarrage
   (`db:migrate:deploy`). Noter l'URL, ex. `https://oculosaas-api.onrender.com`.

> `JWT_ACCESS_SECRET` et le mot de passe de la base sont générés automatiquement.

### 2. Frontend — Vercel

1. [vercel.com](https://vercel.com) → se connecter avec GitHub.
2. **Add New** → **Project** → importer `optic-120`.
   Vercel détecte [`vercel.json`](./vercel.json) — ne rien changer aux réglages de build.
3. **Environment Variables** :
   | Variable | Valeur |
   |----------|--------|
   | `VITE_API_URL` | l'URL Render de l'étape 1 |
4. **Deploy**. Noter l'URL, ex. `https://optic-120.vercel.app`.

### 3. Reconnecter le CORS

1. Render → service `oculosaas-api` → **Environment**.
2. `CORS_ORIGIN` = l'URL Vercel exacte (**sans slash final**), ex. `https://optic-120.vercel.app`.
3. Sauvegarder → Render redéploie automatiquement.

### 4. Créer le compte administrateur

Deux options :

- **Via l'UI** : ouvrir le site Vercel → page d'inscription → créer ton entreprise.
- **Via seed** (Render → service API → onglet **Shell**) :
  ```bash
  ADMIN_EMAIL=admin@maclinique.com \
  ADMIN_PASSWORD='MotDePasseFort!' \
  TENANT_NAME="Ma Clinique" \
  npm run db:seed:admin --workspace @oculo/api
  ```
  Variables optionnelles : `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME`, `ADMIN_USERNAME`, `BRANCH_NAME`.

> Le seed de base (permissions, rôles, offres) tourne automatiquement ? Non —
> lance-le une fois si besoin : `npm run db:seed --workspace @oculo/api`.
> `db:seed:admin` exige que les rôles système existent déjà.

### 5. OculoPartners (espace partenaire) — Netlify, en plus

`apps/partners` est une app séparée (mobile-first, inscription/dashboard des
partenaires affiliés). Elle appelle la MÊME API Render — pas de backend
séparé à déployer. Config prête dans [`apps/partners/netlify.toml`](./apps/partners/netlify.toml).

1. [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an
   existing project** → connecter GitHub → sélectionner `optic-120`.
2. **Base directory** → `apps/partners` (Netlify lit alors `netlify.toml` à
   cet endroit et applique build command / publish directory / redirection
   SPA automatiquement — rien d'autre à saisir dans ce formulaire).
3. **Site settings → Environment variables** : ajouter `VITE_API_URL` = la
   même URL Render qu'à l'étape 1 (ex. `https://oculosaas-api.onrender.com`),
   puis relancer un déploiement (les variables ne s'appliquent qu'au build
   suivant).
4. **Deploy site**. Noter l'URL, ex. `https://oculopartners.netlify.app`
   (personnalisable dans **Site settings → Domain management**).
5. Render → `oculosaas-api` → **Environment** → `CORS_ORIGIN` : ajouter
   cette URL à la liste existante, séparée par une virgule (ex.
   `https://optic-120.vercel.app,https://oculopartners.netlify.app`).
   Sauvegarder → redéploiement automatique.

Le lien de parrainage généré pour chaque partenaire pointe vers le site
PRINCIPAL (`<CORS_ORIGIN[0]>/?ref=CODE`, capturé sur `apps/web`) — c'est
normal : le clic a lieu sur la landing du magasin, pas sur l'app partenaire.

---

## Variables d'environnement de l'API (référence)

Voir [`.env.example`](./.env.example). Les essentielles en production :

| Variable | Production |
|----------|-----------|
| `DATABASE_URL` | fourni par la base Render |
| `CORS_ORIGIN` | URL du frontend Vercel |
| `COOKIE_DOMAIN` | `""` (vide — cookie host-only en cross-domaine) |
| `COOKIE_SAMESITE` | `none` |
| `COOKIE_SECURE` | `true` |
| `JWT_ACCESS_SECRET` | secret long et aléatoire |
| `ENCRYPTION_KEY` | 64 hex (`openssl rand -hex 32`) |
| `PLATFORM_ADMIN_EMAILS` | emails des opérateurs plateforme |

---

## Notes

- **Plan gratuit Render** : l'API se met en veille après 15 min d'inactivité
  (premier appel ~30 s pour la réveiller). Pour la prod, passer les `plan: free`
  en `plan: starter` dans [`render.yaml`](./render.yaml).
- **Redéploiement** : chaque `git push` sur `main` redéploie automatiquement
  Vercel et Render.
- **Emails** (réinit. mot de passe) : `MAIL_DRIVER=console` par défaut (logués).
  Pour de vrais emails, passer `MAIL_DRIVER=smtp` et renseigner les `SMTP_*`.
