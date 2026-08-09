-- Colonne déclarée dans schema.prisma (commit b5e249c) mais jamais migrée :
-- toute création/mise à jour/lecture d'ordonnance échouait en "Erreur interne
-- du serveur" (Prisma tentait de lire/écrire une colonne inexistante).
ALTER TABLE "OpticalPrescription" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
