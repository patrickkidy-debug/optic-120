-- Annonce « OculoSaaS devient international », créée en BROUILLON (publishedAt
-- NULL) : à relire puis publier depuis la console fondateur → Annonces.
-- Idempotent : rien n'est ajouté si une annonce porte déjà ce titre.
INSERT INTO "Announcement" ("id", "kind", "title", "body", "images", "whatsappMessage", "linkedinPost", "publishedAt", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, 'FEATURE', 'OculoSaaS devient international : gérez votre optique où que vous soyez', 'OculoSaaS s''ouvre à l''international. Où que vous soyez dans le monde, une connexion internet et un navigateur suffisent (ordinateur, tablette ou téléphone) pour gérer votre boutique d''optique.

Ce que cela change pour vous :
• Le logiciel en 3 langues : français, anglais et portugais.
• Votre monnaie : franc CFA (XOF et XAF), euro, franc suisse, escudo cap-verdien, kwanza, metical et franc rwandais.
• 25 pays déjà proposés à l''inscription, en Afrique et en Europe.
• Vos magasins suivis à distance : ventes, caisse, stock, patients et rapports, même quand vous êtes en déplacement.

Hors de la zone franc CFA, l''abonnement se règle par virement bancaire.

Votre pays ou votre monnaie n''apparaît pas encore ? Écrivez-nous sur WhatsApp, nous étudierons son ajout.', '[]'::jsonb, '🌍 *OculoSaaS devient international*

Où que vous soyez dans le monde, gérez votre boutique d''optique avec une simple connexion internet : ordinateur, tablette ou téléphone.

✅ 3 langues : français, anglais, portugais
✅ Votre monnaie : FCFA, euro, franc suisse, escudo, kwanza, metical, franc rwandais
✅ 25 pays en Afrique et en Europe
✅ Ventes, caisse, stock et rapports suivis à distance

Votre pays n''est pas encore dans la liste ? Répondez à ce message.', 'OculoSaaS devient international.

Le logiciel de gestion pour opticiens est désormais disponible en français, en anglais et en portugais, et fonctionne dans la monnaie de chaque boutique : franc CFA, euro, franc suisse, escudo cap-verdien, kwanza, metical et franc rwandais.

25 pays sont déjà proposés à l''inscription, en Afrique et en Europe. Où que vous soyez, une connexion internet suffit pour suivre vos ventes, votre caisse, votre stock et vos rapports, magasin par magasin.

#optique #opticien #SaaS #OculoSaaS #international', NULL, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Announcement" WHERE "title" = 'OculoSaaS devient international : gérez votre optique où que vous soyez');
