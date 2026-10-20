-- Dossier de vente détaillé (bêta) : ordonnance enrichie, motif et livraison prévue.
ALTER TABLE "OpticalPrescription"
  ADD COLUMN "visionType" TEXT,
  ADD COLUMN "odPrism1" TEXT,
  ADD COLUMN "odPrism1Base" TEXT,
  ADD COLUMN "odPrism2" TEXT,
  ADD COLUMN "odPrism2Base" TEXT,
  ADD COLUMN "ogPrism1" TEXT,
  ADD COLUMN "ogPrism1Base" TEXT,
  ADD COLUMN "ogPrism2" TEXT,
  ADD COLUMN "ogPrism2Base" TEXT,
  ADD COLUMN "odFarPd" TEXT,
  ADD COLUMN "ogFarPd" TEXT,
  ADD COLUMN "odAcuity" TEXT,
  ADD COLUMN "ogAcuity" TEXT;
ALTER TABLE "Sale"
  ADD COLUMN "visitReason" VARCHAR(120),
  ADD COLUMN "expectedDeliveryAt" TIMESTAMP(3);
