import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from './logger.js';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface Mailer {
  send(msg: MailMessage): Promise<void>;
  /** Vérifie la connexion SMTP (no-op pour le driver console). */
  verify(): Promise<void>;
}

/**
 * Adresse d'expédition alignée sur le compte SMTP authentifié. Avec Gmail (et la
 * plupart des relais), une adresse "From" d'un autre domaine échoue SPF/DKIM et
 * finit en spam — ou est réécrite. On garde donc le nom d'affichage de MAIL_FROM
 * mais on force l'adresse sur SMTP_USER pour une bonne délivrabilité.
 */
function resolveFrom(): string {
  const raw = (env.MAIL_FROM ?? '').trim();
  const user = (env.SMTP_USER ?? '').trim();
  if (!user) return raw || 'OculoSaaS <no-reply@oculosaas.com>';
  const nameMatch = raw.match(/^\s*"?([^"<]+?)"?\s*(?:<|$)/);
  const name = nameMatch && nameMatch[1] ? nameMatch[1].trim() : 'OculoSaaS';
  return `${name} <${user}>`;
}

/**
 * Driver de développement : n'envoie rien, journalise simplement le message
 * (et notamment les liens de réinitialisation) dans la console.
 */
class ConsoleMailer implements Mailer {
  async send(msg: MailMessage): Promise<void> {
    logger.info(
      { to: msg.to, subject: msg.subject },
      `📧 [ConsoleMailer] Email simulé\n--- ${msg.subject} ---\n${msg.text ?? msg.html}\n---`,
    );
  }

  async verify(): Promise<void> {
    logger.info('✉️  Mailer : mode console (aucun email réel ne sera envoyé). Définissez MAIL_DRIVER=smtp en production.');
  }
}

/** Driver SMTP (production). Branché dès que MAIL_DRIVER=smtp. */
class SmtpMailer implements Mailer {
  private transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });

  private from = resolveFrom();

  async send(msg: MailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    });
  }

  async verify(): Promise<void> {
    await this.transport.verify();
  }
}

export const mailer: Mailer = env.MAIL_DRIVER === 'smtp' ? new SmtpMailer() : new ConsoleMailer();

/**
 * Vérifie la configuration email au démarrage (non bloquant) : rend visible dans
 * les logs une mauvaise configuration SMTP (identifiants erronés, hôte injoignable)
 * — cause n°1 des « emails jamais reçus » — sans faire échouer le boot.
 */
export async function verifyMailerConnection(): Promise<void> {
  try {
    await mailer.verify();
    if (env.MAIL_DRIVER === 'smtp') {
      logger.info({ host: env.SMTP_HOST, from: resolveFrom() }, '✉️  Mailer SMTP : connexion OK');
    }
  } catch (err) {
    logger.error(
      { err, host: env.SMTP_HOST, user: env.SMTP_USER },
      '✉️  Mailer SMTP : échec de connexion — vérifiez SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASSWORD',
    );
  }
}
