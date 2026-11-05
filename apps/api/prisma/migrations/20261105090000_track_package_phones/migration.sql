-- OculoTrack : téléphones de l'expéditeur et du destinataire du colis.
ALTER TABLE "TrackPackage" ADD COLUMN IF NOT EXISTS "senderPhone" TEXT;
ALTER TABLE "TrackPackage" ADD COLUMN IF NOT EXISTS "recipientPhone" TEXT;
