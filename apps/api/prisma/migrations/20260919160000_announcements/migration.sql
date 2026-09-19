-- Annonces produit (nouveautés, améliorations, correctifs) publiées depuis la
-- console fondateur, et leurs accusés de lecture par utilisateur.
--
-- Purement additif : deux nouvelles tables, aucune table existante modifiée.
-- Les annonces sont globales à la plateforme (pas de tenantId) ; seules les
-- lignes publiées, c'est-à-dire dont publishedAt n'est pas NULL, sont visibles
-- des utilisateurs.
CREATE TABLE IF NOT EXISTS "Announcement" (
  "id"              TEXT NOT NULL,
  "kind"            TEXT NOT NULL DEFAULT 'FEATURE',
  "title"           TEXT NOT NULL,
  "body"            TEXT NOT NULL,
  "images"          JSONB,
  "whatsappMessage" TEXT,
  "linkedinPost"    TEXT,
  "publishedAt"     TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Announcement_publishedAt_idx" ON "Announcement"("publishedAt");

CREATE TABLE IF NOT EXISTS "AnnouncementRead" (
  "announcementId" TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "readAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnnouncementRead_pkey" PRIMARY KEY ("announcementId", "userId")
);

CREATE INDEX IF NOT EXISTS "AnnouncementRead_userId_idx" ON "AnnouncementRead"("userId");

DO $$
BEGIN
  ALTER TABLE "AnnouncementRead"
    ADD CONSTRAINT "AnnouncementRead_announcementId_fkey"
    FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "AnnouncementRead"
    ADD CONSTRAINT "AnnouncementRead_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
