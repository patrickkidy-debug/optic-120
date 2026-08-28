-- A customer account may be linked to one clinical patient record.
ALTER TABLE "Patient" ADD COLUMN "customerId" TEXT;

CREATE UNIQUE INDEX "Patient_customerId_key" ON "Patient"("customerId");

ALTER TABLE "Patient"
  ADD CONSTRAINT "Patient_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
