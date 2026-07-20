-- Modèles de messages WhatsApp par étape de vente, propres à l'établissement.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "whatsappTemplates" JSONB;
