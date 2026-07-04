import nodemailer from "nodemailer";
import type Transporter from "nodemailer/lib/mailer";
import { env, isSmtpConfigured } from "@/server/env";

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  if (!isSmtpConfigured()) {
    transporter = null;
    return null;
  }
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
  });
  return transporter;
}

export type SendMailArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
};

export type SendMailResult =
  | { ok: true; mode: "smtp"; messageId?: string }
  | { ok: true; mode: "console"; message: string }
  | { ok: false; mode: "unconfigured"; message: string };

/** Deliver mail via SMTP or log to console when SMTP is not configured. */
export async function deliverMail(args: SendMailArgs): Promise<SendMailResult> {
  const from = args.from ?? env.SMTP_FROM ?? "Julow <noreply@localhost>";
  const transport = getTransporter();

  if (!transport) {
    const banner = `[julow:email] SMTP not configured — logging email instead of sending`;
    const body = [
      banner,
      `To: ${args.to}`,
      `From: ${from}`,
      `Subject: ${args.subject}`,
      "─".repeat(60),
      args.text,
      "─".repeat(60),
      "(HTML body omitted in console — see worker logs or configure SMTP)",
    ].join("\n");
    console.log(body);
    if (env.isProd) {
      return {
        ok: false,
        mode: "unconfigured",
        message: "SMTP is not configured",
      };
    }
    return { ok: true, mode: "console", message: banner };
  }

  const info = await transport.sendMail({
    from,
    to: args.to,
    subject: args.subject,
    html: args.html,
    text: args.text,
  });
  return { ok: true, mode: "smtp", messageId: info.messageId };
}
