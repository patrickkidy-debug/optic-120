import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../middlewares/auth-guard.js';
import { requireAnyPermission, assertBranchAccess } from '../../middlewares/rbac-guard.js';
import { badRequest } from '../../lib/http-error.js';
import { recordAudit, requestMeta } from '../../lib/audit.js';
import { parseImportFile, previewImportRows, commitImport, type CommitRow } from './products-import.service.js';

const CAN_IMPORT = requireAnyPermission('optique.products.create', 'optique.products.update');

/** Import Excel/CSV de produits : aperçu (rien n'est écrit) puis validation explicite. */
export async function productsImportRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.post('/preview', { preHandler: CAN_IMPORT }, async (req, reply) => {
    const file = await req.file();
    if (!file) throw badRequest('Fichier requis (.xlsx ou .csv)');
    const buffer = await file.toBuffer();
    let parsed;
    try {
      parsed = parseImportFile(buffer);
    } catch (err) {
      // Les erreurs de structure Excel (titre avant l'en-tête, colonnes non
      // reconnues…) viennent du fichier utilisateur : elles doivent être
      // affichées comme telles, jamais comme une erreur interne 500.
      throw badRequest(err instanceof Error ? err.message : 'Fichier Excel ou CSV illisible');
    }
    if (parsed.length === 0) throw badRequest('Aucune ligne exploitable dans ce fichier');
    const rows = await previewImportRows(req.db!, parsed);
    return reply.send({ rows });
  });

  app.post('/commit', { preHandler: CAN_IMPORT }, async (req, reply) => {
    const body = req.body as { branchId?: string; rows?: CommitRow[] };
    if (!body.branchId) throw badRequest('branchId requis');
    if (!body.rows || body.rows.length === 0) throw badRequest('Aucune ligne à importer');
    assertBranchAccess(req, body.branchId);

    const result = await commitImport(req.db!, req.auth!.tenantId, body.branchId, body.rows);
    await recordAudit({
      tenantId: req.auth!.tenantId,
      userId: req.auth!.userId,
      action: 'PRODUCTS_IMPORTED',
      entity: 'Product',
      metadata: { created: result.created, updated: result.updated, errorCount: result.errors.length },
      ...requestMeta(req),
    });
    return reply.send(result);
  });
}
