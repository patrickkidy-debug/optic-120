-- Annonce de l'offre unique de janvier 2027, créée en BROUILLON (publishedAt
-- NULL) : à relire puis publier depuis la console fondateur → Annonces.
-- Idempotent : rien n'est ajouté si une annonce porte déjà ce titre.
INSERT INTO "Announcement" ("id", "kind", "title", "body", "images", "whatsappMessage", "linkedinPost", "publishedAt", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'IMPROVEMENT', 'Janvier 2027 : une seule offre à 10 000 FCFA/mois, tout inclus', 'À partir du 1er janvier 2027, OculoSaaS passe à une offre unique : 10 000 FCFA par mois, à la place des trois offres actuelles (Starter, Standard et Growth).

Ce qui change pour vous :
• Un seul prix, simple : 10 000 FCFA par mois.
• Toutes les fonctionnalités incluses pour chaque établissement : caisse et ventes, stock et inventaire, patients et ordonnances, assurances, OculoLab (fiches précal), dépenses et versements, rapports et statistiques, rôles et permissions.
• Plus besoin de choisir ni de changer d''offre pour débloquer une fonction.

Jusqu''au 31 décembre 2026, rien ne change : vos tarifs actuels s''appliquent.

Une question ? Écrivez-nous sur WhatsApp, l''équipe vous répond.', '[]'::jsonb, '✨ *OculoSaaS — Une seule offre dès janvier 2027*

À partir du 1er janvier 2027 : *10 000 FCFA/mois*, toutes les fonctionnalités incluses, à la place des offres Starter, Standard et Growth.

✅ Caisse, ventes, stock, patients, ordonnances, assurances
✅ OculoLab (fiches précal), dépenses et versements, rapports
✅ Plus besoin de changer d''offre pour débloquer une fonction

Jusqu''au 31 décembre 2026, vos tarifs actuels restent en place.
Une question ? Répondez à ce message.', 'OculoSaaS simplifie ses tarifs.

À partir du 1er janvier 2027, une seule offre : 10 000 FCFA par mois, toutes les fonctionnalités incluses. Les offres Starter, Standard et Growth sont remplacées.

Chaque optique accède à la caisse, aux ventes, au stock, aux patients et ordonnances, aux assurances, à OculoLab pour les fiches précal, au suivi des dépenses et aux rapports, sans avoir à changer d''offre.

#optique #opticien #SaaS #OculoSaaS', NULL, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Announcement" WHERE "title" = 'Janvier 2027 : une seule offre à 10 000 FCFA/mois, tout inclus');
