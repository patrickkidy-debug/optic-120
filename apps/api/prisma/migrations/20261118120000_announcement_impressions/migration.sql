-- Affichages des annonces en fenêtre surgissante (rappel tant que non lue).
CREATE TABLE "AnnouncementImpression" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shownAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementImpression_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnnouncementImpression_announcementId_userId_idx" ON "AnnouncementImpression"("announcementId", "userId");
CREATE INDEX "AnnouncementImpression_userId_idx" ON "AnnouncementImpression"("userId");

ALTER TABLE "AnnouncementImpression" ADD CONSTRAINT "AnnouncementImpression_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnnouncementImpression" ADD CONSTRAINT "AnnouncementImpression_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
