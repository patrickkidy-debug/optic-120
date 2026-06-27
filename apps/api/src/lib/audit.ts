import type { FastifyRequest } from 'fastify';
import { prisma } from './prisma.js';
import { logger } from './logger.js';

export interface AuditInput {
  tenantId: string;
  userId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Écrit une entrée dans le journal d'audit. Utilise le client système (l'audit
 * porte déjà son tenantId explicitement). N'échoue jamais l'opération métier :
 * une erreur d'écriture d'audit est seulement journalisée.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        metadata: input.metadata ? (input.metadata as object) : undefined,
      },
    });
  } catch (err) {
    logger.error({ err, action: input.action }, "Échec d'écriture du journal d'audit");
  }
}

export function requestMeta(req: FastifyRequest): { ipAddress: string; userAgent: string } {
  return {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] ?? 'unknown',
  };
}
