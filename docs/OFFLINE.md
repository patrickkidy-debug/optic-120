# OculoSaaS hors connexion — analyse et architecture

Document de référence du chantier offline-first. Il décrit l'existant tel qu'il
est, ce qui empêche aujourd'hui de travailler sans Internet, et le plan retenu.

## 1. Architecture actuelle

| Couche | Technologie | Remarque pour le hors-ligne |
|---|---|---|
| Web | React 18, Vite, Tailwind, React Router 6 | SPA : se prête bien au local-first |
| Données côté client | TanStack Query (cache mémoire, `staleTime` 30 s) | Aucune persistance : tout disparaît au rechargement |
| Mobile | Capacitor 8 (Android) sur la même application web | Le travail hors-ligne web profite directement au mobile |
| PWA | `manifest.webmanifest` + `public/sw.js` | Déjà installable ; le SW met en cache le shell et les assets, **jamais l'API** |
| API | Fastify + Prisma, hébergée sur Render | REST, JSON |
| Base | PostgreSQL (Supabase), 78 modèles | Multi-établissement par `tenantId` (extension Prisma `forTenant`) |
| Auth | JWT d'accès 15 min en mémoire + cookie de rafraîchissement | Voir risque R1 |
| Droits | RBAC (`PERMISSIONS`, `requirePermission`) + accès par magasin (`assertBranchAccess`) | À répliquer côté appareil |

## 2. Entités concernées

- **Client** (`Customer`) — ordonnances (`OpticalPrescription`), historique, fidélité. **Pas de `updatedAt`.**
- **Produit** (`Product`) — montures, verres (catégories « fabriqués sur commande »), accessoires, code-barres.
- **Stock** (`StockItem` par produit × magasin) + journal `StockMovement` (quantité signée). Le journal existe déjà : c'est la base d'une synchronisation par opérations.
- **Vente / devis** (`Sale`, `SaleItem`), **paiements** (`Payment`), numérotation par compteur serveur (`DocumentCounter`, séries `VEN-` / `DEV-`).
- **Commande de verres** (`LensOrder`), **SAV** (`Repair`), **assurances**, **anomalies**.

## 3. Ce qui peut fonctionner hors connexion

| Fonction | Hors-ligne | Condition |
|---|---|---|
| Consulter clients, produits, stock, ventes récentes | Oui | Copie locale indexée (phase 2) |
| Rechercher un client / un produit, scanner un code-barres | Oui | Index IndexedDB |
| Créer / modifier un client, une ordonnance | Oui | Identifiant créé sur l'appareil |
| Créer une vente, encaisser (espèces, Mobile Money saisi à la main) | Oui | Voir décisions D1 et D2 |
| Entrée, sortie, ajustement de stock | Oui | Envoyés comme **mouvements**, jamais comme quantités absolues |
| Inventaire (comptage) | Oui, avec prudence | Le comptage fixe une quantité absolue : conflit possible si des ventes ont eu lieu entre-temps |
| Commande de verres | Oui | |
| Tableau de bord | Oui, partiel | Calculé sur les données locales, avec la date de dernière synchronisation |

## 4. Ce qui exige Internet

Paiement en ligne (Moneroo, passerelles), envoi WhatsApp / e-mail, abonnement et
facturation OculoSaaS, import Excel, gestion des utilisateurs et des rôles,
console fondateur, envoi d'images (Supabase Storage). L'interface le dit
clairement au lieu d'échouer, et **la pièce elle-même reste créée** : seul
l'envoi attend le réseau.

## 5. Risques techniques identifiés

- **R1 — Déconnexion au rechargement hors-ligne.** La session ne survit que grâce à `/auth/refresh`. Hors connexion, le rafraîchissement échoue et `clear()` déconnecte l'utilisateur. Un opticien qui recharge la page sans réseau perd l'accès au logiciel. **Bloquant, traité en phase 1.**
- **R2 — Stock en lecture puis écriture.** `createSale`, la modification, l'annulation, le retour et la réception de stock écrivent `quantity: item.quantity ± n`. Deux requêtes simultanées lisent la même valeur et l'une écrase l'autre : c'est exactement le scénario « 10 − 1 − 2 = 8 au lieu de 7 ». Le défaut existe **déjà en ligne**. **Traité en phase 1.**
- **R3 — Aucune idempotence sur la création de vente.** Une vente renvoyée après une coupure pendant la réponse est créée deux fois. **Traité en phase 1** par un journal d'opérations côté serveur.
- **R4 — Numéros de pièce alloués par le serveur.** Hors connexion, aucun numéro définitif n'est disponible. Voir D2.
- **R5 — Stock insuffisant à la synchronisation.** Le serveur refuse une vente si le stock ne suffit pas. Hors connexion, la monture est déjà partie avec le client : refuser la vente à la synchronisation perdrait une vente réelle. Voir D1.
- **R6 — Pas de `updatedAt` sur `Customer` ni `OpticalPrescription`, pas de suppression logique nulle part.** La synchronisation incrémentale et la propagation des suppressions exigent une migration additive (phase 2).
- **R7 — Données de plusieurs établissements sur un même appareil.** La base locale est cloisonnée par établissement **et** par utilisateur.

## 6. Architecture retenue

```
 Écran ──lit──▶ Base locale (IndexedDB / Dexie) ◀──tire── /sync/pull (changements depuis le curseur)
   │                                                              ▲
   └─écrit─▶ Base locale + file d'opérations ──pousse──▶ /sync/push (idempotent par opId)
```

- **Local d'abord.** Toute action s'enregistre localement et s'affiche aussitôt ; elle rejoint une file d'opérations persistante.
- **Opérations, pas états.** Le stock et les ventes voyagent comme des mouvements (« −1 monture X au magasin Y »), appliqués côté serveur par décrément atomique. Deux appareils qui vendent chacun hors ligne donnent 10 − 1 − 2 = 7, quel que soit l'ordre d'arrivée.
- **Idempotence.** Chaque opération porte un `opId` (UUID créé sur l'appareil). Le serveur enregistre le résultat de chaque `opId` traité ; un renvoi reçoit le même résultat sans rien rejouer.
- **Identifiants créés sur l'appareil** (UUID v4) pour toute entité créée hors connexion : le serveur les accepte tels quels.
- **Conflits par type de donnée.**
  - Stock, ventes, paiements : opérations additives, pas de conflit d'écrasement.
  - Fiches (client, produit, ordonnance) : modification champ par champ, avec la version connue de l'appareil. Si le serveur a changé le même champ entre-temps, la modification n'est pas appliquée en silence : elle est gardée et signalée au gérant.
  - Inventaire (quantité absolue) : converti en mouvement d'écart *au moment du comptage*, avec la quantité que l'appareil croyait avoir ; l'écart est ensuite rejoué comme un mouvement.
- **Cloisonnement.** Une base IndexedDB par établissement et par utilisateur (`oculo-<tenant>-<user>`). Les droits sont vérifiés deux fois : dans l'interface (droits mis en cache) et par le serveur à la synchronisation, qui reste l'autorité.
- **Identifiant d'appareil** persistant, joint à chaque opération : traçabilité et diagnostic multi-appareils.

## 7. Décisions à prendre (métier, pas technique)

- **D1 — Vente hors-ligne au-delà du stock connu.** Recommandé : l'accepter à la synchronisation, laisser le stock passer en négatif et le signaler au gérant. La vente a eu lieu physiquement ; la refuser efface une réalité.
- **D2 — Numérotation hors-ligne.** Recommandé : numéro provisoire propre à l'appareil (ex. `HL-A3-0007`), remplacé par le numéro définitif `VEN-2026-…` à la synchronisation. Le ticket remis au client porte la mention « provisoire » et la référence finale est consultable ensuite. Alternative : réserver à l'avance des plages de numéros par appareil — sans renumérotation, mais la série n'est plus strictement chronologique.
- **D3 — Déconnexion avec des opérations en attente.** Recommandé : la base locale est effacée à la déconnexion (un autre utilisateur peut prendre l'appareil), **sauf** s'il reste des opérations non synchronisées : la déconnexion est alors refusée tant qu'elles ne sont pas envoyées.
- **D4 — Durée de travail hors-ligne autorisée.** Recommandé : 7 jours sans contact serveur, puis reconnexion exigée (révocation d'un compte, changement de droits).

## 8. Fichiers touchés

Phase 1 : `apps/web/src/lib/offline/*` (nouveau), `store/auth.ts`, `lib/api.ts`,
`components/layout/Topbar.tsx`, `public/sw.js` ; côté API `modules/sync/*`
(nouveau), `sales.service.ts`, `stock.service.ts`, migration `SyncOperation`.

Phases suivantes : écrans Caisse, Clients, Stock, Ventes, Commandes de verres
(lecture via la base locale), schéma (`updatedAt`, `deletedAt`).

## 9. Plan

1. **Infrastructure** — base locale, identifiant d'appareil, détection réseau fiable, file d'opérations avec reprise et backoff, indicateur d'état, session qui survit au hors-ligne, protocole `/sync/push` idempotent, stock atomique.
2. **Clients, produits, stock** — copie locale indexée, `/sync/pull` incrémental, migration `updatedAt` / `deletedAt`.
3. **Ventes, factures, paiements** — caisse hors-ligne (après D1 et D2).
4. **Commandes de verres, ordonnances.**
5. **Tableau de bord local.**
6. **Multi-appareils, conflits, écran des erreurs de synchronisation, performances.**
