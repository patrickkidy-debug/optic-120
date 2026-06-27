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
}

/**
 * Driver SMTP (production). Chargé dynamiquement pour ne pas imposer
 * `nodemailer` en développement. Branché dès que MAIL_DRIVER=smtp.
 */
class SmtpMailer implements Mailer {
  async send(msg: MailMessage): Promise<void> {
    // Import indirect : `nodemailer` reste une dépendance optionnelle (prod uniquement).
    const moduleName = 'nodemailer';
    const nodemailer = (await import(moduleName)) as {
      createTransport: (opts: unknown) => { sendMail: (m: unknown) => Promise<unknown> };
    };
    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    });
    await transport.sendMail({
      from: env.MAIL_FROM,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    });
  }
}

export const mailer: Mailer = env.MAIL_DRIVER === 'smtp' ? new SmtpMailer() : new ConsoleMailer();
