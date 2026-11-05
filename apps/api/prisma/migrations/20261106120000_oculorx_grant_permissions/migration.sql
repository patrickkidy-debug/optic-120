-- OculoRX : les rôles des établissements existants sont tous marqués
-- « personnalisés » (migration 20260721) et ne reçoivent donc plus les
-- nouvelles permissions au déploiement. On les accorde ici UNE seule fois,
-- sans rien retirer :
--   - administrateurs et gestionnaires : tout OculoRX (dont prix d'achat et marges) ;
--   - opticiens et tout rôle qui gère déjà OculoTrack : voir et commander.
-- Les permissions existent déjà (créées par le seed du déploiement précédent) ;
-- sur une base neuve, la requête n'insère simplement rien.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "Role" r
JOIN "Permission" p ON p."module" = 'oculorx'
WHERE r."tenantId" IS NOT NULL
  AND (
    r."code" IN ('admin', 'super_admin', 'gestionnaire')
    OR (
      p."action" IN ('view', 'order')
      AND (
        r."code" = 'opticien'
        OR EXISTS (
          SELECT 1 FROM "RolePermission" rp
          JOIN "Permission" po ON po."id" = rp."permissionId"
          WHERE rp."roleId" = r."id" AND po."module" = 'oculotrack' AND po."action" = 'manage'
        )
      )
    )
  )
ON CONFLICT DO NOTHING;
