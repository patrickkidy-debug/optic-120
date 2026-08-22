-- Chèque : moyen de règlement courant des assurances (tiers payant).
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CHEQUE';
