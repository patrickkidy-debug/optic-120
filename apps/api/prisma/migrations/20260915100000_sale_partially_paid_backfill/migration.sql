-- Rattrapage du statut de règlement des ventes déjà enregistrées.
--
-- `paidAmount` inclut la prise en charge assurance, déduite de ce que doit le
-- client dès la création de la vente. Or la création et la conversion de devis
-- n'émettaient jamais PARTIALLY_PAID : elles retombaient sur CONFIRMED dès que
-- le règlement était incomplet. Une vente de 230 000 couverte à 200 000 par
-- l'assureur s'affichait donc « Confirmée » alors qu'il restait 30 000 à
-- encaisser auprès du client.
--
-- Seules les lignes réellement incohérentes sont touchées : encaissement
-- strictement positif et strictement inférieur au total. Aucune donnée
-- financière n'est modifiée — ni montant, ni paiement, ni dossier assurance —
-- uniquement l'étiquette de statut, et uniquement dans le sens
-- CONFIRMED -> PARTIALLY_PAID. Les ventes annulées, soldées, en brouillon et
-- les retours ne sont pas concernés. Rejouer ce script ne change plus rien.
UPDATE "Sale"
SET "status" = 'PARTIALLY_PAID'
WHERE "type" = 'SALE'
  AND "status" = 'CONFIRMED'
  AND "paidAmount" > 0
  AND "paidAmount" < "totalAmount";
