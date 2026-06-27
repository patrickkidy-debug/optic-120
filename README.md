# OculoSaaS — West Africa

SaaS multi-tenant premium pour la gestion des **magasins d'optique**, **cabinets d'optométrie** et **cliniques d'ophtalmologie** en Afrique de l'Ouest.

> **Phase 1** — Fondations (auth réelle, multi-tenant, RBAC, thèmes clair/sombre/responsive) + module pilote **Optique** (produits, stock multi-magasins, caisse/POS, ventes, devis) + intégration **CinetPay** en mode simulation.

## Architecture (monorepo npm workspaces)

```
apps/
  api/            Backend — Fastify + TypeScript + Prisma (PostgreSQL)
  web/            Frontend — React + Vite + TypeScript + Tailwind
packages/
  shared-types/   Enums, schémas Zod & matrice de permissions partagés
legacy/           Prototype d'origine (référence visuelle/fonctionnelle, non utilisé)
```

## Stack

| Couche | Technologies |
|--------|--------------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, React Router, TanStack Query, Zustand, React Hook Form + Zod, react-i18next (FR/EN/PT), Lucide |
| Backend | Fastify, Prisma ORM, Zod, `jose` (JWT), `argon2` (hash), `pino` (logs), Helmet/CORS/Rate-limit |
| Base de données | PostgreSQL 16 |

## Prérequis

- Node.js ≥ 20
- PostgreSQL 16 (base `oculo_dev`)

## Démarrage

```bash
# 1. Installer les dépendances (à la racine)
npm install

# 2. Configurer l'environnement
#    Copier .env.example vers apps/api/.env et ajuster DATABASE_URL si besoin

# 3. Migrer + seed la base
npm run db:migrate
npm run db:seed

# 4. Lancer API + Web en parallèle
npm run dev
```

- API : http://localhost:4000
- Web : http://localhost:5173

## Sécurité multi-tenant

Chaque requête authentifiée est automatiquement filtrée par `tenantId` via une **Prisma Client Extension** (`apps/api/src/lib/prisma-tenant.ts`). Le client Prisma brut n'est jamais exposé aux modules métier.

## Roadmap

- **Phase 2** : dossier médical complet, atelier de montage, RH, PDF factures/ordonnances.
- **Phase 3** : finance avancée, fournisseurs, assurances/tiers-payant, chirurgies.
- **Phase 4** : offline-first/sync, 2FA, déploiement production.
