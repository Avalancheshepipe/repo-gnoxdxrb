import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "@/server/trpc/trpc";
import { assertMember } from "@/server/trpc/util";

type StoredProposal = {
  id: string;
  kind: string;
  args: unknown;
  status?: "pending" | "accepted" | "declined" | "failed";
  note?: string;
  /** Task created/affected by this proposal (for opening its detail later). */
  taskId?: string;
  /** Project the task lives in (so opening can switch the active project). */
  projectId?: string;
};

export const chatRouter = router({
  /** Latest conversation thread for the current user + agent + messages. */
  history: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().min(1),
        agentId: z.string().min(1),
        taskId: z.string().min(1).nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId);
      const thread = await ctx.prisma.chatThread.findFirst({
        where: {
          organizationId: input.organizationId,
          userId: ctx.user.id,
          agentId: input.agentId,
          taskId: input.taskId ?? null,
        },
        orderBy: { updatedAt: "desc" },
        include: {
          messages: { orderBy: { createdAt: "asc" }, take: 100 },
        },
      });
      if (!thread) return { threadId: null, messages: [] };

      return {
        threadId: thread.id,
        messages: thread.messages
          .filter((m) => m.content?.trim())
          .map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            proposals: (Array.isArray(m.proposals)
              ? (m.proposals as unknown as StoredProposal[])
              : []) as StoredProposal[],
          })),
      };
    }),

  /**
   * The whole per-task conversation for the current user: messages from ALL the
   * task's agents merged into one timeline (each tagged with its agent), plus
   * the task's assigned agents. Powers the in-panel task chat thread. Autonomous
   * run results posted into these threads (see executeAgentRun) surface here too.
   */
  taskThread: protectedProcedure
    .input(
      z.object({
        organizationId: z.string().min(1),
        taskId: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId);
      const [task, threads] = await Promise.all([
        ctx.prisma.task.findFirst({
          where: { id: input.taskId, project: { organizationId: input.organizationId } },
          select: {
            assignees: {
              where: { agentId: { not: null } },
              select: { agent: { select: { id: true, name: true } } },
            },
          },
        }),
        ctx.prisma.chatThread.findMany({
          where: {
            organizationId: input.organizationId,
            userId: ctx.user.id,
            taskId: input.taskId,
          },
          include: {
            agent: { select: { id: true, name: true } },
            messages: { orderBy: { createdAt: "asc" }, take: 200 },
          },
        }),
      ]);

      const agents = (task?.assignees ?? [])
        .map((a) => a.agent)
        .filter((a): a is { id: string; name: string } => Boolean(a));

      const messages = threads
        .flatMap((thread) =>
          thread.messages
            .filter((m) => m.content?.trim())
            .map((m) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
              agentId: thread.agentId,
              agentName: thread.agent?.name ?? null,
              createdAt: m.createdAt,
              proposals: (Array.isArray(m.proposals)
                ? (m.proposals as unknown as StoredProposal[])
                : []) as StoredProposal[],
            })),
        )
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      return { agents, messages };
    }),

  /** Persist a proposal's resolution (accept/decline) for accurate memory. */
  resolveProposal: protectedProcedure
    .input(
      z.object({
        messageId: z.string().min(1),
        proposalId: z.string().min(1),
        status: z.enum(["accepted", "declined", "failed"]),
        note: z.string().max(500).optional(),
        taskId: z.string().optional(),
        projectId: z.string().optional(),
        /** Final (possibly edited-before-approve) proposal args to persist. */
        args: z.unknown().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const message = await ctx.prisma.chatMessage.findUnique({
        where: { id: input.messageId },
        include: { thread: { select: { userId: true } } },
      });
      if (!message || message.thread.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const proposals = (
        Array.isArray(message.proposals)
          ? (message.proposals as unknown as StoredProposal[])
          : []
      ).map((p) =>
        p.id === input.proposalId
          ? {
              ...p,
              status: input.status,
              note: input.note,
              taskId: input.taskId ?? p.taskId,
              projectId: input.projectId ?? p.projectId,
              args: input.args ?? p.args,
            }
          : p,
      );
      await ctx.prisma.chatMessage.update({
        where: { id: input.messageId },
        data: { proposals: JSON.parse(JSON.stringify(proposals)) },
      });
      return { ok: true };
    }),

  /** Start a fresh conversation (keeps old threads in history). */
  reset: protectedProcedure
    .input(z.object({ organizationId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await assertMember(ctx.user.id, input.organizationId);
      const thread = await ctx.prisma.chatThread.create({
        data: {
          organizationId: input.organizationId,
          userId: ctx.user.id,
          title: "New chat",
        },
      });
      return { threadId: thread.id };
    }),
});
