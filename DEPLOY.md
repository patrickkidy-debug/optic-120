# Déploiement — OculoSaaS

Architecture : **monorepo full-stack**.

| Partie | Techno | Hébergeur |
|--------|--------|-----------|
| `apps/web` (oculosaas.com) | Vite + React (SPA) | **Netlify** |
| `apps/partners` (oculosaas.com/partners) | Vite + React (SPA) | **Netlify** (site séparé, proxyé sous `/partners`) |
| `apps/api` | Fastify + Prisma | **Render** (web service) |
| Base de données | PostgreSQL | **Render** (managée) |

Le frontend (Netlify) et l'API (Render) sont sur des domaines différents : les cookies
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

### 2. Frontend (oculosaas.com) — Netlify

Config prête dans [`netlify.toml`](./netlify.toml) (racine du repo).

1. [app.netlify.com](https://app.netlify.com) → **Add new project** → **Import
   an existing project** → connecter GitHub → sélectionner `optic-120`.
2. Netlify lit `netlify.toml` à la racine automatiquement (build command,
   `apps/web/dist`, redirection SPA, en-têtes de sécurité) — rien à changer.
3. **Site settings → Environment variables** : `VITE_API_URL` est déjà fixée
   dans `netlify.toml` (`https://api.oculosaas.com`) ; ajuster seulement si
   l'URL Render réelle diffère (puis relancer un déploiement).
4. **Deploy site**. Noter l'URL, ex. `https://oculosaas.netlify.app`
   (domaine personnalisé `oculosaas.com` à brancher ensuite dans **Domain
   management**).

### 3. Reconnecter le CORS

1. Render → service `oculosaas-api` → **Environment**.
2. `CORS_ORIGIN` = l'URL du site Netlify (**sans slash final**), ex.
   `https://oculosaas.com` (ou l'URL `*.netlify.app` en attendant le domaine
   personnalisé).
3. Sauvegarder → Render redéploie automatiquement.

### 4. Créer le compte administrateur

Deux options :

- **Via l'UI** : ouvrir le site → page d'inscription → créer ton entreprise.
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

### 5. OculoPartners (oculosaas.com/partners) — second site Netlify + proxy

`apps/partners` est déployé comme un **site Netlify séparé**, puis rendu
accessible sous `oculosaas.com/partners` par un **rewrite proxy** configuré
dans le `netlify.toml` du site PRINCIPAL (pas de sous-domaine visible, pas
de second nom de domaine à gérer). Config prête dans
[`apps/partners/netlify.toml`](./apps/partners/netlify.toml).

1. [app.netlify.com](https://app.netlify.com) → **Add new project** →
   **Import an existing project** → GitHub → `optic-120` (même repo, un
   second site).
2. **Base directory** → `apps/partners` (Netlify lit alors son
   `netlify.toml` et propose déjà la bonne commande de build / dossier de
   publication).
3. **Project name** → choisir explicitement **`oculopartners`**, pour que
   l'URL générée soit `https://oculopartners.netlify.app` — c'est cette URL
   exacte que le proxy du site principal cible (voir `[[redirects]]` dans le
   `netlify.toml` racine, règle `/partners/*`). Un autre nom fonctionne aussi,
   mais il faut alors modifier cette URL cible dans le `netlify.toml` racine.
4. **Environment variables** : `VITE_API_URL` = la même URL Render qu'à
   l'étape 1.
5. **Deploy site**.
6. Retourner sur le site PRINCIPAL et **redéployer** (le proxy vers
   `oculopartners.netlify.app` vient d'être ajouté au `netlify.toml` racine :
   un nouveau déploiement du site principal est nécessaire pour qu'il prenne
   effet — un simple `git push`, ou **Trigger deploy** dans Netlify, suffit).
7. Vérifier : `https://oculosaas.com/partners/inscription` doit afficher la
   page d'inscription partenaire.

**Pas d'étape CORS supplémentaire** : le proxy est un *rewrite* (statut 200,
l'URL dans la barre d'adresse ne change pas), donc le navigateur voit
toujours l'origine `oculosaas.com` — les appels API de `apps/partners`
passent par le `CORS_ORIGIN` déjà autorisé à l'étape 3.

Le lien de parrainage généré pour chaque partenaire pointe vers le site
PRINCIPAL (`https://oculosaas.com/?ref=CODE`, capturé dans `apps/web`) —
c'est normal : le clic a lieu sur la landing du magasin, pas sur l'espace
partenaire.

---

## Variables d'environnement de l'API (référence)

Voir [`.env.example`](./.env.example). Les essentielles en production :

| Variable | Production |
|----------|-----------|
| `DATABASE_URL` | fourni par la base Render |
| `CORS_ORIGIN` | URL du site Netlify principal (`oculosaas.com`) |
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
  Netlify (les deux sites) et Render.
- **Emails** (réinit. mot de passe) : `MAIL_DRIVER=console` par défaut (logués).
  Pour de vrais emails, passer `MAIL_DRIVER=smtp` et renseigner les `SMTP_*`.
