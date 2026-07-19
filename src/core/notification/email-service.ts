import nodemailer, { type Transporter } from "nodemailer";

import * as userRepository from "@/core/user/user-repository";

const globalForMailer = globalThis as unknown as {
  mailTransporter: Transporter | undefined;
};

/**
 * Lazy singleton, same shape as the `prisma` singleton in lib/db.ts. Returns
 * null (rather than constructing a transporter that would just fail to
 * connect) until SMTP_HOST is actually configured — the user hasn't put
 * real credentials in .env yet by design (see plan), and this app has no
 * other integration that needs external credentials it doesn't already
 * have, so "gracefully do nothing until configured" has no other precedent
 * to match beyond the general best-effort-notification philosophy.
 */
function getTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  if (globalForMailer.mailTransporter) return globalForMailer.mailTransporter;

  const port = Number(process.env.SMTP_PORT ?? 587);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });

  if (process.env.NODE_ENV !== "production") {
    globalForMailer.mailTransporter = transporter;
  }
  return transporter;
}

/**
 * Best-effort at the transport level too: SMTP_HOST unset logs to console
 * and returns instead of throwing, so every caller can treat this exactly
 * like the rest of this app's notification calls — safe to await without a
 * try/catch of its own for the "not configured yet" case (real send
 * failures still throw, callers wrap those the same way they already wrap
 * notificationRepository.createNotification failures).
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) {
    console.log(
      `[email-service] SMTP_HOST not configured, skipping send. To: ${params.to} | Subject: ${params.subject}`
    );
    return;
  }
  await transporter.sendMail({
    // Defaults to the real info@ mailbox: GoDaddy (and most providers) reject
    // a From address that isn't the authenticated mailbox, so falling back to
    // a non-existent noreply@ would bounce. Override with SMTP_FROM if needed.
    from: process.env.SMTP_FROM ?? "Logigo <info@logigotr.com>",
    to: params.to,
    subject: params.subject,
    text: params.text,
  });
}

/**
 * Emails every active user at a company. Each recipient is sent
 * independently with its own catch — one bad address (or one user's mail
 * server rejecting the message) never blocks the rest of the company.
 */
export async function sendEmailToCompany(
  companyId: string,
  subject: string,
  text: string
): Promise<void> {
  const users = await userRepository.listActiveUserEmails(companyId);
  await Promise.all(
    users.map((user) =>
      sendEmail({ to: user.email, subject, text }).catch((error) => {
        console.error(`E-posta gönderilemedi (${user.email}):`, error);
      })
    )
  );
}
