# OculoPartners — architecture MVP

## Périmètre validé

- Application web séparée, prévue pour `partners.oculosaas.com`.
- API et PostgreSQL OculoSaaS partagés au MVP, avec module métier et tables
  partenaires séparés afin de pouvoir extraire le produit ultérieurement.
- Attribution « premier partenaire valide » pendant 90 jours.
- Commission uniquement sur le premier paiement d'abonnement confirmé.

## Intégration OculoSaaS

Les sources de vérité restent OculoSaaS :

| Événement | Point d'intégration vérifié | Effet partenaire |
| --- | --- | --- |
| Inscription magasin | `authService.signupTenant` | lie le tenant à une attribution active |
| Essai | `ensurePendingSubscription` | met à jour le funnel partenaire |
| Paiement abonnement confirmé | `billing.settleSubscriptionPayment` | crée une commission idempotente |
| Paiement échoué/annulé | même service | ne génère aucune commission |

L'intégration passe par un `PartnerEvent` transactionnel : `idempotencyKey` est
unique. Ainsi un webhook de paiement rejoué ne peut jamais créer une seconde
commission.

## Entités MVP

- `Partner` : identité, statut, niveau, code et lien de parrainage uniques.
- `PartnerSession` : sessions séparées des utilisateurs de magasins.
- `PartnerAttribution` : partenaire, visiteur anonyme éventuel, tenant final,
  dates d'attribution et expiration.
- `PartnerLead` : prospect ajouté par un partenaire ou issu d'une attribution.
- `PartnerCommissionRule` : montant par offre, actif, configurable serveur.
- `PartnerCommission` : paiement source, montant, statut financier et snapshot
  de la règle appliquée.
- `PartnerEvent` et `PartnerAuditLog` : idempotence et traçabilité.

## Règles de sécurité

1. Les données partenaires ne passent jamais par le client Prisma tenant-scopé.
   Elles restent globales et les requêtes partenaire filtrent toujours
   explicitement `partnerId`.
2. L'attribution est figée à l'inscription : un partenaire ne peut ni l'éditer,
   ni éditer une commission.
3. Une commission ne peut naître que d'un `SubscriptionPayment` réussi, après
   vérification serveur existante.
4. `subscriptionPaymentId` est unique dans les commissions : protection contre
   les paiements/webhooks dupliqués.
5. Toute transition financière est enregistrée dans `PartnerAuditLog`.

## Tracking

`/?ref=CODE` crée une attribution anonyme et conserve le code dans un cookie
first-party + localStorage. L'inscription transmet le code au serveur. Le
serveur contrôle l'expiration, le premier clic valide et l'absence
d'auto-parrainage avant de lier le tenant.

## API MVP

- Public : validation/clic de code, inscription et connexion partenaire.
- Partenaire authentifié : profil, tableau de bord, lien/QR, prospects,
  commissions.
- Opérateur : partenaires, règles, attributions et validations de commissions.
- Interne : consommation des événements OculoSaaS, non exposée au navigateur.
