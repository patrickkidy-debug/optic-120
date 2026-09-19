-- Modèle de message des relances de renouvellement (console fondateur).
--
-- Colonne nullable, purement additive : NULL signifie « modèle par défaut ».
-- Aucune ligne existante n'est modifiée. L'historique des relances envoyées ne
-- nécessite aucune table : il est consigné dans AuditLog
-- (action PLATFORM_RENEWAL_REMINDER), déjà indexé par établissement.
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "renewalReminderTemplate" TEXT;
