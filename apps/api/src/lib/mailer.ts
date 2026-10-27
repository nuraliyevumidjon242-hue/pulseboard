import nodemailer, { type Transporter } from 'nodemailer';
import { env, isTest } from '../config/env';
import { logger } from './logger';

let transporter: Transporter | null = null;
let usingJsonTransport = false;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  if (env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  } else {
    usingJsonTransport = true;
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }

  return transporter;
}

interface MailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendMail(input: MailInput): Promise<void> {
  if (isTest) return;
  try {
    const info = await getTransporter().sendMail({ from: env.MAIL_FROM, ...input });
    if (usingJsonTransport) {
      logger.info({ to: input.to, subject: input.subject }, 'Email (dev transport) — not sent');
      logger.debug({ preview: info.message?.toString() }, 'Email preview');
    } else {
      logger.info({ to: input.to, subject: input.subject }, 'Email sent');
    }
  } catch (error) {
    logger.error({ err: error, to: input.to }, 'Failed to send email');
  }
}

export const sendPasswordResetEmail = (to: string, resetUrl: string): Promise<void> =>
  sendMail({
    to,
    subject: 'Reset your PulseBoard password',
    text: `We received a request to reset your PulseBoard password.\n\nReset it here (valid for 1 hour):\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`,
    html: `<p>We received a request to reset your PulseBoard password.</p><p><a href="${resetUrl}">Reset your password</a> — the link is valid for 1 hour.</p><p>If you did not request this, you can safely ignore this email.</p>`,
  });

export const sendInvitationEmail = (
  to: string,
  storeName: string,
  role: string,
  inviteUrl: string,
): Promise<void> =>
  sendMail({
    to,
    subject: `You have been invited to ${storeName} on PulseBoard`,
    text: `You have been invited to join ${storeName} as ${role}.\n\nAccept the invitation:\n${inviteUrl}\n\nThe link expires in 7 days.`,
    html: `<p>You have been invited to join <strong>${storeName}</strong> as <strong>${role}</strong> on PulseBoard.</p><p><a href="${inviteUrl}">Accept invitation</a> — expires in 7 days.</p>`,
  });

export const sendLowStockEmail = (
  to: string,
  storeName: string,
  products: Array<{ name: string; currentStock: number; minStock: number }>,
): Promise<void> => {
  const lines = products
    .map((product) => `• ${product.name}: ${product.currentStock} left (min ${product.minStock})`)
    .join('\n');
  return sendMail({
    to,
    subject: `Low stock alert — ${storeName}`,
    text: `The following products are below their minimum stock level:\n\n${lines}\n\nReplenish them to keep sales running.`,
    html: `<p>The following products are below their minimum stock level:</p><ul>${products
      .map(
        (product) =>
          `<li><strong>${product.name}</strong>: ${product.currentStock} left (min ${product.minStock})</li>`,
      )
      .join('')}</ul>`,
  });
};
