import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { HttpError } from '../lib/http-error.js';
import { logger } from '../lib/logger.js';
import { isProd } from '../config/env.js';

export function errorHandler(
  error: FastifyError | Error,
  req: FastifyRequest,
  reply: FastifyReply,
): void {
  // Erreurs HTTP typées
  if (error instanceof HttpError) {
    reply.status(error.statusCode).send({
      error: { code: error.code, message: error.message, details: error.details },
    });
    return;
  }

  // Validation Zod
  if (error instanceof ZodError) {
    reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Données invalides',
        details: error.flatten(),
      },
    });
    return;
  }

  // Contraintes Prisma (ex : unique violation)
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = error.meta?.target;
      const targetStr = Array.isArray(target) ? target.join(',') : String(target ?? '');
      // Toujours tracé côté serveur avec le détail Postgres/Prisma complet
      // (contrainte, colonnes, requête) : un message utilisateur plus clair
      // ne doit jamais faire disparaître la trace technique nécessaire pour
      // diagnostiquer une VRAIE collision si elle se reproduit.
      logger.warn(
        { code: error.code, target, meta: error.meta, url: req.url, method: req.method },
        'Contrainte unique violée (P2002)',
      );
      // Message utilisateur précis quand la colonne en cause est connue,
      // au lieu du générique "Cette valeur existe déjà" pour les cas
      // fréquents identifiés (numéro de pièce, référence produit) — la
      // cause elle-même (numérotation non verrouillée) doit être corrigée
      // à la source, ce message ne fait qu'expliquer un résidu éventuel.
      const message = targetStr.includes('number')
        ? "Impossible de créer le document : son numéro vient d'être attribué à un autre document. Réessayez."
        : targetStr.includes('sku')
          ? 'Cette référence produit est déjà utilisée par un autre produit.'
          : 'Cette valeur existe déjà.';
      reply.status(409).send({
        error: { code: 'CONFLICT', message, details: { target } },
      });
      return;
    }
    if (error.code === 'P2025') {
      reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'Ressource introuvable' },
      });
      return;
    }
  }

  // Rate limit (plugin Fastify)
  const statusCode = (error as FastifyError).statusCode;
  if (statusCode === 429) {
    reply.status(429).send({
      error: { code: 'TOO_MANY_REQUESTS', message: 'Trop de requêtes, réessayez plus tard' },
    });
    return;
  }

  logger.error({ err: error, url: req.url, method: req.method }, 'Erreur non gérée');
  reply.status(500).send({
    error: {
      code: 'INTERNAL_ERROR',
      message: isProd ? 'Erreur interne du serveur' : error.message,
    },
  });
}
