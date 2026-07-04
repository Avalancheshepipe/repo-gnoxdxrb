import { prisma } from "@/server/db";
import { enqueueEmail } from "@/server/queue/enqueue";
import { renderEmailJob } from "./render";
import { deliverMail } from "./transport";
import type { EmailJobPayload } from "./types";

export type QueueEmailOptions = {
  /** Skip queue and send inline (used by worker). */
  immediate?: boolean;
  logId?: string;
};

/** Queue an email for async delivery (or send immediately in the worker). */
export async function queueEmail(
  payload: EmailJobPayload,
  opts?: QueueEmailOptions,
): Promise<{ logId: string }> {
  const log = await prisma.emailLog.create({
    data: {
      organizationId: payload.organizationId ?? null,
      to: payload.to,
      subject: payload.subject,
      template: payload.template,
      status: opts?.immediate ? "sending" : "queued",
      metadata: { props: payload.props },
    },
  });

  if (opts?.immediate) {
    await processEmailJob({ ...payload, logId: log.id });
    return { logId: log.id };
  }

  await enqueueEmail({ ...payload, logId: log.id });
  return { logId: log.id };
}

/** Process a single email job (BullMQ worker entry point). */
export async function processEmailJob(
  payload: EmailJobPayload & { logId?: string },
): Promise<void> {
  const logId = payload.logId;
  try {
    const { html, text } = await renderEmailJob(payload);
    const result = await deliverMail({
      to: payload.to,
      subject: payload.subject,
      html,
      text,
    });

    if (!result.ok) {
      if (logId) {
        await prisma.emailLog.update({
          where: { id: logId },
          data: {
            status: "failed",
            error: result.message,
          },
        });
      }
      return;
    }

    if (logId) {
      await prisma.emailLog.update({
        where: { id: logId },
        data: {
          status: result.mode === "console" ? "logged" : "sent",
          sentAt: new Date(),
          error: result.mode === "console" ? "SMTP not configured (dev console log)" : null,
        },
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    if (logId) {
      await prisma.emailLog
        .update({
          where: { id: logId },
          data: { status: "failed", error: message },
        })
        .catch(() => undefined);
    }
    throw err;
  }
}

/** Send a custom (agent-approved) email immediately via queue. */
export async function sendCustomEmail(args: {
  organizationId: string;
  to: string;
  subject: string;
  bodyMarkdown: string;
  organizationName: string;
  linkUrl?: string;
  linkLabel?: string;
  locale?: "ru" | "en";
  userId?: string;
}): Promise<{ logId: string }> {
  const bodyHtml = markdownToSimpleHtml(args.bodyMarkdown);
  const result = await queueEmail({
    template: "custom-message",
    to: args.to,
    subject: args.subject,
    locale: args.locale ?? "ru",
    organizationId: args.organizationId,
    props: {
      organizationName: args.organizationName,
      subject: args.subject,
      bodyHtml,
      linkUrl: args.linkUrl,
      linkLabel: args.linkLabel,
    },
  });

  await prisma.activityLog
    .create({
      data: {
        organizationId: args.organizationId,
        userId: args.userId ?? null,
        type: "SYSTEM",
        actor: args.organizationName,
        action: "sent email",
        target: args.to,
        metadata: { subject: args.subject },
      },
    })
    .catch(() => undefined);

  return result;
}

function markdownToSimpleHtml(md: string): string {
  const escaped = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const withBreaks = p.replace(/\n/g, "<br/>");
      const linked = withBreaks.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" style="color:#4f46e5">$1</a>',
      );
      return `<p style="margin:0 0 12px;line-height:24px">${linked}</p>`;
    });
  return paragraphs.join("");
}
