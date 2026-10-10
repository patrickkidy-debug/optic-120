-- AlterTable
ALTER TABLE "OpticalMeasurement" ADD COLUMN     "autoValues" JSONB,
ADD COLUMN     "calibration" TEXT,
ADD COLUMN     "confidence" INTEGER,
ADD COLUMN     "ed" DOUBLE PRECISION,
ADD COLUMN     "frameWidth" DOUBLE PRECISION,
ADD COLUMN     "markers" JSONB,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3);

