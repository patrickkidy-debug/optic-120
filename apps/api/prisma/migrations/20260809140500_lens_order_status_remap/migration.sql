-- Bascule les commandes historiques "MOUNTED" (dernière étape avant livraison
-- dans l'ancien workflow à 4 statuts) vers "READY" du nouveau workflow Kanban.
-- Doit être une migration séparée : READY vient d'être ajoutée à l'enum et
-- Postgres interdit d'utiliser une valeur d'enum dans la transaction qui l'a créée.
UPDATE "LensOrder" SET status = 'READY' WHERE status = 'MOUNTED';

-- Les nouvelles commandes partent du début du workflow (valeur ajoutée dans
-- la migration précédente : utilisable ici, une fois celle-ci committée).
ALTER TABLE "LensOrder" ALTER COLUMN "status" SET DEFAULT 'TO_ORDER';
