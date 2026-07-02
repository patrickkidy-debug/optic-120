import { prisma } from './prisma.js';
import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * Emails autorisés à la console plateforme (cross-tenant) : la liste env
 * PLATFORM_ADMIN_EMAILS sert de bootstrap (toujours valide, même base vide) et
 * la table PlatformOperator permet d'ajouter l'équipe depuis la console, sans
 * dépendre d'un redéploiement. Le cache (rafraîchi en tâche de fond, lecture
 * synchrone) évite d'ajouter une requête DB sur le chemin chaud de chaque
 * requête authentifiée.
 */
/**
 * Fondateur du SaaS : toujours opérateur plateforme et sans aucune restriction
 * (console fondateur, exemption d'abonnement, toutes permissions). Codé en dur
 * pour garantir son accès quelle que soit la configuration.
 */
export const FOUNDER_EMAILS = ['patrickkidy@gmail.com'];

function envEmails(): string[] {
  return env.PLATFORM_ADMIN_EMAILS.split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

let dbEmails: string[] = [];

async function refresh(): Promise<void> {
  try {
    const rows = await prisma.platformOperator.findMany({ select: { email: true } });
    dbEmails = rows.map((r) => r.email.toLowerCase());
  } catch (err) {
    logger.warn({ err }, 'Rafraîchissement des opérateurs plateforme échoué');
  }
}

void refresh();
const interval = setInterval(refresh, 30_000);
interval.unref?.();

export function getOperatorEmails(): Set<string> {
  return new Set([...FOUNDER_EMAILS, ...envEmails(), ...dbEmails]);
}

export function isOperatorEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getOperatorEmails().has(email.toLowerCase());
}

/** Le fondateur du SaaS : accès total, sans aucune restriction. */
export function isFounderEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return FOUNDER_EMAILS.includes(email.toLowerCase());
}

/** À appeler juste après un ajout/suppression pour refléter le changement sans attendre le TTL. */
export function invalidateOperatorCache(): void {
  void refresh();
}

/** Emails ajoutés via la console (gérables) — distincts du bootstrap env (lecture seule). */
export function isEnvOperator(email: string): boolean {
  return envEmails().includes(email.toLowerCase());
}
