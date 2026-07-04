import { z } from "zod";
import {
  executeCreateDocument,
  executeReport,
  executeResearch,
  executeReviewTask,
  executeValidateTask,
  type ActionContext,
} from "@/server/ai/actions";
import { assertWithinBudget } from "@/server/ai/run";
import { handleFromEmail } from "@/lib/mentions";
import { sendCustomEmail } from "@/server/mail/send";
import { prisma } from "@/server/db";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { assertMember } from "@/server/trpc/util";

// Runs approval-gated agent actions (the chat proposals) using the SAME core
// as the autonomous worker tools. Org membership gates access; every action is
// internally scoped to the organization.
async function buildContext(
  organizationId: string,
  agentId: string | undefined,
  projectId: string | undefined,
): Promise<ActionContext> {
  let agentName = "Agent";
  if (agentId) {
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, organizationId },
      select: { name: true },
    });
    if (agent) agentName = agent.name;
  }
  return { organizationId, agentId: agentId ?? null, agentName, projectId };
}

/** Resolve a workspace member by @handle, name, or email (humans only). */
async function resolveMemberEmail(
  organizationId: string,
  recipient: string,
): Promise<{ email: string; name: string } | null> {
  const needle = recipient.trim().replace(/^@/, "").toLowerCase();
  const members = await prisma.member.findMany({
    where: { organizationId },
    include: { user: { select: { name: true, email: true } } },
  });
  for (const m of members) {
    const email = m.user.email.toLowerCase();
    const name = (m.user.name ?? m.user.email).toLowerCase();
    const handle = handleFromEmail(m.user.email).toLowerCase();
    if (
      email === needle ||
      name === needle ||
      handle === needle ||
      name.includes(needle) ||
      email.startsWith(needle)
    ) {
      return { email: m.user.email, name: m.user.name ?? m.user.email };
    }
  }
  return null;
}

const docContent = {
  sections: z
    .array(
      z.object({
        heading: z.string().optional(),
        paragraphs: z.array(z.string()).optional(),
        bullets: z.array(z.string()).optional(),
      }),
    )
    .optional(),
  sheet: z
    .object({
      columns: z.array(z.string()),
      rows: z.array(z.array(z.union([z.string(), z.number()]))),
    })
    .optional(),
};

export const agentActionRouter = router({
  research: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().min(1),
        agentId: z.string().optional(),
        projectId: z.string().optional(),
        query: z.string().min(1).max(300),
        maxResults: z.number().int().min(1).max(8).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId);
      await assertWithinBudget(input.organizationId);
      const c = await buildContext(input.organizationId, input.agentId, input.projectId);
      return executeResearch(c, {
        query: input.query,
        maxResults: input.maxResults,
        save: true,
      });
    }),

  createDocument: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().min(1),
        agentId: z.string().optional(),
        projectId: z.string().optional(),
        format: z.enum(["word", "excel", "pdf"]),
        title: z.string().min(1).max(160),
        taskId: z.string().optional(),
        ...docContent,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId);
      const c = await buildContext(input.organizationId, input.agentId, input.projectId);
      return executeCreateDocument(c, {
        format: input.format,
        title: input.title,
        content: { sections: input.sections, sheet: input.sheet },
        taskId: input.taskId,
      });
    }),

  report: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().min(1),
        agentId: z.string().optional(),
        projectId: z.string().optional(),
        title: z.string().max(160).optional(),
        format: z.enum(["markdown", "excel"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId);
      const c = await buildContext(input.organizationId, input.agentId, input.projectId);
      return executeReport(c, { title: input.title, format: input.format });
    }),

  review: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().min(1),
        agentId: z.string().optional(),
        taskId: z.string().min(1),
        criteria: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId);
      await assertWithinBudget(input.organizationId);
      const c = await buildContext(input.organizationId, input.agentId, undefined);
      return executeReviewTask(c, { taskId: input.taskId, criteria: input.criteria });
    }),

  validate: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().min(1),
        agentId: z.string().optional(),
        taskId: z.string().min(1),
        criteria: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId);
      await assertWithinBudget(input.organizationId);
      const c = await buildContext(input.organizationId, input.agentId, undefined);
      return executeValidateTask(c, { taskId: input.taskId, criteria: input.criteria });
    }),

  sendEmail: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().min(1),
        recipient: z.string().min(1),
        subject: z.string().min(1).max(200),
        body: z.string().min(1).max(8000),
        linkUrl: z.string().url().optional(),
        linkLabel: z.string().max(120).optional(),
        locale: z.enum(["ru", "en"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId);
      const member = await resolveMemberEmail(input.organizationId, input.recipient);
      if (!member) {
        return { ok: false as const, error: `No member matched "${input.recipient}"` };
      }
      const org = await prisma.organization.findUnique({
        where: { id: input.organizationId },
        select: { name: true },
      });
      const { logId } = await sendCustomEmail({
        organizationId: input.organizationId,
        to: member.email,
        subject: input.subject,
        bodyMarkdown: input.body,
        organizationName: org?.name ?? "Julow",
        linkUrl: input.linkUrl,
        linkLabel: input.linkLabel,
        locale: input.locale ?? "ru",
        userId: ctx.user.id,
      });
      return { ok: true as const, to: member.email, name: member.name, logId };
    }),
});
