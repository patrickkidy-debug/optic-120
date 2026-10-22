-- Sécurité Supabase : la base est exposée par l'API REST de Supabase (PostgREST)
-- avec la clé publique « anon » présente dans le site (elle sert au stockage
-- des images). Sans protection, n'importe qui pouvait lire / modifier les
-- tables. OculoSaaS n'accède JAMAIS aux tables par cette API : tout passe par
-- le serveur (Prisma, rôle propriétaire des tables, non concerné par la RLS).
--
-- 1. RLS activée sur toutes les tables du schéma public, sans aucune règle :
--    l'API publique ne voit plus aucune ligne.
-- 2. Droits retirés aux rôles publics de Supabase (anon, authenticated), y
--    compris pour les tables créées par les migrations futures.
-- Sans effet hors Supabase (rôles absents : bloc ignoré).
DO $$
DECLARE
  t record;
  r text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;

  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);
    END IF;
  END LOOP;
END $$;
