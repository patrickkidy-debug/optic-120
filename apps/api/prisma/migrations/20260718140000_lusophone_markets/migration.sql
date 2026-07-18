-- Ouverture des marchés lusophones (Cap-Vert, Guinée-Bissau, Angola, Mozambique).

-- Moyens d'encaissement locaux (manuels, comme Wave/Orange Money aujourd'hui).
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'MPESA';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'EMOLA';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'MKESH';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'MULTICAIXA';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'UNITEL_MONEY';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'VINTI4';

-- Pays de l'établissement (ISO-2), déduit de l'indicatif WhatsApp à l'inscription.
-- Sert à choisir la devise, la TVA par défaut et les moyens de paiement affichés.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "countryCode" TEXT;
